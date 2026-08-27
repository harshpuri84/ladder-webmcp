import type { CustomsStatus, ScreeningStatus, Shipment, SlaTier } from './types';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** The one master air waybill every row on this disrupted flight shares. */
export const DISRUPTED_FLIGHT = {
  flightNumber: 'NX-4821',
  mawb: 'MAWB-176-88031204',
  origin: 'Singapore',
  destination: 'Frankfurt',
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
const EXTRA_CUSTOMER_INDEX = [0, 5, 9, 12, 15, 18, 21, 24, 27, 3, 30];

function customerAt(i: number): string {
  return i < 31 ? CUSTOMERS[i] : CUSTOMERS[EXTRA_CUSTOMER_INDEX[i - 31]];
}

const SLA_TIERS: SlaTier[] = ['premium', 'standard', 'basic'];

// The handful of flagged shipments, named by index rather than rolled up in the RNG, for the
// same reason as EXTRA_CUSTOMER_INDEX above: a reviewer can read this fixture instead of running
// it. Index 0 (customer index 0, "Northwind Retail") is deliberately paired with the extra
// shipment at index 31 (same customer, no flags) — one customer with two house shipments on
// this flight, one blocked from rebook and one not, so that pairing exists in the fixture on
// purpose rather than by chance.
const LITHIUM_INDEX = [0, 40];
const OVERSIZE_INDEX = [11];
const SCREENING_PENDING_INDEX = [17, 29];
// 6 has too little endurance for a truck-and-fly route; 23 has enough.
const ACTIVE_TEMP_SHORT_INDEX = [6];
const ACTIVE_TEMP_OK_INDEX = [23];
const PHARMA_INDEX = [14, 40];
const CUSTOMS_HELD_INDEX = [37];

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
    const activeTempControl = ACTIVE_TEMP_SHORT_INDEX.includes(i) || ACTIVE_TEMP_OK_INDEX.includes(i);
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
      activeTempControl,
      tempEnduranceHours: ACTIVE_TEMP_SHORT_INDEX.includes(i) ? 18 : ACTIVE_TEMP_OK_INDEX.includes(i) ? 40 : 0,
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
