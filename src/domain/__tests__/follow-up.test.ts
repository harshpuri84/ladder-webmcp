import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { store as StoreModule } from '../store';
import type { registerDomainTools as RegisterDomainTools } from '../tools';
import type {
  onProposal as OnProposal,
  onResult as OnResult,
  PendingProposal,
  ProposalOutcome,
} from '../../webmcp/adapter';
import { checkRemedy, remedyCost } from '../remedy-policy';

/**
 * The claim this suite guards is narrow on purpose: a later call that names only records an
 * earlier call was refused on is *observably* a narrowing of it, and the interface may say so.
 *
 * So every case here drives two real calls through the real preview/commit path and asks what
 * the second one carries. Nothing is asserted about an agent — there is no agent in a test
 * runner, and the feature is built so that there never needs to be one for this to be true.
 *
 * The cases that matter most are the negative ones. A relationship this page cannot verify must
 * come back null, because a page that claims a loop closed when it did not is worse than a page
 * that says nothing at all.
 */
describe('a later call read against an earlier refusal', () => {
  let store: typeof StoreModule;
  let registerDomainTools: typeof RegisterDomainTools;
  let onProposal: typeof OnProposal;
  let onResult: typeof OnResult;
  const registered = new Map<string, { execute: (...a: any[]) => Promise<any> }>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (spec: any) => registered.set(spec.name, spec),
        unregisterTool: (name: string) => registered.delete(name),
      },
    };
    ({ store } = await import('../store'));
    ({ registerDomainTools } = await import('../tools'));
    ({ onProposal, onResult } = await import('../../webmcp/adapter'));
    registerDomainTools();
  });

  afterAll(() => { delete (globalThis as any).document; });

  const call = (name: string, input: any) => registered.get(name)!.execute(input);

  /** Runs one call, decides it the way `decide` says, and hands back both halves of the run. */
  async function run(
    name: string,
    input: any,
    decide: (p: PendingProposal) => { groups: string[]; actions: string[] } | null,
  ): Promise<{ proposal: PendingProposal | null; outcome: ProposalOutcome }> {
    let proposal: PendingProposal | null = null;
    const offProposal = onProposal(p => {
      if (!p || proposal) return;
      proposal = p;
      p.resolve(decide(p));
    });
    const done = new Promise<ProposalOutcome>(res => {
      const off = onResult(o => { if (o.toolName === name) { off(); res(o); } });
    });
    await call(name, input);
    offProposal();
    return { proposal, outcome: await done };
  }

  const approveAll = (p: PendingProposal) => ({
    groups: p.diff.groups.map(g => g.group),
    actions: p.diff.actions.map(a => a.actionId),
  });

  /**
   * Rows no case in this file has used yet. A refused row keeps `remedy === null`, so "untouched"
   * alone would hand the same shipments to a later case — and a case asserting that a *clean* run
   * leaves nothing to answer would then be reading a refusal an earlier case left behind. Every
   * case reserves the rows it uses, so each one starts from records with no history.
   */
  const taken = new Set<string>();
  const untouched = () =>
    Object.values(store.state.shipments).filter(s => s.remedy === null && !taken.has(s.id));
  function reserve(rows: { id: string }[], n: number): string[] {
    const ids = rows.slice(0, n).map(r => r.id);
    for (const id of ids) taken.add(id);
    return ids;
  }
  /**
   * Rows the free rebook and the road option are both open to. Every case that needs two calls
   * over the same records uses these: the first forces `rebook` (free, so never referred) and the
   * follow-up forces `truck`, which guarantees the second call has something real to preview
   * rather than matching nothing and never reaching a panel.
   */
  const plain = (n: number) => reserve(
    untouched().filter(
      s => checkRemedy(s, 'rebook').status === 'available' && checkRemedy(s, 'truck').status === 'available',
    ),
    n,
  );
  /** Above the gateway operator's limit on the freighter, so referable. Read from the real
   *  policy, not from a constant. */
  const dear = (n: number) => reserve(
    untouched().filter(
      s => checkRemedy(s, 'competitor').status === 'available' && remedyCost(s, 'competitor') > 250,
    ),
    n,
  );

  it('says nothing about a call that names no ids at all', async () => {
    // Scoped to one customer and its rows reserved, rather than to a whole consol. A refusal
    // over half the flight would leave a very large refused set behind, and every narrow call a
    // later case makes would then genuinely be a subset of it — which is the feature working,
    // not a defect, but it would stop the later cases testing what they say they test.
    const customer = untouched()
      .find(s => checkRemedy(s, 'rebook').status === 'available')!.customer;
    for (const s of Object.values(store.state.shipments)) {
      if (s.customer === customer) taken.add(s.id);
    }

    const { proposal, outcome } = await run('propose_remedy', { customer }, () => null);
    expect(proposal, 'this customer has no row to preview').toBeTruthy();
    expect(proposal!.followUp).toBeNull();
    expect(outcome.followUp).toBeNull();
  });

  it('names the earlier run, and the second person holding the rows, for a call narrowed to referred ids', async () => {
    const referrable = dear(3);
    expect(referrable.length, 'seed has no rows above the operator limit').toBe(3);

    const first = await run('propose_remedy', { ids: referrable, remedy: 'competitor' }, approveAll);
    expect(first.outcome.cause).toBe('referred');
    const referred = first.outcome.payload.referred!;
    expect(referred.ids.slice().sort()).toEqual(referrable.slice().sort());

    const second = await run('propose_remedy', { ids: referred.ids, remedy: 'truck' }, () => null);
    const f = second.proposal!.followUp!;
    expect(f, 'a call naming only just-referred ids is not being recognised').toBeTruthy();
    expect(f.toolName).toBe('propose_remedy');
    expect(f.ids.slice().sort()).toEqual(referrable.slice().sort());
    expect(f.parts).toEqual([{ kind: 'referred', count: 3, awaiting: 'duty manager' }]);
    // The same fact reaches the run log, not only the panel.
    expect(second.outcome.followUp!.parts).toEqual(f.parts);
  });

  it('names rows the operator struck out apart from rows the tool itself left alone', async () => {
    // One row the tool itself will refuse for a domain rule (its cargo cannot ride a passenger
    // belly), and two it will offer that the operator then strikes out.
    const blocked = Object.values(store.state.shipments).find(
      s => s.remedy === null && !taken.has(s.id)
        && checkRemedy(s, 'rebook').status === 'blocked'
        && checkRemedy(s, 'truck').status === 'available',
    )!;
    taken.add(blocked.id);
    const struck = plain(2);
    expect(struck.length).toBe(2);

    const first = await run(
      'propose_remedy',
      { ids: [blocked.id, ...struck], remedy: 'rebook' },
      () => ({ groups: [], actions: [] }),
    );
    expect(first.outcome.payload.applied).toBe(0);

    const second = await run(
      'propose_remedy',
      { ids: [blocked.id, ...struck], remedy: 'truck' },
      () => null,
    );
    const parts = second.proposal!.followUp!.parts;
    expect(parts.find(p => p.kind === 'blocked')?.count).toBe(1);
    expect(parts.find(p => p.kind === 'removed')?.count).toBe(2);
  });

  it('says nothing when one named id was never refused', async () => {
    const [refusable] = plain(1);
    await run('propose_remedy', { ids: [refusable], remedy: 'rebook' }, () => ({ groups: [], actions: [] }));

    const [fresh] = plain(1);
    const { proposal } = await run(
      'propose_remedy',
      { ids: [refusable, fresh], remedy: 'truck' },
      () => null,
    );
    expect(
      proposal!.followUp,
      'a call that mixes a refused id with a fresh one is a new ask, not a narrowing',
    ).toBeNull();
  });

  it('says nothing about a clean run, and does not treat that run as something to answer', async () => {
    const clean = plain(2);
    const first = await run('propose_remedy', { ids: clean, remedy: 'rebook' }, approveAll);
    expect(first.outcome.payload.rejected).toEqual([]);

    const second = await run('propose_remedy', { ids: clean, remedy: 'truck' }, () => null);
    expect(second.proposal!.followUp).toBeNull();
  });

  it('never reads a call as an answer to itself', async () => {
    const ids = plain(2);
    // This very call is refused on exactly the ids it names — the one shape that would make a
    // self-reference possible if the relationship were read after the run rather than before it.
    const { proposal, outcome } = await run(
      'propose_remedy',
      { ids, remedy: 'rebook' },
      () => ({ groups: [], actions: [] }),
    );
    expect(proposal!.followUp).toBeNull();
    expect(outcome.followUp).toBeNull();
  });
});
