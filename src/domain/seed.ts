import type { CustomsStatus, ScreeningStatus, Shipment, SlaTier } from './types';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/**
 * The one master air waybill every row on this disrupted flight shares.
 *
 * The lane is load-bearing, not scenery. Two of the constraint layer's rules are lane-specific:
 * advance cargo data filed against a new carrier before it loads is a United States import
 * requirement, so it only exists on a flight bound for the United States, and the road option
 * only makes sense where a second airport is a truck ride away. Frankfurt to Chicago, with
 * Amsterdam as the alternative gateway, is what makes both of them describe something real.
 */
export const DISRUPTED_FLIGHT = {
  flightNumber: 'NX-4821',
  mawb: 'MAWB-176-88031204',
  origin: 'Frankfurt',
  destination: 'Chicago',
  /** Where the truck-and-fly remedy drives to before it flies. */
  alternativeGateway: 'Amsterdam',
  cancelledDeparture: '2026-09-14',
};

export const CONSOLS = ['CONSOL-A', 'CONSOL-B'] as const;

const SHIPMENT_COUNT = 42;

// 31 invented customers. No real companies, no real customers.
const CUSTOMERS = [
  'Northwind Retail', 'Belmont Foods', 'Karo Textiles', 'Ashgrove Pharma', 'Verity Motors',
  'Lumen Electronics', 'Pacific Grove', 'Halden Chemicals', 'Solace Robotics', 'Meridian Apparel',
  'Brightwell Toys', 'Corvus Instruments', 'Fenwick Hardware', 'Amaranth Cosmetics',
  'Thistledown Books', 'Ironclad Fasteners', 'Windermere Optics', 'Cobalt Sportswear',
  'Driftwood Furniture', 'Sable & Finch Leather', 'Quill & Ledger Stationery', 'Marrow Biotech',
  'Talon Aerospace Parts', 'Hearth & Home Appliances', 'Gravelight Batteries',
  'Perch Coffee Traders', 'Loomis Carpets', 'Vantage Sporting Goods', 'Emberline Ceramics',
  'Nautilus Marine Supply', 'Wrenfield Toolworks',
];

// 42 shipments across 31 customers means 31 customers get exactly one house shipment and 11 get
// a second. Indices 0..30 map straight to CUSTOMERS; indices 31..41 (the 11 "extra" shipments)
// map back onto 11 of those same customers, named here explicitly rather than derived, so the
// fixture is a fixed, readable manifest rather than something a reader has to run to discover.
//
// Three customers end up with one constrained shipment and one ordinary one, which is what a
// consol actually looks like: Northwind Retail (0 lithium / 31 clean), Marrow Biotech
// (21 pharma lane / 37 customs held) and Ashgrove Pharma (3 temperature-controlled and fine /
// 40 unscreened on a pharma lane, and out of options).
const EXTRA_CUSTOMER_INDEX = [0, 5, 9, 12, 15, 18, 21, 24, 27, 3, 30];

function customerAt(i: number): string {
  return i < 31 ? CUSTOMERS[i] : CUSTOMERS[EXTRA_CUSTOMER_INDEX[i - 31]];
}

const SLA_TIERS: SlaTier[] = ['premium', 'standard', 'basic'];

// The handful of flagged shipments, named by index rather than rolled up in the RNG, for the
// same reason as EXTRA_CUSTOMER_INDEX above: a reviewer can read this fixture instead of running
// it. Index 0 (customer index 0, "Northwind Retail") is deliberately paired with the extra
// shipment at index 31 (same customer, no flags) — one customer with two house shipments on
// this flight, one blocked from rebook and one not, so that pairing exists on purpose rather
// than by chance.
// Each flag sits on a customer who would plausibly ship that commodity — a battery company
// with standalone lithium-ion, an aerospace parts shipper with a piece built for a main deck,
// a biotech on a qualified lane. A flag landing on a customer who would never carry it is the
// first thing a reader from this industry notices, and it makes every other figure suspect.
const LITHIUM_INDEX = [0, 24];            // Northwind Retail (see below), Gravelight Batteries
const OVERSIZE_INDEX = [22];              // Talon Aerospace Parts
const SCREENING_PENDING_INDEX = [17, 29, 40]; // Cobalt Sportswear, Nautilus Marine Supply, Ashgrove Pharma
const PHARMA_INDEX = [21, 40];            // Marrow Biotech, Ashgrove Pharma
const CUSTOMS_HELD_INDEX = [37];          // Marrow Biotech's second shipment

/**
 * Index 40 carries both an unscreened status and a pharma-qualified lane, which is the one
 * combination that closes every door: the rebook needs passenger-standard screening, and both
 * reroutes need a lane sign-off nobody can give tonight. That shipment gets no remedy at all
 * and is reported as needing manual escalation — a real outcome the panel has to state rather
 * than let vanish, not an accident of the fixture.
 */

/**
 * The three sizes of temperature clock, and the reason the fixture has three.
 *
 * An active container holds temperature for a fixed number of hours, and remedy-policy.ts
 * measures that against how long each option takes to land the freight (18h for tomorrow
 * morning's rebook, 4h for a freighter tonight, 24h for the road route). Which side of those
 * three numbers a container's clock falls on is the whole difference between an interesting
 * shipment and an ordinary one:
 *
 *  - 12h — expires before tomorrow morning and before the road route. The free rebook is out
 *    and the truck is out; the only thing that lands this in time is the freighter tonight,
 *    at a spot rate. This is the row where the cheap option is ruled out by a clock rather
 *    than by an aircraft rule, and someone has to decide to spend money on it.
 *  - 20h — outlasts the rebook, does not outlast the road route. The free option still works;
 *    only the reroute is off.
 *  - 40h — outlasts everything. Temperature-controlled, and unconstrained by it.
 */
const ACTIVE_TEMP_TONIGHT_INDEX = [1, 13];  // Belmont Foods, Amaranth Cosmetics
const ACTIVE_TEMP_SHORT_INDEX = [7];        // Halden Chemicals
const ACTIVE_TEMP_OK_INDEX = [3];           // Ashgrove Pharma's other shipment

/** Hours of endurance, or 0 for a shipment that is not in an active container at all. */
function enduranceFor(i: number): number {
  if (ACTIVE_TEMP_TONIGHT_INDEX.includes(i)) return 12;
  if (ACTIVE_TEMP_SHORT_INDEX.includes(i)) return 20;
  if (ACTIVE_TEMP_OK_INDEX.includes(i)) return 40;
  return 0;
}

export function seedShipments(): Record<string, Shipment> {
  const rnd = lcg(20260901);
  const out: Record<string, Shipment> = {};
  for (let i = 0; i < SHIPMENT_COUNT; i++) {
    const id = `HAWB-${70001 + i}`;
    const consol = CONSOLS[rnd() < 0.55 ? 0 : 1];
    const slaTier = SLA_TIERS[Math.floor(rnd() * SLA_TIERS.length)];
    const weightKg = 40 + Math.floor(rnd() * 960);
    const revenueEur = 300 + Math.floor(rnd() * 4700);
    const day = 15 + Math.floor(rnd() * 4);
    const tempEnduranceHours = enduranceFor(i);
    const screeningStatus: ScreeningStatus = SCREENING_PENDING_INDEX.includes(i) ? 'pending' : 'cleared';
    const customsStatus: CustomsStatus = CUSTOMS_HELD_INDEX.includes(i) ? 'held' : 'released';

    out[id] = {
      id,
      mawb: DISRUPTED_FLIGHT.mawb,
      consol,
      customer: customerAt(i),
      slaTier,
      promisedDelivery: `2026-09-${String(day).padStart(2, '0')}`,
      revenueEur,
      weightKg,
      lithiumBattery: LITHIUM_INDEX.includes(i),
      activeTempControl: tempEnduranceHours > 0,
      tempEnduranceHours,
      pharmaQualifiedLane: PHARMA_INDEX.includes(i),
      oversizeMainDeckOnly: OVERSIZE_INDEX.includes(i),
      screeningStatus,
      customsStatus,
      remedy: null,
      remedyCost: 0,
      recoveredHours: 0,
      blockedAlternatives: [],
      version: 1,
    };
  }
  return out;
}
