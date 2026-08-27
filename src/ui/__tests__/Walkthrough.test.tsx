// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Walkthrough } from '../mock/Walkthrough';
import { FREIGHT } from '../mock/domains';
import { STEPS } from '../mock/types';

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
