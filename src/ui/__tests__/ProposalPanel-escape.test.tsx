// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { registerLadderTool as RegisterLadderTool } from '../../webmcp/adapter';
import type { ProposalPanel as ProposalPanelType } from '../ProposalPanel';

const flush = () => new Promise(r => setTimeout(r, 0));

/**
 * F11: the panel carries role="dialog" and aria-modal="true", which sets the expectation that
 * Escape closes it — but nothing handled the key at all. The fix has to take the same path
 * Refuse does (resolving the proposal with a real decision), not a silent dismiss: a proposal
 * vanishing off screen with its promise never settled would just be F1 again by another route.
 */
describe('ProposalPanel: Escape refuses the open proposal (F11)', () => {
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
      name: 'escape_test_tool', description: 'test-only',
      inputSchema: { type: 'object', properties: {} },
      async exec(_input: any, ctx: any) {
        ctx.db.shipments['HAWB-70003'].revenueEur += 1;
        return { matched: 1 };
      },
    });
  });

  afterEach(() => cleanup());
  afterAll(() => { delete (document as any).modelContext; });

  it('resolves the proposal (a refusal, not a silent dismiss) when Escape is pressed', async () => {
    render(<ProposalPanel />);

    const result = registered.get('escape_test_tool')!.execute({});
    await act(async () => { await flush(); });

    expect(screen.getByText('escape_test_tool')).toBeTruthy();

    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });

    const settledOrPending = (p: Promise<unknown>) =>
      Promise.race([p.then(() => 'settled'), flush().then(() => 'pending')]);
    expect(await settledOrPending(result)).toBe('settled');

    const payload = await result;
    // The same account a genuine Refuse click produces — not a silent close.
    expect(payload.status).not.toBe('applied');
    expect(payload.rejected.some((r: any) => r.reason === 'the operator refused this change')).toBe(true);
  });

  it('does not resolve a second time if Escape and Refuse race in the same batch', async () => {
    registerLadderTool({
      name: 'escape_race_test_tool', description: 'test-only',
      inputSchema: { type: 'object', properties: {} },
      async exec(_input: any, ctx: any) {
        // A revenue bump rather than a fixed field assignment: guaranteed to differ from
        // whatever the seed happened to produce, so the write always reaches the diff.
        ctx.db.shipments['HAWB-70004'].revenueEur += 1;
        return { matched: 1 };
      },
    });

    render(<ProposalPanel />);
    const result = registered.get('escape_race_test_tool')!.execute({});
    await act(async () => { await flush(); });

    const refuseButton = screen.getByRole('button', { name: 'Refuse all' });
    expect(() => act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.click(refuseButton);
    })).not.toThrow();

    await result;
  });
});
