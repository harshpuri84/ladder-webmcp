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
 * the argument for WebMCP being the right place to build this rather than merely an
 * unfinished one, so
 * losing any of them silently is losing the section's point while the heading still stands.
 */
const CONSEQUENCES = [
  'The human is already here.',
  'The page owns the state.',
  'The rules can change live.',
  'The credential is already here.',
];

const flat = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The placement drawing ships two arrangements; CSS shows one. */
const named = (pattern: RegExp) => screen.getAllByRole('img', { name: pattern });

describe('ProblemPage', () => {
  afterEach(cleanup);

  it('sets out the sections a reader has to walk through', () => {
    render(<ProblemPage />);
    for (const heading of [
      'Thursday, 19:40',
      // "The half that was missing" folded into the section that answers it on 2 Sep 2026.
      'Why this has to live in the page',
      'How it works',
      'One implementation note',
      'A refusal is a message',
      // Was "What this does not do"; a boundary, named as one.
      'Where the guard stops',
    ]) {
      expect(screen.getByRole('heading', { name: heading, level: 2 })).toBeTruthy();
    }
  });

  it('states the limit that a reviewer would otherwise have to find out the hard way', () => {
    const { container } = render(<ProblemPage />);
    expect(flat(container)).toContain('Not a sandbox.');
    expect(flat(container)).toContain('outside the guard');
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
    const why = screen.getByRole('heading', { name: 'Why this has to live in the page' });
    const how = screen.getByRole('heading', { name: 'How it works' });
    const stops = screen.getByRole('heading', { name: 'Where the guard stops' });

    expect(why.compareDocumentPosition(how) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(how.compareDocumentPosition(stops) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  /** The engine is drawn inside the lower band of the same figure, so its words live there. */
  it('describes the engine in words as well as in the drawing', () => {
    render(<ProblemPage />);
    const [diagram] = named(/two placements/i);
    const label = (diagram.getAttribute('aria-label') ?? '').toLowerCase();
    for (const stage of ['tool call', 'fork', 'operator', 'guard', 'result', 'rolled back']) {
      expect(label).toContain(stage);
    }
    expect(screen.queryByRole('img', { name: /how ladder runs a write tool twice/i })).toBeNull();
  });

  /**
   * A margin note is positioned against the paragraph it is keyed to, so each one has to be
   * wrapped with that paragraph, and read straight after it by anyone who cannot see the
   * margin. Two survive: the browser measurements and the proofreader's query.
   */
  it('keeps every margin note beside the paragraph it is keyed to', () => {
    const { container } = render(<ProblemPage />);
    const notes = [...container.querySelectorAll('.pr-note')];
    expect(notes.length).toBe(2);
    for (const note of notes) {
      const keyed = note.closest('.pr-keyed');
      expect(keyed).toBeTruthy();
      expect(keyed?.closest('.pr-sec')).toBeTruthy();
      expect(note.previousElementSibling?.classList.contains('pr-p')).toBe(true);
    }
  });

  /**
   * The sum is done under the payload it is done off, as one mono line. Doing it off the quoted
   * sample is the whole point: a typed "27 + 1 + 14 = 42" would go on reading correctly for
   * exactly as long as nobody edited the payload.
   */
  it('does the payload arithmetic under the payload rather than asserting it', () => {
    const { container } = render(<ProblemPage />);
    const sample = JSON.parse(container.querySelector('.pr-payload')?.textContent ?? '') as {
      requested: number;
      applied: number;
      rejected: { count: number }[];
    };
    const sum = [sample.applied, ...sample.rejected.map(r => r.count)].join(' + ');
    const check = container.querySelector('.pr-check');
    expect(check?.previousElementSibling?.classList.contains('pr-payload')).toBe(true);
    expect(flat(check!)).toBe(`${sum} = ${sample.requested}`);
  });

  /** One measured note, beside the requestUserInteraction paragraph, carrying every reading. */
  it('carries the browser measurements out into one margin note', () => {
    const { container } = render(<ProblemPage />);
    const margins = [...container.querySelectorAll('.pr-note')].map(flat);
    expect(margins.filter(t => t.includes('Chrome 151.0')).length).toBe(1);
    const measured = margins.find(t => t.includes('Chrome 151.0'))!;
    expect(measured).toContain('96 s');
    // And again where it is evidence rather than a footnote: the boundary's own reading, set as
    // an instrument reading rather than as a sentence about one.
    const reading = flat(container.querySelector('.pr-measured')!);
    expect(reading).toContain('Chrome 151');
    expect(reading).toContain('pending execute() · 96 s');
    expect(reading).toContain('Long enough for a person to read a proof and decide.');
  });

  /** Nothing on the page describes why the page is honest. */
  it('carries no note about its own method', () => {
    const { container } = render(<ProblemPage />);
    const text = flat(container);
    for (const phrase of [
      'Counted, not typed',
      'Taken in the browser',
      'so it cannot come to disagree',
      'Every reviewer who read this code',
      'the whole bet this design makes',
      'The load-bearing one',
    ]) {
      expect(text).not.toContain(phrase);
    }
    expect(text).not.toContain('\u2014');
  });

  it('keeps the dagger for the limits list only', () => {
    const { container } = render(<ProblemPage />);
    const daggers = [...container.querySelectorAll('.pm')].filter(m =>
      !m.closest('.pr-note') && m.classList.contains('pr-limit-mark'));
    const others = [...container.querySelectorAll('.pr-limit-mark')];
    expect(daggers.length).toBe(others.length);
    // The five compact constraints are numbered 01 to 05 and carry no mark; the dagger is left
    // for the places a reference mark is what is meant.
    expect(container.querySelectorAll('.pr-limit-mark').length).toBe(0);
    expect(container.querySelectorAll('.pr-grid--limits .pr-conseq-n').length).toBe(5);
  });

  /**
   * Three drawn figures, each a real figure: a caption a reader can see and an alt that says
   * what is in the picture rather than what the file is called. Sized in the markup so the
   * sheet does not reflow as they arrive. The stylesheet never hides them; the entrance class
   * is put on by script only where an observer exists, and jsdom has none.
   */
  it('sets the two drawings as figures with captions, alts and fixed sizes', () => {
    const { container } = render(<ProblemPage />);
    const figures = [...container.querySelectorAll('figure.pr-fig')];
    // Two, not three. The architecture plate came out on 2 Sep 2026: the section's own drawn
    // diagram already carries the mechanism, and a third picture of one argument is a third.
    expect(figures.map(f => f.querySelector('img')?.getAttribute('src'))).toEqual([
      '/img/network.jpg', '/img/boundary.jpg',
    ]);
    for (const figure of figures) {
      const img = figure.querySelector('img')!;
      expect((img.getAttribute('alt') ?? '').length).toBeGreaterThan(80);
      expect(Number(img.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(img.getAttribute('height'))).toBeGreaterThan(0);
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('decoding')).toBe('async');
      expect(flat(figure.querySelector('figcaption')!).length).toBeGreaterThan(20);
      expect(figure.classList.contains('rv')).toBe(false);
    }
  });

  /** The rooms are read before the ruled diagram: the intuition first, then its detail. */
  it('shows the drawn rooms before the placement diagram', () => {
    const { container } = render(<ProblemPage />);
    const rooms = container.querySelector('img[src="/img/boundary.jpg"]')!;
    const diagram = container.querySelector('.pd')!;
    expect(rooms.compareDocumentPosition(diagram) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hands the reader on to the proof with a plain link, not a pitch', () => {
    render(<ProblemPage />);
    const link = screen.getByRole('link', { name: /proof/i });
    expect(link.getAttribute('href')).toBe('#/proof');
  });
});
