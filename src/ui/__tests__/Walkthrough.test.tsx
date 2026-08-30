// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ProofPage } from '../pages/ProofPage';
import { PROMPTS } from '../prompts';
import { STEPS } from '../walkthrough';

/**
 * That the sequence reaches the sheet, that it sits under the register rather than over it, and
 * that the copy control still confirms in a word rather than in a colour. jsdom applies no
 * stylesheet, so the markup is the only place any of those can be checked — including the
 * placement, which is document order here and nothing else.
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

  it('ships the prompts exactly as the module states them, never a paraphrase', () => {
    render(<ProofPage />);
    // The first prompt is printed twice on purpose — once at the head of the sheet, once as
    // step 1 under the register — and both times it is the module's own string.
    expect(screen.getAllByText(PROMPTS[0].text)).toHaveLength(2);
    expect(screen.getAllByText(PROMPTS[1].text)).toHaveLength(1);
    // Every copy control on the page offers one of the module's prompts and nothing else.
    const buttons = screen.getAllByRole('button', { name: /^Copy the prompt:/, hidden: true });
    expect(buttons).toHaveLength(3);
    const offered = buttons.map(b => b.getAttribute('aria-label')!.replace('Copy the prompt: ', ''));
    expect([...new Set(offered)].sort()).toEqual([...PROMPTS.map(p => p.text)].sort());
  });

  it('leads with the register — the sequence is printed under it, the first prompt above', () => {
    const { container } = render(<ProofPage />);
    const kids = [...container.querySelectorAll('main > *')];
    const at = (cls: string) => kids.findIndex(k => k.classList.contains(cls));
    const start = at('ag-start');
    const register = at('console');
    const walk = at('ag');

    expect(start).toBeGreaterThanOrEqual(0);
    expect(start).toBeLessThan(register);
    // The whole point of the move: nothing of the walkthrough stands between the head of the
    // sheet and the instrument.
    expect(register).toBeLessThan(walk);

    // Every step lives in the section under the register; the line above it carries none.
    expect(kids[walk].querySelectorAll('.ag-step')).toHaveLength(STEPS.length);
    expect(container.querySelectorAll('.ag-step')).toHaveLength(STEPS.length);
    expect(kids[start].querySelector('.ag-step')).toBeNull();
    // Nothing folded away any more. The fold existed to stop seven steps shouting from above
    // the register, and there is nothing above the register to shout from.
    expect(container.querySelector('details')).toBeNull();
  });

  it('carries the first prompt to the head of the sheet, with a way back to the rest', () => {
    const { container } = render(<ProofPage />);
    const head = container.querySelector('.ag-start')!;
    expect(head.querySelector('.ag-prompt-text')!.textContent).toBe(PROMPTS[0].text);
    // It states no outcome of its own — that claim is step 1's, made once, out of the
    // prompt's own note.
    expect(head.textContent).not.toContain(PROMPTS[0].note);
    expect(head.querySelector('.ag-step-seen')).toBeNull();
    // And it says where the rest is rather than leaving a judge to find it.
    const jump = screen.getByRole('button', { name: 'Go to them' });
    expect(head.contains(jump)).toBe(true);
    expect(container.querySelector('.ag')!.id).toBe('run-it-yourself');
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
