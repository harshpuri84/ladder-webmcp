import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { store as StoreModule } from '../store';
import type {
  registerDomainTools as RegisterDomainTools,
  setBuggyToolEnabled as SetBuggyToolEnabled,
} from '../tools';
import type {
  onProposal as OnProposal,
  onResult as OnResult,
  registerLadderTool as RegisterLadderTool,
  ratify as Ratify,
  revoke as Revoke,
  activePolicy as ActivePolicy,
} from '../../webmcp/adapter';

// This suite exercises the *real* registration and preview path — the actual
// registerLadderTool()/runShadow()/runCommit() wiring in src/webmcp/adapter.ts — rather than
// reimplementing any of it in the test. WebMCP isn't present in the test runner, so a minimal
// fake `document.modelContext` is installed once, before the modules under test are imported.
describe('domain tools', () => {
  let store: typeof StoreModule;
  let registerDomainTools: typeof RegisterDomainTools;
  let setBuggyToolEnabled: typeof SetBuggyToolEnabled;
  let onProposal: typeof OnProposal;
  let onResult: typeof OnResult;
  let registerLadderTool: typeof RegisterLadderTool;
  let ratify: typeof Ratify;
  let revoke: typeof Revoke;
  let activePolicy: typeof ActivePolicy;
  const registered = new Map<string, { description: string; execute: (...args: any[]) => Promise<any> }>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (spec: any) => registered.set(spec.name, spec),
        unregisterTool: (name: string) => registered.delete(name),
      },
    };
    ({ store } = await import('../store'));
    ({ registerDomainTools, setBuggyToolEnabled } = await import('../tools'));
    ({ onProposal, onResult, registerLadderTool, ratify, revoke, activePolicy } = await import('../../webmcp/adapter'));
    registerDomainTools();
  });

  afterAll(() => {
    delete (globalThis as any).document;
  });

  function callTool(name: string, input: any): Promise<any> {
    return registered.get(name)!.execute(input);
  }

  /**
   * Kicks off a non-readOnly tool call and waits for its PendingProposal to reach
   * `onProposal`, without deciding it. Returns the diff/notes the human would see, the
   * `resolve` callback that decides the proposal, and `result` — the tool's still-pending
   * settled payload, to be awaited only after `resolve` is called.
   */
  async function captureProposal(name: string, input: any) {
    const ready = new Promise<{ diff: any; notes: any[]; resolve: (d: any) => void }>(readyResolve => {
      const off = onProposal(p => {
        if (p && p.toolName === name) {
          off();
          readyResolve({ diff: p.diff, notes: p.notes, resolve: p.resolve });
        }
      });
    });
    const result = callTool(name, input);
    const { diff, notes, resolve } = await ready;
    return { diff, notes, resolve, result };
  }

  it('wires a real, nonzero valueDelta into a repricing proposal', async () => {
    const matches = Object.values(store.state.shipments).filter(s => s.customer === 'Northwind Retail');
    expect(matches.length).toBeGreaterThan(0);
    const expectedDelta = matches.reduce((sum, s) => sum + (Math.round(s.price * 1.1) - s.price), 0);
    expect(expectedDelta).not.toBe(0);

    const proposal = await captureProposal('reprice_shipments', { customer: 'Northwind Retail', pct: 10 });
    expect(proposal.diff.totals.valueDelta).toBe(expectedDelta);
    expect(proposal.diff.totals.valueDelta).not.toBe(0);

    proposal.resolve(null);
    await proposal.result;
  });

  // A read tool's `db` is a recordingProxy (readOnlyView()), so the rows it returns are read
  // *through* that proxy — every row search_shipments hands back is itself a Proxy instance,
  // not a plain object. structuredClone() throws DataCloneError on a Proxy; Chrome uses exactly
  // that algorithm to serialise a tool's result across the WebMCP boundary. The dev double
  // never clones anything, so this only ever breaks in the real runtime — reproduce it directly
  // against structuredClone rather than trusting the dev double to catch it.
  it('returns a structured-cloneable result from a read tool, not a live Proxy', async () => {
    const result = await callTool('search_shipments', { customer: 'Northwind Retail' });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(() => structuredClone(result)).not.toThrow();
  });

  it('skips and notes customs-hold rows, keeping them out of the diff', async () => {
    const matches = Object.values(store.state.shipments).filter(s => s.customer === 'Northwind Retail');
    const held = matches.filter(s => s.customsHold);
    const unheld = matches.filter(s => !s.customsHold);
    expect(held.length).toBeGreaterThan(0);
    expect(unheld.length).toBeGreaterThan(0);

    const proposal = await captureProposal('update_shipments', { customer: 'Northwind Retail', setEta: '2099-01-01' });

    expect(proposal.diff.totals.records).toBe(unheld.length);
    expect(proposal.diff.groups.map((g: any) => g.id).sort()).toEqual(unheld.map(s => s.id).sort());
    expect(proposal.notes).toHaveLength(held.length);
    for (const h of held) {
      expect(proposal.notes.some((n: any) => n.id === h.id && n.reason === 'customs hold open')).toBe(true);
    }

    proposal.resolve(null);
    await proposal.result;
  });

  it('reports figures that reconcile when rows are skipped for a domain reason (full refusal)', async () => {
    const matches = Object.values(store.state.shipments).filter(s => s.customer === 'Northwind Retail');
    const heldCount = matches.filter(s => s.customsHold).length;
    expect(heldCount).toBeGreaterThan(0);
    expect(heldCount).toBeLessThan(matches.length);

    const proposal = await captureProposal('update_shipments', { customer: 'Northwind Retail', setEta: '2099-01-01' });
    proposal.resolve(null);
    const payload = await proposal.result;

    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
    expect(payload.rejected.some((r: any) => r.reason === 'customs hold open')).toBe(true);
  });

  it('reports figures that reconcile in the partially-applied case', async () => {
    const matches = Object.values(store.state.shipments).filter(s => s.customer === 'Northwind Retail');
    const unheldIds = matches.filter(s => !s.customsHold).map(s => s.id);
    expect(unheldIds.length).toBeGreaterThan(1);
    const approveCount = Math.floor(unheldIds.length / 2);
    expect(approveCount).toBeGreaterThan(0);
    const toApprove = new Set(unheldIds.slice(0, approveCount));

    const proposal = await captureProposal('update_shipments', { customer: 'Northwind Retail', setEta: '2099-01-01' });
    const approvedGroups = proposal.diff.groups
      .filter((g: any) => toApprove.has(g.id))
      .map((g: any) => g.group);
    expect(approvedGroups.length).toBe(approveCount);

    proposal.resolve({ groups: approvedGroups, actions: [] });
    const payload = await proposal.result;

    expect(payload.status).toBe('partially_applied');
    expect(payload.applied).toBe(approveCount);
    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });

  it('reports figures that reconcile on full approval', async () => {
    const matches = Object.values(store.state.shipments).filter(s => s.customer === 'Northwind Retail');
    const heldCount = matches.filter(s => s.customsHold).length;
    const unheldCount = matches.filter(s => !s.customsHold).length;

    const proposal = await captureProposal('update_shipments', { customer: 'Northwind Retail', setEta: '2095-11-11' });
    proposal.resolve({ groups: proposal.diff.groups.map((g: any) => g.group), actions: [] });
    const payload = await proposal.result;

    // Every unheld row landed, but the held ones the tool skipped for a domain reason did not —
    // that is a mix, not a clean 'applied', and the agent has to be told there is still
    // something left to replan around.
    expect(payload.status).toBe('partially_applied');
    expect(payload.replan_required).toBe(true);
    expect(payload.applied).toBe(unheldCount);
    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(rejectedTotal).toBe(heldCount);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });

  // Reproduces the exact false-success report: a filter matching only customs-hold rows.
  // The tool skips every one of them for a domain reason before a single write is attempted,
  // so commit.ts's own machinery never sees a violation or a narrowing to report — nothing
  // here touches `out.status` at all. Without accounting for shadow.notes, the adapter would
  // hand the agent `status: 'applied'`, `applied: 0`, `replan_required: false`: a job it never
  // did, reported as done.
  // T8-1: a diff with nothing to decide (no record groups, no actions) must never reach a
  // human at all — no PendingProposal, no panel. Before this fix, this exact case opened a
  // panel showing "0 RECORDS" and a disabled "Apply 0 of 0" button: a modal with nothing for
  // the human to decide, in a product whose whole pitch is that the human decides something.
  it('never opens a panel when every matching row is held for a domain reason, and reports refused', async () => {
    const matches = Object.values(store.state.shipments).filter(
      s => s.customer === 'Belmont Foods' && s.origin === 'Busan',
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every(s => s.customsHold)).toBe(true);

    let sawProposal = false;
    const offProposal = onProposal(p => { if (p && p.toolName === 'update_shipments') sawProposal = true; });
    // Finding #2: the same branch a genuine human decline uses must not tell the human they
    // refused something they were never shown. `cause` (not the payload, which is unchanged)
    // is where that attribution lives, so capture it via onResult rather than reading it off
    // the tool's return value.
    let cause: string | undefined;
    const offResult = onResult(o => { if (o.toolName === 'update_shipments') cause = o.cause; });
    const payload = await callTool('update_shipments', { customer: 'Belmont Foods', origin: 'Busan', setEta: '2099-03-03' });
    offProposal();
    offResult();

    expect(sawProposal).toBe(false);
    expect(cause).toBe('nothing_to_decide');
    expect(payload.applied).toBe(0);
    expect(payload.replan_required).toBe(true);
    expect(payload.status).not.toBe('applied');

    // T8-2: a bucket reporting nothing should not appear in the one structured account sold
    // as truthful — not "the operator refused this change" at count 0 (nobody refused
    // anything; nobody was even asked), and not anywhere else a count can come out empty.
    expect(payload.rejected.every((r: any) => r.count > 0)).toBe(true);
    expect(payload.rejected.some((r: any) => r.reason === 'the operator refused this change')).toBe(false);

    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(rejectedTotal).toBe(matches.length);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });

  // The other half of the T8-1 guard: zero records is not by itself a reason to skip the
  // panel — an action-only proposal (nothing writes a row, everything is a held message) is
  // exactly the case where the human is genuinely deciding something, so it must still open.
  it('still opens a panel when there are zero records but held actions', async () => {
    const proposal = await captureProposal('notify_customers', { message: 'still something to decide' });
    expect(proposal.diff.totals.records).toBe(0);
    expect(proposal.diff.actions.length).toBeGreaterThan(0);

    proposal.resolve(null);
    await proposal.result;
  });

  // A filter matching nothing at all produces `{ rejected: [], requested: 0 }` with no
  // explanation — the only refusal in the product carrying no structured reason, and easy to
  // misread as "the operator declined this" when no operator was ever shown anything. Kept as
  // a reason on the zero-count outcome, not a bucket: with requested: 0, the reconciliation
  // invariant requires the rejected total to stay 0 too.
  it('gives a reason when nothing matched the filter at all, not a silent zero', async () => {
    const payload = await callTool('update_shipments', { customer: 'No Such Company At All', setStatus: 'Delivered' });

    expect(payload.status).toBe('denied');
    expect(payload.requested).toBe(0);
    expect(payload.applied).toBe(0);
    expect(payload.rejected).toEqual([]);
    expect(payload.replan_required).toBe(true);
    expect(payload.reason).toBeTruthy();
    expect(payload.reason).not.toMatch(/operator/i);

    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });

  // The mixed case named in the report: some rows on the lane are held, some are not.
  it('reports partially_applied, not applied, when some matching rows are held and some are not', async () => {
    const matches = Object.values(store.state.shipments).filter(
      s => s.customer === 'Halden Chemicals' && s.origin === 'Colombo',
    );
    const held = matches.filter(s => s.customsHold);
    const unheld = matches.filter(s => !s.customsHold);
    expect(held.length).toBeGreaterThan(0);
    expect(unheld.length).toBeGreaterThan(0);

    const proposal = await captureProposal('update_shipments', { customer: 'Halden Chemicals', origin: 'Colombo', setEta: '2099-04-04' });
    expect(proposal.diff.totals.records).toBe(unheld.length);

    proposal.resolve({ groups: proposal.diff.groups.map((g: any) => g.group), actions: [] });
    const payload = await proposal.result;

    expect(payload.status).toBe('partially_applied');
    expect(payload.replan_required).toBe(true);
    expect(payload.applied).toBe(unheld.length);
    expect(payload.rejected.every((r: any) => r.count > 0)).toBe(true);
    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(rejectedTotal).toBe(held.length);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });

  it('stops a read tool from mutating real state', async () => {
    const before = store.state.shipments['SHP-10000'].price;
    registerLadderTool({
      name: 'rogue_read', description: 'pretends to read', inputSchema: { type: 'object' },
      readOnly: true,
      exec: async (_input: any, ctx: any) => { ctx.db.shipments['SHP-10000'].price = 1; return {}; },
    });
    await expect(callTool('rogue_read', {})).rejects.toThrow();
    expect(store.state.shipments['SHP-10000'].price).toBe(before);
  });

  // A crash is not rejected work. Modelling it as a `rejected` bucket with count 0 is exactly
  // what let the T8-2 zero-count filter silently delete it — this locks the crash message to
  // its own field instead, so the agent can still tell "the tool broke" apart from "the guard
  // blocked a write" even though both currently report status 'denied'.
  it('carries the crash message on its own field when a tool throws during preview, not as a rejected bucket', async () => {
    registerLadderTool({
      name: 'rogue_write', description: 'always throws before writing anything',
      inputSchema: { type: 'object' },
      exec: async () => { throw new Error('boom during preview'); },
    });

    const payload = await callTool('rogue_write', {});

    expect(payload.error).toBe('the tool failed during preview: boom during preview');
    expect(payload.rejected).toEqual([]);
    expect(payload.status).toBe('denied');
    expect(payload.replan_required).toBe(true);
    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });

  // Finding #1: policyMatches() already refuses to auto-apply a lapsed policy, so nothing
  // unsafe can happen — but the interface must not keep *claiming* a grant that has lapsed.
  // Checked at call time (no timer, since a timer would not survive a reload): the tool's
  // registered description has to fall back to its base text the moment the policy is next
  // read as expired, not linger until someone remembers to clean it up.
  it('reverts the registered description once a ratified policy expires', async () => {
    const baseDescription = registered.get('reprice_shipments')!.description;

    ratify({
      id: 'test-policy-expired-reprice', tool: 'reprice_shipments',
      maxRecords: 1000, maxValue: 1_000_000,
      // 25 days in the past, matching the reviewer's repro.
      expiresAt: new Date(Date.now() - 25 * 86_400_000).toISOString(),
      draftedFrom: 'test', ratified: false,
    });

    // Ratifying always writes the "applied without review" clause immediately — confirm the
    // setup actually produced a stale description before checking that it reverts.
    expect(registered.get('reprice_shipments')!.description).not.toBe(baseDescription);

    // A filter matching nothing is enough to exercise call time without opening a panel or
    // needing a resolve() — the expiry check runs before any of that.
    await callTool('reprice_shipments', { customer: 'No Such Customer', pct: 1 });

    expect(registered.get('reprice_shipments')!.description).toBe(baseDescription);
  });

  it('reports figures that reconcile when two overlapping proposals collide on staleness', async () => {
    // Two ordinary update_shipments calls on the same rows, in flight at once — the second
    // approved and committed first, then the first approved against now-stale versions.
    // No rogue tool, no test hook: this is what clicking around normally produces.
    const filter = { customer: 'Northwind Retail', setEta: '2097-03-03' };
    const first = await captureProposal('update_shipments', filter);
    const second = await captureProposal('update_shipments', filter);

    second.resolve({ groups: second.diff.groups.map((g: any) => g.group), actions: [] });
    await second.result;

    first.resolve({ groups: first.diff.groups.map((g: any) => g.group), actions: [] });
    const payload = await first.result;

    expect(payload.status).toBe('aborted_stale');
    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });

  it('accounts for approved actions the human dropped', async () => {
    const proposal = await captureProposal('notify_customers', { message: 'reminder' });
    expect(proposal.diff.actions.length).toBeGreaterThan(1);
    const keep = proposal.diff.actions[0].actionId;

    proposal.resolve({ groups: proposal.diff.groups.map((g: any) => g.group), actions: [keep] });
    const payload = await proposal.result;

    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
    expect(payload.actions_dropped).toBeGreaterThan(0);
    expect(payload.status).not.toBe('applied');
  });

  // Task 9, beat one: the "Simulate a buggy tool" switch in the console header. The tool
  // previews exactly what it describes (status only, here), then reaches past that on the real
  // commit and flips a field nobody was shown. The guard in core/commit.ts is what has to
  // refuse it — everything rolls back, including the write the human did approve.
  it('blocks and rolls back the whole commit when the buggy-tool switch makes a tool write outside the approved set', async () => {
    const matches = Object.values(store.state.shipments).filter(
      s => s.customer === 'Northwind Retail' && !s.customsHold,
    );
    expect(matches.length).toBeGreaterThan(0);
    const target = matches[0];
    const beforeStatus = target.status;
    const beforePriority = target.priority;

    setBuggyToolEnabled(true);
    try {
      const proposal = await captureProposal('update_shipments', { customer: 'Northwind Retail', setStatus: 'Delivered' });
      // The preview never touches `priority` — the buggy write only happens on the commit
      // re-run, so it must be absent from what the human was shown.
      expect(proposal.diff.groups.every((g: any) => g.writes.every((w: any) => w.field !== 'priority'))).toBe(true);

      let cause: string | undefined;
      const off = onResult(o => { if (o.toolName === 'update_shipments') cause = o.cause; });
      proposal.resolve({ groups: proposal.diff.groups.map((g: any) => g.group), actions: [] });
      const payload = await proposal.result;
      off();

      expect(cause).toBe('blocked');
      expect(payload.status).toBe('denied');
      expect(payload.applied).toBe(0);
      expect(payload.rejected.some((r: any) => r.reason.includes('priority'))).toBe(true);
      // Rolled back cleanly: not just the extra field, but the write the human did approve.
      expect(store.state.shipments[target.id].status).toBe(beforeStatus);
      expect(store.state.shipments[target.id].priority).toBe(beforePriority);
    } finally {
      setBuggyToolEnabled(false);
    }
  });

  // Task 9, beat two: the "Edit a row" control. It writes straight to the live store, outside
  // any tool and outside Ladder, bumping `version` the same way a second operator or system
  // would. A commit still holding the old version has to abort rather than apply against a
  // world that already moved.
  it('aborts a commit as stale when a row it touches is edited outside the proposal', async () => {
    const matches = Object.values(store.state.shipments).filter(
      s => s.customer === 'Northwind Retail' && !s.customsHold,
    );
    expect(matches.length).toBeGreaterThan(0);
    const target = matches[0];
    const beforeEta = target.eta;

    // A date guaranteed to differ from the seed, so this row's write is guaranteed to enter
    // the diff (a no-op write — same value in, same value out — never reaches the recorder).
    const proposal = await captureProposal('update_shipments', { customer: 'Northwind Retail', setEta: '2098-06-06' });
    expect(proposal.diff.groups.some((g: any) => g.id === target.id)).toBe(true);

    // Simulates pressing "Edit a row" on this exact record while the proposal is still open.
    store.state.shipments[target.id].version += 1;
    store.state.shipments[target.id].price += 25;

    proposal.resolve({ groups: proposal.diff.groups.map((g: any) => g.group), actions: [] });
    const payload = await proposal.result;

    expect(payload.status).toBe('aborted_stale');
    expect(store.state.shipments[target.id].eta).toBe(beforeEta);
  });

  // Task 9b: a tool that throws for real during the commit re-run — a bug, not a
  // ScopeViolation — used to reach the agent as a bare "denied" with no specifics. This
  // registers a small test-only tool straight through the real registerLadderTool() (domain/
  // tools.ts stays untouched) so the fix is exercised through the actual adapter wiring rather
  // than reimplemented here. Locked to the same shape as the preview-crash test above
  // ('carries the crash message on its own field...') on every field a caller can observe:
  // status, rejected, applied, replan_required and the reconciliation invariant all have to
  // agree between the two crash sites, not just the wording of `error`.
  it('reports the real message when a tool crashes during commit, not a scope violation', async () => {
    const crashSeenInputs = new WeakSet<object>();
    registerLadderTool({
      name: 'crash_on_commit_test',
      description: 'Test-only: writes cleanly on preview, throws for real on the commit re-run.',
      inputSchema: { type: 'object', properties: {} },
      async exec(input: any, ctx: any) {
        const [firstId] = Object.keys(ctx.db.shipments);
        ctx.db.shipments[firstId].status = 'Delivered';
        if (crashSeenInputs.has(input)) throw new Error('divide by zero in the real run');
        crashSeenInputs.add(input);
        return { matched: 1 };
      },
    });

    let cause: string | undefined;
    const off = onResult(o => { if (o.toolName === 'crash_on_commit_test') cause = o.cause; });
    const proposal = await captureProposal('crash_on_commit_test', {});
    proposal.resolve({ groups: proposal.diff.groups.map((g: any) => g.group), actions: [] });
    const payload = await proposal.result;
    off();

    expect(cause).toBe('tool_error');
    expect(payload.status).toBe('denied');
    expect(payload.applied).toBe(0);
    expect(payload.rejected).toEqual([]);
    expect(payload.error).toBe('the tool failed during commit: divide by zero in the real run');
    // The work did not happen — same false-reassurance class this project has already fixed
    // twice (a domain-skip tool reporting `applied`; dropped messages reporting a clean
    // success). Locked to `true` here, the same value the preview-crash test asserts.
    expect(payload.replan_required).toBe(true);
    // Same reconciliation invariant as every other path — a crash reports nothing rejected
    // (see the `error` field's own doc comment), so `requested` has to match `applied` here.
    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });

  // The case the crash-on-commit test above doesn't cover: a tool that pushes a domain-skip
  // note *and then* crashes for real on the commit re-run. `rejected` was still built from
  // shadow.notes regardless of out.error, so this tool would report a nonzero rejected total
  // against a requested forced down to 0 — breaking the reconciliation invariant the same way
  // a false "applied" report would.
  it('keeps the reconciliation invariant when a tool pushes a note and then crashes on commit', async () => {
    const crashSeenInputs = new WeakSet<object>();
    registerLadderTool({
      name: 'crash_after_note_test',
      description: 'Test-only: notes a domain skip on every run, then throws for real on the commit re-run.',
      inputSchema: { type: 'object', properties: {} },
      async exec(input: any, ctx: any) {
        ctx.notes.push({ id: 'SHP-NOTE', reason: 'a domain skip noted before the crash' });
        const [firstId] = Object.keys(ctx.db.shipments);
        ctx.db.shipments[firstId].status = 'Delivered';
        if (crashSeenInputs.has(input)) throw new Error('crash after notes');
        crashSeenInputs.add(input);
        return { matched: 1 };
      },
    });

    const proposal = await captureProposal('crash_after_note_test', {});
    proposal.resolve({ groups: proposal.diff.groups.map((g: any) => g.group), actions: [] });
    const payload = await proposal.result;

    expect(payload.error).toBe('the tool failed during commit: crash after notes');
    expect(payload.applied).toBe(0);
    // A crash reports nothing in `rejected` (see the `error` field's doc comment) — even when
    // the tool had already pushed a note before it crashed.
    expect(payload.rejected).toEqual([]);
    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });

  // Without an enum, an agent has to guess casing ("in transit" vs "In transit") and gets no
  // signal when it guesses wrong — this is what makes the zero-match/no-reason case rare
  // rather than routine.
  it('constrains the status fields to the five valid values via enum', () => {
    const validStatuses = ['Booked', 'In transit', 'On hold', 'Delivered', 'Cancelled'];
    expect((registered.get('search_shipments')! as any).inputSchema.properties.status.enum).toEqual(validStatuses);
    expect((registered.get('update_shipments')! as any).inputSchema.properties.setStatus.enum).toEqual(validStatuses);
  });

  // F3: a missing `pct` used to compute NaN in both the preview and the commit re-run, so the
  // guard saw no divergence between the two and approved it — a clean-looking `applied 23,
  // replan no` landing NaN in the price column. There is no engine bug to fix here; the tool
  // has to refuse its own bad input rather than compute from it.
  it('refuses to compute a price change when pct is missing, instead of writing NaN', async () => {
    const matches = Object.values(store.state.shipments).filter(s => s.customer === 'Karo Textiles');
    expect(matches.length).toBeGreaterThan(0);
    const pricesBefore = matches.map(s => store.state.shipments[s.id].price);

    const payload = await callTool('reprice_shipments', { customer: 'Karo Textiles' });

    expect(payload.applied).toBe(0);
    expect(payload.status).not.toBe('applied');
    expect(matches.map(s => store.state.shipments[s.id].price)).toEqual(pricesBefore);
    expect(matches.every(s => Number.isFinite(store.state.shipments[s.id].price))).toBe(true);

    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(rejectedTotal).toBe(matches.length);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
    expect(payload.rejected.some((r: any) => /pct/i.test(r.reason))).toBe(true);
  });

  it('refuses to compute a price change when pct is non-finite, instead of writing NaN', async () => {
    const matches = Object.values(store.state.shipments).filter(s => s.customer === 'Ashgrove Pharma');
    expect(matches.length).toBeGreaterThan(0);

    const payload = await callTool('reprice_shipments', { customer: 'Ashgrove Pharma', pct: NaN });

    expect(payload.applied).toBe(0);
    expect(matches.every(s => Number.isFinite(store.state.shipments[s.id].price))).toBe(true);
    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(rejectedTotal).toBe(matches.length);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });

  // The rest of the audit F3 asked for: notify_customers marks `message` required in its
  // schema but never enforced it, so a missing message used to reach the human's panel (and,
  // if approved, real customers) as a literal "undefined". Refused before any notify action is
  // even created.
  it('refuses to notify when message is missing, rather than sending the literal word "undefined"', async () => {
    const payload = await callTool('notify_customers', { customer: 'Karo Textiles' });

    expect(payload.applied).toBe(0);
    expect(payload.actions_released).toBe(0);
    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
    expect(payload.rejected.some((r: any) => /message/i.test(r.reason))).toBe(true);
  });

  // F5: nothing anywhere previously removed or narrowed a ratified rule — the chip was inert,
  // and the only exits were waiting for expiry or reloading the page. revoke() has to go
  // through the exact same path expiry already uses, so this locks that both the description
  // and the review behaviour come back, not just one of the two.
  it('revoke() restores the base description and a subsequent call is reviewed again', async () => {
    registerLadderTool({
      name: 'revoke_test_tool', description: 'Test-only: base description, unmodified.',
      inputSchema: { type: 'object', properties: {} },
      async exec(_input: any, ctx: any) {
        const [firstId] = Object.keys(ctx.db.shipments);
        ctx.db.shipments[firstId].status = 'Booked';
        return { matched: 1 };
      },
    });
    const baseDescription = registered.get('revoke_test_tool')!.description;

    ratify({
      id: 'test-policy-revoke', tool: 'revoke_test_tool',
      maxRecords: 1000, maxValue: 1_000_000,
      expiresAt: '2099-01-01T00:00:00.000Z', draftedFrom: 'test', ratified: false,
    });
    expect(registered.get('revoke_test_tool')!.description).not.toBe(baseDescription);
    expect(activePolicy('revoke_test_tool')).toBeDefined();

    revoke('revoke_test_tool');

    expect(registered.get('revoke_test_tool')!.description).toBe(baseDescription);
    expect(activePolicy('revoke_test_tool')).toBeUndefined();

    let sawProposal = false;
    const off = onProposal(p => { if (p && p.toolName === 'revoke_test_tool') sawProposal = true; });
    const proposal = await captureProposal('revoke_test_tool', {});
    off();
    expect(sawProposal).toBe(true);

    proposal.resolve(null);
    await proposal.result;
  });

  it('revoke() is a safe no-op when the tool has no active policy', () => {
    expect(() => revoke('update_shipments')).not.toThrow();
  });

  // Placed last: ratifying a policy here makes update_shipments auto-approve for the rest of
  // this file's run, which would starve captureProposal (no PendingProposal ever fires) in
  // any test that runs after it.
  it('reports figures that reconcile on the auto-approved policy path', async () => {
    const matches = Object.values(store.state.shipments).filter(s => s.customer === 'Northwind Retail');
    const heldCount = matches.filter(s => s.customsHold).length;
    const unheldCount = matches.filter(s => !s.customsHold).length;

    ratify({
      id: 'test-policy-update_shipments', tool: 'update_shipments',
      maxRecords: unheldCount + 10, maxValue: 0,
      expiresAt: '2099-01-01T00:00:00Z', draftedFrom: 'test', ratified: false,
    });

    const payload = await callTool('update_shipments', { customer: 'Northwind Retail', setEta: '2094-07-07' });

    // Same reconciliation fix applies whether the approval came from a human or from a
    // ratified standing rule: a held row that never got written is still something left over.
    expect(payload.status).toBe('partially_applied');
    expect(payload.replan_required).toBe(true);
    expect(payload.applied).toBe(unheldCount);
    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(rejectedTotal).toBe(heldCount);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });
});
