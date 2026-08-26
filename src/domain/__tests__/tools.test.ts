import { describe, it, expect, afterEach } from 'vitest';

// This test exercises the *real* registration and preview path — the actual
// registerLadderTool()/runShadow() wiring in src/webmcp/adapter.ts — rather than
// reimplementing the domain's deltaOf in the test. WebMCP isn't present in the test
// runner, so a minimal fake `document.modelContext` is installed before the modules
// under test are imported (adapter.ts throws at import time if it can't find one).
describe('domain tools: deltaOf wiring', () => {
  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('wires a real, nonzero valueDelta into a repricing proposal', async () => {
    const registered = new Map<string, { execute: (...args: any[]) => Promise<unknown> }>();
    (globalThis as any).document = {
      modelContext: {
        registerTool: (spec: any) => registered.set(spec.name, spec),
        unregisterTool: (name: string) => registered.delete(name),
      },
    };

    const { store } = await import('../store');
    const { registerDomainTools } = await import('../tools');
    const { onProposal } = await import('../../webmcp/adapter');
    registerDomainTools();

    const reprice = registered.get('reprice_shipments');
    expect(reprice).toBeDefined();

    const matches = Object.values(store.state.shipments).filter(s => s.customer === 'Northwind Retail');
    expect(matches.length).toBeGreaterThan(0);
    const expectedDelta = matches.reduce((sum, s) => sum + (Math.round(s.price * 1.1) - s.price), 0);
    expect(expectedDelta).not.toBe(0);

    let capturedDiff: any;
    const off = onProposal(p => {
      if (p) { capturedDiff = p.diff; p.resolve(null); }
    });

    await reprice!.execute({ customer: 'Northwind Retail', pct: 10 });
    off();

    expect(capturedDiff).toBeDefined();
    expect(capturedDiff.totals.valueDelta).toBe(expectedDelta);
    expect(capturedDiff.totals.valueDelta).not.toBe(0);
  });
});
