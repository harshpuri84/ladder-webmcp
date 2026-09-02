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
    expect(rollConfig).toContain('may authorise up to 0.50% of production traffic on one site');
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

  it('refers every site that exposes more traffic than the operator may, and applies none of them', async () => {
    // Three apac sites are open to an immediate rollout: nrt1 (3.4% of production traffic), syd1
    // (2.2%) and icn1 (1.3%). Taking a release on every node at once exposes a site's whole
    // share, so all three are above the release engineer's 0.50% and all three are the traffic
    // lead's to decide. The other four never reach the drawer at all: sin1, sin2 and hkg1 are
    // inside the apac peak freeze, and bom1 is behind the compatibility floor.
    const { payload, proposal } = await run(
      'roll_config',
      { region: 'apac', mode: 'immediate' },
      // Approving every group, referred ones included — what a broken interface, or a caller
      // reaching past it, would send. The boundary is enforced in the commit, not in the drawer.
      groups => ({ groups: groups.map((g: any) => g.group), actions: [] }),
    );

    expect(proposal!.authority.role.label).toBe('Release engineer');
    expect(proposal!.authority.target?.label).toBe('Traffic lead');
    expect(proposal!.authority.referred).toEqual(['pops:nrt1', 'pops:syd1', 'pops:icn1']);

    expect(payload.referred)
      .toEqual({ count: 3, ids: ['nrt1', 'syd1', 'icn1'], awaiting: 'traffic lead' });
    // Nothing landed. Every site the operator was shown was somebody else's to authorise, and
    // approving all three did not make one of them theirs.
    expect(payload.applied).toBe(0);
    expect(edgeStore.state.pops.nrt1.pendingVersion).toBeNull();
    expect(edgeStore.state.pops.syd1.rolloutMode).toBeNull();

    const bucket = payload.rejected.find((r: any) => r.pending !== undefined);
    expect(bucket).toEqual({
      count: 3,
      reason: "above the release engineer's 0.50% of production traffic exposure authority, referred to a traffic lead",
      ids: ['nrt1', 'syd1', 'icn1'],
      pending: 'traffic lead',
    });

    // The ledger the sweep guards, on the one path that adds a bucket to it.
    expect(payload.applied + payload.rejected.reduce((n: number, r: any) => n + r.count, 0))
      .toBe(payload.requested);
  });

  it('offers the referred sites to the traffic lead, and to nobody else', async () => {
    const queue = listReferrals();
    expect(queue).toHaveLength(1);
    expect(queue[0].ids).toEqual(['nrt1', 'syd1', 'icn1']);
    expect(queue[0].toRole).toBe('Traffic lead');
    // The magnitude travels in this product's unit: 3.4 + 2.2 + 1.3 = 6.9% of production
    // traffic across the three referred sites, not a currency.
    expect(queue[0].spendEur).toBeCloseTo(6.9, 5);

    setRole(ROLES[1].id);
    const ready = new Promise<any>(res => {
      const off = onProposal((p: any) => { if (p) { off(); res(p); } });
    });
    const result = reviewReferral(queue[0].id)!;
    const pending = await ready;
    // The second approver gets their own preview of exactly the referred sites — not a rubber
    // stamp on somebody else's diff — and nothing is above *their* limit.
    expect(pending.diff.groups.map((g: any) => g.id)).toEqual(['nrt1', 'syd1', 'icn1']);
    expect(pending.authority.referred).toEqual([]);
    pending.resolve({ groups: pending.diff.groups.map((g: any) => g.group), actions: [] });
    await result;

    expect(['nrt1', 'syd1', 'icn1'].map(id => edgeStore.state.pops[id].rolloutMode))
      .toEqual(['immediate', 'immediate', 'immediate']);
    expect(listReferrals()).toHaveLength(0);
    setRole(ROLES[0].id);
  });

  it('counts a row that is both struck out and above the limit as referred, not operator-removed', async () => {
    // The attribution rule, pinned by name rather than left as an accident of which sites the
    // fixture happens to put on each side of the line.
    //
    // A row the operator unticks that is ALSO above their authority was narrowed out twice over,
    // and the engine resolves that by counting it once, as referred
    // (`removedByOperator = narrowedOut - referredCount`, adapter.ts). Which way round it goes is
    // not cosmetic: "the operator removed these" tells an agent to replan without those ids,
    // where a referral tells it to leave them alone because a second person is now holding them.
    // Inverting it would have the agent propose a worse remedy for work that is about to be
    // approved — and nothing in either product named the rule before this.
    //
    // eu-west sets all three cases up at once on the plainest call the tool has. Every open site
    // takes a staged rollout, a tenth of its share: ams1 0.91%, lhr1 0.59% and fra1 0.54% are
    // above the release engineer's 0.50%, while ams2 0.20% and lhr2 0.17% are inside it. The
    // operator strikes out lhr1 (above the limit) and ams2 (inside it) and keeps the other three.
    const { payload } = await run(
      'roll_config',
      { region: 'eu-west' },
      groups => ({
        groups: groups
          .filter((g: any) => g.id !== 'lhr1' && g.id !== 'ams2')
          .map((g: any) => g.group),
        actions: [],
      }),
    );

    // lhr1 is in the referral bucket — struck out or not, it was never the operator's to strike.
    expect(payload.rejected.find((r: any) => r.pending !== undefined)).toEqual({
      count: 3,
      reason: "above the release engineer's 0.50% of production traffic exposure authority, referred to a traffic lead",
      ids: ['ams1', 'lhr1', 'fra1'],
      pending: 'traffic lead',
    });

    // ams2 — struck out and inside the limit — is the only row attributed to the operator, and
    // lhr1 appears in no second bucket. One row, one account.
    expect(payload.rejected.filter((r: any) => r.reason === 'the operator removed these from the change'))
      .toEqual([{ count: 1, reason: 'the operator removed these from the change', ids: ['ams2'] }]);

    // And keeping a row above the limit does not apply it either: only lhr2 lands.
    expect(payload.applied).toBe(1);
    expect(edgeStore.state.pops.lhr2.rolloutMode).toBe('staged');
    for (const id of ['ams1', 'lhr1', 'fra1', 'ams2']) {
      expect(edgeStore.state.pops[id].pendingVersion).toBeNull();
    }

    // Counted once and only once, so the ledger still closes over the whole region: five sites
    // previewed, three skipped by the domain (cdg1's incident, fra2 drained, dub1 already
    // serving), one applied, three referred, one removed.
    expect(payload.requested).toBe(8);
    expect(payload.applied + payload.rejected.reduce((n: number, r: any) => n + r.count, 0))
      .toBe(payload.requested);
  });
});
