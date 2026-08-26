import { describe, it, expect } from 'vitest';
import { seedShipments } from '../seed';

describe('seedShipments', () => {
  it('is deterministic', () => {
    expect(seedShipments(200)).toEqual(seedShipments(200));
  });

  it('produces the requested count with unique ids', () => {
    const s = seedShipments(200);
    expect(Object.keys(s)).toHaveLength(200);
    expect(new Set(Object.values(s).map(x => x.id)).size).toBe(200);
  });

  it('puts some shipments on customs hold, but not all', () => {
    const held = Object.values(seedShipments(200)).filter(s => s.customsHold);
    expect(held.length).toBeGreaterThan(20);
    expect(held.length).toBeLessThan(120);
  });

  it('starts every shipment at version 1', () => {
    expect(Object.values(seedShipments(200)).every(s => s.version === 1)).toBe(true);
  });
});
