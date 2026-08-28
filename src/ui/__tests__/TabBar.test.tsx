// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TabBar, TABPANEL_ID, tabButtonId } from '../TabBar';

/**
 * The tabs used to be three words in a row with a hairline under one of them. A judge landing
 * on the problem page could miss that the other two existed, which would mean the reusability
 * argument on the third was never read. They are index tabs cut into the head of the sheet now.
 *
 * A stylesheet is what makes them read that way and jsdom applies none, so these tests hold the
 * things the stylesheet hangs off: a real button per tab, the state said in the markup rather
 * than only in a colour, and the association with the one panel. If any of those go, the
 * styling above them is decorating nothing.
 */
describe('TabBar', () => {
  afterEach(cleanup);

  const setup = (tab: 'problem' | 'proof' | 'elsewhere' = 'problem') => {
    const setTab = vi.fn();
    render(<TabBar tab={tab} setTab={setTab} />);
    return { setTab };
  };

  it('gives every section a tab that is a real control, not a word', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual([
      'The problem',
      'The proof',
      'Same engine, other work',
    ]);
    // A button, so it has a hit target, a focus ring and keyboard activation without anyone
    // reimplementing them.
    for (const t of tabs) expect(t.tagName).toBe('BUTTON');
  });

  /**
   * The operator this product is built for has red-green colour vision deficiency, so no state
   * here may rest on a hue. `aria-selected` and the modifier class are what the stock, the
   * height, the weight and the broken head rule all hang off in CSS — every one of which
   * survives the colour being taken out.
   */
  it('says which tab is open in the markup, not only in a tint', () => {
    setup('proof');
    const open = screen.getByRole('tab', { name: 'The proof' });
    expect(open.getAttribute('aria-selected')).toBe('true');
    expect(open.classList.contains('tab-bar-tab--active')).toBe(true);

    for (const name of ['The problem', 'Same engine, other work']) {
      const shut = screen.getByRole('tab', { name });
      expect(shut.getAttribute('aria-selected')).toBe('false');
      expect(shut.classList.contains('tab-bar-tab--active')).toBe(false);
    }
  });

  /** One tab stop for the whole set, the way a tablist is meant to behave. */
  it('puts exactly one tab in the tab order', () => {
    setup('elsewhere');
    const inOrder = screen.getAllByRole('tab').filter(t => t.getAttribute('tabindex') === '0');
    expect(inOrder.map(t => t.textContent)).toEqual(['Same engine, other work']);
  });

  it('moves between tabs with the arrow keys, and wraps', () => {
    const { setTab } = setup('problem');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'The problem' }), { key: 'ArrowRight' });
    expect(setTab).toHaveBeenCalledWith('proof');

    setTab.mockClear();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'The problem' }), { key: 'ArrowLeft' });
    expect(setTab).toHaveBeenCalledWith('elsewhere');
  });

  it('points every tab at the one panel, by the id App.tsx puts on it', () => {
    setup();
    for (const t of screen.getAllByRole('tab')) {
      expect(t.getAttribute('aria-controls')).toBe(TABPANEL_ID);
    }
    expect(screen.getByRole('tab', { name: 'The proof' }).id).toBe(tabButtonId('proof'));
  });
});
