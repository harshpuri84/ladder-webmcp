import { runShadow, type Ctx, type Exec } from '../core/shadow';
import { runCommit } from '../core/commit';
import { buildWriteSet } from '../core/writeset';
import { draftPolicy, policyMatches, type Disposition, type Policy } from '../core/policy';
import { recordingProxy } from '../core/recorder';
import {
  authorityConfigured, authorityVocabulary, configureAuthority, currentRole, describeAuthority,
  isReferable, onRoleChange, referralTarget,
  type AuthorityRole, type AuthorityVocabulary,
} from './authority';
import type { Diff } from '../core/diff';
import type { Note, WriteRecord } from '../core/types';
import { toolResult, type ToolPayload } from './result';

/**
 * Reads the namespace fresh, never caches a falsy answer. A Chrome flag build injects
 * `document.modelContext` before page scripts run, so a one-time read at module load used to
 * work there — but a host is free to inject a moment later (ChatGPT desktop's built-in browser
 * does exactly this), and a one-time read that landed `undefined` never looked again. See
 * `checkForWebmcp` and `registerWhenReady` below for the retry this enables.
 */
function resolveMc(): any {
  return (document as any).modelContext ?? (navigator as any).modelContext;
}

let mc: any = resolveMc();

const availabilityListeners = new Set<() => void>();
export function onAvailabilityChange(fn: () => void) {
  availabilityListeners.add(fn); return () => { availabilityListeners.delete(fn); };
}

/** True once the namespace has been found — read fresh, not a value frozen at module load. */
export function isWebmcpAvailable(): boolean {
  return Boolean(mc);
}

if (!mc) {
  console.info('[ladder] WebMCP unavailable: use ChatGPT desktop, or Chrome 149+ with chrome://flags/#enable-webmcp-testing. The console below still works by hand.');
}

/**
 * Re-reads the namespace. A no-op once `mc` is already set — an existing reference is never
 * swapped out from under live registrations, and this never re-fires availability listeners
 * for a host that was already known available. Returns whether the namespace is available
 * after this check, so a caller can act on the result immediately.
 */
export function checkForWebmcp(): boolean {
  if (mc) return true;
  const found = resolveMc();
  if (!found) return false;
  mc = found;
  availabilityListeners.forEach(fn => fn());
  return true;
}

const POLL_INTERVAL_MS = 300;
// ~10s of polling: generous enough for a host that injects the namespace a little after boot
// (the actual failure this fixes), short enough that a browser with no WebMCP at all — the
// ordinary case for anyone just browsing the app by hand — isn't polled forever.
const POLL_CEILING_MS = 10_000;

/**
 * Registers immediately if the namespace is already there (unchanged behaviour for the Chrome
 * flag build). Otherwise polls for it — and re-checks the moment the tab becomes visible again,
 * since a host may inject on activation rather than at load — calling `register` the instant it
 * appears, and stops polling once it lands or the ceiling passes. `register` is guaranteed to
 * run at most once no matter which of those paths gets there first.
 */
export function registerWhenReady(register: () => void): () => void {
  if (checkForWebmcp()) { register(); return () => {}; }

  let done = false;
  const cleanup = () => {
    clearInterval(intervalId);
    clearTimeout(ceilingId);
    document.removeEventListener('visibilitychange', onVisible);
  };
  const tryNow = () => {
    if (done) return;
    if (!checkForWebmcp()) return;
    done = true;
    register();
    cleanup();
  };
  const onVisible = () => { if (document.visibilityState === 'visible') tryNow(); };

  const intervalId = setInterval(tryNow, POLL_INTERVAL_MS);
  const ceilingId = setTimeout(() => { done = true; cleanup(); }, POLL_CEILING_MS);
  document.addEventListener('visibilitychange', onVisible);

  return cleanup;
}

/**
 * Everything about the application this adapter is guarding, in one object. The module itself
 * never names an entity, a field, or a store: it asks the binding for a record's version, for
 * the value a write moves, and for the tool names a standing rule may never cover.
 */
export interface HostBinding<S> {
  /** The live state every tool previews against and commits into. Read fresh on each call, so
   *  a host whose state object is replaced rather than mutated is free to expose a getter. */
  state: S;
  /** Called once after a commit lands, so the host's own subscribers re-render. */
  notify(): void;
  versionOf(entity: string, id: string): number;
  bumpVersion(entity: string, id: string): void;
  /** The signed value a write moves, in the host's own units. Zero for fields that carry none. */
  valueDeltaOf(w: WriteRecord): number;
  /** Tool names that may never be covered by a standing rule. */
  neverEligible: string[];
  /**
   * This product's words for the authority boundary between two of its humans: its roles, its
   * unit, and its word for one record. Every agent-facing sentence about that boundary is
   * composed from these — see `describeAuthority`, `describePolicy` and the referral reason in
   * `execute` — so that a second product gets the same mechanic stated in its own terms rather
   * than in the first product's.
   */
  authority: AuthorityVocabulary;
}

let binding: HostBinding<any> | null = null;

/**
 * Binds this module to one application, once, at startup — before any tool can be called.
 *
 * A second call replaces the binding and nothing else: the policies, registrations, history and
 * referrals held below are module singletons and are deliberately left alone, so a host that
 * re-binds (a hot reload, a test re-configuring the same module instance) keeps the ladder it
 * has already earned rather than silently losing it. Last call wins.
 *
 * That is the whole of the supported story. Two different applications sharing one document is
 * explicitly out of scope: the registered tool names, the standing rules and the approval
 * history are all one flat namespace here, and a second domain would land in the middle of the
 * first one's. Each product gets its own Vite entry and therefore its own module graph and its
 * own copy of this state — which is why coexistence in a single document never needed solving.
 */
export function configureHost<S>(b: HostBinding<S>): void {
  binding = b as HostBinding<any>;
  // The vocabulary lives in authority.ts, which owns the role ladder and its listeners. Pushed
  // in from here rather than configured separately so a host has exactly one call to make and
  // cannot bind its state while leaving the boundary speaking somebody else's language.
  configureAuthority(b.authority);
}

/** The binding, or a loud failure. Reached on every path that touches host state, so an
 *  unconfigured module fails at the first tool call with the setup it is missing named, rather
 *  than reading fields off `undefined` several frames later. */
function host(): HostBinding<any> {
  if (!binding) {
    throw new Error(
      'Ladder has no host configured: call configureHost({ state, notify, versionOf, bumpVersion, valueDeltaOf, neverEligible, authority }) once at startup, before any tool runs.',
    );
  }
  return binding;
}

/**
 * The host's state, as far as this module is concerned: opaque. Nothing here reads a field of
 * it — every host-shaped question goes through the binding above. Left as `any` rather than
 * given a structural stand-in because each tool's own `exec` is written against its host's real
 * state type (`Ctx<AppState>` in the freight app), and a concrete placeholder here would reject
 * those signatures instead of leaving the shape to the host.
 */
type State = any;

export interface LadderToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly?: boolean;
  exec(input: any, ctx: Ctx<State>): Promise<unknown>;
}

export interface Decision { groups: string[]; actions: string[]; }

/** What the operator on shift may and may not authorise, as the panel needs to say it. */
export interface AuthorityScope {
  role: AuthorityRole;
  /** Who rows above the limit go to, or null when this role is the top of the ladder. */
  target: AuthorityRole | null;
  /** Group keys the diff carries that this role cannot authorise. Never empty-checked by the UI
   *  as an enforcement step — the filter in `execute` is what enforces it. */
  referred: string[];
}

export interface PendingProposal {
  toolName: string; input: unknown; diff: Diff; notes: Note[];
  authority: AuthorityScope;
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
// 'referred' is 'applied' plus the one fact that changes what the human should do next: part of
// what they were shown was never theirs to authorise and is now with a second person. Folding it
// into 'applied' (or into a plain partial) would report a run as finished while a colleague still
// has half of it open.
export type OutcomeCause =
  | 'applied' | 'auto_applied' | 'referred' | 'refused' | 'nothing_to_decide' | 'stale'
  | 'blocked' | 'tool_error';
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

// A second surface (App.tsx's tab-forcing effect) needs to know a proposal exists without
// itself being an `onProposal` subscriber — becoming one would just race whichever subscriber
// mounts first for the same buffer-draining `forEach` above, and React flushes a child's
// passive effects (ProposalPanel, mounted below App) before a parent's own (App itself), so the
// child always wins that race and the parent sees an already-emptied buffer. Tracked as a plain
// counter rather than a boolean so two proposals queued back to back (see the F1 double-decision
// suite) don't have the second's resolution flip this back to "nothing pending" early.
let pendingProposalCount = 0;
const arrivalListeners = new Set<() => void>();

/** True whenever a proposal is awaiting a decision, whether or not it has already been drained
 *  out of `bufferedProposals` and into a subscriber's own state. Reads nothing from the buffer
 *  and drains nothing — a second surface can call this on mount to catch up on a proposal that
 *  arrived before it existed, without competing with `onProposal`'s own replay. */
export function hasPendingProposal(): boolean {
  return pendingProposalCount > 0;
}

/** Fires once per proposal, the moment it is created — alongside the existing buffer/listener
 *  notification below, never instead of it. Purely a signal: it neither reads nor drains
 *  `bufferedProposals`, so it can be subscribed to from anywhere without affecting who the
 *  buffer's own replay goes to. */
export function onProposalArrival(fn: () => void): () => void {
  arrivalListeners.add(fn);
  return () => { arrivalListeners.delete(fn); };
}

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
// Covers read-only tools too, which never enter `registrations` above. registerWhenReady()
// guarantees its own callback runs once, but this is the guard that actually matters at the
// tool level: whatever path calls registerLadderTool for a name that's already registered
// (a retry racing a caller who registered by hand, a host re-announcing itself) is a no-op
// rather than a second mc.registerTool() for the same name.
const registeredToolNames = new Set<string>();

/**
 * Every registered tool's spec, in registration order, read-only ones included — `registrations`
 * above holds only the guarded write tools, because only those need an `execute` closure kept
 * around to re-register with. The inventory panel needs the read tools too: a surface that
 * showed only the tools Ladder guards would imply Ladder had something to say about the others,
 * and its whole claim is the opposite — reads are untouched and go straight through.
 */
const toolSpecs = new Map<string, LadderToolSpec>();
const toolListeners = new Set<() => void>();

/** Fires once per tool as it registers, so a surface mounted before the host injected the
 *  namespace still fills in rather than showing an empty inventory forever. */
export function onToolsChange(fn: () => void): () => void {
  toolListeners.add(fn);
  return () => { toolListeners.delete(fn); };
}

export interface ToolSummary {
  name: string;
  readOnly: boolean;
  /** The description as it stands registered with the browser right now — for a guarded tool
   *  that is the composed one, standing rule and spend boundary included. This is the field
   *  that makes ratifying a rule visible: it is literally what the agent reads. */
  description: string;
}

/** What the agent can see, as the agent sees it. Never a second copy of the registry — every
 *  field is read back out of the same maps the registration itself wrote. */
export function listTools(): ToolSummary[] {
  return [...toolSpecs.values()].map(spec => ({
    name: spec.name,
    readOnly: Boolean(spec.readOnly),
    description: spec.readOnly ? spec.description : composedDescription(spec.name),
  }));
}

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
  if (r) reregister(tool, composedDescription(tool));
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
  const ratified = { ...p, ratified: true };
  policies.set(p.tool, ratified);
  // The just-ratified policy is passed in rather than read back through activePolicy(), which
  // treats an already-lapsed rule as absent. Ratifying an expired policy is a caller error, not
  // a silent no-op: the description says what was stamped, and the next call's expiry check is
  // what puts it back. Reading it back here would have that correction never appear to happen.
  reregister(p.tool, composedDescription(p.tool, ratified));
  draftListeners.forEach(fn => fn(null));
  policyListeners.forEach(fn => fn());
}
export const describePolicy = (p: Policy) =>
  `up to ${p.maxRecords} records, up to ${authorityVocabulary().amount(p.maxValue)}, reversible only, expires ${p.expiresAt.slice(0, 10)}`;

/**
 * The agent's own description of a guarded write tool, composed from the three things that
 * actually bound it: what the tool does, what a ratified standing rule lets it do without
 * review, and what the human on shift is allowed to authorise. Autonomy is stated in one
 * sentence and authority in the next, because they move independently — a standing rule can be
 * ratified or lapse without the spend boundary changing, and the role can change without
 * touching the rule.
 *
 * Worded about value on a record rather than about freight, so it stays true of a tool whose
 * records carry no value at all: nothing that costs nothing is ever above a limit.
 */
function composedDescription(name: string, policy?: Policy): string {
  const r = registrations.get(name);
  if (!r) return '';
  const pol = policy ?? activePolicy(name);
  const rule = pol
    ? ` Changes within the standing rule (${describePolicy(pol)}) are applied without review.`
    : '';
  const role = currentRole();
  // Omitted entirely while unbound: a module with no host has no boundary it could honestly
  // state, and a tool may be registered before configureHost runs. configureAuthority() fires
  // the role listeners, so every such tool is re-registered with this sentence the moment a
  // host arrives.
  const bound = authorityConfigured();
  const target = bound ? referralTarget(role) : null;
  // Opened on the condition rather than stated flat, so it reads correctly on a tool whose
  // changes never carry value at all — where nothing carries value, nothing is ever referred.
  // Every noun in it is the host's: its word for the condition, its role labels, its unit.
  const authority = bound
    ? ` Where a proposed change ${authorityVocabulary().carries}, the operator on shift is a ${role.label.toLowerCase()} and ${describeAuthority(role)}` +
      (target
        ? `; anything above that is referred to a ${target.label.toLowerCase()} and is not applied by this call.`
        : '.')
    : '';
  // What the agent should do when one of those two boundaries bites. `rejected` is inert to an
  // agent that reads any non-success as "call it again the same way": the reasons and the ids
  // are there so the next call can be a narrower, different one, and nothing but a sentence in
  // the description ever tells it so. Last, after both boundary sentences, because it is about
  // what happens once one of them has already applied.
  const replan =
    ' When the result\'s status is `partially_applied` or `denied`, do not retry the same call.'
    + ' Read `rejected`: each entry carries a reason and the exact ids it applies to.'
    + ' Propose a follow-up that addresses those reasons, restricted to those ids.'
    // Only a role with someone above it can produce a `pending` bucket at all, so the sentence
    // that explains one is omitted where no row could ever be referred.
    + (target
      ? ' An entry carrying `pending` is with a second person rather than refused; leave those ids out of the follow-up.'
      : '');
  return `${r.spec.description}${rule}${authority}${replan}`;
}

/**
 * Changing who is on shift changes what the agent's toolset says it can get done, so every
 * guarded write tool is re-registered with its new description — the same push-based path
 * ratifying and revoking a standing rule already take, for the same reason: the description
 * must never keep claiming a boundary that has moved.
 */
onRoleChange(() => {
  for (const name of registrations.keys()) reregister(name, composedDescription(name));
});

export function reregister(name: string, description: string) {
  const r = registrations.get(name);
  if (!r) return;
  mc.unregisterTool(name);
  mc.registerTool({ name, description, inputSchema: r.spec.inputSchema, execute: r.execute });
  // Every path that changes what the agent reads goes through here — ratifying a rule, revoking
  // one, a rule lapsing, the role on shift changing. Firing from this one place is what lets the
  // inventory panel hold a single subscription instead of tracking each of those separately and
  // eventually missing one.
  toolListeners.forEach(fn => fn());
}

let seq = 0;
const versionOf = (e: string, id: string) => host().versionOf(e, id);
const bumpVersion = (e: string, id: string) => host().bumpVersion(e, id);
const deltaOf = (w: WriteRecord) => host().valueDeltaOf(w);

/** A read tool sees real state but cannot change it. A write from a read tool is a bug, loudly. */
const readOnlyView = () => recordingProxy(host().state, {
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

/**
 * The rows one call left with a second person, held so a duty manager can pick them up after
 * the tool call that produced them has already returned. Nothing here is applied state: a
 * referral is a note that a decision is outstanding, and the decision itself goes through the
 * ordinary path — preview, panel, guarded commit — when the second approver takes it.
 */
export interface Referral {
  id: string;
  toolName: string;
  /** The original call's arguments, narrowed to the referred rows when it is picked up. */
  input: unknown;
  ids: string[];
  /** The magnitude referred, in the host's own units — euros in the freight console, share of
   *  production traffic in the edge one. Named for the first host that had one; the number is
   *  whatever `HostBinding.valueDeltaOf` measures, and only that host's own interface renders
   *  it, so nothing agent-facing ever reads a unit off this name. */
  spendEur: number;
  /** Who referred it, and who it is waiting on, in the words the strip and receipts use. */
  fromRole: string;
  toRoleId: string;
  toRole: string;
}

const referrals: Referral[] = [];
const referralListeners = new Set<() => void>();
let referralSeq = 0;

export function onReferralsChange(fn: () => void) {
  referralListeners.add(fn); return () => { referralListeners.delete(fn); };
}
export function listReferrals(): Referral[] {
  return [...referrals];
}

/**
 * The second approver picks a referral up. It is deliberately not a special commit path: the
 * tool is called again, narrowed to exactly the referred rows, so the duty manager gets their
 * own preview, their own proof sheet and the same guarded commit the first operator got. A
 * rubber stamp on someone else's diff would not be a second approval.
 *
 * Narrowing by `ids` is the one place this layer names a tool argument. It is already the layer
 * that binds core to the host application — `versionOf` and `deltaOf` above both go through the
 * host binding — so it lives here rather than leaking into `src/core/`.
 *
 * Removed from the queue on pickup, whatever the second approver then decides: it has been
 * put in front of them, and their answer (applied, cut down, or refused) is reported by the
 * ordinary receipt rather than by this list.
 */
export function reviewReferral(id: string): Promise<unknown> | null {
  const idx = referrals.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const [ref] = referrals.splice(idx, 1);
  referralListeners.forEach(fn => fn());
  const reg = registrations.get(ref.toolName);
  if (!reg) return null;
  return reg.execute({ ...(ref.input as Record<string, unknown> ?? {}), ids: ref.ids });
}

async function decide(
  toolName: string, input: unknown, diff: Diff, notes: Note[],
  authority: AuthorityScope, agent: any, signal?: AbortSignal,
) {
  let resolveFn!: (d: Decision | null) => void;
  const decision = new Promise<Decision | null>(r => { resolveFn = r; });
  signal?.addEventListener('abort', () => resolveFn(null), { once: true });
  const pending: PendingProposal = { toolName, input, diff, notes, authority, resolve: resolveFn };

  const show = async () => {
    // Counted and announced here, at creation, regardless of which branch below actually
    // delivers the proposal — this is what lets a second surface (App.tsx) learn a proposal
    // exists without becoming another `onProposal` subscriber itself. See the two exports'
    // own doc comments above.
    pendingProposalCount++;
    arrivalListeners.forEach(fn => fn());

    // No subscriber yet (e.g. a write call fired before React mounted its effect): hold this
    // proposal rather than broadcast it into an empty set, so the subscriber that eventually
    // attaches still gets it instead of the promise below waiting forever.
    if (proposalListeners.size === 0) bufferedProposals.push(pending);
    else proposalListeners.forEach(fn => fn(pending));
    const d = await decision;
    pendingProposalCount--;
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
  if (registeredToolNames.has(spec.name)) return;
  registeredToolNames.add(spec.name);
  toolSpecs.set(spec.name, spec);

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
    toolListeners.forEach(fn => fn());
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

    const shadow = await runShadow(host().state, run, { proposalId, versionOf, deltaOf });
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

    // The subjects of every bucket built below, named once. A refusal an agent cannot attach
    // to anything is a refusal it cannot replan around, so no bucket on any path is left with
    // an empty `ids` while the preview still knows what it covered. One group per record, and
    // the action ids are the same content-derived ones the human approved (or did not) by
    // name — a diff carries records or messages, effectively never both, so the two are only
    // ever concatenated on the paths that reject the whole preview at once.
    const recordIds = shadow.diff.groups.map(g => g.id);
    const actionIds = shadow.diff.actions.map(a => a.actionId);
    const allPreviewedIds = [...recordIds, ...actionIds];
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

    // The authority boundary. A row whose value is above what the operator on shift may commit
    // is not theirs to approve, so it is separated here — before the panel is opened, so they
    // are never shown a control over something they cannot do — and enforced below, after the
    // decision comes back, so nothing the interface does (or a standing rule does) can put it
    // back. Read off `valueDelta`, which is already the per-record figure the diff carries, in
    // the host's own units, and the same one the extent panel and the standing-rule cap read.
    const role = currentRole();
    const target = referralTarget(role);
    const referredGroups = shadow.diff.groups.filter(g => isReferable(g.valueDelta, role));
    const referredKeys = new Set(referredGroups.map(g => g.group));
    const authority: AuthorityScope = { role, target, referred: [...referredKeys] };

    const approved: Decision | null = auto
      ? { groups: shadow.diff.groups.map(g => g.group), actions: [] }
      : nothingToDecide
      ? null
      : await decide(spec.name, input, shadow.diff, shadow.notes, authority, agent, options?.signal);

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
        rejected: [
          ...rejectedFrom(shadow.notes),
          // One line per kind rather than a single `diffRequested` line, so each says which
          // ids it covers; together they still sum to diffRequested, so the ledger is unmoved.
          { count: shadow.diff.groups.length, reason: 'the operator refused this change', ids: recordIds },
          { count: shadow.diff.actions.length, reason: 'the operator did not approve these messages', ids: actionIds },
        ],
        actions_released: 0, actions_dropped: shadow.diff.actions.length,
        replan_required: true, rule_offered: null,
        ...(noMatch ? { reason: 'no records or actions matched this request; nothing was found to change' } : {}),
      });
    }

    // Enforcement, not presentation. The panel already withholds these controls, and a ratified
    // standing rule approves every group without a panel at all — both of those hand a group
    // list to this line, and neither of them gets to decide the boundary. An authority limit
    // that only the interface honoured would not be an authority limit.
    const authorisedGroups = approved.groups.filter(g => !referredKeys.has(g));

    const ws = buildWriteSet(shadow.diff, authorisedGroups, approved.actions);
    const out = await runCommit(host().state, run, ws, { versionOf, bumpVersion });
    host().notify();

    // Kept as the set, not just its size: the rows the operator struck out are exactly the
    // previewed groups that are neither in here nor referred, and naming them needs the keys.
    const appliedRowKeys = new Set(out.applied.map(w => `${w.entity}:${w.id}`));
    const appliedRows = appliedRowKeys.size;
    // narrowedOut and droppedActions only mean anything once the commit actually ran: for an
    // abort (stale, diverged, or a scope violation) nothing was applied or released for a
    // wholly different reason, and counting the whole diff (or every approved action) as
    // "narrowed"/"dropped" there would double it against the abort's own bucket below.
    const committed = out.status === 'applied' || out.status === 'partially_applied';
    const narrowedOut = committed ? shadow.diff.totals.records - appliedRows : 0;
    const droppedActions = committed ? out.dropped.length : 0;
    const appliedTotal = appliedRows + out.released.length;

    // Referred rows sit inside `narrowedOut` — they were previewed and not applied, exactly
    // like a row the operator unticked — but they are not the same event and must not be
    // reported as one. Split here, once, so the two get their own reason lines below and the
    // ledger still sums to the same total either way. A referred row can never be in
    // `appliedRows` (the filter above kept it out of the write set), so this cannot go negative.
    const referredCount = committed ? referredGroups.length : 0;
    const removedByOperator = narrowedOut - referredCount;
    const referredIds = referredGroups.map(g => g.id);
    // A diff group's key is `entity:id`, the same shape appliedRowKeys holds, so this is a
    // straight set difference. Every applied write was previewed (the commit guard allows
    // nothing else) and a referred group can never be applied, so this list has exactly
    // `removedByOperator` entries — the count and its subjects come from one fact, not two.
    const removedIds = committed
      ? shadow.diff.groups
          .filter(g => !appliedRowKeys.has(g.group) && !referredKeys.has(g.group))
          .map(g => g.id)
      : [];
    const awaiting = target ? target.label.toLowerCase() : 'a second approver';

    if (referredCount > 0) {
      referrals.push({
        id: `ref-${++referralSeq}`,
        toolName: spec.name,
        input,
        ids: referredIds,
        spendEur: referredGroups.reduce((n, g) => n + g.valueDelta, 0),
        fromRole: role.label,
        toRoleId: target?.id ?? role.id,
        toRole: target?.label ?? role.label,
      });
      referralListeners.forEach(fn => fn());
    }

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
      ...(referredCount > 0 ? [{
        count: referredCount,
        reason: `above the ${role.label.toLowerCase()}'s ${authorityVocabulary().amount(role.limit)} ${authorityVocabulary().bound} — referred to a ${awaiting}, not refused`,
        ids: referredIds,
        pending: awaiting,
      }] : []),
      ...(removedByOperator > 0 ? [{ count: removedByOperator, reason: 'the operator removed these from the change', ids: removedIds }] : []),
      ...(droppedActions > 0 ? [{ count: droppedActions, reason: 'the operator did not approve these messages', ids: out.dropped }] : []),
      ...(out.status === 'aborted_stale' ? [{ count: diffRequested, reason: 'a record changed after the preview; nothing was applied', ids: allPreviewedIds }] : []),
      ...(out.status === 'aborted_diverged' ? [{ count: diffRequested, reason: `an approved field would have received a value the preview never showed (${out.violation}); nothing was applied`, ids: allPreviewedIds }] : []),
      ...(!committed && out.violation && out.status !== 'aborted_diverged' ? [{ count: diffRequested, reason: `the tool tried to write outside the approved set (${out.violation}); everything was rolled back`, ids: allPreviewedIds }] : []),
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
      ? draftPolicy(spec.name, history, new Date(), host().neverEligible)
      : null;
    if (draft) draftListeners.forEach(fn => fn(draft));

    const cause: OutcomeCause =
      out.status === 'aborted_stale' ? 'stale' :
      out.status === 'aborted_diverged' ? 'blocked' :
      !committed && out.violation ? 'blocked' :
      // A commit that returned `denied` with no violation key is a tool that threw, not the
      // guard firing. Kept apart so the UI never reports a crash as enforcement.
      !committed ? 'tool_error' :
      // Named before 'auto_applied' and before 'applied': whatever else was true of this run,
      // the fact the human has to act on is that part of it is now with someone else.
      referredCount > 0 ? 'referred' :
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
      //
      // Referred rows are the one exception, and they are subtracted here rather than left out
      // of `rejected`: they did not happen, so they stay in the ledger, but they have not been
      // refused either. Telling an agent to replan around a row a duty manager is holding would
      // have it propose a worse remedy for freight that is about to get a better one.
      replan_required: rejectedTotal - referredCount > 0 || out.error !== undefined,
      ...(referredCount > 0
        ? { referred: { count: referredCount, ids: referredIds, awaiting } }
        : {}),
      rule_offered: draft ? describePolicy(draft) : null,
      ...(out.error !== undefined ? { error: `the tool failed during commit: ${out.error}` } : {}),
    }, auto ? describePolicy(pol!) : undefined);
  };

  // Registered before the description is composed, because composedDescription() reads the
  // registration back for the tool's base words — and the agent is told about the spend
  // boundary from the first registration, not only once a row has already been referred.
  registrations.set(spec.name, { spec, execute });
  mc.registerTool({
    name: spec.name, description: composedDescription(spec.name),
    inputSchema: spec.inputSchema, execute,
  });
  toolListeners.forEach(fn => fn());
}
