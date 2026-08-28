import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { edgeStore as StoreModule } from '../store';
import type { registerEdgeTools as RegisterEdgeTools } from '../tools';
import type { onProposal as OnProposal } from '../../webmcp/adapter';

/**
 * The same invariant the freight product's sweep walks, over this domain's own tools: `applied`
 * plus the sum of every `rejected[].count` equals `requested`, on every path, and every bucket
 * names as many ids as it claims.
 *
 * This is the test that makes the engine claim falsifiable. The ledger is assembled in
 * `webmcp/adapter.ts` out of numbers three different layers contribute — the tool's own domain
 * skips, the operator's cut, the commit's outcome — so a domain that fed it a shape the freight
 * product never produces would break it here rather than in a review six weeks later. If this
 * fails, the claim that `src/core/` is domain-free fails with it.
 *
 * Sixty real preview-and-commit calls with randomised filters, three decision shapes (refuse
 * everything, keep a random subset, approve everything) and both a default and a forced rollout
 * mode. Fixed seed, so a failure is reproducible rather than a story about a flake.
 */
describe('the reconciliation ledger holds across randomised real calls', () => {
  let edgeStore: typeof StoreModule;
  let onProposal: typeof OnProposal;
  const registered = new Map<string, any>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (s: any) => registered.set(s.name, s),
        unregisterTool: (n: string) => registered.delete(n),
      },
    };
    ({ edgeStore } = await import('../store'));
    const { registerEdgeTools } = await import('../tools') as { registerEdgeTools: typeof RegisterEdgeTools };
    ({ onProposal } = await import('../../webmcp/adapter'));
    registerEdgeTools();
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
    let seed = 20260828;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

    const regions = ['eu-west', 'eu-north', 'na-east', 'na-west', 'apac', 'latam'];
    const modes = ['shadow', 'staged', 'immediate'];
    const releases = ['2026.08.27-1', '2026.08.28-1'];
    let checked = 0;
    const bad: string[] = [];

    for (let i = 0; i < 60; i++) {
      const input: any = {};
      if (rnd() < 0.5) input.region = regions[Math.floor(rnd() * regions.length)];
      if (rnd() < 0.3) input.frozen = rnd() < 0.5;
      if (rnd() < 0.2) input.incident = true;
      if (rnd() < 0.35) input.mode = modes[Math.floor(rnd() * modes.length)];
      if (rnd() < 0.3) input.release = releases[Math.floor(rnd() * releases.length)];

      const mode = i % 3; // 0 = take nothing, 1 = cut it down, 2 = commit as proposed
      const out = await run('roll_config', input, (groups, actions) => {
        if (mode === 0) return null;
        if (mode === 2) return { groups: groups.map((g: any) => g.group), actions: actions.map((a: any) => a.actionId) };
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

    // Reported in full rather than as a count: a failure here needs the exact call to reproduce.
    expect(bad).toEqual([]);
    expect(checked).toBe(60);
    expect(Object.keys(edgeStore.state.pops).length).toBe(36);
  }, 60_000);

  it('holds for the irreversible tool too, where the ledger counts actions and not records', async () => {
    const bad: string[] = [];
    const shapes: [string, any, number][] = [
      ['whole', { region: 'apac', message: 'Rolling 2026.08.27-1 tonight.' }, 2],
      ['none', { region: 'apac', message: 'Rolling 2026.08.27-1 tonight.' }, 0],
      ['no message', { region: 'apac', message: '   ' }, 2],
    ];
    for (const [name, input, keep] of shapes) {
      const out = await run('page_oncall', input, (_g, actions) =>
        keep === 0 ? null : { groups: [], actions: actions.slice(0, keep).map((a: any) => a.actionId) },
      );
      const payload = JSON.parse(out.content[0].text);
      const sum = (payload.rejected ?? []).reduce((n: number, r: any) => n + r.count, 0);
      if (payload.applied + sum !== payload.requested) {
        bad.push(`${name}: applied=${payload.applied} + rejected=${sum} !== requested=${payload.requested}`);
      }
      for (const r of payload.rejected ?? []) {
        if (!Array.isArray(r.ids) || r.ids.length !== r.count) {
          bad.push(`${name}: bucket "${r.reason}" count=${r.count} but ids=${r.ids?.length}`);
        }
      }
    }
    expect(bad).toEqual([]);
  }, 20_000);

  it('an unknown release is reported against the release, not against thirty-six sites', async () => {
    const out = await run('roll_config', { release: '2026.99.99-1' }, () => null);
    const payload = JSON.parse(out.content[0].text);
    expect(payload.requested).toBe(1);
    expect(payload.applied).toBe(0);
    expect(payload.rejected).toEqual([
      { count: 1, reason: 'no such release; nothing was staged', ids: ['2026.99.99-1'] },
    ]);
  });
});
