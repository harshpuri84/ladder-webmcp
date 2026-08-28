import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { onProposal as OnProposal, PendingProposal } from '../../webmcp/adapter';

/**
 * The same reading the freight console gets, on the second product's own records: a call that
 * names only sites an earlier call was refused on is observably a narrowing of it.
 *
 * It is here rather than only in `src/domain/` because the detection is supplied by the host —
 * `targetedIds` on the binding — and a second product that answered that question wrongly, or
 * not at all, would look identical from the engine's side and show nothing on its page.
 */
describe('a later edge call read against an earlier refusal', () => {
  let onProposal: typeof OnProposal;
  const registered = new Map<string, any>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (s: any) => registered.set(s.name, s),
        unregisterTool: (n: string) => registered.delete(n),
      },
    };
    const { registerEdgeTools } = await import('../tools');
    ({ onProposal } = await import('../../webmcp/adapter'));
    registerEdgeTools();
  });
  afterAll(() => { delete (globalThis as any).document; });

  async function run(tool: string, input: any, pick: (p: PendingProposal) => any) {
    let off = () => {};
    const ready = new Promise<PendingProposal>(res => {
      off = onProposal(p => { if (p && p.toolName === tool) { off(); res(p); } });
    });
    const result = registered.get(tool)!.execute(input);
    const settled = Symbol('settled');
    const first = await Promise.race([ready, result.then(() => settled)]);
    if (first === settled) { off(); return { payload: JSON.parse((await result).content[0].text), proposal: null }; }
    const p = first as PendingProposal;
    p.resolve(pick(p));
    return { payload: JSON.parse((await result).content[0].text), proposal: p };
  }

  const approveAll = (p: PendingProposal) => ({
    groups: p.diff.groups.map(g => g.group),
    actions: p.diff.actions.map(a => a.actionId),
  });

  it('names the earlier run and the lead holding the sites, in this product’s own words', async () => {
    // An immediate rollout across the region: what a release engineer can authorise is applied,
    // and anything past their exposure limit goes to a traffic lead rather than being refused.
    const first = await run('roll_config', { region: 'apac', mode: 'immediate' }, approveAll);
    const referred = first.payload.referred;
    expect(referred, 'no site was above the release engineer limit').toBeTruthy();

    const second = await run('roll_config', { ids: referred.ids, mode: 'shadow' }, () => null);
    const f = second.proposal!.followUp!;
    expect(f, 'a call naming only just-referred sites is not being recognised').toBeTruthy();
    expect(f.ids.slice().sort()).toEqual(referred.ids.slice().sort());
    expect(f.parts).toEqual([
      { kind: 'referred', count: referred.count, awaiting: referred.awaiting },
    ]);
    // No freight vocabulary reaches this product's reading of it.
    expect(JSON.stringify(f)).not.toMatch(/shipment|duty manager|EUR/i);
  });

  it('says nothing about a call whose sites were never refused', async () => {
    const { proposal } = await run('roll_config', { ids: ['ams1'], mode: 'shadow' }, () => null);
    expect(proposal!.followUp).toBeNull();
  });
});
