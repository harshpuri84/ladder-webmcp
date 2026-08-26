import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { store as StoreModule } from '../../domain/store';
import type { registerLadderTool as RegisterLadderTool, onProposal as OnProposal } from '../adapter';

const flush = () => new Promise(r => setTimeout(r, 0));

/**
 * F2: a tool call arriving before any subscriber attaches to `onProposal` used to vanish
 * silently — `proposalListeners.forEach(...)` over an empty Set does nothing, and nothing
 * buffered the proposal for later. Tools register at module load, before React mounts and its
 * effect subscribes, so a write call fired the instant the page loads hit exactly this gap: no
 * panel, no receipt, and a promise that never settles.
 *
 * Deliberately its own file, matching webmcp/adapter.test.ts's own reasoning: `mc` is read once
 * at module load, so a fresh module instance with its own fake `document.modelContext` is
 * needed to exercise registerLadderTool() actually registering something.
 */
describe('adapter buffers a proposal published before any subscriber (F2)', () => {
  let store: typeof StoreModule;
  let registerLadderTool: typeof RegisterLadderTool;
  let onProposal: typeof OnProposal;
  const registered = new Map<string, { execute: (input: any) => Promise<any> }>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (spec: any) => registered.set(spec.name, spec),
        unregisterTool: (name: string) => registered.delete(name),
      },
    };
    ({ store } = await import('../../domain/store'));
    ({ registerLadderTool, onProposal } = await import('../adapter'));

    registerLadderTool({
      name: 'early_call_test_tool', description: 'test-only',
      inputSchema: { type: 'object', properties: {} },
      async exec(_input: any, ctx: any) {
        const [firstId] = Object.keys(ctx.db.shipments);
        ctx.db.shipments[firstId].status = 'Delivered';
        return { matched: 1 };
      },
    });
  });

  afterAll(() => { delete (globalThis as any).document; });

  it('holds a proposal published with no subscriber and replays it to the first one that attaches', async () => {
    // Simulates the exact ordering the bug depends on: the tool call fires (module evaluation
    // already happened, so the tool is registered) before anything has called onProposal — the
    // real app's case is React's effect not having run yet because the page just loaded.
    const resultPromise = registered.get('early_call_test_tool')!.execute({});

    // Let the preview run to completion and reach the "publish to onProposal" point, with
    // still nobody subscribed.
    await flush();

    let received: any = null;
    const off = onProposal(p => { if (p) received = p; });

    // The proposal must arrive on first subscription, not be lost.
    expect(received).not.toBeNull();
    expect(received.toolName).toBe('early_call_test_tool');

    received.resolve(null);
    off();
    await resultPromise;
  });

  it('does not replay a buffered proposal to a second subscriber once the first has consumed it', async () => {
    void store; // referenced for type-checking symmetry with the other adapter suites
    const resultPromise = registered.get('early_call_test_tool')!.execute({});
    await flush();

    let first: any = null;
    const offFirst = onProposal(p => { if (p) first = p; });
    expect(first).not.toBeNull();
    offFirst();

    let second: any = null;
    const offSecond = onProposal(p => { if (p) second = p; });
    expect(second).toBeNull();
    offSecond();

    first.resolve(null);
    await resultPromise;
  });
});
