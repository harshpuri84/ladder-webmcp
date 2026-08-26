import { runShadow, type Ctx, type Exec } from '../core/shadow';
import { runCommit } from '../core/commit';
import { buildWriteSet } from '../core/writeset';
import { draftPolicy, policyMatches, type Disposition, type Policy } from '../core/policy';
import { NEVER_ELIGIBLE } from '../domain/tools';
import type { Diff } from '../core/diff';
import type { Note, WriteRecord } from '../core/types';
import { toolResult } from './result';
import { store } from '../domain/store';

const mc: any = (document as any).modelContext ?? (navigator as any).modelContext;

/** False when the page is open in a browser without WebMCP. The app still works by hand. */
export const webmcpAvailable = Boolean(mc);
if (!webmcpAvailable) {
  console.info('[ladder] WebMCP unavailable: use ChatGPT desktop, or Chrome 149+ with chrome://flags/#enable-webmcp-testing. The console below still works by hand.');
}

type State = typeof store.state;

export interface LadderToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly?: boolean;
  exec(input: any, ctx: Ctx<State>): Promise<unknown>;
}

export interface Decision { groups: string[]; actions: string[]; }
export interface PendingProposal {
  toolName: string; diff: Diff; notes: Note[];
  resolve(d: Decision | null): void;
}

const proposalListeners = new Set<(p: PendingProposal | null) => void>();
const draftListeners = new Set<(p: Policy | null) => void>();
export function onProposal(fn: (p: PendingProposal | null) => void) {
  proposalListeners.add(fn); return () => { proposalListeners.delete(fn); };
}
export function onDraft(fn: (p: Policy | null) => void) {
  draftListeners.add(fn); return () => { draftListeners.delete(fn); };
}

const history: Disposition[] = [];
const policies = new Map<string, Policy>();
const registrations = new Map<string, { spec: LadderToolSpec; execute: Function }>();

export const activePolicy = (tool: string) => policies.get(tool);
export function ratify(p: Policy) {
  policies.set(p.tool, { ...p, ratified: true });
  reregister(p.tool, `${registrations.get(p.tool)!.spec.description} Changes within the standing rule (${describePolicy(p)}) are applied without review.`);
  draftListeners.forEach(fn => fn(null));
}
export const describePolicy = (p: Policy) =>
  `up to ${p.maxRecords} records, up to EUR ${p.maxValue}, reversible only, expires ${p.expiresAt.slice(0, 10)}`;

export function reregister(name: string, description: string) {
  const r = registrations.get(name);
  if (!r) return;
  mc.unregisterTool(name);
  mc.registerTool({ name, description, inputSchema: r.spec.inputSchema, execute: r.execute });
}

let seq = 0;
const versionOf = (_e: string, id: string) => store.state.shipments[id]?.version ?? -1;
const bumpVersion = (_e: string, id: string) => { const s = store.state.shipments[id]; if (s) s.version += 1; };
const deltaOf = (w: WriteRecord) => (w.field === 'price' ? (w.after as number) - (w.before as number) : 0);

function rejectedFrom(notes: Note[]) {
  const byReason = new Map<string, string[]>();
  for (const n of notes) {
    const a = byReason.get(n.reason) ?? []; a.push(n.id); byReason.set(n.reason, a);
  }
  return [...byReason].map(([reason, ids]) => ({ reason, ids, count: ids.length }));
}

async function decide(toolName: string, diff: Diff, notes: Note[], agent: any, signal?: AbortSignal) {
  let resolveFn!: (d: Decision | null) => void;
  const decision = new Promise<Decision | null>(r => { resolveFn = r; });
  signal?.addEventListener('abort', () => resolveFn(null), { once: true });
  const pending: PendingProposal = { toolName, diff, notes, resolve: resolveFn };

  const show = async () => {
    proposalListeners.forEach(fn => fn(pending));
    const d = await decision;
    proposalListeners.forEach(fn => fn(null));
    return d;
  };

  return typeof agent?.requestUserInteraction === 'function'
    ? await agent.requestUserInteraction(show)
    : await show();
}

export function registerLadderTool(spec: LadderToolSpec) {
  if (!mc) return;

  if (spec.readOnly) {
    mc.registerTool({
      name: spec.name, description: spec.description, inputSchema: spec.inputSchema,
      annotations: { readOnlyHint: true },
      execute: async (input: any) => {
        const out = await spec.exec(input, {
          db: store.state, notes: [], effects: { async notify() {} },
        });
        return { ...(out as object), content: [{ type: 'text', text: JSON.stringify(out) }] };
      },
    });
    return;
  }

  const execute = async (input: any, agent?: any, options?: { signal?: AbortSignal }) => {
    const proposalId = `prop-${++seq}`;
    const run: Exec<State, unknown> = ctx => spec.exec(input, ctx);

    const shadow = await runShadow(store.state, run, { proposalId, versionOf, deltaOf });
    if (!shadow.ok) {
      return toolResult({
        status: 'denied', requested: 0, applied: 0,
        rejected: [{ count: 0, reason: `the tool failed during preview: ${shadow.error!.message}`, ids: [] }],
        actions_released: 0, actions_dropped: 0, replan_required: true, rule_offered: null,
      });
    }

    // diffRequested is what the human is actually shown and decides on. Rows the tool
    // skipped for a domain reason (e.g. a customs hold) never enter the diff, but the agent
    // asked about them and hears about them in `rejected` — so `requested`, the figure sent
    // to the agent, must count them too, or applied + rejected will not reconcile against it.
    const diffRequested = shadow.diff.totals.records + shadow.diff.actions.length;
    const requested = diffRequested + shadow.notes.length;
    const pol = activePolicy(spec.name);
    const auto = pol ? policyMatches(pol, shadow.diff, new Date()) : false;

    const approved: Decision | null = auto
      ? { groups: shadow.diff.groups.map(g => g.group), actions: [] }
      : await decide(spec.name, shadow.diff, shadow.notes, agent, options?.signal);

    if (!approved) {
      history.push({ tool: spec.name, proposalId, proposed: requested, approved: 0,
                     valueDelta: shadow.diff.totals.valueDelta });
      return toolResult({
        status: 'denied', requested, applied: 0,
        rejected: [...rejectedFrom(shadow.notes),
                   { count: diffRequested, reason: 'the operator refused this change', ids: [] }],
        actions_released: 0, actions_dropped: shadow.diff.actions.length,
        replan_required: true, rule_offered: null,
      });
    }

    const ws = buildWriteSet(shadow.diff, approved.groups, approved.actions);
    const out = await runCommit(store.state, run, ws, { versionOf, bumpVersion });
    store.notify();

    const appliedRows = new Set(out.applied.map(w => `${w.entity}:${w.id}`)).size;
    // narrowedOut only means anything once the commit actually ran: for an abort (stale,
    // diverged, or a scope violation) nothing was applied for a wholly different reason, and
    // counting the whole diff as "narrowed" there would double it against the abort's own
    // bucket below.
    const committed = out.status === 'applied' || out.status === 'partially_applied';
    const narrowedOut = committed ? shadow.diff.totals.records - appliedRows : 0;

    history.push({ tool: spec.name, proposalId, proposed: requested,
                   approved: appliedRows + out.released.length,
                   valueDelta: shadow.diff.totals.valueDelta });

    const draft = out.status === 'applied'
      ? draftPolicy(spec.name, history, new Date(), NEVER_ELIGIBLE)
      : null;
    if (draft) draftListeners.forEach(fn => fn(draft));

    return toolResult({
      status: out.status,
      requested,
      applied: appliedRows + out.released.length,
      rejected: [
        // shadow.notes — not out.notes — is the domain-skip account here: it is always
        // complete (drawn from a full preview run), where out.notes can be empty (the commit
        // aborted before the tool ran at all) or partial (the tool stopped mid-way on a
        // violation). Merging both would double-count the same rows when a deterministic tool
        // re-derives the identical skips during the real commit.
        ...rejectedFrom(shadow.notes),
        ...(narrowedOut > 0 ? [{ count: narrowedOut, reason: 'the operator removed these from the change', ids: [] }] : []),
        ...(out.status === 'aborted_stale' ? [{ count: diffRequested, reason: 'a record changed after the preview; nothing was applied', ids: [] }] : []),
        ...(out.status === 'aborted_diverged' ? [{ count: diffRequested, reason: `an approved field would have received a value the preview never showed (${out.violation}); nothing was applied`, ids: [] }] : []),
        ...(!committed && out.violation && out.status !== 'aborted_diverged' ? [{ count: diffRequested, reason: `the tool tried to write outside the approved set (${out.violation}); everything was rolled back`, ids: [] }] : []),
      ],
      actions_released: out.released.length,
      actions_dropped: out.dropped.length,
      replan_required: out.status !== 'applied',
      rule_offered: draft ? describePolicy(draft) : null,
    });
  };

  registrations.set(spec.name, { spec, execute });
  mc.registerTool({ name: spec.name, description: spec.description, inputSchema: spec.inputSchema, execute });
}
