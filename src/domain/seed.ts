import type { Shipment, ShipmentStatus } from './types';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

const CUSTOMERS = ['Northwind Retail','Belmont Foods','Karo Textiles','Ashgrove Pharma',
                   'Verity Motors','Lumen Electronics','Pacific Grove','Halden Chemicals'];
const LANES: [string, string][] = [
  ['Shanghai','Rotterdam'],['Shenzhen','Hamburg'],['Busan','Antwerp'],['Singapore','Felixstowe'],
  ['Ho Chi Minh','Rotterdam'],['Ningbo','Le Havre'],['Jakarta','Hamburg'],['Chennai','Antwerp'],
  ['Kaohsiung','Rotterdam'],['Manila','Valencia'],['Bangkok','Gdansk'],['Colombo','Genoa'],
];
const STATUSES: ShipmentStatus[] = ['Booked','In transit','On hold','Delivered'];

export function seedShipments(count: number): Record<string, Shipment> {
  const rnd = lcg(20260903);
  const out: Record<string, Shipment> = {};
  for (let i = 0; i < count; i++) {
    const id = `SHP-${10000 + i}`;
    const [origin, destination] = LANES[Math.floor(rnd() * LANES.length)];
    const day = 1 + Math.floor(rnd() * 28);
    out[id] = {
      id,
      customer: CUSTOMERS[Math.floor(rnd() * CUSTOMERS.length)],
      origin, destination,
      status: STATUSES[Math.floor(rnd() * STATUSES.length)],
      price: 800 + Math.floor(rnd() * 9200),
      eta: `2026-09-${String(day).padStart(2, '0')}`,
      customsHold: rnd() < 0.28,
      priority: rnd() < 0.15,
      version: 1,
    };
  }
  return out;
}
