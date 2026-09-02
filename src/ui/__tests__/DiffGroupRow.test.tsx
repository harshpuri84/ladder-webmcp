// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { DiffGroup } from '../../core/diff';
import type { Shipment } from '../../domain/types';
import { DiffGroupRow } from '../DiffGroupRow';
import { RemedySummary } from '../RemedySummary';
import { readProofRow, summariseRemedies } from '../remedy-diff';
import { seedShipments, DISRUPTED_FLIGHT } from '../../domain/seed';
import { recommendRemedy } from '../../domain/remedy-policy';

afterEach(() => cleanup());

const fixture = seedShipments();

/** The writes propose_remedy actually makes for one shipment, built the way the tool builds
 *  them: a field only appears when its value changed, exactly as core/recorder.ts records it. */
function groupFor(id: string): { group: DiffGroup; record: Shipment } {
  const record = fixture[id];
  const rec = recommendRemedy(record)!;
  const writes = [
    { entity: 'shipments', id, field: 'remedy', before: null, after: rec.remedy, group: `shipments:${id}` },
    ...(rec.cost !== 0
      ? [{ entity: 'shipments', id, field: 'remedyCost', before: 0, after: rec.cost, group: `shipments:${id}` }]
      : []),
    { entity: 'shipments', id, field: 'recoveredHours', before: 0, after: rec.recoveredHours, group: `shipments:${id}` },
    ...(rec.blocked.length > 0
      ? [{ entity: 'shipments', id, field: 'blockedAlternatives', before: [], after: rec.blocked, group: `shipments:${id}` }]
      : []),
  ];
  return {
    record,
    group: { group: `shipments:${id}`, entity: 'shipments', id, writes, valueDelta: rec.cost, version: 1 },
  };
}

/**
 * The recommendation is only honest if the alternatives it passed over are on the sheet with
 * the rule that removed them. A row where the free rebook is blocked by lithium-ion has to
 * read that way without opening anything.
 */
describe('DiffGroupRow names the blocked alternatives and their rules', () => {
  it('shows the recommended remedy, what it costs, and what it recovers', () => {
    // HAWB-70001 carries lithium-ion: the free rebook is off, so it goes on a truck.
    const { group, record } = groupFor('HAWB-70001');
    render(<DiffGroupRow group={group} record={record} subtitle="Northwind Retail" checked onToggle={() => {}} />);

    expect(screen.getByText(`Truck to ${DISRUPTED_FLIGHT.alternativeGateway}, fly from there`)).toBeTruthy();
    expect(screen.getByText('€326')).toBeTruthy();
    expect(screen.getByText('24')).toBeTruthy();
  });

  it('names the rule that blocked the alternative, in words and not by its id', () => {
    const { group, record } = groupFor('HAWB-70001');
    const { container } = render(
      <DiffGroupRow group={group} record={record} subtitle="Northwind Retail" checked onToggle={() => {}} />,
    );

    expect(container.textContent).toContain('Blocked by rule, 1 alternative');
    expect(screen.getByText('Same carrier, tomorrow morning')).toBeTruthy();
    expect(container.textContent).toContain('cargo-aircraft-only');
    // The id is in the receipt's payload; a proof sheet does not end on a developer's slug.
    expect(screen.queryByText('lithium-cargo-aircraft-only')).toBeNull();
  });

  it('lists every blocked alternative when a rule takes two away', () => {
    // HAWB-70022 is on a pharma-qualified lane: both reroutes need sign-off.
    const { group, record } = groupFor('HAWB-70022');
    const { container } = render(
      <DiffGroupRow group={group} record={record} subtitle="Marrow Biotech" checked onToggle={() => {}} />,
    );

    expect(container.textContent).toContain('Blocked by rule, 2 alternatives');
    // One rule took both, so it is stated once with both alternatives struck under it.
    expect(container.querySelectorAll('.dg-blocked')).toHaveLength(1);
    expect(container.querySelectorAll('.dg-blocked-remedy')).toHaveLength(2);
    expect(container.querySelectorAll('.dg-blocked-rule')).toHaveLength(1);
  });

  /**
   * The row the whole demo turns on: the cheap option is gone because it is too slow, not
   * because of an aircraft rule, so somebody has to decide to spend money to save the freight.
   */
  it('reads as urgent, not arbitrary, when a temperature clock leaves only the freighter', () => {
    const { group, record } = groupFor('HAWB-70002');
    const { container } = render(
      <DiffGroupRow group={group} record={record} subtitle="Belmont Foods" checked onToggle={() => {}} />,
    );

    expect(container.textContent).toContain("Competitor's freighter, tonight");
    expect(container.textContent).toContain('Blocked by rule, 2 alternatives');
    expect(container.textContent).toContain('endurance clock runs out');
    // Both cheaper options are named, so the price is visibly the last resort rather than a
    // preference: the free rebook and the road route are each struck with the same rule.
    expect(screen.getByText('Same carrier, tomorrow morning')).toBeTruthy();
    expect(container.querySelectorAll('.dg-blocked-remedy')).toHaveLength(2);
  });

  it('carries no blocked block at all on an unconstrained row — the mass difference is the point', () => {
    const { group, record } = groupFor('HAWB-70003');
    const { container } = render(
      <DiffGroupRow group={group} record={record} subtitle="Karo Textiles" checked onToggle={() => {}} />,
    );

    expect(container.textContent).toContain('Same carrier, tomorrow morning');
    expect(container.textContent).toContain('free');
    expect(container.querySelector('.dg-blocked-list')).toBeNull();
  });

  it('falls back to a plain field substitution for a write it has no vocabulary for', () => {
    const group: DiffGroup = {
      group: 'shipments:HAWB-70003', entity: 'shipments', id: 'HAWB-70003', valueDelta: 0, version: 1,
      writes: [{ entity: 'shipments', id: 'HAWB-70003', field: 'slaTier', before: 'basic', after: 'premium', group: 'shipments:HAWB-70003' }],
    };
    const { container } = render(
      <DiffGroupRow group={group} record={undefined} subtitle="" checked onToggle={() => {}} />,
    );

    expect(screen.getByText('slaTier')).toBeTruthy();
    expect(screen.getByText('basic')).toBeTruthy();
    expect(screen.getByText('premium')).toBeTruthy();
    expect(container.querySelector('.dg-remedy')).toBeNull();
  });
});

/**
 * The distribution is the argument the whole demo rests on: most of the forty-two take the free
 * rebook and a handful are genuinely constrained. If the tally cannot say that, the operator
 * has to scroll forty-two rows to find it out, and with ninety minutes they will not.
 */
describe('RemedySummary states the distribution of the run', () => {
  const allRows = Object.keys(fixture)
    .filter(id => recommendRemedy(fixture[id]) !== null)
    .map(id => { const { group, record } = groupFor(id); return readProofRow(group, record); });

  it('groups the whole fixture into a cheap majority and a constrained handful', () => {
    const { lines, constrained } = summariseRemedies(allRows);
    const total = lines.reduce((n, l) => n + l.count, 0);

    expect(total).toBe(allRows.length);
    const biggest = lines.reduce((a, b) => (a.count >= b.count ? a : b));
    expect(biggest.remedy).toBe('rebook');
    expect(biggest.cost).toBe(0);
    expect(biggest.count).toBeGreaterThan(total * 0.5);
    expect(constrained).toBeGreaterThan(0);
    expect(constrained).toBeLessThan(total * 0.5);
    // All three remedies are represented, or a third of the option space never appears in the
    // demo and the panel is only ever showing the same two answers.
    expect(lines.map(l => l.remedy).sort()).toEqual(['competitor', 'rebook', 'truck']);
  });

  it('renders the tally and nothing under it', () => {
    const { lines } = summariseRemedies(allRows);
    const { container } = render(<RemedySummary lines={lines} />);

    expect(container.textContent).toContain('Remedies in this run');
    expect(container.textContent).toContain('Same carrier, tomorrow morning');
    // The count of rows a rule constrained is said on each such row, not summed above them.
    expect(container.textContent).not.toContain('an alternative a rule took away');
    expect(container.querySelector('.pm')).toBeNull();
  });

  it('renders nothing at all when the proposal has no remedies in it', () => {
    const { container } = render(<RemedySummary lines={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

/**
 * A referred row is the one row on the sheet that is not the operator's to mark. It has to be
 * distinguishable from a row they struck out — the difference between "I said no" and "this
 * was never mine" — and it has to be distinguishable without any colour, since the operator
 * this is built for cannot rely on hue at all. It carries no control and no mark at all, and
 * the rule form on its own edge; the line naming the limit and the approver sits above the
 * group, on the panel.
 */
describe('DiffGroupRow sets a referred row apart without using colour', () => {
  it('carries no control and no mark, and still names the shipment and its cost', () => {
    const { group, record } = groupFor('HAWB-70001');
    const { container } = render(
      <DiffGroupRow group={group} record={record} subtitle="" checked={false} referred onToggle={() => {}} />,
    );

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(container.querySelector('.dg-mark')).toBeNull();
    expect(container.querySelector('label')).toBeNull();
    expect(screen.getByText('HAWB-70001')).toBeTruthy();
    expect(screen.getByText('€326')).toBeTruthy();
  });

  it('is not struck out — nothing on it was declined', () => {
    const { group, record } = groupFor('HAWB-70001');
    const { container } = render(
      <DiffGroupRow group={group} record={record} subtitle="" checked={false} referred onToggle={() => {}} />,
    );

    const row = container.querySelector('.dg')!;
    expect(row.className).toContain('dg--referred');
    expect(row.className).not.toContain('dg--struck');
  });

  it('carries the solid rule form only while it is marked, the form the register draws on the same row', () => {
    const { group, record } = groupFor('HAWB-70001');
    const marked = render(
      <DiffGroupRow group={group} record={record} subtitle="" checked onToggle={() => {}} />,
    );
    expect(marked.container.querySelector('.dg')!.className).toContain('dg--marked');
    cleanup();
    const struck = render(
      <DiffGroupRow group={group} record={record} subtitle="" checked={false} onToggle={() => {}} />,
    );
    expect(struck.container.querySelector('.dg')!.className).not.toContain('dg--marked');
    expect(struck.container.querySelector('.dg')!.className).toContain('dg--struck');
  });

  it('keeps the control and the mark on every row that is the operator\'s own', () => {
    const { group, record } = groupFor('HAWB-70001');
    for (const checked of [true, false]) {
      const own = render(
        <DiffGroupRow group={group} record={record} subtitle="" checked={checked} onToggle={() => {}} />,
      );
      expect(own.container.querySelector('input[type="checkbox"]')).toBeTruthy();
      expect(own.container.querySelector('.dg-mark svg')).toBeTruthy();
      cleanup();
    }
  });
});
