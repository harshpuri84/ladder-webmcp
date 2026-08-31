// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import type { registerLadderTool as RegisterLadderTool, ratify as Ratify, revoke as Revoke } from '../../webmcp/adapter';
import type { ToolPill as ToolPillType } from '../ToolPill';
import type { Policy } from '../../core/policy';
import { PROMPTS } from '../prompts';

/**
 * The inventory panel is the only surface showing the agent's half. Its load-bearing claim is
 * that the description it prints is the one actually registered with the browser — so these
 * tests drive the real adapter and read the panel, never a fixture in between.
 */
describe('ToolPill shows the toolset as the agent sees it', () => {
  let ToolPill: typeof ToolPillType;
  let ratify: typeof Ratify;
  let revoke: typeof Revoke;

  beforeAll(async () => {
    (document as any).modelContext = {
      registerTool: () => {},
      unregisterTool: () => {},
    };
    let registerLadderTool: typeof RegisterLadderTool;
    ({ registerLadderTool, ratify, revoke } = await import('../../webmcp/adapter'));
    ({ ToolPill } = await import('../ToolPill'));

    registerLadderTool({
      name: 'search_shipments', description: 'Finds house shipments.',
      inputSchema: { type: 'object', properties: {} }, readOnly: true,
      async exec() { return {}; },
    });
    registerLadderTool({
      name: 'propose_remedy', description: 'Proposes a remedy for each shipment.',
      inputSchema: { type: 'object', properties: {} },
      async exec() { return {}; },
    });
    registerLadderTool({
      name: 'notify_customers', description: 'Emails the affected customers.',
      inputSchema: { type: 'object', properties: {} },
      async exec() { return {}; },
    });
  });

  afterEach(() => {
    cleanup();
    revoke('propose_remedy');
  });
  afterAll(() => { delete (document as any).modelContext; });

  const open = () => fireEvent.click(screen.getByRole('button', { name: /Ladder/ }));

  const rule = (): Policy => ({
    id: 'pol-test', tool: 'propose_remedy', maxRecords: 20, maxValue: 500,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    draftedFrom: 'operator', ratified: false,
  });

  it('counts every registered tool on the chip, reads included', () => {
    render(<ToolPill />);
    expect(screen.getByText('3 tools')).toBeTruthy();
  });

  it('lists read tools as well as write tools, so the panel is the whole surface', () => {
    render(<ToolPill />);
    open();

    expect(screen.getByText('search_shipments')).toBeTruthy();
    expect(screen.getByText('propose_remedy')).toBeTruthy();
    expect(screen.getByText('reads only — changes nothing')).toBeTruthy();
  });

  it('separates a tool that can never be automatic from one that is merely unruled', () => {
    render(<ToolPill />);
    open();

    expect(screen.getByText('never automatic — always reviewed')).toBeTruthy();
    expect(screen.getByText('every change reviewed first')).toBeTruthy();
  });

  /** The video beat, and the reason the panel exists at all. */
  it('grows the standing-rule sentence into the live description when a rule is ratified', () => {
    render(<ToolPill />);
    open();

    const before = screen.getByText(/Proposes a remedy for each shipment\./).textContent ?? '';
    expect(before).not.toContain('without review');

    fireEvent.click(screen.getByRole('button', { name: /Ladder/ }));  // close
    act(() => ratify(rule()));
    open();

    const after = screen.getByText(/Proposes a remedy for each shipment\./).textContent ?? '';
    expect(after).toContain('up to 20 records');
    expect(after).toContain('without review');
    expect(screen.getByText('standing rule in force')).toBeTruthy();
  });

  it('updates while the panel is already open, without a remount', () => {
    render(<ToolPill />);
    open();

    expect(screen.getByText('every change reviewed first')).toBeTruthy();
    act(() => ratify(rule()));

    expect(screen.getByText('standing rule in force')).toBeTruthy();
    expect(screen.queryByText('every change reviewed first')).toBeNull();
  });

  it('puts the description back when the rule is revoked', () => {
    render(<ToolPill />);
    open();
    act(() => ratify(rule()));
    expect(screen.getByText('standing rule in force')).toBeTruthy();

    act(() => revoke('propose_remedy'));

    expect(screen.getByText('every change reviewed first')).toBeTruthy();
    const desc = screen.getByText(/Proposes a remedy for each shipment\./).textContent ?? '';
    expect(desc).not.toContain('without review');
  });

  /**
   * The chip is on every tab and the proof sheet is not, so on two of the three this panel is
   * the only place a prompt is printed. It has to be the shipped string — `shipped-prompts`
   * holds that string against the real tools — and it has to be above the inventory, because
   * the panel scrolls and a reader does not scroll to find the thing that starts it.
   */
  it('prints the opening prompt, verbatim and above the inventory', () => {
    const { container } = render(<ToolPill />);
    open();

    expect(screen.getByText(PROMPTS[0].text)).toBeTruthy();
    expect(screen.getByRole('button', { name: `Copy the prompt: ${PROMPTS[0].text}` })).toBeTruthy();

    // One prompt, not the whole sheet's worth.
    expect(screen.queryByText(PROMPTS[1].text)).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Copy the prompt:/ })).toHaveLength(1);

    const kids = [...container.querySelectorAll('.tp-panel > *')];
    const say = kids.findIndex(k => k.classList.contains('tp-say'));
    const list = kids.findIndex(k => k.classList.contains('tp-list'));
    expect(say).toBeGreaterThan(-1);
    expect(list).toBeGreaterThan(say);
  });

  it('names who is on shift once, not once per tool', () => {
    render(<ToolPill />);
    open();
    expect(screen.getAllByText(/On shift: gateway operator/)).toHaveLength(1);
  });
});
