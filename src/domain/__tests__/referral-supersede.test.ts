import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { registerDomainTools as RegisterDomainTools } from '../tools';
import type {
  onProposal as OnProposal,
  listReferrals as ListReferrals,
  reviewReferral as ReviewReferral,
  PendingProposal,
} from '../../webmcp/adapter';

/**
 * What a second approver is holding after an agent asks twice about the same rows.
 *
 * The follow-up is the product's strongest sequence: a run refers four shipments, the agent
 * reads the refusal and comes back naming only those four, and the operator — who still cannot
 * authorise them — sends them up again. Before this was fixed, that left the duty manager with
 * the same four shipments queued twice, and signing one left the other standing: a note for
 * work already done, indistinguishable from a note for work outstanding.
 *
 * Its own file rather than a case inside `spend-authority.test.ts`, because that suite carries
 * fixture state between its tests in order and this one needs a queue it owns from empty.
 */
describe('a referral supersedes an earlier one for the same rows', () => {
  let registerDomainTools: typeof RegisterDomainTools;
  let onProposal: typeof OnProposal;
  let listReferrals: typeof ListReferrals;
  let reviewReferral: typeof ReviewReferral;
  const registered = new Map<string, { execute: (...a: any[]) => Promise<any> }>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (spec: any) => registered.set(spec.name, spec),
        unregisterTool: (name: string) => registered.delete(name),
      },
    };
    await import('../store');
    ({ registerDomainTools } = await import('../tools'));
    ({ onProposal, listReferrals, reviewReferral } = await import('../../webmcp/adapter'));
    registerDomainTools();
  });

  afterAll(() => { delete (globalThis as any).document; });

  /** Runs a write call and takes the offered decision, exactly as the panel's stamp would. */
  async function runAndApprove(input: unknown) {
    const ready = new Promise<PendingProposal>(res => {
      const off = onProposal(p => { if (p) { off(); res(p); } });
    });
    const result = registered.get('propose_remedy')!.execute(input);
    const pending = await ready;
    // Everything the operator was offered — the referred rows are not among them, which is the
    // point: they are referred whatever is ticked.
    pending.resolve({ groups: pending.diff.groups.map(g => g.group), actions: [] });
    return await result;
  }

  const REFERRED = ['HAWB-70001', 'HAWB-70002', 'HAWB-70023', 'HAWB-70025'];

  it('queues one referral for the four the first run could not authorise', async () => {
    const out = await runAndApprove({ consol: 'CONSOL-A' });
    expect(out.referred.ids.sort()).toEqual([...REFERRED].sort());
    expect(listReferrals()).toHaveLength(1);
  });

  it('does not queue the same rows a second time when the agent asks again', async () => {
    await runAndApprove({ ids: REFERRED });

    const queue = listReferrals();
    expect(queue).toHaveLength(1);
    expect(queue[0].ids.sort()).toEqual([...REFERRED].sort());
  });

  it('leaves nothing behind once the second approver takes it', async () => {
    const queued = listReferrals()[0];
    void reviewReferral(queued.id);
    expect(listReferrals()).toHaveLength(0);
  });
});
