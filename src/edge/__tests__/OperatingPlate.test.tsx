// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import { OperatingPlate } from '../ui/OperatingPlate';
import { checkForWebmcp } from '../../webmcp/adapter';
import { CANDIDATE_RELEASE } from '../seed';

/**
 * The plate exists because the first thirty seconds of this page used to fail: six dense region
 * tables, the word "absent" in a header, and no way to find out what any of it was for. A judge
 * without a WebMCP runtime met a static table and left, with the entire agent half of the product
 * behind a door they did not know was shut.
 *
 * jsdom applies no stylesheet, so these hold the things the stylesheet hangs off — the words, the
 * forms, the state said in the markup rather than only in a colour, and the order the runtime
 * states resolve in. If any of those go, the panel above them is decorating nothing.
 *
 * The cases run in the order availability can actually change: the adapter's namespace reference
 * is sticky once found, deliberately, so absent has to be exercised before present.
 */

const CHROME_FLAG = 'chrome://flags/#enable-webmcp-testing';

afterEach(cleanup);

describe('the plate before a runtime is found', () => {
  beforeAll(() => { vi.useFakeTimers(); });

  it('does not say absent on the first frame, so a host injecting a moment late never flashes', () => {
    render(<OperatingPlate />);
    expect(screen.queryByText(/Runtime absent/i)).toBeNull();
    expect(screen.getByText(/Runtime · checking/i)).toBeTruthy();
    expect(screen.queryByText(CHROME_FLAG)).toBeNull();
  });

  it('after the grace period it names both routes to a runtime rather than only the word absent', () => {
    render(<OperatingPlate />);
    act(() => { vi.advanceTimersByTime(1600); });

    expect(screen.getByText(/Runtime absent/i)).toBeTruthy();
    // The two routes, exactly as the freight console names them.
    expect(screen.getByText(/ChatGPT desktop’s built-in browser/)).toBeTruthy();
    expect(screen.getByText(/Google Chrome 149 or newer/)).toBeTruthy();
    expect(screen.getByText(CHROME_FLAG)).toBeTruthy();
    // Recoverable, not a dead end: it says what still works meanwhile.
    expect(screen.getByText(/The rack below still reads/)).toBeTruthy();
  });

  it('says absent is closed with a form, not with a colour', () => {
    render(<OperatingPlate />);
    act(() => { vi.advanceTimersByTime(1600); });
    // `st--closed` is the hatched legend the rest of the rack uses for "closed by a rule". The
    // hatch is what survives greyscale; the amber only agrees with it.
    expect(screen.getByText(/Runtime absent/i).className).toContain('st--closed');
    vi.useRealTimers();
  });
});

describe('the plate once a runtime is present', () => {
  beforeAll(() => {
    (document as unknown as Record<string, unknown>).modelContext = {
      registerTool: () => {}, unregisterTool: () => {},
    };
    expect(checkForWebmcp()).toBe(true);
  });

  it('says the tools are registered and drops the recovery routes', () => {
    render(<OperatingPlate />);
    expect(screen.getByText(/Runtime present/i)).toBeTruthy();
    expect(screen.getByText(/Runtime present/i).className).not.toContain('st--closed');
    expect(screen.queryByText(CHROME_FLAG)).toBeNull();
    expect(screen.getByText(/The four tools are registered with this browser/)).toBeTruthy();
  });

  it('says what the estate is, counted off the fixture rather than written down beside it', () => {
    render(<OperatingPlate />);
    expect(screen.getByText(CANDIDATE_RELEASE)).toBeTruthy();
    // 36 sites. Read from the seed by the component, so a row added later cannot make it lie.
    expect(screen.getByText('36')).toBeTruthy();
    expect(screen.getByText(/An agent proposes the whole rollout in a single call/)).toBeTruthy();
  });

  it('puts the prompts on the page, verbatim and copyable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<OperatingPlate />);
    const money = screen.getByText('Stage the candidate release at every site.');
    expect(money).toBeTruthy();
    expect(screen.getByText('Stage the candidate release in eu-north only.')).toBeTruthy();

    const buttons = screen.getAllByRole('button', { name: /^Copy the prompt:/ });
    expect(buttons).toHaveLength(2);
    await act(async () => { fireEvent.click(buttons[0]); });
    expect(writeText).toHaveBeenCalledWith('Stage the candidate release at every site.');
    // The confirmation is a word, not a colour.
    expect(buttons[0].textContent).toBe('Copied');
  });

  it('says so when the clipboard refuses rather than failing silently', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true,
    });
    render(<OperatingPlate />);
    const buttons = screen.getAllByRole('button', { name: /^Copy the prompt:/ });
    await act(async () => { fireEvent.click(buttons[0]); });
    expect(buttons[0].textContent).toBe('Select it');
  });
});
