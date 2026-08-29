import type { Ctx } from '../core/shadow';
import type { EdgeState, Pop, Release, RolloutMode } from './types';
import {
  MODES, blockedModes, checkMode, closingRules, convergeMinutes, evaluateAllModes, exposedPct,
  recommendMode,
} from './rollout-policy';
import { CANDIDATE_RELEASE, REGIONS } from './seed';
import { registerLadderTool, type LadderToolSpec } from '../webmcp/adapter';
import { setRackView } from './rack-view';
// Imported for its side effect: store.ts is where this application binds itself to the adapter
// (see `edgeHost` there). The adapter never reaches into a domain for its state, so the domain
// side has to hand it over, and every entry point that can register these tools reaches here.
import './store';

/** Re-exported from its canonical export point; see policy-eligibility.ts for why the constant
 *  itself does not live in this file. */
export { NEVER_ELIGIBLE } from './policy-eligibility';

interface Filter {
  ids?: string[];
  region?: string;
  running?: string;
  canary?: boolean;
  drained?: boolean;
  frozen?: boolean;
  incident?: boolean;
}

function matchesFilter(p: Pop, f: Filter): boolean {
  if (f.ids !== undefined && !f.ids.includes(p.id)) return false;
  if (f.region !== undefined && p.region !== f.region) return false;
  if (f.running !== undefined && p.configVersion !== f.running) return false;
  if (f.canary !== undefined && p.canary !== f.canary) return false;
  if (f.drained !== undefined && p.drained !== f.drained) return false;
  if (f.frozen !== undefined && (p.freezeUntil !== null) !== f.frozen) return false;
  if (f.incident !== undefined && (p.incidentId !== null) !== f.incident) return false;
  return true;
}

/** Ordered by traffic share, heaviest first, so a truncated read tool result is the part of the
 *  estate that matters rather than an alphabetical accident. */
function findMatches(db: EdgeState, f: Filter): Pop[] {
  return Object.values(db.pops)
    .filter(p => matchesFilter(p, f))
    .sort((a, b) => b.trafficPct - a.trafficPct || a.id.localeCompare(b.id));
}

const filterProps = {
  ids: { type: 'array', items: { type: 'string' }, description: 'Exact site codes to target, e.g. ["ams1","lhr1"]' },
  region: { type: 'string', enum: REGIONS, description: 'Exact routing region to filter by' },
  running: { type: 'string', description: 'Exact release a site is currently serving, e.g. 2026.08.19-3' },
  canary: { type: 'boolean', description: 'Filter to canary sites, which take a release before production sites do' },
  drained: { type: 'boolean', description: 'Filter to sites drained for maintenance' },
  frozen: { type: 'boolean', description: 'Filter to sites inside a change-freeze window' },
  incident: { type: 'boolean', description: 'Filter to sites with an open incident' },
} as const;

/**
 * The same filter, said to the engineer instead of to the agent. The rack prints this, so it has
 * to read in the trade's own words — the words the rules and the condition column already use.
 *
 * A flag set false is worth saying out loud rather than dropping: an agent narrowing to the
 * sites *outside* a freeze has narrowed the rack just as much, and a line that only ever named
 * the positive case would describe the opposite view identically.
 */
function describeFilter(f: Filter): string {
  const parts: string[] = [];
  if (f.ids !== undefined) {
    parts.push(f.ids.length <= 4 ? f.ids.join(', ') : `${f.ids.length} named sites`);
  }
  if (f.region !== undefined) parts.push(f.region);
  if (f.running !== undefined) parts.push(`running ${f.running}`);
  if (f.canary !== undefined) parts.push(f.canary ? 'canary sites' : 'production sites');
  if (f.drained !== undefined) parts.push(f.drained ? 'drained' : 'in rotation');
  if (f.frozen !== undefined) parts.push(f.frozen ? 'inside a change freeze' : 'no change freeze');
  if (f.incident !== undefined) parts.push(f.incident ? 'open incident' : 'no open incident');
  return parts.length === 0 ? 'the whole estate' : parts.join(', ');
}

const listPops: LadderToolSpec = {
  name: 'list_pops',
  description: 'List points of presence by region, running release, or state (canary, drained, frozen, incident). Heaviest traffic share first; returns up to 50 sites. This call also changes what the on-call engineer is looking at: the rack on their screen narrows to the sites returned here, labelled as set by you and cleared by them in one click. It changes no site and takes none out of the estate — each region band goes on counting against the whole region. Use it when you want the engineer looking at a particular part of the estate before you propose anything.',
  readOnly: true,
  changesTheView: true,
  inputSchema: { type: 'object', properties: { ...filterProps } },
  async exec(input: Filter = {}, ctx: Ctx<EdgeState>) {
    const rows = findMatches(ctx.db, input);
    const shown = rows.slice(0, 50);
    // Set from `shown`, never from `rows`: the rack is told to draw exactly what the agent was
    // handed, so a call that truncated at 50 cannot leave the engineer looking at sites the
    // agent never saw.
    setRackView({
      toolName: 'list_pops',
      ids: shown.map(p => p.id),
      words: describeFilter(input),
    });
    return {
      rows: shown,
      total: rows.length,
      trafficPct: Math.round(rows.reduce((n, p) => n + p.trafficPct, 0) * 100) / 100,
    };
  },
};

const inspectPop: LadderToolSpec = {
  name: 'inspect_pop',
  description: 'Inspect one point of presence together with every rollout mode for a release — whether it is open, how much production traffic it would expose, how long it takes to converge, and which rule closes any that are shut.',
  readOnly: true,
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Site code, e.g. ams1' },
      release: { type: 'string', description: `Release to evaluate against. Defaults to ${CANDIDATE_RELEASE}.` },
    },
    required: ['id'],
  },
  async exec(input: { id: string; release?: string }, ctx: Ctx<EdgeState>) {
    const pop = ctx.db.pops[input.id] ?? null;
    const release = ctx.db.releases[input.release ?? CANDIDATE_RELEASE] ?? null;
    return {
      pop,
      release,
      modes: pop && release ? evaluateAllModes(pop, release) : null,
    };
  },
};

/** Puts one release on one site in one mode. Every field is set wholesale — never a nested
 *  mutation — so the recorder sees the whole change as one write per field. */
function applyRollout(p: Pop, release: Release, mode: RolloutMode): void {
  p.pendingVersion = release.id;
  p.rolloutMode = mode;
  p.exposedPct = exposedPct(p, mode);
  p.convergeMinutes = convergeMinutes(mode);
  const blocked = blockedModes(p, release, mode);
  // Compared by content, not written unconditionally. This is a fresh array every call, so an
  // unguarded assignment is always a write as far as the recorder is concerned — which would put
  // a site with nothing to change into the diff carrying one meaningless field, and the drawer
  // would open on a row whose every figure was unchanged.
  if (blocked.length > 0 && JSON.stringify(p.blockedModes) !== JSON.stringify(blocked)) {
    p.blockedModes = blocked;
  }
}

/** The reason line an agent gets back for a closed site: the rule id first, then the sentence.
 *  The id is the stable half — it is what a follow-up call can be written against. */
const ruleNote = (ruleId: string, description: string) => `${ruleId} — ${description}`;

const rollConfig: LadderToolSpec = {
  name: 'roll_config',
  description: "Stage a release for rollout at every point of presence matching a filter. Without `mode`, each site gets the most cautious mode still open to it — usually a staged rollout across a tenth of its nodes. With `mode`, that specific mode is staged only where no rule closes it; closed sites are skipped and reported with the rule id that closed them.",
  inputSchema: {
    type: 'object',
    properties: {
      ...filterProps,
      release: { type: 'string', description: `Release to roll. Defaults to ${CANDIDATE_RELEASE}.` },
      mode: { type: 'string', enum: MODES, description: 'Force this rollout mode instead of taking the most cautious one still open' },
    },
  },
  async exec(input: Filter & { release?: string; mode?: RolloutMode } = {}, ctx: Ctx<EdgeState>) {
    const releaseId = input.release ?? CANDIDATE_RELEASE;
    const release = ctx.db.releases[releaseId];
    if (!release) {
      // One note against the release itself rather than one per matched site: the release is the
      // thing that is wrong, and repeating that thirty-six times would bury it.
      ctx.notes.push({ id: releaseId, reason: 'no such release; nothing was staged' });
      return { staged: 0 };
    }

    const rows = findMatches(ctx.db, input);
    let staged = 0;
    for (const row of rows) {
      const p = ctx.db.pops[row.id];
      if (p.configVersion === release.id) {
        ctx.notes.push({ id: p.id, reason: `already serving ${release.id}; there is nothing to roll here` });
        continue;
      }
      let mode: RolloutMode;
      if (input.mode !== undefined) {
        const check = checkMode(p, release, input.mode);
        if (check.status === 'blocked') {
          ctx.notes.push({ id: p.id, reason: ruleNote(check.rule.id, check.rule.description) });
          continue;
        }
        mode = input.mode;
      } else {
        const rec = recommendMode(p, release);
        if (!rec) {
          // Named, not just counted. "This needs a person" tells the agent nothing it can act on;
          // the rule ids are what let its next call be a different one.
          const closed = closingRules(p, release).map(r => r.id).join(', ');
          ctx.notes.push({
            id: p.id,
            reason: `every rollout mode is closed here by ${closed}; this site needs a person before anything can go out`,
          });
          continue;
        }
        mode = rec.mode;
      }
      // A second call over ground the first one already covered. Reported as a skip rather than
      // staged again, so the drawer never opens on a row where every figure is the one already
      // showing — the failure a re-run over an overlapping filter produces otherwise.
      if (p.pendingVersion === release.id && p.rolloutMode === mode) {
        ctx.notes.push({
          id: p.id,
          reason: `already staged for ${release.id} as ${mode}; there is nothing to change here`,
        });
        continue;
      }
      applyRollout(p, release, mode);
      staged++;
    }
    return { staged };
  },
};

const pageOncall: LadderToolSpec = {
  name: 'page_oncall',
  description: 'Page the on-call rotation for every region among the sites matching a filter. A page wakes a person and cannot be recalled, so this is never eligible for a standing rule.',
  inputSchema: {
    type: 'object',
    properties: { ...filterProps, message: { type: 'string' } },
    required: ['message'],
  },
  async exec(input: Filter & { message: string }, ctx: Ctx<EdgeState>) {
    const rows = findMatches(ctx.db, input);
    const rotations = [...new Set(rows.map(r => r.oncall))].sort();
    // `message` is required in the schema but nothing enforces that on its own, and a missing
    // one would reach a pager as the literal word "undefined". Refuse before creating any page.
    if (typeof input.message !== 'string' || input.message.trim() === '') {
      for (const rotation of rotations) {
        ctx.notes.push({ id: rotation, reason: 'no message was given, so nobody was paged' });
      }
      return { paged: [] };
    }
    for (const rotation of rotations) {
      await ctx.effects.notify(rotation, input.message);
    }
    return { paged: rotations };
  },
};

/**
 * Deferred behind a function rather than run as a module side effect, and called once from the
 * entry point after both this module and adapter.ts have finished loading.
 */
export function registerEdgeTools(): void {
  registerLadderTool(listPops);
  registerLadderTool(inspectPop);
  registerLadderTool(rollConfig);
  registerLadderTool(pageOncall);
}
