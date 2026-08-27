/**
 * The constraint layer. Pure, side-effect free, no UI: given a shipment and a remedy, say
 * whether it's available or which rule blocks it. Everything else in this module (cost,
 * recovered time, the cheapest-available recommendation) is built on top of that one
 * predicate and stays just as pure.
 *
 * Three remedies exist for a house shipment caught on a cancelled flight:
 *  - rebook:     same carrier, next scheduled (passenger-belly) service, tomorrow morning. Free.
 *  - competitor: a competitor's freighter tonight, at spot rate. Cargo aircraft — no belly
 *                constraints — but switching carriers costs money and has a cutoff.
 *  - truck:      trucked to another gateway and flown from there. Not belly-constrained either,
 *                but it is itself a reroute, and it takes longer than the other two.
 */
import type {
  BlockedAlternative, CustomsStatus, RemedyId, RemedyRule, Shipment, ScreeningStatus,
} from './types';

export const REMEDIES: RemedyId[] = ['rebook', 'competitor', 'truck'];

// A truck-and-fly route's total transit time, in hours — the figure an active container's
// endurance clock is measured against. Fixed, not derived from any shipment: the route itself
// doesn't change shipment to shipment, only whether a given container can survive it.
const TRUCK_ROUTE_HOURS = 30;

// "The time it recovers" for each remedy, relative to a disrupted shipment doing nothing and
// waiting for the next available capacity (assumed ~48h out). Fixed per remedy, matching the
// design table's own language ("about 18 hours", "tonight", "one day instead of two") rather
// than varying per shipment.
const REBOOK_RECOVERED_HOURS = 30;     // delay limited to ~18h -> 48 - 18
const COMPETITOR_RECOVERED_HOURS = 44; // flies out tonight -> 48 - ~4
const TRUCK_RECOVERED_HOURS = 24;      // one day instead of two -> 48 - 24

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
    description: "This active container's endurance clock is shorter than a truck-and-fly route.",
  },
  pharmaLaneSignoffRequired: {
    id: 'pharma-lane-signoff-required',
    description: 'This pharma lane qualification does not cover an unplanned reroute without sign-off.',
  },
  customsAcdCutoff: {
    id: 'customs-acd-cutoff',
    description: 'Advance cargo data must be filed against the new carrier before it loads, and this shipment is not yet customs-released ahead of that cutoff.',
  },
} as const satisfies Record<string, RemedyRule>;

export type RemedyAvailability =
  | { status: 'available' }
  | { status: 'blocked'; rule: RemedyRule };

const AVAILABLE: RemedyAvailability = { status: 'available' };
const blockedBy = (rule: RemedyRule): RemedyAvailability => ({ status: 'blocked', rule });

/** The heart of it: given a shipment and a remedy, is it available, or blocked and by what. */
export function checkRemedy(s: Shipment, remedy: RemedyId): RemedyAvailability {
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
  if (s.activeTempControl && s.tempEnduranceHours < TRUCK_ROUTE_HOURS) {
    return blockedBy(RULES.activeTempEnduranceWindow);
  }
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
  if (remedy === 'rebook') return REBOOK_RECOVERED_HOURS;
  if (remedy === 'competitor') return COMPETITOR_RECOVERED_HOURS;
  return TRUCK_RECOVERED_HOURS;
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
