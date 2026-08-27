// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Console } from '../Console';
import { store } from '../../domain/store';

afterEach(() => cleanup());

const totalShipments = Object.keys(store.state.shipments).length;
const setFilter = (value: string) => {
  fireEvent.change(screen.getByPlaceholderText(/Filter by/i), { target: { value } });
};
const rows = () => Object.values(store.state.shipments);

/**
 * F8: receipts and panel notes hand the operator ids ("HAWB-70019 skipped, every remedy
 * blocked"), consol ids, tiers and cargo words — and the filter has to find the row when any
 * of them is pasted back in, exactly as the register renders it.
 */
describe('Console filter matches every column as rendered (F8)', () => {
  it('finds a shipment by pasting its id', () => {
    const { container } = render(<Console />);
    const target = rows()[3];

    setFilter(target.id);

    expect(container.textContent).toContain(target.id);
    expect(screen.getByText(`1 of ${totalShipments} house shipments`)).toBeTruthy();
  });

  it('finds the shipments on one consol', () => {
    render(<Console />);
    const expected = rows().filter(s => s.consol === 'CONSOL-B');
    expect(expected.length).toBeGreaterThan(0);

    setFilter('CONSOL-B');

    expect(screen.getByText(`${expected.length} of ${totalShipments} house shipments`)).toBeTruthy();
  });

  it('finds the shipments on one SLA tier', () => {
    render(<Console />);
    const expected = rows().filter(s => s.slaTier === 'premium');
    expect(expected.length).toBeGreaterThan(0);

    setFilter('premium');

    expect(screen.getByText(`${expected.length} of ${totalShipments} house shipments`)).toBeTruthy();
  });

  it('finds the constrained handful by the cargo word the register shows', () => {
    const { container } = render(<Console />);
    const expected = rows().filter(s => s.lithiumBattery);
    expect(expected.length).toBeGreaterThan(0);
    // The point of the fixture: constrained rows are a handful, not the bulk.
    expect(expected.length).toBeLessThan(totalShipments / 4);

    setFilter('lithium');

    expect(screen.getByText(`${expected.length} of ${totalShipments} house shipments`)).toBeTruthy();
    expect(container.textContent).toContain(expected[0].id);
  });

  it('stays case-insensitive and trimmed', () => {
    const { container } = render(<Console />);
    const target = rows()[3];

    setFilter(`  ${target.id.toLowerCase()}  `);

    expect(container.textContent).toContain(target.id);
    expect(screen.getByText(`1 of ${totalShipments} house shipments`)).toBeTruthy();
  });

  it('still matches by customer (unchanged behaviour)', () => {
    render(<Console />);
    const target = rows()[0];
    const expected = rows().filter(s => s.customer === target.customer);

    setFilter(target.customer);

    expect(screen.getByText(`${expected.length} of ${totalShipments} house shipments`)).toBeTruthy();
  });
});

/**
 * The register has to show the cargo facts a remedy can founder on before any agent has
 * proposed anything — that is what makes the constrained handful visible at rest, and what a
 * blocked alternative in the panel later refers back to.
 */
describe('Console shows cargo constraints and proposed remedies', () => {
  it('names the constraint on a flagged row and shows a dash on an unflagged one', () => {
    render(<Console />);
    const flagged = rows().find(s => s.lithiumBattery)!;
    setFilter(flagged.id);
    expect(screen.getByText('Lithium-ion')).toBeTruthy();

    const plain = rows().find(
      s => !s.lithiumBattery && !s.oversizeMainDeckOnly && !s.pharmaQualifiedLane
        && !s.activeTempControl && s.screeningStatus === 'cleared' && s.customsStatus === 'released',
    )!;
    setFilter(plain.id);
    expect(screen.queryByText('Lithium-ion')).toBeNull();
    expect(screen.getByLabelText('no cargo constraints')).toBeTruthy();
  });

  it('shows no remedy until one is proposed, then shows it with what it costs', () => {
    const target = rows()[5];
    render(<Console />);
    setFilter(target.id);
    expect(screen.getByLabelText('no remedy proposed yet')).toBeTruthy();

    act(() => {
      target.remedy = 'truck';
      target.remedyCost = 326;
      store.notify();
    });

    expect(screen.getByText('truck-and-fly')).toBeTruthy();
    expect(screen.getByText('€326')).toBeTruthy();

    // Leave the fixture as this suite found it — the store is a module singleton.
    act(() => {
      target.remedy = null;
      target.remedyCost = 0;
      store.notify();
    });
  });
});

/**
 * The "Edit a row" beat: a write straight to the live store, outside any tool and outside
 * Ladder, that bumps the same `version` the commit-time guard checks. Without the bump, a
 * proposal opened before it would apply against a record that has already moved.
 */
describe('Console external edit bumps the version the guard reads', () => {
  it('raises the version and changes a rendered field', () => {
    render(<Console />);
    const target = rows()[9];
    setFilter(target.id);

    const before = { version: target.version, revenue: target.revenueEur };
    fireEvent.click(screen.getByRole('button', { name: 'Edit a row' }));

    expect(target.version).toBe(before.version + 1);
    expect(target.revenueEur).toBe(before.revenue + 25);
    expect(screen.getByText(`v${before.version + 1}`)).toBeTruthy();
  });
});
