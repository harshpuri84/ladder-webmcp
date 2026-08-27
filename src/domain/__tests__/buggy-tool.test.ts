// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { setBuggyToolEnabled as SetBuggyToolEnabled } from '../tools';

/**
 * The scope-violation demonstration, restored on the new tool surface.
 *
 * "Simulate a buggy tool" makes propose_remedy write a field at commit time that the preview
 * never showed. It is one of only two moments where the enforcement visibly fires, so it has
 * to keep working: the guard must abort the commit, roll every approved write back, and report
 * the field it caught by name — and with the switch off, the very same call must go through
 * clean, or the demonstration is proving nothing about the guard.
 */
describe('the buggy-tool demonstration reaches the commit guard', () => {
  let setBuggyToolEnabled: typeof SetBuggyToolEnabled;
  let store: typeof import('../store').store;
  const registered = new Map<string, { execute: (input: unknown) => Promise<any> }>();

  beforeAll(async () => {
    (document as any).modelContext = {
      registerTool: (spec: any) => registered.set(spec.name, spec),
      unregisterTool: (name: string) => registered.delete(name),
    };
    ({ setBuggyToolEnabled } = await import('../tools'));
    ({ store } = await import('../store'));
    const { registerDomainTools } = await import('../tools');
    registerDomainTools();
  });

  afterEach(() => setBuggyToolEnabled(false));
  afterAll(() => { delete (document as any).modelContext; });

  // Approves everything the preview showed, which is what the operator does by leaving the
  // panel as it arrives — so anything the commit does beyond that is the tool going off-script.
  async function runWithApproval(input: unknown) {
    const { onProposal } = await import('../../webmcp/adapter');
    const off = onProposal(p => {
      if (!p) return;
      p.resolve({ groups: p.diff.groups.map(g => g.group), actions: [] });
    });
    try {
      return await registered.get('propose_remedy')!.execute(input);
    } finally {
      off();
    }
  }

  it('goes through clean with the switch off', async () => {
    const out = await runWithApproval({ customer: 'Karo Textiles' });
    const payload = JSON.parse(out.content[0].text);

    expect(payload.status).toBe('applied');
    expect(payload.applied).toBeGreaterThan(0);
    expect(payload.rejected).toEqual([]);
    expect(store.state.shipments['HAWB-70003'].remedy).toBe('rebook');
  });

  it('is caught, named and rolled back with the switch on', async () => {
    const target = 'HAWB-70005';
    const before = {
      remedy: store.state.shipments[target].remedy,
      slaTier: store.state.shipments[target].slaTier,
    };

    setBuggyToolEnabled(true);
    const out = await runWithApproval({ customer: 'Verity Motors' });
    const payload = JSON.parse(out.content[0].text);

    expect(payload.applied).toBe(0);
    expect(payload.rejected.some((r: any) => r.reason.includes('slaTier'))).toBe(true);
    expect(payload.replan_required).toBe(true);

    // Rolled back whole: not the approved remedy, not the field the tool reached for.
    expect(store.state.shipments[target].remedy).toBe(before.remedy);
    expect(store.state.shipments[target].slaTier).toBe(before.slaTier);

    // The invariant, on the one path most likely to break it.
    const rejectedTotal = payload.rejected.reduce((n: number, r: any) => n + r.count, 0);
    expect(payload.applied + rejectedTotal).toBe(payload.requested);
  });
});
