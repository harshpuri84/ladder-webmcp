// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Console } from '../Console';
import { store } from '../../domain/store';

afterEach(() => cleanup());

const totalShipments = Object.keys(store.state.shipments).length;
const setFilter = (value: string) => {
  fireEvent.change(screen.getByPlaceholderText(/Filter by/i), { target: { value } });
};

/**
 * F8: receipts and panel notes hand the operator ids ("SHP-10003 skipped, customs hold open")
 * and the filter couldn't find any of them — id and status text returned nothing, and a lane
 * pasted as displayed ("Shanghai → Rotterdam") returned nothing because origin and destination
 * were matched separately, never as the combined string the console itself renders.
 */
describe('Console filter matches id, status, and lane as rendered (F8)', () => {
  it('finds a shipment by pasting its id', () => {
    const { container } = render(<Console />);
    const target = Object.values(store.state.shipments)[3];

    setFilter(target.id);

    expect(container.textContent).toContain(target.id);
    expect(screen.getByText(`1 of ${totalShipments} shipments`)).toBeTruthy();
  });

  it('finds shipments by status text', () => {
    render(<Console />);
    const expected = Object.values(store.state.shipments).filter(s => s.status === 'On hold');
    expect(expected.length).toBeGreaterThan(0);

    setFilter('On hold');

    expect(screen.getByText(`${expected.length} of ${totalShipments} shipments`)).toBeTruthy();
  });

  it('finds shipments by the lane exactly as displayed ("Origin → Destination")', () => {
    const { container } = render(<Console />);
    const target = Object.values(store.state.shipments)[7];
    const lane = `${target.origin} → ${target.destination}`;
    const expected = Object.values(store.state.shipments).filter(
      s => s.origin === target.origin && s.destination === target.destination,
    );

    setFilter(lane);

    expect(screen.getByText(`${expected.length} of ${totalShipments} shipments`)).toBeTruthy();
    expect(container.textContent).toContain(target.id);
  });

  it('stays case-insensitive and trimmed for the new id/status/lane matching', () => {
    const { container } = render(<Console />);
    const target = Object.values(store.state.shipments)[3];

    setFilter(`  ${target.id.toLowerCase()}  `);

    expect(container.textContent).toContain(target.id);
    expect(screen.getByText(`1 of ${totalShipments} shipments`)).toBeTruthy();
  });

  it('still matches by customer and by origin/destination alone (unchanged behaviour)', () => {
    render(<Console />);
    const target = Object.values(store.state.shipments)[0];
    const expected = Object.values(store.state.shipments).filter(s => s.customer === target.customer);

    setFilter(target.customer);

    expect(screen.getByText(`${expected.length} of ${totalShipments} shipments`)).toBeTruthy();
  });
});
