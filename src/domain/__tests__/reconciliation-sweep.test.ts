import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { store as StoreModule } from '../store';
import type { registerDomainTools as RegisterDomainTools } from '../tools';
import type { onProposal as OnProposal } from '../../webmcp/adapter';
import { setRole } from '../../webmcp/authority';

/**
 * A randomised sweep over the one invariant this product cannot afford to get wrong:
 * `applied` plus the sum of every `rejected[].count` equals `requested`, on every path — and
 * every bucket names as many ids as it claims, so an agent can act on the refusal.
 *
 * It exists because the invariant has broken three times, each time under an edit smaller than
 * the one that broke it, and each time the hand-written cases in the suites around it happened
 * not to cover the combination that failed. Fixed cases test the paths someone thought of. This
 * walks 60 real calls through the real preview-and-commit wiring with randomised filters, both
 * authority roles, and all three decision shapes (refuse everything, keep a random subset,
 * approve everything), which is how it reaches combinations nobody wrote down.
 *
 * The seed is fixed, so a failure is reproducible rather than a story about a flake.
 */
describe('the reconciliation ledger holds across randomised real calls', () => {
  let store: typeof StoreModule;
  let onProposal: typeof OnProposal;
  const registered = new Map<string, any>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (s: any) => registered.set(s.name, s),
        unregisterTool: (n: string) => registered.delete(n),
      },
    };
    ({ store } = await import('../store'));
    const { registerDomainTools } = await import('../tools') as { registerDomainTools: typeof RegisterDomainTools };
    ({ onProposal } = await import('../../webmcp/adapter'));
    registerDomainTools();
  });
  afterAll(() => { delete (globalThis as any).document; });

  async function run(tool: string, input: any, pick: (groups: any[], actions: any[]) => any) {
    let off = () => {};
    const ready = new Promise<any>(res => {
      off = onProposal((p: any) => { if (p && p.toolName === tool) { off(); res(p); } });
    });
    const result = registered.get(tool)!.execute(input);
    // A filter matching nothing settles with no proposal at all (`nothing_to_decide`), so the
    // proposal promise would hang forever. Race it against the call itself.
    const settled = Symbol('settled');
    const first = await Promise.race([ready, result.then(() => settled)]);
    if (first === settled) { off(); return await result; }
    const p: any = first;
    p.resolve(pick(p.diff.groups ?? [], p.diff.actions ?? []));
    return await result;
  }

  it('applied + sum(rejected.count) === requested, and every bucket names its ids', async () => {
    // Deterministic pseudo-random so a failure is reproducible.
    let seed = 20260827;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

    const consols = ['CONSOL-A', 'CONSOL-B'];
    const tiers = ['premium', 'standard', 'basic'];
    const roles = ['gateway-operator', 'duty-manager'];
    let checked = 0;
    const bad: string[] = [];

    for (let i = 0; i < 60; i++) {
      setRole(roles[i % 2]);
      const input: any = {};
      if (rnd() < 0.5) input.consol = consols[Math.floor(rnd() * 2)];
      if (rnd() < 0.4) input.slaTier = tiers[Math.floor(rnd() * 3)];
      if (rnd() < 0.25) input.lithiumBattery = true;

      const mode = i % 3; // 0 = refuse all, 1 = partial, 2 = approve all
      const out = await run('propose_remedy', input, (groups, actions) => {
        if (mode === 0) return null;
        if (mode === 2) return { groups: groups.map((g: any) => g.group), actions: actions.map((a: any) => a.id ?? a) };
        const keep = groups.filter(() => rnd() < 0.5).map((g: any) => g.group);
        return { groups: keep, actions: [] };
      });

      const payload = JSON.parse(out.content[0].text);
      const sum = (payload.rejected ?? []).reduce((n: number, r: any) => n + r.count, 0);
      if (payload.applied + sum !== payload.requested) {
        bad.push(`call ${i} ${JSON.stringify(input)} mode=${mode}: applied=${payload.applied} + rejected=${sum} !== requested=${payload.requested}`);
      }
      for (const r of payload.rejected ?? []) {
        if (!Array.isArray(r.ids) || r.ids.length !== r.count) {
          bad.push(`call ${i} mode=${mode}: bucket "${r.reason}" count=${r.count} but ids=${r.ids?.length}`);
        }
      }
      checked++;
    }
    setRole('gateway-operator');
    // Reported in full rather than as a count: a failure here needs the exact call to reproduce.
    expect(bad).toEqual([]);
    expect(checked).toBe(60);
    expect(Object.keys(store.state.shipments).length).toBeGreaterThan(0);
  }, 60_000);
});
