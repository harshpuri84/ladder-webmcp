import { describe, it, expect } from 'vitest';
import {
  checkRemedy, remedyCost, remedyRecoveredHours, blockedAlternatives,
  evaluateAllRemedies, recommendRemedy, RULES,
} from '../remedy-policy';
import type { Shipment } from '../types';

function baseShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 'HAWB-TEST', mawb: 'MAWB-TEST', consol: 'CONSOL-A', customer: 'Test Customer',
    slaTier: 'standard', promisedDelivery: '2026-09-16', revenueEur: 1000, weightKg: 100,
    lithiumBattery: false, activeTempControl: false, tempEnduranceHours: 0,
    pharmaQualifiedLane: false, oversizeMainDeckOnly: false,
    screeningStatus: 'cleared', customsStatus: 'released',
    remedy: null, remedyCost: 0, recoveredHours: 0, blockedAlternatives: [],
    version: 1,
    ...overrides,
  };
}

describe('checkRemedy', () => {
  it('permits every remedy for ordinary general cargo', () => {
    const s = baseShipment();
    expect(checkRemedy(s, 'rebook')).toEqual({ status: 'available' });
    expect(checkRemedy(s, 'competitor')).toEqual({ status: 'available' });
    expect(checkRemedy(s, 'truck')).toEqual({ status: 'available' });
  });

  it('blocks rebook for standalone lithium-ion, cargo-aircraft-only', () => {
    const s = baseShipment({ lithiumBattery: true });
    expect(checkRemedy(s, 'rebook')).toEqual({ status: 'blocked', rule: RULES.lithiumCargoAircraftOnly });
    expect(checkRemedy(s, 'competitor').status).toBe('available');
    expect(checkRemedy(s, 'truck').status).toBe('available');
  });

  it('blocks rebook for oversize built for a main deck', () => {
    const s = baseShipment({ oversizeMainDeckOnly: true });
    expect(checkRemedy(s, 'rebook')).toEqual({ status: 'blocked', rule: RULES.oversizeMainDeckOnly });
    expect(checkRemedy(s, 'competitor').status).toBe('available');
    expect(checkRemedy(s, 'truck').status).toBe('available');
  });

  it('blocks rebook for cargo not screened to passenger standard', () => {
    const s = baseShipment({ screeningStatus: 'pending' });
    expect(checkRemedy(s, 'rebook')).toEqual({ status: 'blocked', rule: RULES.screeningNotCleared });
    expect(checkRemedy(s, 'competitor').status).toBe('available');
    expect(checkRemedy(s, 'truck').status).toBe('available');
  });

  it('permits rebook once screening clears', () => {
    const s = baseShipment({ screeningStatus: 'cleared' });
    expect(checkRemedy(s, 'rebook').status).toBe('available');
  });

  it('blocks competitor and truck for a pharma-qualified lane, but permits rebook', () => {
    const s = baseShipment({ pharmaQualifiedLane: true });
    expect(checkRemedy(s, 'rebook').status).toBe('available');
    expect(checkRemedy(s, 'competitor')).toEqual({ status: 'blocked', rule: RULES.pharmaLaneSignoffRequired });
    expect(checkRemedy(s, 'truck')).toEqual({ status: 'blocked', rule: RULES.pharmaLaneSignoffRequired });
  });

  it('blocks truck when an active container\'s endurance is shorter than the route', () => {
    const s = baseShipment({ activeTempControl: true, tempEnduranceHours: 18 });
    expect(checkRemedy(s, 'truck')).toEqual({ status: 'blocked', rule: RULES.activeTempEnduranceWindow });
    expect(checkRemedy(s, 'rebook').status).toBe('available');
    expect(checkRemedy(s, 'competitor').status).toBe('available');
  });

  it('permits truck when an active container\'s endurance covers the route', () => {
    const s = baseShipment({ activeTempControl: true, tempEnduranceHours: 40 });
    expect(checkRemedy(s, 'truck').status).toBe('available');
  });

  it('blocks competitor when customs has not released the shipment ahead of the ACD cutoff', () => {
    const s = baseShipment({ customsStatus: 'held' });
    expect(checkRemedy(s, 'competitor')).toEqual({ status: 'blocked', rule: RULES.customsAcdCutoff });
    expect(checkRemedy(s, 'rebook').status).toBe('available');
    expect(checkRemedy(s, 'truck').status).toBe('available');
  });

  it('permits competitor once customs releases the shipment', () => {
    const s = baseShipment({ customsStatus: 'released' });
    expect(checkRemedy(s, 'competitor').status).toBe('available');
  });

  it('can block every remedy at once for a shipment that combines lithium and a pharma lane', () => {
    const s = baseShipment({ lithiumBattery: true, pharmaQualifiedLane: true });
    expect(checkRemedy(s, 'rebook').status).toBe('blocked');
    expect(checkRemedy(s, 'competitor').status).toBe('blocked');
    expect(checkRemedy(s, 'truck').status).toBe('blocked');
  });
});

describe('remedyCost', () => {
  it('costs nothing to rebook on the same carrier', () => {
    expect(remedyCost(baseShipment({ weightKg: 500 }), 'rebook')).toBe(0);
  });

  it('scales the competitor cost with weight', () => {
    const light = remedyCost(baseShipment({ weightKg: 50 }), 'competitor');
    const heavy = remedyCost(baseShipment({ weightKg: 500 }), 'competitor');
    expect(heavy).toBeGreaterThan(light);
    expect(light).toBeGreaterThan(0);
  });

  it('gives a heavier shipment a cheaper truck option than a light one, relative to competitor', () => {
    // The shared-truck flat share makes trucking relatively worse for light cargo and
    // relatively better for heavy cargo, since competitor scales per kilo and truck mostly
    // doesn't — this is what gives the two remedies a genuine niche each, not just cost noise.
    const light = baseShipment({ weightKg: 40 });
    const heavy = baseShipment({ weightKg: 900 });
    expect(remedyCost(light, 'competitor')).toBeLessThan(remedyCost(light, 'truck'));
    expect(remedyCost(heavy, 'truck')).toBeLessThan(remedyCost(heavy, 'competitor'));
  });

  it('is deterministic — same shipment, same remedy, same cost every time', () => {
    const s = baseShipment({ weightKg: 317 });
    expect(remedyCost(s, 'truck')).toBe(remedyCost(s, 'truck'));
    expect(remedyCost(s, 'competitor')).toBe(remedyCost(s, 'competitor'));
  });
});

describe('remedyRecoveredHours', () => {
  it('is a fixed figure per remedy, independent of the shipment', () => {
    expect(remedyRecoveredHours('rebook')).toBe(30);
    expect(remedyRecoveredHours('competitor')).toBe(44);
    expect(remedyRecoveredHours('truck')).toBe(24);
  });
});

describe('blockedAlternatives', () => {
  it('is empty for ordinary cargo — nothing blocks any of the other two remedies', () => {
    expect(blockedAlternatives(baseShipment(), 'rebook')).toEqual([]);
  });

  it('lists the other blocked remedy with its rule when one is chosen', () => {
    const s = baseShipment({ lithiumBattery: true });
    const blocked = blockedAlternatives(s, 'competitor');
    expect(blocked).toEqual([{ remedy: 'rebook', ruleId: RULES.lithiumCargoAircraftOnly.id, rule: RULES.lithiumCargoAircraftOnly.description }]);
  });

  it('never lists the chosen remedy itself, even if it were somehow blocked', () => {
    const s = baseShipment({ pharmaQualifiedLane: true });
    expect(blockedAlternatives(s, 'rebook').some(b => b.remedy === 'rebook')).toBe(false);
  });
});

describe('evaluateAllRemedies', () => {
  it('reports all three remedies with cost, recovered hours, and why each is or is not available', () => {
    const s = baseShipment({ lithiumBattery: true, weightKg: 200 });
    const evals = evaluateAllRemedies(s);
    expect(evals).toHaveLength(3);
    const rebook = evals.find(e => e.remedy === 'rebook')!;
    expect(rebook.available).toBe(false);
    expect(rebook.blockedBy).toEqual(RULES.lithiumCargoAircraftOnly);
    const competitor = evals.find(e => e.remedy === 'competitor')!;
    expect(competitor.available).toBe(true);
    expect(competitor.blockedBy).toBeNull();
    expect(competitor.cost).toBeGreaterThan(0);
  });
});

describe('recommendRemedy', () => {
  it('recommends the free rebook for ordinary general cargo', () => {
    const rec = recommendRemedy(baseShipment());
    expect(rec).not.toBeNull();
    expect(rec!.remedy).toBe('rebook');
    expect(rec!.cost).toBe(0);
    expect(rec!.blocked).toEqual([]);
  });

  it('recommends the cheaper of competitor/truck for lithium cargo, with the other named as blocked', () => {
    const light = baseShipment({ lithiumBattery: true, weightKg: 40 });
    const rec = recommendRemedy(light);
    expect(rec).not.toBeNull();
    expect(rec!.remedy).toBe('competitor');
    expect(rec!.blocked).toEqual(
      expect.arrayContaining([expect.objectContaining({ remedy: 'rebook', ruleId: RULES.lithiumCargoAircraftOnly.id })]),
    );
    expect(rec!.blocked.some(b => b.remedy === 'truck')).toBe(false);
  });

  it('switches to truck once weight makes it cheaper than the competitor freighter', () => {
    const heavy = baseShipment({ lithiumBattery: true, weightKg: 900 });
    const rec = recommendRemedy(heavy);
    expect(rec!.remedy).toBe('truck');
  });

  it('recommends rebook — the only lane-qualified option — for pharma cargo, even though it is not the fastest', () => {
    const rec = recommendRemedy(baseShipment({ pharmaQualifiedLane: true }));
    expect(rec!.remedy).toBe('rebook');
    expect(rec!.blocked.map(b => b.remedy).sort()).toEqual(['competitor', 'truck']);
  });

  it('returns null when every remedy is blocked, so the caller can report a domain skip', () => {
    const s = baseShipment({ lithiumBattery: true, pharmaQualifiedLane: true });
    expect(recommendRemedy(s)).toBeNull();
  });
});
