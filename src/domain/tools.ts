import type { Ctx } from '../core/shadow';
import type { AppState, Shipment, ShipmentStatus } from './types';
import { registerLadderTool, type LadderToolSpec } from '../webmcp/adapter';

/** Destructive or externally-visible tools never get a standing rule, no matter how many
 *  clean approvals accumulate. Core takes this list as an argument; it never authors it.
 *  Re-exported here (its canonical export point) from its own module — see
 *  policy-eligibility.ts for why the constant itself doesn't live in this file. */
export { NEVER_ELIGIBLE } from './policy-eligibility';

interface Filter {
  customer?: string;
  origin?: string;
  destination?: string;
  status?: ShipmentStatus;
}

function matchesFilter(s: Shipment, f: Filter): boolean {
  if (f.customer !== undefined && s.customer !== f.customer) return false;
  if (f.origin !== undefined && s.origin !== f.origin) return false;
  if (f.destination !== undefined && s.destination !== f.destination) return false;
  if (f.status !== undefined && s.status !== f.status) return false;
  return true;
}

function findMatches(db: AppState, f: Filter): Shipment[] {
  return Object.values(db.shipments).filter(s => matchesFilter(s, f));
}

const filterProps = {
  customer: { type: 'string', description: 'Exact customer name to filter by' },
  origin: { type: 'string', description: 'Exact origin to filter by' },
  destination: { type: 'string', description: 'Exact destination to filter by' },
  status: { type: 'string', description: 'Exact shipment status to filter by' },
} as const;

const searchShipments: LadderToolSpec = {
  name: 'search_shipments',
  description: 'Search shipments by customer, origin, destination, or status. Returns up to 50 matching rows.',
  readOnly: true,
  inputSchema: { type: 'object', properties: { ...filterProps } },
  async exec(input: Filter = {}, ctx: Ctx<AppState>) {
    const rows = findMatches(ctx.db, input);
    return { rows: rows.slice(0, 50), total: rows.length };
  },
};

const getShipment: LadderToolSpec = {
  name: 'get_shipment',
  description: 'Get a single shipment by id.',
  readOnly: true,
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Shipment id, e.g. SHP-10001' } },
    required: ['id'],
  },
  async exec(input: { id: string }, ctx: Ctx<AppState>) {
    return { shipment: ctx.db.shipments[input.id] ?? null };
  },
};

const updateShipments: LadderToolSpec = {
  name: 'update_shipments',
  description: 'Set status and/or ETA on shipments matching a filter. Rows with an open customs hold are skipped and reported.',
  inputSchema: {
    type: 'object',
    properties: {
      ...filterProps,
      setStatus: { type: 'string', description: 'New status to apply to matching rows' },
      setEta: { type: 'string', description: 'New ETA (YYYY-MM-DD) to apply to matching rows' },
    },
  },
  async exec(input: Filter & { setStatus?: ShipmentStatus; setEta?: string } = {}, ctx: Ctx<AppState>) {
    const rows = findMatches(ctx.db, input);
    let matched = 0;
    for (const row of rows) {
      const s = ctx.db.shipments[row.id];
      if (s.customsHold) {
        ctx.notes.push({ id: s.id, reason: 'customs hold open' });
        continue;
      }
      if (input.setStatus !== undefined) s.status = input.setStatus;
      if (input.setEta !== undefined) s.eta = input.setEta;
      matched++;
    }
    return { matched };
  },
};

const repriceShipments: LadderToolSpec = {
  name: 'reprice_shipments',
  description: 'Apply a percentage price change to shipments matching a filter.',
  inputSchema: {
    type: 'object',
    properties: {
      ...filterProps,
      pct: { type: 'number', description: 'Percentage change to apply, e.g. 5 for +5%, -10 for -10%' },
    },
    required: ['pct'],
  },
  async exec(input: Filter & { pct: number }, ctx: Ctx<AppState>) {
    const rows = findMatches(ctx.db, input);
    for (const row of rows) {
      const s = ctx.db.shipments[row.id];
      s.price = Math.round(s.price * (1 + input.pct / 100));
    }
    return { matched: rows.length };
  },
};

const cancelShipments: LadderToolSpec = {
  name: 'cancel_shipments',
  description: 'Cancel shipments matching a filter. Never eligible for standing-rule automation.',
  inputSchema: { type: 'object', properties: { ...filterProps } },
  async exec(input: Filter = {}, ctx: Ctx<AppState>) {
    const rows = findMatches(ctx.db, input);
    for (const row of rows) {
      ctx.db.shipments[row.id].status = 'Cancelled';
    }
    return { matched: rows.length };
  },
};

const notifyCustomers: LadderToolSpec = {
  name: 'notify_customers',
  description: 'Notify each distinct customer among shipments matching a filter. Never eligible for standing-rule automation.',
  inputSchema: {
    type: 'object',
    properties: { ...filterProps, message: { type: 'string' } },
    required: ['message'],
  },
  async exec(input: Filter & { message: string }, ctx: Ctx<AppState>) {
    const rows = findMatches(ctx.db, input);
    const customers = [...new Set(rows.map(r => r.customer))];
    for (const customer of customers) {
      await ctx.effects.notify(customer, input.message);
    }
    return { notified: customers };
  },
};

/**
 * Registration is deliberately deferred behind this function rather than run as a module
 * top-level side effect, and called explicitly once from App.tsx after both this module and
 * adapter.ts have finished loading. (This file and adapter.ts no longer import from one
 * another at all — NEVER_ELIGIBLE moved to policy-eligibility.ts precisely to remove that
 * cycle — but the explicit call site is still the clearer, more testable shape, so it stays.)
 */
export function registerDomainTools(): void {
  registerLadderTool(searchShipments);
  registerLadderTool(getShipment);
  registerLadderTool(updateShipments);
  registerLadderTool(repriceShipments);
  registerLadderTool(cancelShipments);
  registerLadderTool(notifyCustomers);
}
