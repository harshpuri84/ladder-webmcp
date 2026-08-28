import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { setRole as SetRole, ROLES as Roles } from '../authority';
import type { onToolsChange as OnToolsChange, listTools as ListTools } from '../adapter';

/**
 * A WebMCP host may implement half the namespace.
 *
 * Measured against Codex's built-in browser on 28 August 2026: it provides `registerTool` and no
 * `unregisterTool`. `reregister()` called the missing method, threw, and took its caller down —
 * so switching the role on shift, ratifying a standing rule and revoking one all failed there.
 * The role had already changed internally; only the re-registration and the re-render were lost,
 * which is why the strip looked stuck rather than broken.
 *
 * The listeners after the registration calls are the thing that must survive: they are what
 * redraws the human's side. A host that cannot refresh the agent's copy of a description must
 * not also cost the operator their own interface.
 */
describe('a host that registers but cannot unregister', () => {
  const registered = new Map<string, any>();
  let setRole: typeof SetRole;
  let ROLES: typeof Roles;
  let onToolsChange: typeof OnToolsChange;
  let listTools: typeof ListTools;

  beforeAll(async () => {
    (globalThis as any).document = {
      // Deliberately no unregisterTool, exactly as the Codex host is shaped.
      modelContext: { registerTool: (s: any) => registered.set(s.name, s) },
    };
    await import('../../domain/store');
    const { registerDomainTools } = await import('../../domain/tools');
    ({ setRole, ROLES } = await import('../authority'));
    ({ onToolsChange, listTools } = await import('../adapter'));
    registerDomainTools();
  });
  afterAll(() => { delete (globalThis as any).document; });

  it('switches role without throwing, and still tells the UI to redraw', () => {
    let notified = 0;
    const off = onToolsChange(() => { notified += 1; });

    expect(() => setRole(ROLES[1].id)).not.toThrow();
    expect(notified).toBeGreaterThan(0);

    off();
  });

  it('leaves the toolset intact and its descriptions readable', () => {
    const tools = listTools();
    expect(tools.map(t => t.name)).toContain('propose_remedy');
    const remedy = tools.find(t => t.name === 'propose_remedy')!;
    expect(remedy.description.length).toBeGreaterThan(0);
  });
});
