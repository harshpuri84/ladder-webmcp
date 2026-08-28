import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { onProposal as OnProposal } from '../adapter';

/**
 * A runtime may advertise `agent.requestUserInteraction` and refuse it.
 *
 * Measured against Codex's built-in browser on 28 August 2026: the call came back
 * `requestUserInteraction is not supported by the Codex WebMCP shim`. The adapter detected the
 * hook by `typeof === 'function'`, called it, and the whole tool call died — in the one runtime
 * an OpenAI judge is most likely to open. Chrome 151 has the opposite shape, no agent object at
 * all, which is why absence was the only case the original detection considered.
 */
describe('a runtime that advertises the interaction hook and then refuses it', () => {
  const registered = new Map<string, any>();
  let onProposal: typeof OnProposal;

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (s: any) => registered.set(s.name, s),
        unregisterTool: (n: string) => registered.delete(n),
      },
    };
    await import('../../domain/store');
    const { registerDomainTools } = await import('../../domain/tools');
    ({ onProposal } = await import('../adapter'));
    registerDomainTools();
  });
  afterAll(() => { delete (globalThis as any).document; });

  /** Exactly the shim's shape: the method is there, and calling it throws. */
  const refusingAgent = {
    requestUserInteraction() {
      throw new Error('requestUserInteraction is not supported by the Codex WebMCP shim');
    },
  };

  it('falls back to the page surface instead of failing the call', async () => {
    const seen = new Promise<any>(res => {
      const off = onProposal((p: any) => { if (p) { off(); res(p); } });
    });

    // The second argument is the agent object the runtime hands `execute`.
    const call = registered.get('propose_remedy')!.execute({ consol: 'CONSOL-B' }, refusingAgent);

    // The proposal must still reach the page. Before the fix this never arrived and `call`
    // rejected with the shim's error.
    const proposal = await seen;
    expect(proposal.diff.groups.length).toBeGreaterThan(0);

    proposal.resolve(null);
    const out = await call;
    const payload = JSON.parse(out.content[0].text);
    expect(payload.requested).toBeGreaterThan(0);
    expect(payload.applied).toBe(0);
  }, 15_000);

  it('still uses the hook when a runtime genuinely supports it', async () => {
    let hookRan = false;
    const workingAgent = {
      async requestUserInteraction(show: () => Promise<unknown>) { hookRan = true; return show(); },
    };
    const seen = new Promise<any>(res => {
      const off = onProposal((p: any) => { if (p) { off(); res(p); } });
    });
    const call = registered.get('propose_remedy')!.execute({ consol: 'CONSOL-B' }, workingAgent);
    const proposal = await seen;
    proposal.resolve(null);
    await call;
    expect(hookRan).toBe(true);
  }, 15_000);
});
