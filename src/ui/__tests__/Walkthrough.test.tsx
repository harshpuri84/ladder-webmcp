// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ProofPage } from '../pages/ProofPage';
import { PROMPTS } from '../prompts';
import { STEPS } from '../walkthrough';

/**
 * That the sequence reaches the sheet, that it does not shout, and that the copy control still
 * confirms in a word rather than in a colour. jsdom applies no stylesheet, so the markup is the
 * only place any of those can be checked.
 *
 * What the steps claim is held in `walkthrough.test.ts` and, for the two prompts, against the
 * real tools in `domain/__tests__/shipped-prompts.test.ts`.
 */
afterEach(cleanup);

describe('the walkthrough is printed on the proof tab', () => {
  it('prints every step, numbered, with what to do and what should be seen', () => {
    const { container } = render(<ProofPage />);
    // Scoped to the step numbers themselves: the docket above says "2 consols" in the same face.
    const numbers = [...container.querySelectorAll('.ag-step-n')].map(n => n.textContent);
    expect(numbers).toEqual(STEPS.map((_, i) => String(i + 1)));
    STEPS.forEach(step => {
      expect(screen.getByText(step.title)).toBeTruthy();
      expect(screen.getByText(step.action)).toBeTruthy();
      // The outcome is a text node beside its caption, so it is matched inside its own line.
      expect(screen.getByText(step.seen, { exact: false })).toBeTruthy();
    });
    expect(screen.getAllByText('You should see')).toHaveLength(STEPS.length);
  });

  it('ships the prompts exactly as the module states them, and only inside the sequence', () => {
    render(<ProofPage />);
    for (const p of PROMPTS) expect(screen.getByText(p.text)).toBeTruthy();
    // One list, not two: every prompt on the page belongs to a step.
    const buttons = screen.getAllByRole('button', { name: /^Copy the prompt:/, hidden: true });
    expect(buttons).toHaveLength(PROMPTS.length);
  });

  it('opens nearly shut — one step out, the rest behind a fold', () => {
    const { container } = render(<ProofPage />);
    const fold = container.querySelector('details.ag-more');
    expect(fold).toBeTruthy();
    // Closed on arrival. A judge who knows what they want reads step one and goes.
    expect((fold as HTMLDetailsElement).open).toBe(false);
    // The first step is outside it; every other one is inside.
    expect(fold!.querySelector('.ag-step')).toBeTruthy();
    expect(fold!.querySelectorAll('.ag-step')).toHaveLength(STEPS.length - 1);
    expect(container.querySelectorAll('.ag-step')).toHaveLength(STEPS.length);
    expect(fold!.contains(screen.getByText(STEPS[0].title))).toBe(false);
  });

  it('repeats the deliberate-demonstration label in words, not in a colour', () => {
    render(<ProofPage />);
    const labelled = STEPS.filter(s => s.demonstration);
    expect(labelled.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Deliberate demonstration')).toHaveLength(labelled.length);
    for (const s of labelled) expect(screen.getByText(s.demonstration!)).toBeTruthy();
  });

  it('copies a prompt and confirms in a word, not a colour', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<ProofPage />);
    const buttons = screen.getAllByRole('button', { name: /^Copy the prompt:/, hidden: true });

    await act(async () => { fireEvent.click(buttons[0]); });
    expect(writeText).toHaveBeenCalledWith(PROMPTS[0].text);
    expect(buttons[0].textContent).toBe('Copied');
  });

  it('says so when the clipboard refuses rather than failing silently', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true,
    });
    render(<ProofPage />);
    const buttons = screen.getAllByRole('button', { name: /^Copy the prompt:/, hidden: true });
    await act(async () => { fireEvent.click(buttons[0]); });
    expect(buttons[0].textContent).toBe('Select it');
  });
});
