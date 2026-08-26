import { runShadow, type Ctx, type Exec } from '../core/shadow';
import { runCommit } from '../core/commit';
import { buildWriteSet } from '../core/writeset';
import { draftPolicy, policyMatches, type Disposition, type Policy } from '../core/policy';
import { recordingProxy } from '../core/recorder';
import { NEVER_ELIGIBLE } from '../domain/policy-eligibility';
import type { Diff } from '../core/diff';
import type { Note, WriteRecord } from '../core/types';
import { toolResult, type ToolPayload } from './result';
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
  toolName: string; input: unknown; diff: Diff; notes: Note[];
  resolve(d: Decision | null): void;
}

/**
 * Why the outcome carries a cause as well as the payload: the payload is written for the
 * agent, and there `denied` covers a tool that threw and a tool that tried to write outside
 * the approved set alike. A human reading those as the same thing would read a crash as the
 * guard being trigger-happy, so the UI is told which of the two actually happened.
 */
// 'auto_applied' is 'applied' plus one fact a human still needs: nothing was shown to them
// before it happened. Folding it into plain 'applied' would make a standing rule firing look
// identical to a change the human just reviewed — the one distinction the receipt exists to draw.
export type OutcomeCause = 'applied' | 'auto_applied' | 'refused' | 'stale' | 'blocked' | 'tool_error';
export interface ProposalOutcome {
  toolName: string; cause: OutcomeCause; payload: ToolPayload;
  /** Set only for 'auto_applied': the standing rule's own words, so the receipt can name it. */
  ruleDescription?: string;
}

const proposalListeners = new Set<(p: PendingProposal | null) => void>();
const resultListeners = new Set<(o: ProposalOutcome) => void>();
const draftListeners = new Set<(p: Policy | null) => void>();
// Fires whenever a policy is ratified — from a drafted proposal or from the up-front form —
// so any UI showing rungs can re-read activePolicy() instead of tracking policy state itself.
const policyListeners = new Set<() => void>();
export function onProposal(fn: (p: PendingProposal | null) => void) {
  proposalListeners.add(fn); return () => { proposalListeners.delete(fn); };
}
export function onResult(fn: (o: ProposalOutcome) => void) {
  resultListeners.add(fn); return () => { resultListeners.delete(fn); };
}
export function onDraft(fn: (p: Policy | null) => void) {
  draftListeners.add(fn); return () => { draftListeners.delete(fn); };
}
export function onPolicyChange(fn: () => void) {
  policyListeners.add(fn); return () => { policyListeners.delete(fn); };
}

const history: Disposition[] = [];
const policies = new Map<string, Policy>();
const registrations = new Map<string, { spec: LadderToolSpec; execute: Function }>();

export const activePolicy = (tool: string) => policies.get(tool);
export function ratify(p: Policy) {
  policies.set(p.tool, { ...p, ratified: true });
  reregister(p.tool, `${registrations.get(p.tool)!.spec.description} Changes within the standing rule (${describePolicy(p)}) are applied without review.`);
  draftListeners.forEach(fn => fn(null));
  policyListeners.forEach(fn => fn());
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

/** A read tool sees real state but cannot change it. A write from a read tool is a bug, loudly. */
const readOnlyView = () => recordingProxy(store.state, {
  onWrite: () => {},
  guard: k => { throw new Error(`read-only tool attempted to write ${k.entity}.${k.id}.${k.field}`); },
});

function rejectedFrom(notes: Note[]) {
  const byReason = new Map<string, string[]>();
  for (const n of notes) {
    const a = byReason.get(n.reason) ?? []; a.push(n.id); byReason.set(n.reason, a);
  }
  return [...byReason].map(([reason, ids]) => ({ reason, ids, count: ids.length }));
}

async function decide(toolName: string, input: unknown, diff: Diff, notes: Note[], agent: any, signal?: AbortSignal) {
  let resolveFn!: (d: Decision | null) => void;
  const decision = new Promise<Decision | null>(r => { resolveFn = r; });
  signal?.addEventListener('abort', () => resolveFn(null), { once: true });
  const pending: PendingProposal = { toolName, input, diff, notes, resolve: resolveFn };

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
          db: readOnlyView(), notes: [], effects: { async notify() {} },
        });
        return { ...(out as object), content: [{ type: 'text', text: JSON.stringify(out) }] };
      },
    });
    return;
  }

  const execute = async (input: any, agent?: any, options?: { signal?: AbortSignal }) => {
    const proposalId = `prop-${++seq}`;
    const finish = (cause: OutcomeCause, payload: ToolPayload, ruleDescription?: string) => {
      resultListeners.forEach(fn => fn({ toolName: spec.name, cause, payload, ruleDescription }));
      return toolResult(payload);
    };
    const run: Exec<State, unknown> = ctx => spec.exec(input, ctx);

    const shadow = await runShadow(store.state, run, { proposalId, versionOf, deltaOf });
    if (!shadow.ok) {
      return finish('tool_error', {
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
      : await decide(spec.name, input, shadow.diff, shadow.notes, agent, options?.signal);

    if (!approved) {
      history.push({ tool: spec.name, proposalId, proposed: requested, approved: 0,
                     valueDelta: shadow.diff.totals.valueDelta });
      return finish('refused', {
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
    // narrowedOut and droppedActions only mean anything once the commit actually ran: for an
    // abort (stale, diverged, or a scope violation) nothing was applied or released for a
    // wholly different reason, and counting the whole diff (or every approved action) as
    // "narrowed"/"dropped" there would double it against the abort's own bucket below.
    const committed = out.status === 'applied' || out.status === 'partially_applied';
    const narrowedOut = committed ? shadow.diff.totals.records - appliedRows : 0;
    const droppedActions = committed ? out.dropped.length : 0;
    const appliedTotal = appliedRows + out.released.length;

    // shadow.notes — not out.notes — is the domain-skip account here: it is always complete
    // (drawn from a full preview run), where out.notes can be empty (the commit aborted before
    // the tool ran at all) or partial (the tool stopped mid-way on a violation). Merging both
    // would double-count the same rows when a deterministic tool re-derives the identical
    // skips during the real commit.
    const rejected = [
      ...rejectedFrom(shadow.notes),
      ...(narrowedOut > 0 ? [{ count: narrowedOut, reason: 'the operator removed these from the change', ids: [] }] : []),
      ...(droppedActions > 0 ? [{ count: droppedActions, reason: 'the operator did not approve these messages', ids: [] }] : []),
      ...(out.status === 'aborted_stale' ? [{ count: diffRequested, reason: 'a record changed after the preview; nothing was applied', ids: [] }] : []),
      ...(out.status === 'aborted_diverged' ? [{ count: diffRequested, reason: `an approved field would have received a value the preview never showed (${out.violation}); nothing was applied`, ids: [] }] : []),
      ...(!committed && out.violation && out.status !== 'aborted_diverged' ? [{ count: diffRequested, reason: `the tool tried to write outside the approved set (${out.violation}); everything was rolled back`, ids: [] }] : []),
    ];
    const rejectedTotal = rejected.reduce((n, r) => n + r.count, 0);

    // A domain skip (e.g. a customs hold) never touches commit.ts's own narrowing machinery —
    // the tool excludes those rows before a single write is attempted, so `out.status` alone
    // would still read 'applied' even when every requested row was actually held. Anything
    // above means the agent asked about something that did not happen, so the status sent back
    // has to be driven off that full account, not off `out.status` in isolation: nothing landed
    // is 'denied' (matches the full-refusal case's own value), a mix is 'partially_applied'
    // (already the right shape, just not one commit.ts alone can detect here), and only a truly
    // clean run stays 'applied'.
    const reportedStatus =
      out.status !== 'applied' ? out.status :
      rejectedTotal === 0 ? 'applied' :
      appliedTotal === 0 ? 'denied' :
      'partially_applied';

    history.push({ tool: spec.name, proposalId, proposed: requested,
                   approved: appliedTotal,
                   valueDelta: shadow.diff.totals.valueDelta });

    const draft = reportedStatus === 'applied'
      ? draftPolicy(spec.name, history, new Date(), NEVER_ELIGIBLE)
      : null;
    if (draft) draftListeners.forEach(fn => fn(draft));

    const cause: OutcomeCause =
      out.status === 'aborted_stale' ? 'stale' :
      out.status === 'aborted_diverged' ? 'blocked' :
      !committed && out.violation ? 'blocked' :
      // A commit that returned `denied` with no violation key is a tool that threw, not the
      // guard firing. Kept apart so the UI never reports a crash as enforcement.
      !committed ? 'tool_error' :
      // auto is only true when a ratified policy already cleared this diff without ever
      // showing the panel — the one case the receipt has to name, not just report.
      auto ? 'auto_applied' :
      'applied';

    return finish(cause, {
      status: reportedStatus,
      requested,
      applied: appliedTotal,
      rejected,
      actions_released: out.released.length,
      actions_dropped: out.dropped.length,
      // Anything rejected, for any reason, is something the agent asked about that did not
      // happen — that always means a replan, whether or not it moved `out.status` at all.
      replan_required: rejectedTotal > 0,
      rule_offered: draft ? describePolicy(draft) : null,
    }, auto ? describePolicy(pol!) : undefined);
  };

  registrations.set(spec.name, { spec, execute });
  mc.registerTool({ name: spec.name, description: spec.description, inputSchema: spec.inputSchema, execute });
}
