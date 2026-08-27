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

  it('names the rule that blocked the alternative, and the rule id beside it', () => {
    const { group, record } = groupFor('HAWB-70001');
    const { container } = render(
      <DiffGroupRow group={group} record={record} subtitle="Northwind Retail" checked onToggle={() => {}} />,
    );

    expect(container.textContent).toContain('Blocked by rule — 1 alternative');
    expect(screen.getByText('Same carrier, tomorrow morning')).toBeTruthy();
    expect(container.textContent).toContain('cargo-aircraft-only');
    expect(screen.getByText('lithium-cargo-aircraft-only')).toBeTruthy();
  });

  it('lists every blocked alternative when a rule takes two away', () => {
    // HAWB-70022 is on a pharma-qualified lane: both reroutes need sign-off.
    const { group, record } = groupFor('HAWB-70022');
    const { container } = render(
      <DiffGroupRow group={group} record={record} subtitle="Marrow Biotech" checked onToggle={() => {}} />,
    );

    expect(container.textContent).toContain('Blocked by rule — 2 alternatives');
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
    expect(container.textContent).toContain('Blocked by rule — 2 alternatives');
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

  it('renders the tally and the constrained count in words', () => {
    const { lines, constrained } = summariseRemedies(allRows);
    const { container } = render(
      <RemedySummary lines={lines} constrained={constrained} total={allRows.length} />,
    );

    expect(container.textContent).toContain('Remedies in this run');
    expect(container.textContent).toContain('Same carrier, tomorrow morning');
    expect(container.textContent).toContain('an alternative a rule took away');
  });

  it('says so plainly when nothing was constrained rather than printing a zero', () => {
    const { group, record } = groupFor('HAWB-70003');
    const rows = [readProofRow(group, record)];
    const { lines, constrained } = summariseRemedies(rows);
    const { container } = render(<RemedySummary lines={lines} constrained={constrained} total={1} />);

    expect(constrained).toBe(0);
    expect(container.textContent).toContain('Every alternative was open on the one marked row.');
  });

  it('renders nothing at all when the proposal has no remedies in it', () => {
    const { container } = render(<RemedySummary lines={[]} constrained={0} total={0} />);
    expect(container.firstChild).toBeNull();
  });
});
