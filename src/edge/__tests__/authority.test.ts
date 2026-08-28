import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { edgeStore as StoreModule } from '../store';
import type {
  listTools as ListTools, listReferrals as ListReferrals, onProposal as OnProposal,
  ratify as Ratify, reviewReferral as ReviewReferral,
} from '../../webmcp/adapter';
import type { ROLES as Roles, setRole as SetRole } from '../../webmcp/authority';

/**
 * The defect this file exists to prevent, in the plainest terms available: **no sentence this
 * product hands an agent may be written in the other product's language.**
 *
 * `composedDescription()` appends an authority sentence to every guarded tool, and that sentence
 * used to be hard-coded — "may authorise up to EUR 250 on one shipment" — so `roll_config`
 * registered itself with freight money in it. A judge prompting this prototype would have read
 * euros on an edge tool, which falsifies the two-products claim at the exact point the claim is
 * being made. The first case below is the lock; everything after it is the mechanic the fix
 * bought, driven through the real preview-and-commit path rather than asserted.
 */
describe('the edge product states its own authority boundary', () => {
  let edgeStore: typeof StoreModule;
  let listTools: typeof ListTools;
  let listReferrals: typeof ListReferrals;
  let reviewReferral: typeof ReviewReferral;
  let onProposal: typeof OnProposal;
  let ratify: typeof Ratify;
  let ROLES: typeof Roles;
  let setRole: typeof SetRole;
  const registered = new Map<string, any>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (s: any) => registered.set(s.name, s),
        unregisterTool: (n: string) => registered.delete(n),
      },
    };
    ({ edgeStore } = await import('../store'));
    const { registerEdgeTools } = await import('../tools');
    ({ listTools, listReferrals, reviewReferral, onProposal, ratify } = await import('../../webmcp/adapter'));
    ({ ROLES, setRole } = await import('../../webmcp/authority'));
    registerEdgeTools();
  });
  afterAll(() => { delete (globalThis as any).document; });

  async function run(tool: string, input: any, pick: (groups: any[], authority: any) => any) {
    let off = () => {};
    const ready = new Promise<any>(res => {
      off = onProposal((p: any) => { if (p && p.toolName === tool) { off(); res(p); } });
    });
    const result = registered.get(tool)!.execute(input);
    const settled = Symbol('settled');
    const first = await Promise.race([ready, result.then(() => settled)]);
    if (first === settled) { off(); return { payload: JSON.parse((await result).content[0].text), proposal: null }; }
    const p: any = first;
    p.resolve(pick(p.diff.groups ?? [], p.authority));
    return { payload: JSON.parse((await result).content[0].text), proposal: p };
  }

  /** Every word an agent can read off this product's toolset, in one string. */
  const allAgentText = () => [
    ...[...registered.values()].map(s => `${s.name} ${s.description}`),
    ...listTools().map(t => `${t.name} ${t.description}`),
  ].join('\n');

  it('registers no description carrying the other product’s money or its records', () => {
    // Four tools, so a registry that silently emptied cannot pass this by having nothing to say.
    expect([...registered.keys()].sort())
      .toEqual(['inspect_pop', 'list_pops', 'page_oncall', 'roll_config']);

    expect(allAgentText()).not.toMatch(/EUR|€|shipment/i);
  });

  it('states the boundary in this estate’s own unit instead — traffic, a site, and a second person', () => {
    // The negative above is only worth having if the sentence is actually there to be wrong.
    const rollConfig = registered.get('roll_config').description;
    expect(rollConfig).toContain('the operator on shift is a release engineer');
    expect(rollConfig).toContain('may authorise up to 3.00% of production traffic on one site');
    expect(rollConfig).toContain('referred to a traffic lead');
  });

  it('keeps the other product’s money out of a ratified standing rule’s sentence too', () => {
    // describePolicy() rendered a rule's value cap in a fixed currency, so ratifying anything
    // used to put "up to EUR 0" into the description of a tool that has never seen a euro.
    ratify({
      id: 'pol-edge-vocab', tool: 'roll_config',
      maxRecords: 4, maxValue: 0.42,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      draftedFrom: 'test', ratified: false,
    });
    const withRule = registered.get('roll_config').description;
    expect(withRule).toContain('up to 4 records, up to 0.42% of production traffic');
    expect(allAgentText()).not.toMatch(/EUR|€|shipment/i);
  });

  it('re-registers in the new role’s words when the role changes, and still says neither', () => {
    setRole(ROLES[1].id);
    const asLead = registered.get('roll_config').description;
    expect(asLead).toContain('the operator on shift is a traffic lead');
    expect(asLead).toContain('may authorise up to 10.00% of production traffic on one site');
    // Top of the ladder: nobody to refer to, so the sentence must not promise one.
    expect(asLead).not.toContain('referred to');
    expect(allAgentText()).not.toMatch(/EUR|€|shipment/i);

    setRole(ROLES[0].id);
    expect(registered.get('roll_config').description).toContain('release engineer');
  });

  it('refers a site that exposes more traffic than the operator may, and does not apply it', async () => {
    // nrt1 carries 3.4% of production traffic; taking a release on every node at once exposes
    // all of it, which is above the release engineer's 3.00%. Everything else in apac is either
    // closed by a rule or small enough to be theirs.
    const { payload, proposal } = await run(
      'roll_config',
      { region: 'apac', mode: 'immediate' },
      // Approving every group, referred ones included — what a broken interface, or a caller
      // reaching past it, would send. The boundary is enforced in the commit, not in the drawer.
      groups => ({ groups: groups.map((g: any) => g.group), actions: [] }),
    );

    expect(proposal!.authority.role.label).toBe('Release engineer');
    expect(proposal!.authority.target?.label).toBe('Traffic lead');
    expect(proposal!.authority.referred).toEqual(['pops:nrt1']);

    expect(payload.referred).toEqual({ count: 1, ids: ['nrt1'], awaiting: 'traffic lead' });
    expect(edgeStore.state.pops.nrt1.pendingVersion).toBeNull();
    expect(edgeStore.state.pops.syd1.rolloutMode).toBe('immediate');

    const bucket = payload.rejected.find((r: any) => r.pending !== undefined);
    expect(bucket).toEqual({
      count: 1,
      reason: "above the release engineer's 3.00% of production traffic exposure authority — referred to a traffic lead, not refused",
      ids: ['nrt1'],
      pending: 'traffic lead',
    });

    // The ledger the sweep guards, on the one path that adds a bucket to it.
    expect(payload.applied + payload.rejected.reduce((n: number, r: any) => n + r.count, 0))
      .toBe(payload.requested);
  });

  it('offers the referred site to the traffic lead, and to nobody else', async () => {
    const queue = listReferrals();
    expect(queue).toHaveLength(1);
    expect(queue[0].ids).toEqual(['nrt1']);
    expect(queue[0].toRole).toBe('Traffic lead');
    // The magnitude travels in this product's unit: 3.4% of production traffic, not a currency.
    expect(queue[0].spendEur).toBeCloseTo(3.4, 5);

    setRole(ROLES[1].id);
    const ready = new Promise<any>(res => {
      const off = onProposal((p: any) => { if (p) { off(); res(p); } });
    });
    const result = reviewReferral(queue[0].id)!;
    const pending = await ready;
    // The second approver gets their own preview of exactly the referred site — not a rubber
    // stamp on somebody else's diff — and nothing is above *their* limit.
    expect(pending.diff.groups.map((g: any) => g.id)).toEqual(['nrt1']);
    expect(pending.authority.referred).toEqual([]);
    pending.resolve({ groups: pending.diff.groups.map((g: any) => g.group), actions: [] });
    await result;

    expect(edgeStore.state.pops.nrt1.rolloutMode).toBe('immediate');
    expect(listReferrals()).toHaveLength(0);
    setRole(ROLES[0].id);
  });
});
