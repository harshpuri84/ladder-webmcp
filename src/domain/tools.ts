import type { Ctx } from '../core/shadow';
import type {
  AppState, CustomsStatus, RemedyId, ScreeningStatus, Shipment, SlaTier,
} from './types';
import {
  REMEDIES, checkRemedy, remedyCost, remedyRecoveredHours, blockedAlternatives,
  evaluateAllRemedies, recommendRemedy,
} from './remedy-policy';
import { registerLadderTool, type LadderToolSpec } from '../webmcp/adapter';

/** Destructive or externally-visible tools never get a standing rule, no matter how many
 *  clean approvals accumulate. Core takes this list as an argument; it never authors it.
 *  Re-exported here (its canonical export point) from its own module — see
 *  policy-eligibility.ts for why the constant itself doesn't live in this file. */
export { NEVER_ELIGIBLE } from './policy-eligibility';

interface Filter {
  ids?: string[];
  customer?: string;
  consol?: string;
  slaTier?: SlaTier;
  lithiumBattery?: boolean;
  activeTempControl?: boolean;
  pharmaQualifiedLane?: boolean;
  oversizeMainDeckOnly?: boolean;
  screeningStatus?: ScreeningStatus;
  customsStatus?: CustomsStatus;
}

function matchesFilter(s: Shipment, f: Filter): boolean {
  if (f.ids !== undefined && !f.ids.includes(s.id)) return false;
  if (f.customer !== undefined && s.customer !== f.customer) return false;
  if (f.consol !== undefined && s.consol !== f.consol) return false;
  if (f.slaTier !== undefined && s.slaTier !== f.slaTier) return false;
  if (f.lithiumBattery !== undefined && s.lithiumBattery !== f.lithiumBattery) return false;
  if (f.activeTempControl !== undefined && s.activeTempControl !== f.activeTempControl) return false;
  if (f.pharmaQualifiedLane !== undefined && s.pharmaQualifiedLane !== f.pharmaQualifiedLane) return false;
  if (f.oversizeMainDeckOnly !== undefined && s.oversizeMainDeckOnly !== f.oversizeMainDeckOnly) return false;
  if (f.screeningStatus !== undefined && s.screeningStatus !== f.screeningStatus) return false;
  if (f.customsStatus !== undefined && s.customsStatus !== f.customsStatus) return false;
  return true;
}

function findMatches(db: AppState, f: Filter): Shipment[] {
  return Object.values(db.shipments).filter(s => matchesFilter(s, f));
}

const SLA_TIERS: SlaTier[] = ['premium', 'standard', 'basic'];
const SCREENING_STATUSES: ScreeningStatus[] = ['cleared', 'pending'];
const CUSTOMS_STATUSES: CustomsStatus[] = ['released', 'held'];

const filterProps = {
  ids: { type: 'array', items: { type: 'string' }, description: 'Exact shipment ids to target' },
  customer: { type: 'string', description: 'Exact customer name to filter by' },
  consol: { type: 'string', description: 'Exact consol id to filter by, e.g. CONSOL-A' },
  slaTier: { type: 'string', enum: SLA_TIERS, description: 'Exact SLA tier to filter by' },
  lithiumBattery: { type: 'boolean', description: 'Filter to shipments carrying standalone lithium-ion batteries' },
  activeTempControl: { type: 'boolean', description: 'Filter to shipments in an active temperature-controlled container' },
  pharmaQualifiedLane: { type: 'boolean', description: 'Filter to shipments on a pharma-qualified lane' },
  oversizeMainDeckOnly: { type: 'boolean', description: 'Filter to oversize shipments built for a main deck' },
  screeningStatus: { type: 'string', enum: SCREENING_STATUSES, description: 'Exact security screening status to filter by' },
  customsStatus: { type: 'string', enum: CUSTOMS_STATUSES, description: 'Exact customs release status to filter by' },
} as const;

const searchShipments: LadderToolSpec = {
  name: 'search_shipments',
  description: 'Search the house shipments on the disrupted flight by customer, consol, SLA tier, cargo flag, or status. Returns up to 50 matching rows.',
  readOnly: true,
  inputSchema: { type: 'object', properties: { ...filterProps } },
  async exec(input: Filter = {}, ctx: Ctx<AppState>) {
    const rows = findMatches(ctx.db, input);
    return { rows: rows.slice(0, 50), total: rows.length };
  },
};

const getShipment: LadderToolSpec = {
  name: 'get_shipment',
  description: 'Get a single house shipment by id, together with the availability, cost, and recovered time of every remedy — and which rule blocks any that are not available.',
  readOnly: true,
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'House shipment id, e.g. HAWB-70001' } },
    required: ['id'],
  },
  async exec(input: { id: string }, ctx: Ctx<AppState>) {
    const shipment = ctx.db.shipments[input.id] ?? null;
    return { shipment, remedies: shipment ? evaluateAllRemedies(shipment) : null };
  },
};

/** Applies one remedy to a shipment record. Every field is set wholesale — never a nested
 *  mutation — so the recorder sees the whole change in one write per field. */
function applyRemedy(s: Shipment, remedy: RemedyId): void {
  s.remedy = remedy;
  s.remedyCost = remedyCost(s, remedy);
  s.recoveredHours = remedyRecoveredHours(remedy);
  const blocked = blockedAlternatives(s, remedy);
  if (blocked.length > 0) s.blockedAlternatives = blocked;
}

const proposeRemedy: LadderToolSpec = {
  name: 'propose_remedy',
  description: "Propose a remedy for shipments matching a filter. Without `remedy`, each shipment gets the cheapest remedy available to it — most get the free same-carrier rebook. With `remedy`, that specific remedy is applied only where it is not blocked; blocked rows are skipped and reported with the rule that blocked them.",
  inputSchema: {
    type: 'object',
    properties: {
      ...filterProps,
      remedy: { type: 'string', enum: REMEDIES, description: 'Force this specific remedy instead of recommending the cheapest available one' },
    },
  },
  async exec(input: Filter & { remedy?: RemedyId } = {}, ctx: Ctx<AppState>) {
    const rows = findMatches(ctx.db, input);
    let matched = 0;
    for (const row of rows) {
      const s = ctx.db.shipments[row.id];
      if (input.remedy !== undefined) {
        const check = checkRemedy(s, input.remedy);
        if (check.status === 'blocked') {
          ctx.notes.push({ id: s.id, reason: check.rule.description });
          continue;
        }
        applyRemedy(s, input.remedy);
        matched++;
        continue;
      }
      const rec = recommendRemedy(s);
      if (!rec) {
        ctx.notes.push({ id: s.id, reason: 'every remedy is blocked for this shipment; it needs manual escalation' });
        continue;
      }
      applyRemedy(s, rec.remedy);
      matched++;
    }
    return { matched };
  },
};

const notifyCustomers: LadderToolSpec = {
  name: 'notify_customers',
  description: 'Notify each distinct customer among shipments matching a filter about the disruption. Never eligible for standing-rule automation.',
  inputSchema: {
    type: 'object',
    properties: { ...filterProps, message: { type: 'string' } },
    required: ['message'],
  },
  async exec(input: Filter & { message: string }, ctx: Ctx<AppState>) {
    const rows = findMatches(ctx.db, input);
    const customers = [...new Set(rows.map(r => r.customer))];
    // `message` is required in the schema but nothing here enforces that on its own — a missing
    // message would otherwise reach a customer as the literal word "undefined". Refuse before
    // creating any notify action.
    if (typeof input.message !== 'string' || input.message.trim() === '') {
      for (const customer of customers) {
        ctx.notes.push({ id: customer, reason: 'no message was given, so nothing was sent' });
      }
      return { notified: [] };
    }
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
  registerLadderTool(proposeRemedy);
  registerLadderTool(notifyCustomers);
}
