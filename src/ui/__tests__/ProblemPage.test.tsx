// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProblemPage } from '../pages/ProblemPage';
import { store } from '../../domain/store';

/**
 * The page spells small counts out in words where the sentence calls for a word, so this test
 * carries its own independent spelling table rather than importing the page's. If the fixture
 * ever grows a third consolidation, only a page that counts can say "Three"; a page holding a
 * literal "Two" fails here, which is the whole point of the assertion.
 */
const SPELLED = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

const flat = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('ProblemPage', () => {
  afterEach(cleanup);

  it('sets out the five sections a reader has to walk through', () => {
    render(<ProblemPage />);
    for (const heading of [
      'Thursday, 19:40',
      'The half that was missing',
      'How it works',
      'A refusal is a message',
      'What this does not do',
    ]) {
      expect(screen.getByRole('heading', { name: heading, level: 2 })).toBeTruthy();
    }
  });

  it('states the limit that a reviewer would otherwise have to find out the hard way', () => {
    const { container } = render(<ProblemPage />);
    expect(flat(container)).toContain('Ladder is a guard, not a sandbox.');
  });

  it('counts every figure in the opening off the register rather than typing it in', () => {
    const { container } = render(<ProblemPage />);
    const rows = Object.values(store.state.shipments);
    const customers = new Set(rows.map(s => s.customer)).size;
    const consols = new Set(rows.map(s => s.consol)).size;
    const text = flat(container);

    expect(text).toContain(`${SPELLED[consols]} consolidations were on it`);
    expect(text).toContain(
      `so ${rows.length} shipments belonging to ${customers} different customers are now unbooked`,
    );
  });

  it('names the lane from the fixture, so the scene and the register describe one flight', () => {
    const { container } = render(<ProblemPage />);
    expect(flat(container)).toContain('A flight from Frankfurt to Chicago is cancelled.');
  });

  it('describes the engine in words as well as in the drawing', () => {
    render(<ProblemPage />);
    const [diagram] = screen.getAllByRole('img');
    const label = diagram.getAttribute('aria-label') ?? '';
    for (const stage of ['tool call', 'fork', 'operator', 'guard', 'result', 'rolled back']) {
      expect(label.toLowerCase()).toContain(stage);
    }
  });

  it('hands the reader on to the proof with a plain link, not a pitch', () => {
    render(<ProblemPage />);
    const link = screen.getByRole('link', { name: /proof/i });
    expect(link.getAttribute('href')).toBe('#/proof');
  });
});
