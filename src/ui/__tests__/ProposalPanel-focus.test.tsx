// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { registerLadderTool as RegisterLadderTool } from '../../webmcp/adapter';
import type { ProposalPanel as ProposalPanelType } from '../ProposalPanel';

const flush = () => new Promise(r => setTimeout(r, 0));

/**
 * F2: the panel opened with `document.activeElement` still on <body>. Measured with real key
 * dispatch, the first row checkbox inside it was tab stop 51 — the operator tabbed past the tab
 * bar, the sheet, the authority strip, the filter and forty-two register buttons to reach the
 * decision they had been interrupted for.
 *
 * F3 decided the shape of the fix: this dialog is deliberately NOT modal (the register has to
 * stay reachable during a decision, which is the whole point of the external-edit control), so
 * focus MOVES into the panel and is never trapped there.
 */
describe('ProposalPanel: focus on open and on close (F2)', () => {
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
      name: 'focus_test_tool', description: 'test-only',
      inputSchema: { type: 'object', properties: {} },
      async exec(_input: any, ctx: any) {
        ctx.db.shipments['HAWB-70011'].revenueEur += 1;
        return { matched: 1 };
      },
    });
  });

  afterEach(() => cleanup());
  afterAll(() => { delete (document as any).modelContext; });

  // Deliberately not `async`: awaiting this function would await the proposal's own promise,
  // which does not settle until the operator decides.
  const open = async (tool: string) => {
    const result = registered.get(tool)!.execute({});
    await act(async () => { await flush(); });
    return { result };
  };

  it('puts focus on the panel itself when a proposal arrives, not on the body', async () => {
    render(<ProposalPanel />);
    const { result } = await open('focus_test_tool');

    const panel = screen.getByRole('dialog');
    expect(document.activeElement).toBe(panel);
    // One Tab from the decision, not fifty-one: nothing focusable sits between the panel and
    // the first row control.
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
    );
    expect(focusables[0].className).toContain('dg-check');

    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    await result;
  });

  it('is a dialog but not a modal one — the register stays reachable during a decision', async () => {
    registerLadderTool({
      name: 'focus_modal_test_tool', description: 'test-only',
      inputSchema: { type: 'object', properties: {} },
      async exec(_input: any, ctx: any) {
        ctx.db.shipments['HAWB-70012'].revenueEur += 1;
        return { matched: 1 };
      },
    });
    render(<ProposalPanel />);
    const { result } = await open('focus_modal_test_tool');

    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe(null);

    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    await result;
  });

  it('hands focus back to the shell when the panel closes', async () => {
    registerLadderTool({
      name: 'focus_close_test_tool', description: 'test-only',
      inputSchema: { type: 'object', properties: {} },
      async exec(_input: any, ctx: any) {
        ctx.db.shipments['HAWB-70013'].revenueEur += 1;
        return { matched: 1 };
      },
    });

    // The register the operator was working in before the agent interrupted them.
    const opener = document.createElement('button');
    opener.textContent = 'Marta edits this';
    document.body.appendChild(opener);
    opener.focus();

    render(<ProposalPanel />);
    const { result } = await open('focus_close_test_tool');
    expect(document.activeElement).toBe(screen.getByRole('dialog'));

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
      await result;
    });

    expect(screen.queryByRole('dialog')).toBe(null);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
