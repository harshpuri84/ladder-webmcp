import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { store as StoreModule } from '../store';
import type { registerDomainTools as RegisterDomainTools } from '../tools';
import type {
  onProposal as OnProposal,
  listReferrals as ListReferrals,
  reviewReferral as ReviewReferral,
  ratify as Ratify,
  PendingProposal,
} from '../../webmcp/adapter';
import type { ROLES as Roles, setRole as SetRole } from '../../webmcp/authority';
import { recommendRemedy } from '../remedy-policy';

/**
 * The authority boundary, driven through the real registration/preview/commit path — the same
 * wiring tools.test.ts exercises, in its own file so this suite gets its own module registry
 * and its own untouched fixture. WebMCP isn't present in the runner, so a minimal fake
 * `document.modelContext` is installed before the modules under test are imported.
 */
describe('spend authority: two humans, one boundary', () => {
  let store: typeof StoreModule;
  let registerDomainTools: typeof RegisterDomainTools;
  let onProposal: typeof OnProposal;
  let listReferrals: typeof ListReferrals;
  let reviewReferral: typeof ReviewReferral;
  let ratify: typeof Ratify;
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
    ({ onProposal, listReferrals, reviewReferral, ratify } = await import('../../webmcp/adapter'));
    ({ ROLES, setRole } = await import('../../webmcp/authority'));
    registerDomainTools();
  });

  afterAll(() => { delete (globalThis as any).document; });

  const call = (name: string, input: any) => registered.get(name)!.execute(input);

  /** Kicks a write call off and hands back its proposal without deciding it. */
  async function captureProposal(name: string, input: any) {
    const ready = new Promise<PendingProposal>(res => {
      const off = onProposal(p => { if (p && p.toolName === name) { off(); res(p); } });
    });
    const result = call(name, input);
    const pending = await ready;
    return { pending, result };
  }

  const sumRejected = (p: any) => p.rejected.reduce((n: number, r: any) => n + r.count, 0);

  it('splits one proposal into what this operator can authorise and what they cannot', async () => {
    const { pending, result } = await captureProposal('propose_remedy', { consol: 'CONSOL-A' });
    const { diff, authority } = pending;

    expect(authority.role.id).toBe(ROLES[0].id);
    expect(authority.target?.id).toBe(ROLES[1].id);

    // Every referred group is over the limit and every other one is not — the split is the
    // euro figure and nothing else. Asserted against the diff rather than against a hard-coded
    // list of shipment ids, so a fixture change moves the rows without falsifying the rule.
    const referred = new Set(authority.referred);
    expect(referred.size).toBeGreaterThan(0);
    expect(referred.size).toBeLessThan(diff.groups.length);
    for (const g of diff.groups) {
      expect(referred.has(g.group)).toBe(Math.abs(g.valueDelta) > authority.role.spendLimitEur);
    }

    pending.resolve(null);
    await result;
  });

  it('applies what the operator can authorise, refers the rest, and reconciles', async () => {
    const { pending, result } = await captureProposal('propose_remedy', { consol: 'CONSOL-A' });
    const referred = new Set(pending.authority.referred);
    const authorisable = pending.diff.groups.filter(g => !referred.has(g.group));

    // The operator stamps everything in front of them, which is what the panel starts them on.
    pending.resolve({ groups: authorisable.map(g => g.group), actions: [] });
    const payload = await result;

    expect(payload.applied).toBe(authorisable.length);
    expect(payload.referred.count).toBe(referred.size);
    expect(payload.referred.awaiting).toBe(ROLES[1].label.toLowerCase());
    expect(payload.referred.ids).toHaveLength(referred.size);

    // The invariant, with a referral in the middle of it.
    expect(payload.applied + sumRejected(payload)).toBe(payload.requested);

    // Referral is in the ledger, but it is marked as awaiting rather than settled, and it is
    // not the same bucket as a row the operator struck out.
    const pendingBucket = payload.rejected.find((r: any) => r.pending);
    expect(pendingBucket.count).toBe(referred.size);
    expect(pendingBucket.pending).toBe(ROLES[1].label.toLowerCase());
    expect(pendingBucket.reason).toMatch(/not refused/);
    expect(payload.rejected.some((r: any) => /operator removed/.test(r.reason))).toBe(false);

    // Nothing was refused outright, so there is nothing for the agent to replan around.
    expect(payload.replan_required).toBe(false);

    // And none of the referred rows actually moved.
    for (const id of payload.referred.ids) {
      expect(store.state.shipments[id].remedy).toBeNull();
    }
  });

  it('queues the referred rows for a second approver, naming who they are waiting on', () => {
    const queue = listReferrals();
    expect(queue).toHaveLength(1);
    expect(queue[0].toolName).toBe('propose_remedy');
    expect(queue[0].fromRole).toBe(ROLES[0].label);
    expect(queue[0].toRoleId).toBe(ROLES[1].id);
    expect(queue[0].spendEur).toBeGreaterThan(ROLES[0].spendLimitEur);
  });

  it('lets the second approver decide the referred set through the ordinary proof path', async () => {
    setRole(ROLES[1].id);
    const queued = listReferrals()[0];

    const ready = new Promise<PendingProposal>(res => {
      const off = onProposal(p => { if (p) { off(); res(p); } });
    });
    const result = reviewReferral(queued.id)!;
    const pending = await ready;

    // The duty manager gets a real proof sheet over exactly the referred rows, with nothing
    // above their own limit — not a rubber stamp on the first operator's diff.
    expect(pending.authority.role.id).toBe(ROLES[1].id);
    expect(pending.authority.referred).toHaveLength(0);
    expect(pending.diff.groups.map(g => g.id).sort()).toEqual([...queued.ids].sort());

    pending.resolve({ groups: pending.diff.groups.map(g => g.group), actions: [] });
    const payload = await result as any;

    expect(payload.status).toBe('applied');
    expect(payload.applied).toBe(queued.ids.length);
    expect(payload.referred).toBeUndefined();
    for (const id of queued.ids) {
      expect(store.state.shipments[id].remedy).not.toBeNull();
    }
    expect(listReferrals()).toHaveLength(0);
    setRole(ROLES[0].id);
  });

  it('tells the agent about the boundary in the tool description, and re-registers when the role changes', () => {
    const asOperator = registered.get('propose_remedy')!.description;
    expect(asOperator).toContain(`EUR ${ROLES[0].spendLimitEur}`);
    expect(asOperator).toContain(ROLES[1].label.toLowerCase());

    setRole(ROLES[1].id);
    const asManager = registered.get('propose_remedy')!.description;
    expect(asManager).toContain(`EUR ${ROLES[1].spendLimitEur}`);
    expect(asManager).not.toBe(asOperator);

    setRole(ROLES[0].id);
    expect(registered.get('propose_remedy')!.description).toBe(asOperator);
  });

  /**
   * The boundary is not a UI convention. Two paths hand a group list to the commit — the panel,
   * and a ratified standing rule that never opens one — and neither of them gets to authorise
   * spend on this operator's behalf.
   */
  it('refuses a referred row even when the decision that came back approved it', async () => {
    const { pending, result } = await captureProposal('propose_remedy', { consol: 'CONSOL-B' });
    const referredIds = pending.diff.groups
      .filter(g => pending.authority.referred.includes(g.group))
      .map(g => g.id);
    expect(referredIds.length).toBeGreaterThan(0);

    // A decision approving every group, referred rows included — what a broken panel, or a
    // caller reaching past it, would send.
    pending.resolve({ groups: pending.diff.groups.map(g => g.group), actions: [] });
    const payload = await result;

    expect(payload.referred.count).toBe(referredIds.length);
    for (const id of referredIds) {
      expect(store.state.shipments[id].remedy).toBeNull();
    }
    expect(payload.applied + sumRejected(payload)).toBe(payload.requested);
  });

  it('does not let a ratified standing rule spend past the operator who ratified it', async () => {
    // Wide enough to auto-apply the whole thing: the cap that stops it has to be the authority
    // limit, not the rule's own numbers.
    ratify({
      id: 'pol-authority-test', tool: 'propose_remedy',
      maxRecords: 1000, maxValue: 1_000_000,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      draftedFrom: 'test', ratified: false,
    });

    // A customer whose shipment is still unremedied and still over the limit, found rather
    // than written down, so the earlier cases in this file can apply whatever they like
    // without quietly emptying this one's diff.
    const target = Object.values(store.state.shipments).find(s => {
      const rec = recommendRemedy(s);
      return s.remedy === null && rec !== null && rec.cost > ROLES[0].spendLimitEur;
    })!;
    expect(target).toBeTruthy();

    // Nothing decided this by hand: if a panel opens, the call hangs and the test fails on it.
    const payload = await call('propose_remedy', { ids: [target.id] });

    expect(payload.referred.count).toBeGreaterThan(0);
    for (const id of payload.referred.ids) {
      expect(store.state.shipments[id].remedy).toBeNull();
    }
    expect(payload.applied + sumRejected(payload)).toBe(payload.requested);
  });
});
