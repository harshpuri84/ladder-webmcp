import { describe, it, expect } from 'vitest';
import { STEPS } from '../walkthrough';
import { PROMPTS } from '../prompts';

/**
 * The walkthrough's own invariants, held away from React so they can be stated plainly.
 *
 * What each step *does* is held elsewhere: `domain/__tests__/shipped-prompts.test.ts` drives the
 * two prompts through the real tools, and `Walkthrough.test.tsx` holds that the steps reach the
 * page. This file holds the three rules that make the sequence safe to print at all.
 */
describe('the steps a judge is asked to walk', () => {
  it('gives every step both halves — what to do, and what should be on screen', () => {
    // A step with no stated outcome is an instruction, not a check, and a judge who cannot tell
    // whether something happened concludes it did not.
    for (const s of STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.action.length).toBeGreaterThan(0);
      expect(s.seen.length).toBeGreaterThan(0);
    }
  });

  it('says nothing to an agent that is not one of the shipped prompts, verbatim', () => {
    // Identity, not equality of text: a step must carry the very object `prompts.ts` exports, so
    // a wording change there moves the walkthrough with it and cannot be forgotten here.
    const spoken = STEPS.map(s => s.prompt).filter(p => p !== undefined);
    for (const p of spoken) expect(PROMPTS).toContain(p);
    // Both of them are used, so neither prompt is stranded off the page by the absorption.
    for (const p of PROMPTS) expect(spoken).toContain(p);
  });

  it('lets a prompt make its claim once — the step reads it back off the prompt', () => {
    for (const s of STEPS) {
      if (s.prompt) expect(s.seen).toBe(s.prompt.note);
    }
  });

  /**
   * The two controls the console labels as deliberate demonstrations by name. A step that tells a
   * judge to press one and does not repeat the label is the one way this block could mislead: a
   * judge would leave believing the tool has a real defect, or that a second person is signed in.
   */
  const LABELLED_CONTROLS = ['Marta edits this', 'Simulate a buggy tool'];

  it('repeats the label on every step that drives a labelled demonstration', () => {
    const driving = STEPS.filter(s => LABELLED_CONTROLS.some(c => s.action.includes(c)));
    expect(driving).toHaveLength(LABELLED_CONTROLS.length);
    for (const s of driving) expect(s.demonstration).toBeTruthy();
  });

  it('does not label anything else a demonstration', () => {
    // The reverse direction: a demonstration note on a step that drives nothing of the kind
    // would cheapen the two that need it.
    for (const s of STEPS) {
      if (s.demonstration) {
        expect(LABELLED_CONTROLS.some(c => s.action.includes(c))).toBe(true);
      }
    }
  });
});
