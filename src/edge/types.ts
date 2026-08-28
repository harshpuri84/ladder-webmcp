/**
 * The second product's records. Nothing in `src/edge/` imports from `src/domain/` or `src/ui/`,
 * and nothing there imports from here — `__tests__/isolation.test.ts` walks the import graph and
 * fails if either direction appears. The two products share `src/core/` and `src/webmcp/` and
 * nothing else.
 */

/** How a release reaches a point of presence. Ordered by caution in `rollout-policy.ts`. */
export type RolloutMode = 'shadow' | 'staged' | 'immediate';

/** Named the way a linter names its rules: a stable id plus the sentence a human reads. */
export interface RolloutRule {
  id: string;
  description: string;
}

/** A mode that would otherwise be open for this point of presence but is blocked by a rule. */
export interface BlockedMode {
  mode: RolloutMode;
  ruleId: string;
  rule: string;
}

/** A point of presence: one site's worth of edge nodes serving a share of production traffic. */
export interface Pop {
  id: string;                 // "ams1"
  city: string;
  region: string;             // "eu-west"
  /** Share of all production traffic this site answers. The 36 sites sum to 100. */
  trafficPct: number;
  rps: number;
  nodes: number;
  /** Percent of this site's serving capacity in use. Above the ceiling there is no room to
   *  evaluate a second config alongside the live one. */
  utilisationPct: number;
  /** The release this site is serving right now. */
  configVersion: string;
  /** A site whose whole job is to take a release first. Exempt from the soak rule. */
  canary: boolean;
  /** Out of rotation for hardware work; nothing may be pushed to it. */
  drained: boolean;
  /** A change freeze covering this site, or null. */
  freezeLabel: string | null;
  freezeUntil: string | null; // "2026-09-02"
  /** An open incident being worked at this site, or null. */
  incidentId: string | null;
  incidentSeverity: number;   // 0 when there is no incident
  /** Which rotation gets paged for this site. */
  oncall: string;

  // Rollout state — null/0/[] until roll_config assigns one. Every field here is primitive or,
  // for blockedModes, replaced wholesale on write, so core/recorder.ts sees every change.
  pendingVersion: string | null;
  rolloutMode: RolloutMode | null;
  /** Share of all production traffic that would begin serving the release at this site. */
  exposedPct: number;
  convergeMinutes: number;
  blockedModes: BlockedMode[];
  version: number;
}

/** A candidate release. Read-only in this domain; no tool writes one. */
export interface Release {
  id: string;                 // "2026.08.27-1"
  summary: string;
  /** The canary site that has already carried it in production, or null if none has. */
  soakedOn: string | null;
  cut: string;                // "2026-08-27"
}

/**
 * Two entities, not one. The freight product has a single record type; this one carries a second
 * so the engine's `entity` argument is doing real work rather than being a constant with a name.
 */
export interface EdgeState {
  pops: Record<string, Pop>;
  releases: Record<string, Release>;
}
