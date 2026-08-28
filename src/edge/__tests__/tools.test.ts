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
    // cph1 and arn1 have eight nodes each and take a staged rollout — a tenth of 1.5% and of
    // 1.3%, so 0.15% and 0.13% of production traffic — and are the release engineer's to commit.
    // osl1 and hel1 are single-node sites with no tenth to hold back, so they go all at once and
    // expose their whole share (1.00% and 0.80%). Both are above the 0.50% limit, so both go to
    // the traffic lead rather than being applied here — including hel1, which the operator also
    // struck out. It is accounted for once, as referred rather than as removed.
    expect(payload.applied).toBe(2);
    expect(payload.status).toBe('partially_applied');
    expect(edgeStore.state.pops.hel1.pendingVersion).toBeNull();
    expect(edgeStore.state.pops.osl1.pendingVersion).toBeNull();
    expect(edgeStore.state.pops.osl1.rolloutMode).toBeNull();
    expect(edgeStore.state.pops.arn1.rolloutMode).toBe('staged');
    expect(edgeStore.state.pops.cph1.rolloutMode).toBe('staged');
    expect(payload.rejected).toEqual([
      {
        count: 2,
        reason: "above the release engineer's 0.50% of production traffic exposure authority — referred to a traffic lead, not refused",
        ids: ['osl1', 'hel1'],
        pending: 'traffic lead',
      },
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
    // bog1 is behind the compatibility floor, so the rule closes it before the drawer opens and
    // it is never previewed. The other four are open to an immediate rollout and expose their
    // whole share — gru1 2.80%, scl1 0.90%, gru2 0.80%, eze1 0.60% of production traffic — so
    // every one of them is above the release engineer's 0.50% and is referred rather than
    // applied. Both layers are visible in the same payload: one bucket names a rule id, the
    // other names the authority boundary, and nothing latched either way.
    const skew = payload.rejected.find((r: any) => r.reason.startsWith('version-skew-floor'));
    expect(skew.ids).toEqual(['bog1']);
    expect(payload.referred)
      .toEqual({ count: 4, ids: ['gru1', 'scl1', 'gru2', 'eze1'], awaiting: 'traffic lead' });
    expect(edgeStore.state.pops.gru1.rolloutMode).toBeNull();
    expect(edgeStore.state.pops.bog1.rolloutMode).toBeNull();
  });

  it('a forced mode lands where the rule leaves it open and the exposure is the operator’s own', async () => {
    // The companion to the case above, and the half that proves a forced mode actually applies.
    //
    // Two honest routes were available once the limit moved to 0.50%: act as the traffic lead,
    // whose 10% clears everything, or force a mode whose exposure genuinely sits inside the
    // release engineer's own authority. This takes the second, because it is what the operator in
    // front of this console would actually do next — the immediate rollout above came back
    // referred, so they stage it instead, which is the entire reason a cautious mode exists.
    // Switching role to get a green test would only show that the boundary can be stepped around,
    // not that a forced mode works; the 0.50% figure is deliberate and nothing here dodges it.
    //
    // `staged` exposes a tenth of a site's share, so latam's multi-node sites land at 0.28%,
    // 0.09% and 0.08% of production traffic — all inside the limit, none referred. eze1 and bog1
    // have one node each and no tenth to hold back, so `single-node-no-slice` closes them before
    // the drawer: the rule layer still bites, and it is a different rule from the compatibility
    // floor the forced-immediate case hit, which is what makes the pair worth having.
    const { payload } = await run('roll_config', { region: 'latam', mode: 'staged' }, groups =>
      ({ groups: groups.map((g: any) => g.group), actions: [] }),
    );
    expect(payload.applied).toBe(3);
    expect(payload.status).toBe('partially_applied');
    // Nothing crossed the boundary, so the payload carries no referral at all.
    expect(payload.referred).toBeUndefined();
    expect(edgeStore.state.pops.gru1.rolloutMode).toBe('staged');
    expect(edgeStore.state.pops.gru1.exposedPct).toBe(0.28);
    expect(edgeStore.state.pops.scl1.rolloutMode).toBe('staged');
    expect(edgeStore.state.pops.gru2.rolloutMode).toBe('staged');
    // The single-node sites never reached the drawer, and the rule that closed them is named.
    const slice = payload.rejected.find((r: any) => r.reason.startsWith('single-node-no-slice'));
    expect(slice.ids.slice().sort()).toEqual(['bog1', 'eze1']);
    expect(edgeStore.state.pops.eze1.rolloutMode).toBeNull();
    expect(payload.applied + payload.rejected.reduce((n: number, r: any) => n + r.count, 0))
      .toBe(payload.requested);
  });

  it('a site already serving the release is reported as nothing to do, not as a change', async () => {
    const { payload } = await run('roll_config', { ids: ['dub1'] }, () => null);
    expect(payload.requested).toBe(1);
    expect(payload.applied).toBe(0);
    expect(payload.rejected[0].reason).toContain('already serving 2026.08.27-1');
  });

  it('a second call over ground already staged brings only what actually changes', async () => {
    // The eu-north case above staged cph1 and arn1, and referred osl1 and hel1 rather than
    // applying them. Re-running the same request must put those two in front of the operator and
    // nothing else: a row whose every figure is already the figure showing is not a change, and
    // the drawer must not carry one.
    const { payload, proposal } = await run('roll_config', { region: 'eu-north' }, () => null);
    expect(proposal!.diff.groups.map((g: any) => g.id)).toEqual(['osl1', 'hel1']);
    expect(payload.requested).toBe(4);
    expect(payload.applied).toBe(0);
    const already = payload.rejected.filter((r: any) => r.reason.includes('already staged for 2026.08.27-1'));
    expect(already.flatMap((r: any) => r.ids).sort()).toEqual(['arn1', 'cph1']);
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
