import type { Diff } from './diff';

export interface Policy {
  id: string; tool: string;
  maxRecords: number; maxValue: number;
  expiresAt: string; draftedFrom: string; ratified: boolean;
}

export interface Disposition {
  tool: string; proposalId: string;
  proposed: number; approved: number; valueDelta: number;
}

const CLEAN_RUN = 3;
const VALID_DAYS = 7;

/** `neverEligible` is supplied by the caller. Core holds no list of domain tool names. */
export function draftPolicy(
  tool: string, history: Disposition[], now: Date, neverEligible: string[],
): Policy | null {
  if (neverEligible.includes(tool)) return null;
  const recent = history.filter(h => h.tool === tool).slice(-CLEAN_RUN);
  if (recent.length < CLEAN_RUN) return null;
  if (recent.some(h => h.approved !== h.proposed)) return null;

  const expires = new Date(now.getTime() + VALID_DAYS * 86_400_000).toISOString();
  return {
    id: `pol-${tool}-${recent[recent.length - 1].proposalId}`,
    tool,
    maxRecords: Math.max(...recent.map(h => h.proposed)),
    maxValue: Math.max(...recent.map(h => Math.abs(h.valueDelta))),
    expiresAt: expires,
    draftedFrom: recent[recent.length - 1].proposalId,
    ratified: false,
  };
}

export function policyMatches(p: Policy, diff: Diff, now: Date): boolean {
  if (!p.ratified) return false;
  if (new Date(p.expiresAt) <= now) return false;
  if (diff.totals.irreversible > 0) return false;
  if (diff.totals.records > p.maxRecords) return false;
  if (Math.abs(diff.totals.valueDelta) > p.maxValue) return false;
  return true;
}
