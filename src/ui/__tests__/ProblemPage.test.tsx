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

/**
 * The four things that follow from the tool running inside the operator's own tab. Each one is
 * the argument for WebMCP being the right substrate rather than merely an unfinished one, so
 * losing any of them silently is losing the section's point while the heading still stands.
 */
const CONSEQUENCES = [
  'The human is already here.',
  'The page owns the state, so it can rehearse against it.',
  "The tool's description can be rewritten at runtime.",
  'The credential is the session that was already there.',
];

const flat = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The engine drawing and the placement drawing each ship two arrangements; CSS shows one. */
const named = (pattern: RegExp) => screen.getAllByRole('img', { name: pattern });

describe('ProblemPage', () => {
  afterEach(cleanup);

  it('sets out the six sections a reader has to walk through', () => {
    render(<ProblemPage />);
    for (const heading of [
      'Thursday, 19:40',
      'The half that was missing',
      'Why this has to live in the page',
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

  /**
   * The quoted payload is a sample, kept exactly as the tool emits it — but its `requested` is
   * the same count the register carries, and the sentence above it names the same `applied`.
   * If the fixture ever grew, a page holding those literals would contradict itself mid-
   * paragraph. This is the assertion that makes that drift fail here instead of shipping.
   */
  it('keeps the quoted payload tied to the register the paragraph is about', () => {
    const rows = Object.values(store.state.shipments);
    const { container } = render(<ProblemPage />);
    const sample = JSON.parse(container.querySelector('.pr-payload')?.textContent ?? '') as {
      requested: number;
      applied: number;
      rejected: { count: number }[];
    };

    expect(sample.requested).toBe(rows.length);
    const rejected = sample.rejected.reduce((n, r) => n + r.count, 0);
    expect(sample.applied + rejected).toBe(sample.requested);
    expect(flat(container)).toContain(`cuts ${rows.length} down to ${sample.applied}`);
  });

  it('says why the tool belongs in the page, not only that WebMCP left something out', () => {
    const { container } = render(<ProblemPage />);
    expect(
      screen.getByRole('heading', { name: 'Why this has to live in the page', level: 2 }),
    ).toBeTruthy();
    const text = flat(container);
    for (const lead of CONSEQUENCES) expect(text).toContain(lead);
  });

  /**
   * Ordering is the argument. A reader who is told how the engine forks state before being told
   * that the page owns that state in the first place has been shown a trick, not a mechanism.
   */
  it('establishes that the page owns the state before explaining how the engine uses it', () => {
    render(<ProblemPage />);
    const missing = screen.getByRole('heading', { name: 'The half that was missing' });
    const why = screen.getByRole('heading', { name: 'Why this has to live in the page' });
    const how = screen.getByRole('heading', { name: 'How it works' });

    expect(missing.compareDocumentPosition(why) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(why.compareDocumentPosition(how) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('describes both placements in words, not only in rules', () => {
    render(<ProblemPage />);
    const placements = named(/two placements/i);
    // Row and column arrangements. Only one is ever displayed; jsdom applies no stylesheet.
    expect(placements.length).toBe(2);

    const label = (placements[0].getAttribute('aria-label') ?? '').toLowerCase();
    for (const beat of ['server', 'outside', 'inside', 'session', 'operator']) {
      expect(label).toContain(beat);
    }
  });

  it('describes the engine in words as well as in the drawing', () => {
    render(<ProblemPage />);
    const [diagram] = named(/how ladder runs a write tool twice/i);
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
