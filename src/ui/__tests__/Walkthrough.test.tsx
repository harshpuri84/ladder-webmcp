// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Walkthrough } from '../mock/Walkthrough';
import { ElsewherePage } from '../pages/ElsewherePage';
import { FREIGHT, DOMAINS } from '../mock/domains';
import { STEPS } from '../mock/types';
import type { MockDomain } from '../mock/types';

/**
 * The reusability tab's whole argument is that the four beats are the same everywhere, and its
 * whole honesty constraint is that a judge can never mistake one of these pictures for the
 * running console on the proof tab. Both are asserted here rather than left to the eye.
 */

const forward = () => fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
const back = () => fireEvent.click(screen.getByRole('button', { name: 'Back' }));

const CUT = FREIGHT.rows.filter(r => r.cut).length;
const DECLINED = FREIGHT.rows.filter(r => r.declined).length;

describe('Walkthrough', () => {
  afterEach(() => cleanup());

  it('opens on the call: the prompt, and not one record yet', () => {
    render(<Walkthrough domain={FREIGHT} />);

    expect(screen.getByText(FREIGHT.prompt)).toBeTruthy();
    for (const row of FREIGHT.rows) {
      expect(screen.queryByText(row.id)).toBeNull();
    }
  });

  it('reveals the records at the blast radius, then strikes the cut ones', () => {
    const { container } = render(<Walkthrough domain={FREIGHT} />);

    forward();
    for (const row of FREIGHT.rows) {
      expect(screen.getByText(row.id)).toBeTruthy();
    }
    expect(container.querySelectorAll('.mk-row--cut')).toHaveLength(0);

    forward();
    expect(container.querySelectorAll('.mk-row--cut')).toHaveLength(CUT);
    expect(screen.getAllByText('Struck out — stands as it is')).toHaveLength(CUT);
  });

  it('counts the kept records off the rows rather than off a written-down figure', () => {
    const { container } = render(<Walkthrough domain={FREIGHT} />);
    forward();

    // The blast radius counts everything the operator could still mark: the declined row is
    // the tool's own refusal and is counted in neither figure.
    expect(container.querySelector('.mk-figure-count')!.textContent)
      .toBe(String(FREIGHT.rows.length - DECLINED));

    forward();
    expect(container.querySelector('.mk-figure-count')!.textContent)
      .toBe(String(FREIGHT.rows.length - CUT - DECLINED));
  });

  it('sets the declined record apart from the run, never as a diff row', () => {
    const { container } = render(<Walkthrough domain={FREIGHT} />);
    forward();

    const declined = FREIGHT.rows.filter(r => r.declined);
    expect(declined.length).toBeGreaterThan(0);
    for (const row of declined) {
      expect(screen.getByText(row.declined!)).toBeTruthy();
    }
    expect(container.querySelectorAll('.mk-held .mk-row')).toHaveLength(DECLINED);
  });

  it('ends on what went back, with the payload the agent reads', () => {
    const { container } = render(<Walkthrough domain={FREIGHT} />);
    forward(); forward(); forward();

    const payload = container.querySelector('.mk-payload')!;
    expect(payload.textContent).toBe(JSON.stringify(FREIGHT.payload, null, 2));
    // applied plus every rejected count equals requested, on this path as on every other.
    const p = FREIGHT.payload as { requested: number; applied: number; rejected: { count: number }[] };
    expect(p.applied + p.rejected.reduce((n, r) => n + r.count, 0)).toBe(p.requested);
  });

  it('says it is a mockup on its face at every step', () => {
    render(<Walkthrough domain={FREIGHT} />);

    for (let i = 0; i < STEPS.length; i++) {
      expect(screen.getAllByText(/Mockup/).length).toBeGreaterThan(0);
      if (i < STEPS.length - 1) forward();
    }
  });

  it('names the same four beats, in the same words, from the shared constant', () => {
    render(<Walkthrough domain={FREIGHT} />);
    for (const label of STEPS) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('will not run past either end of the sequence', () => {
    render(<Walkthrough domain={FREIGHT} />);

    expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(true);
    forward(); forward(); forward();
    expect((screen.getByRole('button', { name: 'Forward' }) as HTMLButtonElement).disabled).toBe(true);
    back();
    expect((screen.getByRole('button', { name: 'Forward' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

/**
 * The same four beats over every kind of work.
 *
 * These run over `DOMAINS` rather than over a list written out here, so a fourth kind of work
 * is covered the day it is authored and cannot arrive with a payload that does not add up or a
 * money line that disagrees with the rows under it.
 */

const AMOUNT = /-?\d[\d,]*(?:\.\d+)?/;

/** The number out of an authored figure, read the way the sheet reads it. */
function figure(text: string): number {
  const found = text.replace(/\u2212/g, '-').match(AMOUNT);
  return found ? Number(found[0].replace(/,/g, '')) : NaN;
}

const money = (container: HTMLElement) =>
  figure(container.querySelector('.mk-figure-money')!.textContent!);

describe('every kind of work', () => {
  afterEach(() => cleanup());

  it('has three of them, and the freight one first', () => {
    expect(DOMAINS.map(d => d.id)).toEqual(['freight', 'catalogue', 'edge']);
  });

  for (const domain of DOMAINS) {
    describe(domain.name, () => {
      it('walks all four beats without throwing', () => {
        const { container } = render(<Walkthrough domain={domain} />);
        expect(screen.getByText(domain.prompt)).toBeTruthy();

        for (let i = 1; i < STEPS.length; i++) forward();
        expect(container.querySelector('.mk-payload')!.textContent)
          .toBe(JSON.stringify(domain.payload, null, 2));

        for (let i = 1; i < STEPS.length; i++) back();
        expect(screen.getByText(domain.prompt)).toBeTruthy();
      });

      it('names the four beats in the same words as every other domain', () => {
        render(<Walkthrough domain={domain} />);
        for (const label of STEPS) {
          expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        }
      });

      it('returns a payload that reconciles: applied plus every rejection equals requested', () => {
        const p = domain.payload as {
          requested: number;
          applied: number;
          rejected: { reason: string; count: number }[];
        };
        expect(p.applied + p.rejected.reduce((n, r) => n + r.count, 0)).toBe(p.requested);
        expect(p.requested).toBe(domain.rows.length);
      });

      it('writes a money line the rows themselves add up to', () => {
        const live = domain.rows.filter(r => !r.declined);
        const kept = live.filter(r => !r.cut);
        const sum = (rows: typeof live) => rows.reduce((n, r) => n + figure(r.cost), 0);

        // Authored once, and the sheet must agree with it before anything is marked.
        expect(figure(domain.magnitude)).toBe(sum(live));

        const { container } = render(<Walkthrough domain={domain} />);
        forward();
        expect(money(container)).toBe(sum(live));

        // And after the operator marks, restated off the rows still on the sheet.
        forward();
        expect(money(container)).toBe(sum(kept));
      });

      it('marks two out and has the tool decline one, so the sheet has something to show', () => {
        expect(domain.rows.filter(r => r.cut)).toHaveLength(2);
        expect(domain.rows.filter(r => r.declined)).toHaveLength(1);
      });

      it('says it is a mockup at every beat', () => {
        render(<Walkthrough domain={domain} />);
        for (let i = 0; i < STEPS.length; i++) {
          expect(screen.getAllByText(/Mockup/).length).toBeGreaterThan(0);
          if (i < STEPS.length - 1) forward();
        }
      });
    });
  }

  it('names its beats from one constant, so no domain can quietly differ', () => {
    const labels = DOMAINS.map((domain: MockDomain) => {
      const { container, unmount } = render(<Walkthrough domain={domain} />);
      const words = [...container.querySelectorAll('.mk-step-label')].map(n => n.textContent);
      unmount();
      return words.join('\u0000');
    });
    expect(new Set(labels).size).toBe(1);
    expect(labels[0]).toBe([...STEPS].join('\u0000'));
  });
});

describe('the selector across the kinds of work', () => {
  afterEach(() => cleanup());

  const pick = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

  it('offers every domain by name, with the first one showing', () => {
    render(<ElsewherePage />);
    for (const domain of DOMAINS) {
      expect(screen.getByRole('button', { name: domain.name })).toBeTruthy();
    }
    expect(screen.getByText(FREIGHT.prompt)).toBeTruthy();
    expect(screen.queryByText(DOMAINS[1].prompt)).toBeNull();
  });

  it('swaps the sheet, and says which one is in effect without relying on the colour', () => {
    render(<ElsewherePage />);
    pick(DOMAINS[2].name);

    expect(screen.getByText(DOMAINS[2].prompt)).toBeTruthy();
    expect(screen.queryByText(FREIGHT.prompt)).toBeNull();

    const active = screen.getByRole('button', { name: DOMAINS[2].name });
    expect(active.getAttribute('aria-pressed')).toBe('true');
    expect(active.className).toContain('--now');
    expect(
      screen.getByRole('button', { name: FREIGHT.name }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('starts the new sheet at the first beat rather than where the last one was left', () => {
    render(<ElsewherePage />);
    forward();
    forward();
    expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(false);

    pick(DOMAINS[1].name);
    expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(DOMAINS[1].prompt)).toBeTruthy();
  });
});
