// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { registerLadderTool as RegisterLadderTool } from '../../webmcp/adapter';
import type { ProposalPanel as ProposalPanelType } from '../ProposalPanel';

const flush = () => new Promise(r => setTimeout(r, 0));

/**
 * F1: double-clicking Apply destroys the second queued proposal and hangs its agent forever.
 * Reproduced through the real adapter + the real ProposalPanel component, not a reimplementation
 * of the queue logic — a fake `document.modelContext` is installed before either module is
 * imported, exactly as the other adapter-facing suites do.
 *
 * Per the brief: two decisions are dispatched inside one React batch (both `fireEvent.click`
 * calls inside a single synchronous `act()`), not two hand-timed clicks — a real double-click
 * lands both native click events in the same task, so this is what actually reproduces the bug
 * deterministically rather than relying on timing.
 */
describe('ProposalPanel: double decision in one batch (F1)', () => {
  let registerLadderTool: typeof RegisterLadderTool;
  let ProposalPanel: typeof ProposalPanelType;
  const registered = new Map<string, { execute: (input: any) => Promise<any> }>();

  beforeAll(async () => {
    (document as any).modelContext = {
      registerTool: (spec: any) => registered.set(spec.name, spec),
      unregisterTool: (name: string) => registered.delete(name),
    };
    ({ registerLadderTool } = await import('../../webmcp/adapter'));
    ({ ProposalPanel } = await import('../ProposalPanel'));

    registerLadderTool({
      name: 'test_tool_one', description: 'first test tool',
      inputSchema: { type: 'object', properties: {} },
      async exec(_input: any, ctx: any) {
        ctx.db.shipments['SHP-10000'].status = 'Delivered';
        return { matched: 1 };
      },
    });
    registerLadderTool({
      name: 'test_tool_two', description: 'second test tool',
      inputSchema: { type: 'object', properties: {} },
      async exec(_input: any, ctx: any) {
        ctx.db.shipments['SHP-10001'].status = 'Delivered';
        return { matched: 1 };
      },
    });
  });

  afterEach(() => cleanup());
  afterAll(() => { delete (document as any).modelContext; });

  it('resolves exactly one proposal and leaves the second queued, not dropped, on a double click', async () => {
    render(<ProposalPanel />);

    // Two write calls queued back to back, exactly as an agent double-firing (or two agents)
    // would produce — neither awaited yet, so both proposals are in flight together.
    const result1 = registered.get('test_tool_one')!.execute({});
    const result2 = registered.get('test_tool_two')!.execute({});

    // Let both tool calls run their preview and publish through onProposal into the panel.
    await act(async () => { await flush(); });

    // The first proposal is on screen, the second is queued behind it.
    expect(screen.getByText('test_tool_one')).toBeTruthy();
    expect(screen.getByText('1 more waiting')).toBeTruthy();

    const applyButton = screen.getByRole('button', { name: /Apply/ });

    // The repro: a double-click dispatches two decisions inside one React batch.
    act(() => {
      fireEvent.click(applyButton);
      fireEvent.click(applyButton);
    });

    const settledOrPending = (p: Promise<unknown>) =>
      Promise.race([p.then(() => 'settled'), flush().then(() => 'pending')]);

    // The first call's promise settles — its decision landed.
    expect(await settledOrPending(result1)).toBe('settled');
    // The second call's promise must NOT have been silently resolved by the double click —
    // this is the "agent waits forever" failure mode before the fix (it would incorrectly
    // settle here without ever being decided).
    expect(await settledOrPending(result2)).toBe('pending');

    // The queue must still hold the second proposal: the panel now shows it, not a closed/empty
    // panel with an orphaned promise.
    await act(async () => { await flush(); });
    expect(screen.getByText('test_tool_two')).toBeTruthy();

    // Clean up the still-pending second proposal so it doesn't leak into other tests.
    const stillApplyButton = screen.getByRole('button', { name: /Apply/ });
    act(() => { fireEvent.click(stillApplyButton); });
    expect(await settledOrPending(result2)).toBe('settled');
  });
});
