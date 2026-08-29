// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ProofPage } from '../pages/ProofPage';
import { PROMPTS } from '../prompts';

/**
 * What the prompts *do* is held in `domain/__tests__/shipped-prompts.test.ts`, against the real
 * tools. This holds that they are on the page at all, verbatim, and that the copy control says
 * what happened in a word rather than in a colour — jsdom applies no stylesheet, so the markup
 * is the only place either of those can be checked.
 */
afterEach(cleanup);

describe('the prompts are printed on the proof tab', () => {
  it('shows both, exactly as the module states them', () => {
    render(<ProofPage />);
    for (const p of PROMPTS) {
      expect(screen.getByText(p.text)).toBeTruthy();
      expect(screen.getByText(p.note)).toBeTruthy();
    }
  });

  it('copies a prompt and confirms in a word, not a colour', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<ProofPage />);
    const buttons = screen.getAllByRole('button', { name: /^Copy the prompt:/ });
    expect(buttons).toHaveLength(PROMPTS.length);

    await act(async () => { fireEvent.click(buttons[0]); });
    expect(writeText).toHaveBeenCalledWith(PROMPTS[0].text);
    expect(buttons[0].textContent).toBe('Copied');
  });

  it('says so when the clipboard refuses rather than failing silently', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true,
    });
    render(<ProofPage />);
    const buttons = screen.getAllByRole('button', { name: /^Copy the prompt:/ });
    await act(async () => { fireEvent.click(buttons[0]); });
    expect(buttons[0].textContent).toBe('Select it');
  });
});
