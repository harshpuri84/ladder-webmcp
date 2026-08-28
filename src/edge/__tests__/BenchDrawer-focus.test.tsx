// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { registerLadderTool as RegisterLadderTool } from '../../webmcp/adapter';
import type { BenchDrawer as BenchDrawerType } from '../ui/BenchDrawer';

const flush = () => new Promise(r => setTimeout(r, 0));

/**
 * F2, this product's half. The drawer opened with focus still on <body>, so the on-call engineer
 * tabbed through the autonomy and authority bars behind it to reach the latches. Unlike the
 * freight console's panel this drawer really is modal — the rack behind it is already
 * `pointer-events: none` while `body.rk-drawn` is set — so the fix makes that claim true rather
 * than dropping it: the rack goes `inert`, and focus moves in and comes back out.
 */
describe('BenchDrawer: focus and inertness while the drawer is out (F2)', () => {
  let registerLadderTool: typeof RegisterLadderTool;
  let BenchDrawer: typeof BenchDrawerType;
  const registered = new Map<string, { execute: (input: any) => Promise<any> }>();

  beforeAll(async () => {
    (document as any).modelContext = {
      registerTool: (spec: any) => registered.set(spec.name, spec),
      unregisterTool: (name: string) => registered.delete(name),
    };
    ({ registerLadderTool } = await import('../../webmcp/adapter'));
    ({ BenchDrawer } = await import('../ui/BenchDrawer'));

    for (const name of ['drawer_focus_tool', 'drawer_inert_tool']) {
      registerLadderTool({
        name, description: 'test-only',
        inputSchema: { type: 'object', properties: {} },
        async exec(_input: any, ctx: any) {
          ctx.db.pops['fra1'].trafficPct += 0.01;
          return { matched: 1 };
        },
      });
    }
  });

  afterEach(() => cleanup());
  afterAll(() => { delete (document as any).modelContext; });

  // Deliberately returns a wrapper: awaiting the proposal's own promise would hang until the
  // operator decides.
  const open = async (tool: string) => {
    const result = registered.get(tool)!.execute({});
    await act(async () => { await flush(); });
    return { result };
  };

  it('puts focus on the drawer when it rises, and gives it back when it closes', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    render(<BenchDrawer />);
    const { result } = await open('drawer_focus_tool');

    const drawer = screen.getByRole('dialog');
    expect(document.activeElement).toBe(drawer);

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
      await result;
    });

    expect(screen.queryByRole('dialog')).toBe(null);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('makes the rack behind it genuinely inert, so aria-modal is not a claim the code breaks', async () => {
    const rack = document.createElement('div');
    rack.className = 'rk-body';
    rack.innerHTML = '<button>a site</button>';
    document.body.appendChild(rack);

    render(<BenchDrawer />);
    const { result } = await open('drawer_inert_tool');

    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    expect(rack.hasAttribute('inert')).toBe(true);

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
      await result;
    });

    expect(rack.hasAttribute('inert')).toBe(false);
    rack.remove();
  });
});
