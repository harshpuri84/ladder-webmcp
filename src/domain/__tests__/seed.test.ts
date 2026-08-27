import { describe, it, expect } from 'vitest';
import { seedShipments, CONSOLS, DISRUPTED_FLIGHT } from '../seed';

describe('seedShipments', () => {
  it('is deterministic', () => {
    expect(seedShipments()).toEqual(seedShipments());
  });

  it('produces exactly 42 house shipments with unique ids', () => {
    const s = seedShipments();
    expect(Object.keys(s)).toHaveLength(42);
    expect(new Set(Object.values(s).map(x => x.id)).size).toBe(42);
  });

  it('spreads the 42 shipments across exactly 31 distinct customers', () => {
    const s = seedShipments();
    const customers = new Set(Object.values(s).map(x => x.customer));
    expect(customers.size).toBe(31);
  });

  it('has at least one customer with more than one house shipment on this flight', () => {
    const s = seedShipments();
    const counts = new Map<string, number>();
    for (const sh of Object.values(s)) counts.set(sh.customer, (counts.get(sh.customer) ?? 0) + 1);
    expect([...counts.values()].some(n => n > 1)).toBe(true);
  });

  it('puts every shipment on one of the two consols, both represented', () => {
    const s = seedShipments();
    const consols = new Set(Object.values(s).map(x => x.consol));
    expect(consols.size).toBe(2);
    expect([...consols].sort()).toEqual([...CONSOLS].sort());
    for (const consol of CONSOLS) {
      expect(Object.values(s).filter(x => x.consol === consol).length).toBeGreaterThan(0);
    }
  });

  it('shares one master air waybill across every house shipment', () => {
    const s = seedShipments();
    const mawbs = new Set(Object.values(s).map(x => x.mawb));
    expect(mawbs.size).toBe(1);
  });

  it('starts every shipment with no remedy assigned yet', () => {
    const s = seedShipments();
    for (const sh of Object.values(s)) {
      expect(sh.remedy).toBeNull();
      expect(sh.remedyCost).toBe(0);
      expect(sh.recoveredHours).toBe(0);
      expect(sh.blockedAlternatives).toEqual([]);
      expect(sh.version).toBe(1);
    }
  });

  it('makes most shipments ordinary general cargo, with only a handful carrying a flag', () => {
    const s = seedShipments();
    const flagged = Object.values(s).filter(x =>
      x.lithiumBattery || x.activeTempControl || x.pharmaQualifiedLane ||
      x.oversizeMainDeckOnly || x.screeningStatus !== 'cleared' || x.customsStatus !== 'released',
    );
    const total = Object.keys(s).length;
    expect(flagged.length).toBeGreaterThan(0);
    // "A handful" stated as a ratio rather than a fixed count, so adding one flagged shipment
    // does not fail a test whose point is the proportion.
    expect(flagged.length * 3).toBeLessThanOrEqual(total);
    expect(flagged.length).toBeLessThan(total - flagged.length);
  });

  it('carries at least one shipment for every one of the six blocking flags', () => {
    const s = seedShipments();
    const rows = Object.values(s);
    expect(rows.some(x => x.lithiumBattery)).toBe(true);
    expect(rows.some(x => x.oversizeMainDeckOnly)).toBe(true);
    expect(rows.some(x => x.screeningStatus === 'pending')).toBe(true);
    expect(rows.some(x => x.activeTempControl)).toBe(true);
    expect(rows.some(x => x.pharmaQualifiedLane)).toBe(true);
    expect(rows.some(x => x.customsStatus === 'held')).toBe(true);
  });

  /**
   * Three sizes of temperature clock, because which side of a remedy's transit time a clock
   * falls on is the whole difference between an ordinary shipment and the one that has to move
   * tonight at a price. Written against the transit figures remedy-policy.ts uses (18h for the
   * rebook, 24h for the road route) rather than against the endurance numbers themselves.
   */
  it('carries a temperature clock that outlasts every option, one that rules out the road route, and one that leaves only tonight', () => {
    const s = seedShipments();
    const rows = Object.values(s).filter(x => x.activeTempControl);
    expect(rows.some(x => x.tempEnduranceHours >= 24)).toBe(true);
    expect(rows.some(x => x.tempEnduranceHours >= 18 && x.tempEnduranceHours < 24)).toBe(true);
    expect(rows.some(x => x.tempEnduranceHours < 18)).toBe(true);
    // Never so short that even a freighter tonight could not make it — that would be a
    // shipment nobody can help for a reason the panel has no way to act on.
    for (const row of rows) expect(row.tempEnduranceHours).toBeGreaterThanOrEqual(4);
  });

  it('flies a lane on which every one of its rules describes something real', () => {
    // Advance cargo data filed against a new carrier before it loads is a United States import
    // requirement, so the customs rule only exists on a flight bound for the United States.
    expect(DISRUPTED_FLIGHT.origin).toBe('Frankfurt');
    expect(DISRUPTED_FLIGHT.destination).toBe('Chicago');
    // And the road option needs a second airport within a truck ride of the origin gateway.
    expect(DISRUPTED_FLIGHT.alternativeGateway).toBe('Amsterdam');
  });
});
