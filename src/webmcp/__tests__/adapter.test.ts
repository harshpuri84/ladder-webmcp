import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { ratify as Ratify, registerLadderTool as RegisterLadderTool, activePolicy as ActivePolicy } from '../adapter';

/**
 * Reproduces the README's own two-minute path: a judge opens the app in a plain browser with
 * no WebMCP support at all. `document` exists (as it does in any real browser) but carries no
 * `modelContext`, and neither does `navigator` here — so `registerLadderTool` returns early and
 * `registrations` stays empty for every tool name, forever. This is deliberately its own file:
 * `webmcp/adapter.ts` reads `mc` once at module load, so tools.test.ts (which installs a fake
 * `document.modelContext` before importing) can never exercise this path in the same run.
 */
describe('adapter with no WebMCP available', () => {
  let ratify: typeof Ratify;
  let registerLadderTool: typeof RegisterLadderTool;
  let activePolicy: typeof ActivePolicy;

  beforeAll(async () => {
    (globalThis as any).document = {};
    ({ ratify, registerLadderTool, activePolicy } = await import('../adapter'));
  });

  afterAll(() => {
    delete (globalThis as any).document;
  });

  it('registerLadderTool is a no-op and registers nothing', () => {
    expect(() => registerLadderTool({
      name: 'noop_tool', description: 'x', inputSchema: { type: 'object' },
      async exec() { return {}; },
    })).not.toThrow();
  });

  it('ratify() does not throw when the tool was never registered, and leaves no policy set', () => {
    expect(() => ratify({
      id: 'pol-1', tool: 'update_shipments', maxRecords: 10, maxValue: 100,
      expiresAt: '2099-01-01T00:00:00.000Z', draftedFrom: 'prop-1', ratified: false,
    })).not.toThrow();

    // The old bug ran `policies.set(...)` before checking the registration existed, so a
    // throwing reregister() still left the policy half-set. Confirm the fix leaves state
    // consistent: since nothing was ever registered, nothing should have been ratified either.
    expect(activePolicy('update_shipments')).toBeUndefined();
  });
});
