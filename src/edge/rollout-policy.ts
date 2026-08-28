/**
 * The constraint layer. Pure, side-effect free, no UI: given a point of presence, a release and
 * a rollout mode, say whether it is open or which rule closes it. Everything else in this module
 * (exposure, convergence time, the recommendation) is built on that one predicate and stays just
 * as pure.
 *
 * Three ways a release can reach a site:
 *  - immediate: every node takes it at once. Four minutes to converge, and the site's whole
 *               traffic share is serving unproven config for those four minutes.
 *  - staged:    one node in ten takes it, the rest wait out a hold. Forty-five minutes, and a
 *               tenth of the site's traffic share is exposed while the hold runs.
 *  - shadow:    every node evaluates the release alongside the live one and serves neither
 *               answer from it. Nothing is exposed, and nothing is delivered either — it sits
 *               until a human promotes it, which is why it is the last resort rather than the
 *               default.
 *
 * The rules are written like lint rules — a stable id and one sentence — because that is how
 * they reach the agent. A blocked site comes back in `rejected` naming the id, so the agent's
 * follow-up call can be a different, narrower one instead of the same call again.
 */
import type { BlockedMode, Pop, Release, RolloutMode, RolloutRule } from './types';

/**
 * Ordered by caution, and the recommendation walks it in this order. `shadow` is last rather
 * than first despite exposing nothing: a mode that never serves the release has not rolled it
 * out, so it is where you land when neither delivering mode is open, never where you start.
 */
export const MODES: RolloutMode[] = ['staged', 'immediate', 'shadow'];

/** Minutes until the whole site is serving the release. Shadow never gets there on its own:
 *  a day is the next promotion window, which is what a human would actually wait for. */
const CONVERGE_MINUTES: Record<RolloutMode, number> = {
  immediate: 4,
  staged: 45,
  shadow: 1440,
};

/** Share of the site's own traffic serving the release while the rollout is in flight. */
const EXPOSED_FRACTION: Record<RolloutMode, number> = {
  immediate: 1,
  staged: 0.1,
  shadow: 0,
};

/** At or above this share of production traffic, a site is a flagship and never takes a release
 *  all at once. Five of the thirty-six sites are above it. */
const FLAGSHIP_TRAFFIC_PCT = 5;

/** At or above this utilisation there is no headroom to evaluate a second config alongside the
 *  live one, so shadow is off as well. */
const SHADOW_HEADROOM_CEILING_PCT = 85;

/** A site running a release cut before this must take an intermediate one in stages. */
export const COMPAT_FLOOR = '2026.07.01';

/** The date part of a release id, for the one comparison this module makes. */
const cutOf = (version: string) => version.slice(0, 10);

export const RULES = {
  changeFreezeWindow: {
    id: 'change-freeze-window',
    description: 'A change freeze is in effect at this site, so nothing may begin serving a new release here; a shadow evaluation is still allowed.',
  },
  incidentInProgress: {
    id: 'incident-in-progress',
    description: 'An incident is open and being worked at this site; a config change now would land in the middle of someone else’s timeline.',
  },
  drainedForMaintenance: {
    id: 'drained-for-maintenance',
    description: 'This site is drained for maintenance, so a push would land on nodes that are out of rotation and be lost when they return.',
  },
  releaseNotSoaked: {
    id: 'release-not-soaked',
    description: 'This release has not yet carried production traffic on a canary site, so it cannot serve traffic here.',
  },
  flagshipRequiresStage: {
    id: 'flagship-requires-stage',
    description: 'This site carries a large enough share of production traffic that a release reaches it in stages, never on every node at once.',
  },
  singleNodeNoSlice: {
    id: 'single-node-no-slice',
    description: 'There is one node here, so there is no tenth of the fleet to hold back and no staged rollout to run.',
  },
  noHeadroomForShadow: {
    id: 'no-headroom-for-shadow',
    description: 'Utilisation here leaves no headroom to evaluate a second config alongside the live one.',
  },
  versionSkewFloor: {
    id: 'version-skew-floor',
    description: 'The release running here predates the compatibility floor, so this site has to take the new one in stages rather than in one step.',
  },
} as const satisfies Record<string, RolloutRule>;

export type ModeAvailability =
  | { status: 'open' }
  | { status: 'blocked'; rule: RolloutRule };

const OPEN: ModeAvailability = { status: 'open' };
const blockedBy = (rule: RolloutRule): ModeAvailability => ({ status: 'blocked', rule });

/**
 * The heart of it. Checked in a fixed order so the reason a site is closed is always the same
 * reason, whichever mode was asked about first: the three that close a site entirely come before
 * the ones that only narrow it.
 */
export function checkMode(p: Pop, release: Release, mode: RolloutMode): ModeAvailability {
  // Closed to everything, in the order an operator would say them out loud.
  if (p.drained) return blockedBy(RULES.drainedForMaintenance);
  if (p.incidentId !== null) return blockedBy(RULES.incidentInProgress);

  if (mode === 'shadow') {
    return p.utilisationPct >= SHADOW_HEADROOM_CEILING_PCT
      ? blockedBy(RULES.noHeadroomForShadow)
      : OPEN;
  }

  // Both delivering modes put the release in front of real traffic, so both are closed by a
  // freeze and by a release nothing has carried yet.
  if (p.freezeUntil !== null) return blockedBy(RULES.changeFreezeWindow);
  if (release.soakedOn === null && !p.canary) return blockedBy(RULES.releaseNotSoaked);

  if (mode === 'immediate') {
    if (p.trafficPct >= FLAGSHIP_TRAFFIC_PCT) return blockedBy(RULES.flagshipRequiresStage);
    if (cutOf(p.configVersion) < COMPAT_FLOOR) return blockedBy(RULES.versionSkewFloor);
    return OPEN;
  }

  // staged
  return p.nodes < 2 ? blockedBy(RULES.singleNodeNoSlice) : OPEN;
}

/** Share of *production* traffic serving the release at this site while the rollout is in
 *  flight — the site's own share scaled by how much of its fleet has taken it. */
export function exposedPct(p: Pop, mode: RolloutMode): number {
  return Math.round(p.trafficPct * EXPOSED_FRACTION[mode] * 100) / 100;
}

export function convergeMinutes(mode: RolloutMode): number {
  return CONVERGE_MINUTES[mode];
}

/** Every mode other than `chosen` that is closed for this site, with the rule that closed it. */
export function blockedModes(p: Pop, release: Release, chosen: RolloutMode): BlockedMode[] {
  const out: BlockedMode[] = [];
  for (const mode of MODES) {
    if (mode === chosen) continue;
    const check = checkMode(p, release, mode);
    if (check.status === 'blocked') {
      out.push({ mode, ruleId: check.rule.id, rule: check.rule.description });
    }
  }
  return out;
}

export interface ModeEvaluation {
  mode: RolloutMode;
  open: boolean;
  exposedPct: number;
  convergeMinutes: number;
  blockedBy: RolloutRule | null;
}

/** The whole landscape for one site — what a human, or an agent deciding what to ask for, needs
 *  before naming a mode. Pure and read-only; used by the read tool. */
export function evaluateAllModes(p: Pop, release: Release): ModeEvaluation[] {
  return MODES.map(mode => {
    const check = checkMode(p, release, mode);
    return {
      mode,
      open: check.status === 'open',
      exposedPct: exposedPct(p, mode),
      convergeMinutes: convergeMinutes(mode),
      blockedBy: check.status === 'blocked' ? check.rule : null,
    };
  });
}

/**
 * The distinct rules closing *every* mode at a site, in the order the modes are walked and with
 * duplicates dropped — one rule usually closes all three.
 *
 * This exists so a site with nowhere to go still comes back naming names. Without it the only
 * thing the agent hears is "this needs a person", which is true and useless: it cannot tell a
 * frozen site from one with an incident open, and its follow-up call would be the same call.
 */
export function closingRules(p: Pop, release: Release): RolloutRule[] {
  const out: RolloutRule[] = [];
  for (const mode of MODES) {
    const check = checkMode(p, release, mode);
    if (check.status !== 'blocked') return [];
    if (!out.some(r => r.id === check.rule.id)) out.push(check.rule);
  }
  return out;
}

export interface ModeRecommendation {
  mode: RolloutMode;
  exposedPct: number;
  convergeMinutes: number;
  blocked: BlockedMode[];
}

/**
 * The most cautious mode still open, walking MODES in order. Deterministic and never dependent
 * on anything that could differ between the preview run and the commit run. Returns null when
 * every mode is closed: that site needs a person, which the caller reports as a domain skip
 * rather than guessing at.
 */
export function recommendMode(p: Pop, release: Release): ModeRecommendation | null {
  const mode = MODES.find(m => checkMode(p, release, m).status === 'open');
  if (mode === undefined) return null;
  return {
    mode,
    exposedPct: exposedPct(p, mode),
    convergeMinutes: convergeMinutes(mode),
    blocked: blockedModes(p, release, mode),
  };
}
