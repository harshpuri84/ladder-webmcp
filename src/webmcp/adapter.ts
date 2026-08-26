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
// 'nothing_to_decide' is 'refused' minus the human: the T8-1 no-panel path resolves through
// the same branch a genuine decline uses (same status, same rejected shape), but nobody was
// ever asked. Folding it into 'refused' would tell the human they declined something they
// were never shown.
export type OutcomeCause =
  | 'applied' | 'auto_applied' | 'refused' | 'nothing_to_decide' | 'stale' | 'blocked' | 'tool_error';
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

// Tools register at module evaluation, before React ever mounts — the panel's subscriber
// attaches later, in an effect. A write call fired the instant the page loads (a plausible
// thing for an agent to do) can publish a proposal into an empty `proposalListeners` set:
// `forEach` over nothing does nothing, and with no queue of its own here, the proposal was
// gone for good and its promise never settled. Held here, independent of which component ever
// mounts, and replayed to the first subscriber that attaches.
const bufferedProposals: PendingProposal[] = [];

export function onProposal(fn: (p: PendingProposal | null) => void) {
  proposalListeners.add(fn);
  if (bufferedProposals.length > 0) {
    for (const p of bufferedProposals.splice(0, bufferedProposals.length)) fn(p);
  }
  return () => { proposalListeners.delete(fn); };
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

const isLapsed = (p: Policy, now: Date) => p.ratified && new Date(p.expiresAt) <= now;

/**
 * A pure read: an expired ratified policy is treated as though none exists, so every caller —
 * the rung chip at render, execute() at call time — sees "no active policy" without a
 * background timer. policyMatches() already refuses to auto-apply a lapsed policy on its own,
 * so this alone keeps every write path safe; it does not, by itself, correct the tool's
 * registered description (see revertIfExpired for that half — descriptions are push-based via
 * reregister(), not derived at read time like this).
 */
export function activePolicy(tool: string): Policy | undefined {
  const p = policies.get(tool);
  return p && !isLapsed(p, new Date()) ? p : undefined;
}

/**
 * The one place a policy is actually removed and its tool put back to its base description —
 * expiry and a human revoking it are the same event as far as the registered tool and every
 * rung chip are concerned, so both go through this rather than each reimplementing it.
 */
function clearPolicy(tool: string) {
  const r = registrations.get(tool);
  policies.delete(tool);
  if (r) reregister(tool, r.spec.description);
  policyListeners.forEach(fn => fn());
}

/**
 * The tool's registered description keeps the "applied without review" clause until something
 * says otherwise — ratify() is push-based (reregister() is only ever called from ratify() and
 * here). Checked at call time, right as a tool runs, rather than on a timer that a reload would
 * drop anyway: the interface must not keep claiming a grant that has lapsed, in either
 * direction (the agent's own description, or the human's rung chip), so the moment either is
 * next read after expiry, both correct themselves.
 */
function revertIfExpired(tool: string, now: Date) {
  const p = policies.get(tool);
  if (!p || !isLapsed(p, now)) return;
  clearPolicy(tool);
}

/**
 * F5: nothing anywhere used to remove or narrow a ratified rule — the chip was inert, and the
 * only exits were waiting for expiry or reloading the page. For a product whose pitch is that
 * autonomy is granted by a human rather than assumed, the human has to be able to take it back
 * too. Goes through the exact same path expiry already uses (clearPolicy), not a second one:
 * the tool is re-registered with its base description, and the next call is reviewed again.
 */
export function revoke(tool: string): void {
  if (!policies.has(tool)) return;
  clearPolicy(tool);
}

// Guarded the same way reregister() already is: in a browser with no WebMCP,
// registerLadderTool() returns early and `registrations` never gets an entry for any tool, so
// ratifying anything (the up-front form, or a drafted proposal) must be a safe no-op rather
// than a crash mid-write — the policies.set() below must not run before this check.
export function ratify(p: Policy) {
  const r = registrations.get(p.tool);
  if (!r) return;
  policies.set(p.tool, { ...p, ratified: true });
  reregister(p.tool, `${r.spec.description} Changes within the standing rule (${describePolicy(p)}) are applied without review.`);
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
    // No subscriber yet (e.g. a write call fired before React mounted its effect): hold this
    // proposal rather than broadcast it into an empty set, so the subscriber that eventually
    // attaches still gets it instead of the promise below waiting forever.
    if (proposalListeners.size === 0) bufferedProposals.push(pending);
    else proposalListeners.forEach(fn => fn(pending));
    const d = await decision;
    const stillBuffered = bufferedProposals.indexOf(pending);
    if (stillBuffered !== -1) bufferedProposals.splice(stillBuffered, 1);
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
        // `out` is read through readOnlyView()'s recordingProxy, so anything nested in it
        // (e.g. search_shipments' rows) is itself a live Proxy, not plain data. Chrome
        // serialises a tool's result with structuredClone, which throws DataCloneError on a
        // Proxy — round-trip through JSON here so what leaves the tool boundary is inert.
        const inert = JSON.parse(JSON.stringify(out));
        return { ...inert, content: [{ type: 'text', text: JSON.stringify(inert) }] };
      },
    });
    return;
  }

  const execute = async (input: any, agent?: any, options?: { signal?: AbortSignal }) => {
    const proposalId = `prop-${++seq}`;
    // T8-2: a bucket reporting zero is noise, not information, in the one structured account
    // this product sells as truthful — suppress it here, once, so every branch that builds a
    // `rejected` array is covered without each call site having to remember the guard itself.
    const finish = (cause: OutcomeCause, payload: ToolPayload, ruleDescription?: string) => {
      const cleaned: ToolPayload = { ...payload, rejected: payload.rejected.filter(r => r.count > 0) };
      resultListeners.forEach(fn => fn({ toolName: spec.name, cause, payload: cleaned, ruleDescription }));
      return toolResult(cleaned);
    };
    const run: Exec<State, unknown> = ctx => spec.exec(input, ctx);

    const shadow = await runShadow(store.state, run, { proposalId, versionOf, deltaOf });
    if (!shadow.ok) {
      // A crash is not rejected work — see the `error` field's own doc comment in
      // src/webmcp/result.ts for why this is a dedicated field rather than a `rejected`
      // bucket with count 0 (which the zero-count filter below would now silently remove).
      return finish('tool_error', {
        status: 'denied', requested: 0, applied: 0, rejected: [],
        actions_released: 0, actions_dropped: 0, replan_required: true, rule_offered: null,
        error: `the tool failed during preview: ${shadow.error!.message}`,
      });
    }

    // Finding #1: an expired standing rule must stop claiming autonomy it no longer has —
    // checked here, at call time, before anything else looks at this tool's policy.
    revertIfExpired(spec.name, new Date());

    // diffRequested is what the human is actually shown and decides on. Rows the tool
    // skipped for a domain reason (e.g. a customs hold) never enter the diff, but the agent
    // asked about them and hears about them in `rejected` — so `requested`, the figure sent
    // to the agent, must count them too, or applied + rejected will not reconcile against it.
    const diffRequested = shadow.diff.totals.records + shadow.diff.actions.length;
    const requested = diffRequested + shadow.notes.length;
    const pol = activePolicy(spec.name);
    const auto = pol ? policyMatches(pol, shadow.diff, new Date()) : false;

    // T8-1: nothing for a human to decide — every matching row was skipped for a domain
    // reason before the diff was even built, so there is no record group and no action to
    // show. Opening a panel there produces "0 RECORDS" and a disabled "Apply 0 of 0" button:
    // a modal with nothing to decide, in a product whose whole pitch is that the human
    // decides something meaningful. Resolve straight to the same refused outcome a human
    // declining would produce and let the receipt, not a panel, carry the news. Guarded on
    // both groups and actions: a proposal with zero records but held actions still needs a
    // human, because there they genuinely are deciding something.
    const nothingToDecide = shadow.diff.groups.length === 0 && shadow.diff.actions.length === 0;

    const approved: Decision | null = auto
      ? { groups: shadow.diff.groups.map(g => g.group), actions: [] }
      : nothingToDecide
      ? null
      : await decide(spec.name, input, shadow.diff, shadow.notes, agent, options?.signal);

    if (!approved) {
      history.push({ tool: spec.name, proposalId, proposed: requested, approved: 0,
                     valueDelta: shadow.diff.totals.valueDelta });
      // nothingToDecide always carries diffRequested === 0 (totals.records mirrors groups.length
      // here), so whenever it also carries no domain notes, `requested` is 0 too: nothing at all
      // matched the filter or request, and no human — no operator — was ever shown this
      // proposal. Give that its own reason (see ToolPayload.reason's doc comment for why it
      // isn't a `rejected` bucket) instead of the silent `{ requested: 0, rejected: [] }` an
      // agent would otherwise have to guess at.
      const noMatch = nothingToDecide && requested === 0;
      return finish(nothingToDecide ? 'nothing_to_decide' : 'refused', {
        status: 'denied', requested, applied: 0,
        rejected: [...rejectedFrom(shadow.notes),
                   { count: diffRequested, reason: 'the operator refused this change', ids: [] }],
        actions_released: 0, actions_dropped: shadow.diff.actions.length,
        replan_required: true, rule_offered: null,
        ...(noMatch ? { reason: 'no records or actions matched this request; nothing was found to change' } : {}),
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
    //
    // A commit crash (out.error set, see its doc comment in core/commit.ts) is kept out of this
    // array entirely, even when the tool had pushed notes before it crashed: `requested` is
    // forced down to `appliedTotal` below on that same path, and a rejected total drawn from
    // shadow.notes would then be nonzero against a requested of zero — breaking
    // applied + Σrejected.count === requested. A crash is not rejected work either way.
    const rejected = out.error !== undefined ? [] : [
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

    // F10: a tool that already carries an active ratified policy has nothing new to offer —
    // without this guard, the very next clean run under that rule (auto-applied or not) still
    // re-fired draftPolicy() and re-offered the same capability the tool already has.
    const draft = reportedStatus === 'applied' && !activePolicy(spec.name)
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
      // A commit crash (not a ScopeViolation, see out.error's doc comment in core/commit.ts)
      // reports nothing in `rejected` (built above), even when the tool had already pushed
      // notes before it crashed — so `requested` has to match `applied` here too, the same way
      // the preview-crash path above reports 0/0/[]; otherwise the applied +
      // Σrejected.count === requested invariant breaks.
      requested: out.error !== undefined ? appliedTotal : requested,
      applied: appliedTotal,
      rejected,
      actions_released: out.released.length,
      actions_dropped: out.dropped.length,
      // Anything rejected, for any reason, is something the agent asked about that did not
      // happen — that always means a replan, whether or not it moved `out.status` at all. A
      // commit crash is the same case even though `rejected` stays empty for it (see above):
      // the work still did not happen, so saying otherwise would be the same false
      // reassurance already fixed twice elsewhere (a domain-skip tool reporting `applied`,
      // dropped messages reporting a clean success) — on the path with the least information
      // for the agent to catch it itself.
      replan_required: rejectedTotal > 0 || out.error !== undefined,
      rule_offered: draft ? describePolicy(draft) : null,
      ...(out.error !== undefined ? { error: `the tool failed during commit: ${out.error}` } : {}),
    }, auto ? describePolicy(pol!) : undefined);
  };

  registrations.set(spec.name, { spec, execute });
  mc.registerTool({ name: spec.name, description: spec.description, inputSchema: spec.inputSchema, execute });
}
