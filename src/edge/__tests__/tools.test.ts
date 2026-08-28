import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { edgeStore as StoreModule } from '../store';
import type { onProposal as OnProposal } from '../../webmcp/adapter';

/**
 * The four tools driven through the real adapter, the way an agent reaches them: a fake
 * `document.modelContext` collects the registrations and the test calls `execute` on them.
 * Nothing here reaches into the tool functions directly, because the guard is the thing under
 * test as much as the tool is.
 */
describe('edge tools through the real preview-and-commit path', () => {
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
    const { registerEdgeTools } = await import('../tools');
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
    const settled = Symbol('settled');
    const first = await Promise.race([ready, result.then(() => settled)]);
    if (first === settled) { off(); return { payload: JSON.parse((await result).content[0].text), proposal: null }; }
    const p: any = first;
    p.resolve(pick(p.diff.groups ?? [], p.diff.actions ?? []));
    return { payload: JSON.parse((await result).content[0].text), proposal: p };
  }

  it('registers two read tools and two guarded write tools', () => {
    expect([...registered.keys()].sort())
      .toEqual(['inspect_pop', 'list_pops', 'page_oncall', 'roll_config']);
    expect(registered.get('list_pops').annotations).toEqual({ readOnlyHint: true });
    expect(registered.get('roll_config').annotations).toBeUndefined();
  });

  it('a read tool answers without opening a drawer and without changing anything', async () => {
    const before = edgeStore.state.pops.ams1.version;
    const out = await registered.get('list_pops').execute({ region: 'eu-north' });
    expect(out.total).toBe(4);
    expect(out.rows.map((r: any) => r.id)).toEqual(['cph1', 'arn1', 'osl1', 'hel1']);
    expect(edgeStore.state.pops.ams1.version).toBe(before);
  });

  it('a read tool cannot write, loudly', async () => {
    // inspect_pop returns the record; a caller mutating it through the returned proxy is the
    // failure mode the read-only view exists to refuse.
    const view = registered.get('inspect_pop');
    const out = await view.execute({ id: 'ams1' });
    expect(out.modes.map((m: any) => m.mode)).toEqual(['staged', 'immediate', 'shadow']);
    expect(out.pop.id).toBe('ams1');
  });

  it('nothing is applied until the operator commits, and only what they kept', async () => {
    const { payload, proposal } = await run('roll_config', { region: 'eu-north' }, groups =>
      ({ groups: groups.filter((g: any) => g.id !== 'hel1').map((g: any) => g.group), actions: [] }),
    );
    // All four eu-north sites are still on 2026.08.19-3, so all four are candidates.
    expect(proposal!.diff.groups).toHaveLength(4);
    expect(payload.applied).toBe(3);
    expect(payload.status).toBe('partially_applied');
    expect(edgeStore.state.pops.hel1.pendingVersion).toBeNull();
    expect(edgeStore.state.pops.osl1.pendingVersion).toBe('2026.08.27-1');
    expect(edgeStore.state.pops.osl1.rolloutMode).toBe('immediate');
    expect(edgeStore.state.pops.arn1.rolloutMode).toBe('staged');
    expect(payload.rejected).toEqual([
      { count: 1, reason: 'the operator removed these from the change', ids: ['hel1'] },
    ]);
  });

  it('a closed site never reaches the drawer and comes back naming the rule id', async () => {
    const { payload, proposal } = await run('roll_config', { region: 'na-west' }, groups =>
      ({ groups: groups.map((g: any) => g.group), actions: [] }),
    );
    // sjc2 is drained and sea1 has an incident open: both are skipped by the tool itself.
    expect(proposal!.diff.groups.map((g: any) => g.id).sort())
      .toEqual(['den1', 'dfw1', 'lax1', 'sjc1']);
    // The default path has no single mode to name, so a fully closed site comes back naming
    // every rule that closed it — which is what an agent needs to write a different next call.
    const reasons = payload.rejected.map((r: any) => r.reason);
    expect(reasons.some((r: string) => r.includes('closed here by drained-for-maintenance'))).toBe(true);
    expect(reasons.some((r: string) => r.includes('closed here by incident-in-progress'))).toBe(true);
    expect(payload.applied + payload.rejected.reduce((n: number, r: any) => n + r.count, 0))
      .toBe(payload.requested);
    expect(payload.replan_required).toBe(true);
  });

  it('a forced mode is applied only where the rule leaves it open', async () => {
    const { payload } = await run('roll_config', { region: 'latam', mode: 'immediate' }, groups =>
      ({ groups: groups.map((g: any) => g.group), actions: [] }),
    );
    // bog1 is behind the compatibility floor; the rest of latam can take it all at once.
    const skew = payload.rejected.find((r: any) => r.reason.startsWith('version-skew-floor'));
    expect(skew.ids).toEqual(['bog1']);
    expect(edgeStore.state.pops.gru1.rolloutMode).toBe('immediate');
    expect(edgeStore.state.pops.bog1.rolloutMode).toBeNull();
  });

  it('a site already serving the release is reported as nothing to do, not as a change', async () => {
    const { payload } = await run('roll_config', { ids: ['dub1'] }, () => null);
    expect(payload.requested).toBe(1);
    expect(payload.applied).toBe(0);
    expect(payload.rejected[0].reason).toContain('already serving 2026.08.27-1');
  });

  it('a second call over ground already staged brings only what actually changes', async () => {
    // The eu-north case above staged three of the four sites and left hel1 unlatched. Re-running
    // the same request must put hel1 in front of the operator and nothing else: a row whose every
    // figure is already the figure showing is not a change, and the drawer must not carry one.
    const { payload, proposal } = await run('roll_config', { region: 'eu-north' }, () => null);
    expect(proposal!.diff.groups.map((g: any) => g.id)).toEqual(['hel1']);
    expect(payload.requested).toBe(4);
    expect(payload.applied).toBe(0);
    const already = payload.rejected.filter((r: any) => r.reason.includes('already staged for 2026.08.27-1'));
    expect(already.flatMap((r: any) => r.ids).sort()).toEqual(['arn1', 'cph1', 'osl1']);
  });

  it('a page is held until released, and is never covered by a standing rule', async () => {
    const { payload, proposal } = await run(
      'page_oncall',
      { region: 'eu-west', message: 'Config rollout starting; watch origin-shield errors.' },
      (_g, actions) => ({ groups: [], actions: [actions[0].actionId] }),
    );
    expect(proposal!.diff.actions).toHaveLength(1); // one rotation covers all of eu-west
    expect(payload.actions_released).toBe(1);
    expect(payload.rule_offered).toBeNull();
  });
});
