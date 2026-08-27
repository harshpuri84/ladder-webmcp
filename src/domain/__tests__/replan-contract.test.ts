import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { store as StoreModule } from '../store';
import type { registerDomainTools as RegisterDomainTools } from '../tools';
import type {
  onProposal as OnProposal,
  listTools as ListTools,
  ratify as Ratify,
  revoke as Revoke,
  PendingProposal,
} from '../../webmcp/adapter';
import type { ROLES as Roles, setRole as SetRole } from '../../webmcp/authority';
import { checkRemedy } from '../remedy-policy';

/**
 * The refusal payload is only worth anything if the agent does something with it. Two things
 * have to hold for that, and neither is provable by reading a constant:
 *
 *  1. The description the browser actually holds tells the agent what to do with a refusal —
 *     in every state that description is composed in, since it is re-composed whenever a
 *     standing rule or the role on shift changes.
 *  2. Every bucket in `rejected` names the ids it covers, so a follow-up can be narrowed to
 *     them. A refusal whose subjects the agent cannot name is one it cannot replan around.
 *
 * So this suite reads the description back out of the registry the adapter registered it with,
 * never out of a spec object, and drives real proposals through the real preview/commit path.
 * It cannot show that a live agent replans — no WebMCP runtime exists in the test runner — only
 * that everything the agent would need to is present and correct.
 */
describe('the replan contract', () => {
  let store: typeof StoreModule;
  let registerDomainTools: typeof RegisterDomainTools;
  let onProposal: typeof OnProposal;
  let listTools: typeof ListTools;
  let ratify: typeof Ratify;
  let revoke: typeof Revoke;
  let ROLES: typeof Roles;
  let setRole: typeof SetRole;
  const registered = new Map<string, { description: string; execute: (...a: any[]) => Promise<any> }>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (spec: any) => registered.set(spec.name, spec),
        unregisterTool: (name: string) => registered.delete(name),
      },
    };
    ({ store } = await import('../store'));
    ({ registerDomainTools } = await import('../tools'));
    ({ onProposal, listTools, ratify, revoke } = await import('../../webmcp/adapter'));
    ({ ROLES, setRole } = await import('../../webmcp/authority'));
    registerDomainTools();
  });

  afterAll(() => { delete (globalThis as any).document; });

  const call = (name: string, input: any) => registered.get(name)!.execute(input);
  const descriptionOf = (name: string) => registered.get(name)!.description;

  async function captureProposal(name: string, input: any) {
    const ready = new Promise<PendingProposal>(res => {
      const off = onProposal(p => { if (p && p.toolName === name) { off(); res(p); } });
    });
    const result = call(name, input);
    const pending = await ready;
    return { pending, result };
  }

  const sumRejected = (p: any) => p.rejected.reduce((n: number, r: any) => n + r.count, 0);

  /** The reconciliation invariant, plus the thing this change adds: every bucket names itself. */
  function expectAccountedFor(payload: any) {
    expect(payload.applied + sumRejected(payload)).toBe(payload.requested);
    for (const bucket of payload.rejected) {
      expect(bucket.ids.length, `bucket "${bucket.reason}" names no ids`).toBe(bucket.count);
    }
  }

  /** Rows nothing has remedied yet whose free rebook is available — cost 0, so never referred. */
  const freshRows = (n: number) => Object.values(store.state.shipments)
    .filter(s => s.remedy === null && checkRemedy(s, 'rebook').status === 'available')
    .slice(0, n);

  const CONTRACT = [
    'do not retry the same call',
    'Read `rejected`: each entry carries a reason and the exact ids it applies to.',
    'restricted to those ids',
  ];
  const PENDING_CLAUSE = 'An entry carrying `pending` is with a second person';
  const RULE_CLAUSE = 'applied without review';
  const AUTHORITY_CLAUSE = 'may authorise up to EUR';

  const standingRule = () => ({
    id: 'pol-replan-contract', tool: 'propose_remedy', maxRecords: 20, maxValue: 500,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    draftedFrom: 'test', ratified: false,
  });

  // The description is re-composed from three independent parts, so it has four shapes and the
  // contract has to survive all four — a sentence that only appears while no rule is in force
  // would go missing at exactly the moment the agent is acting most freely.
  const STATES = [
    { name: 'no standing rule and no one to refer to', rule: false, referral: false },
    { name: 'a standing rule and no one to refer to', rule: true, referral: false },
    { name: 'no standing rule, with someone to refer to', rule: false, referral: true },
    { name: 'a standing rule and someone to refer to', rule: true, referral: true },
  ];

  for (const state of STATES) {
    it(`tells the agent what to do with a refusal, with ${state.name}`, () => {
      // ROLES[0] has ROLES[1] above it; ROLES[1] is the top of the ladder and refers to nobody.
      setRole(state.referral ? ROLES[0].id : ROLES[1].id);
      if (state.rule) ratify(standingRule()); else revoke('propose_remedy');

      const desc = descriptionOf('propose_remedy');

      for (const fragment of CONTRACT) expect(desc).toContain(fragment);
      // The other guarded tool carries it too: this is a property of being guarded, not of
      // one tool's own words.
      for (const fragment of CONTRACT) expect(descriptionOf('notify_customers')).toContain(fragment);

      // The state itself really is the one claimed — otherwise all four cases could be the
      // same string and still pass.
      expect(desc.includes(RULE_CLAUSE)).toBe(state.rule);
      expect(desc).toContain(AUTHORITY_CLAUSE);

      // Referral is the one thing that changes the contract: with nobody above this role, no
      // bucket can ever come back `pending`, so nothing promises the agent one might.
      expect(desc.includes(PENDING_CLAUSE)).toBe(state.referral);

      // And it reads last, after both boundary sentences, rather than interrupting them.
      expect(desc.indexOf(CONTRACT[0])).toBeGreaterThan(desc.indexOf(AUTHORITY_CLAUSE));
      if (state.rule) expect(desc.indexOf(CONTRACT[0])).toBeGreaterThan(desc.indexOf(RULE_CLAUSE));

      // The panel prints this same string, so a judge reading the inventory is reading what
      // the browser holds.
      expect(listTools().find(t => t.name === 'propose_remedy')!.description).toBe(desc);
    });
  }

  it('leaves a read tool alone: nothing there can be partially applied', () => {
    setRole(ROLES[0].id);
    revoke('propose_remedy');
    const desc = descriptionOf('search_shipments');
    for (const fragment of CONTRACT) expect(desc).not.toContain(fragment);
    expect(desc).not.toContain(AUTHORITY_CLAUSE);
  });

  it('names the rows the operator struck out, not just how many there were', async () => {
    const rows = freshRows(4);
    expect(rows).toHaveLength(4);
    const { pending, result } = await captureProposal('propose_remedy', { ids: rows.map(r => r.id) });
    expect(pending.authority.referred).toHaveLength(0);
    expect(pending.diff.groups).toHaveLength(4);

    const kept = pending.diff.groups.slice(0, 2);
    const cut = pending.diff.groups.slice(2);
    pending.resolve({ groups: kept.map(g => g.group), actions: [] });
    const payload = await result;

    expect(payload.status).toBe('partially_applied');
    expect(payload.applied).toBe(2);

    const removed = payload.rejected.find((r: any) => /operator removed/.test(r.reason));
    expect(removed.count).toBe(2);
    expect([...removed.ids].sort()).toEqual(cut.map(g => g.id).sort());
    // The ids are the ones a follow-up would have to be restricted to: still unremedied.
    for (const id of removed.ids) expect(store.state.shipments[id].remedy).toBeNull();
    expect(payload.replan_required).toBe(true);
    expectAccountedFor(payload);
  });

  it('names every row when the operator refuses the whole change', async () => {
    const rows = freshRows(3);
    const { pending, result } = await captureProposal('propose_remedy', { ids: rows.map(r => r.id) });
    pending.resolve(null);
    const payload = await result;

    const refused = payload.rejected.find((r: any) => r.reason === 'the operator refused this change');
    expect([...refused.ids].sort()).toEqual(rows.map(r => r.id).sort());
    expectAccountedFor(payload);
  });

  it('names the messages that were not sent, whether some or none were approved', async () => {
    const partial = await captureProposal('notify_customers', { consol: 'CONSOL-A', message: 'the flight is cancelled' });
    expect(partial.pending.diff.actions.length).toBeGreaterThan(1);
    const keep = partial.pending.diff.actions[0].actionId;
    partial.pending.resolve({ groups: [], actions: [keep] });
    const partialPayload = await partial.result;

    const dropped = partialPayload.rejected.find((r: any) => /did not approve these messages/.test(r.reason));
    expect(dropped.count).toBe(partialPayload.actions_dropped);
    expect(dropped.ids.length).toBeGreaterThan(0);
    expect(dropped.ids).not.toContain(keep);
    expectAccountedFor(partialPayload);

    // A wholesale refusal of a message-only proposal used to report "the operator refused this
    // change" over a count with nothing attached to it. It is the same event, said with ids.
    const all = await captureProposal('notify_customers', { consol: 'CONSOL-B', message: 'an update on your shipment' });
    const everyAction = all.pending.diff.actions.map(a => a.actionId);
    all.pending.resolve(null);
    const refusedPayload = await all.result;

    const refused = refusedPayload.rejected.find((r: any) => /did not approve these messages/.test(r.reason));
    expect([...refused.ids].sort()).toEqual([...everyAction].sort());
    expectAccountedFor(refusedPayload);
  });

  it('accounts for a domain skip and an operator cut in the same payload, each with its own ids', async () => {
    const blocked = Object.values(store.state.shipments)
      .find(s => s.remedy === null && checkRemedy(s, 'rebook').status === 'blocked')!;
    const clean = freshRows(2);
    const ids = [blocked.id, ...clean.map(r => r.id)];

    const { pending, result } = await captureProposal('propose_remedy', { ids, remedy: 'rebook' });
    // The blocked row never reaches the diff, but the agent asked about it and hears about it.
    expect(pending.diff.groups.map(g => g.id)).not.toContain(blocked.id);
    expect(pending.notes.some(n => n.id === blocked.id)).toBe(true);

    pending.resolve({ groups: [pending.diff.groups[0].group], actions: [] });
    const payload = await result;

    const skip = payload.rejected.find((r: any) => r.ids.includes(blocked.id));
    expect(skip.count).toBe(1);
    expect(skip.reason).not.toMatch(/operator/);
    const removed = payload.rejected.find((r: any) => /operator removed/.test(r.reason));
    expect(removed.ids).toEqual([pending.diff.groups[1].id]);
    expectAccountedFor(payload);
  });

  it('names the whole previewed set when a stale record aborts the commit', async () => {
    const [target] = freshRows(1);
    const { pending, result } = await captureProposal('propose_remedy', { ids: [target.id] });

    // A second operator edits the same record while the proposal is open.
    store.state.shipments[target.id].version += 1;

    pending.resolve({ groups: pending.diff.groups.map(g => g.group), actions: [] });
    const payload = await result;

    expect(payload.status).toBe('aborted_stale');
    const stale = payload.rejected.find((r: any) => /changed after the preview/.test(r.reason));
    expect(stale.ids).toEqual([target.id]);
    expectAccountedFor(payload);
  });
});
