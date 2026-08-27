/**
 * The constraint layer. Pure, side-effect free, no UI: given a shipment and a remedy, say
 * whether it's available or which rule blocks it. Everything else in this module (cost,
 * recovered time, the cheapest-available recommendation) is built on top of that one
 * predicate and stays just as pure.
 *
 * Three remedies exist for a house shipment caught on a cancelled flight out of Frankfurt:
 *  - rebook:     same carrier, next scheduled (passenger-belly) service, tomorrow morning. Free.
 *  - competitor: a competitor's freighter tonight, at spot rate. Cargo aircraft — no belly
 *                constraints — but switching carriers costs money and has a cutoff.
 *  - truck:      trucked to the alternative European gateway and flown from there. Not
 *                belly-constrained either, but it is itself a reroute and the slowest of the
 *                three.
 */
import type {
  BlockedAlternative, CustomsStatus, RemedyId, RemedyRule, Shipment, ScreeningStatus,
} from './types';

export const REMEDIES: RemedyId[] = ['rebook', 'competitor', 'truck'];

// What doing nothing costs: the next capacity this shipment could ride out of the gateway is
// about two days away. Every remedy's recovered time is measured against this.
const DO_NOTHING_HOURS = 48;

/**
 * How long each remedy takes to get the freight moving and landed, in hours. One number per
 * remedy, and the only time figure in this module — "the time it recovers" is derived from it
 * (DO_NOTHING_HOURS minus this), and so is whether an active container's endurance clock
 * outlasts it. A single source for both is what stops a remedy from claiming to recover a day
 * while being measured against a different, longer route elsewhere in the file.
 *
 * Fixed per remedy, matching the design table's own language ("about 18 hours", "tonight",
 * "one day instead of two"), rather than varying per shipment.
 */
const TRANSIT_HOURS: Record<RemedyId, number> = {
  rebook: 18,     // tomorrow morning's belly service
  competitor: 4,  // a freighter leaving tonight
  truck: 24,      // road to the alternative gateway, then the air leg from there
};

// Competitor freighter: a spot-rate premium over the contracted rate, per kilo.
const COMPETITOR_RATE_DELTA_PER_KG = 2.35;
// Truck-and-fly: this shipment's share of one shared truck, plus a reroute surcharge per kilo.
const TRUCK_SHARED_COST_SHARE = 180;
const TRUCK_SURCHARGE_PER_KG = 0.4;

export const RULES = {
  lithiumCargoAircraftOnly: {
    id: 'lithium-cargo-aircraft-only',
    description: 'Standalone lithium-ion batteries are cargo-aircraft-only, so this cannot go on a passenger belly flight.',
  },
  oversizeMainDeckOnly: {
    id: 'oversize-main-deck-only',
    description: 'This piece was built for a main deck and does not fit a belly hold.',
  },
  screeningNotCleared: {
    id: 'screening-not-cleared',
    description: 'This cargo is not screened to passenger standard, so it cannot take a belly flight until re-screened.',
  },
  activeTempEnduranceWindow: {
    id: 'active-temp-endurance-window',
    description: "This active container's endurance clock runs out before this option would land the shipment.",
  },
  pharmaLaneSignoffRequired: {
    id: 'pharma-lane-signoff-required',
    description: 'This pharma lane qualification does not cover an unplanned reroute without sign-off.',
  },
  customsAcdCutoff: {
    id: 'customs-acd-cutoff',
    description: 'Advance cargo data must be filed with United States customs against the new carrier before it loads, and this shipment is not yet released ahead of that cutoff.',
  },
} as const satisfies Record<string, RemedyRule>;

export type RemedyAvailability =
  | { status: 'available' }
  | { status: 'blocked'; rule: RemedyRule };

const AVAILABLE: RemedyAvailability = { status: 'available' };
const blockedBy = (rule: RemedyRule): RemedyAvailability => ({ status: 'blocked', rule });

/** The heart of it: given a shipment and a remedy, is it available, or blocked and by what. */
export function checkRemedy(s: Shipment, remedy: RemedyId): RemedyAvailability {
  // Checked first and against every remedy, not just the road one. An active container holds
  // temperature for a fixed number of hours; any option that lands later than that has already
  // spoiled the freight, whichever aircraft it was going to ride. This is the one constraint
  // that can rule out the *cheap* option and leave only the fast one — a shipment whose clock
  // expires before tomorrow morning cannot take the free rebook no matter what else is true
  // of it, and if the clock is shorter than the road route either, the freighter tonight is
  // all that is left.
  if (s.activeTempControl && s.tempEnduranceHours < TRANSIT_HOURS[remedy]) {
    return blockedBy(RULES.activeTempEnduranceWindow);
  }
  if (remedy === 'rebook') {
    if (s.lithiumBattery) return blockedBy(RULES.lithiumCargoAircraftOnly);
    if (s.oversizeMainDeckOnly) return blockedBy(RULES.oversizeMainDeckOnly);
    if (isNotCleared(s.screeningStatus)) return blockedBy(RULES.screeningNotCleared);
    return AVAILABLE;
  }
  if (remedy === 'competitor') {
    if (s.pharmaQualifiedLane) return blockedBy(RULES.pharmaLaneSignoffRequired);
    if (isNotReleased(s.customsStatus)) return blockedBy(RULES.customsAcdCutoff);
    return AVAILABLE;
  }
  // truck
  if (s.pharmaQualifiedLane) return blockedBy(RULES.pharmaLaneSignoffRequired);
  return AVAILABLE;
}

function isNotCleared(status: ScreeningStatus): boolean {
  return status !== 'cleared';
}
function isNotReleased(status: CustomsStatus): boolean {
  return status !== 'released';
}

export function remedyCost(s: Shipment, remedy: RemedyId): number {
  if (remedy === 'rebook') return 0;
  if (remedy === 'competitor') return Math.round(s.weightKg * COMPETITOR_RATE_DELTA_PER_KG);
  return Math.round(TRUCK_SHARED_COST_SHARE + s.weightKg * TRUCK_SURCHARGE_PER_KG);
}

export function remedyRecoveredHours(remedy: RemedyId): number {
  return DO_NOTHING_HOURS - TRANSIT_HOURS[remedy];
}

/** Every remedy other than `chosen` that is blocked for this shipment, with its rule. */
export function blockedAlternatives(s: Shipment, chosen: RemedyId): BlockedAlternative[] {
  const out: BlockedAlternative[] = [];
  for (const remedy of REMEDIES) {
    if (remedy === chosen) continue;
    const check = checkRemedy(s, remedy);
    if (check.status === 'blocked') {
      out.push({ remedy, ruleId: check.rule.id, rule: check.rule.description });
    }
  }
  return out;
}

export interface RemedyEvaluation {
  remedy: RemedyId;
  available: boolean;
  cost: number;
  recoveredHours: number;
  blockedBy: RemedyRule | null;
}

/** The full landscape for one shipment — what a human (or an agent deciding what to ask for)
 *  needs to see before picking a remedy. Pure and read-only; used by the read tool. */
export function evaluateAllRemedies(s: Shipment): RemedyEvaluation[] {
  return REMEDIES.map(remedy => {
    const check = checkRemedy(s, remedy);
    return {
      remedy,
      available: check.status === 'available',
      cost: remedyCost(s, remedy),
      recoveredHours: remedyRecoveredHours(remedy),
      blockedBy: check.status === 'blocked' ? check.rule : null,
    };
  });
}

export interface RemedyRecommendation {
  remedy: RemedyId;
  cost: number;
  recoveredHours: number;
  blocked: BlockedAlternative[];
}

/**
 * The cheapest available remedy, tie-broken by whichever recovers more time, then by a fixed
 * preference order — never by anything that varies between the preview run and the commit run.
 * Returns null when every remedy is blocked: the shipment needs a human to escalate it by hand,
 * which the caller reports as a domain skip rather than guessing.
 */
export function recommendRemedy(s: Shipment): RemedyRecommendation | null {
  const available = REMEDIES.filter(remedy => checkRemedy(s, remedy).status === 'available');
  if (available.length === 0) return null;

  const ranked = available
    .map(remedy => ({ remedy, cost: remedyCost(s, remedy), recoveredHours: remedyRecoveredHours(remedy) }))
    .sort((a, b) =>
      a.cost - b.cost ||
      b.recoveredHours - a.recoveredHours ||
      REMEDIES.indexOf(a.remedy) - REMEDIES.indexOf(b.remedy));

  const chosen = ranked[0];
  return { ...chosen, blocked: blockedAlternatives(s, chosen.remedy) };
}
