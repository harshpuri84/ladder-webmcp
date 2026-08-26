import type { CommitStatus } from '../core/commit';

export interface ToolPayload {
  status: CommitStatus;
  requested: number;
  applied: number;
  rejected: { count: number; reason: string; ids: string[] }[];
  actions_released: number;
  actions_dropped: number;
  replan_required: boolean;
  rule_offered: string | null;
  /**
   * Set only when the tool itself threw — either during preview, before touching a single
   * row, or for real during the commit re-run (as opposed to the guard refusing a write
   * outside the approved set, which is `denied` with no `error`). A crash is not rejected
   * work — modelling it as a zero-count `rejected` bucket is what made it fragile: a later,
   * correct rule ("suppress a bucket reporting nothing") could silently delete it. This is its
   * own field precisely so it survives that rule, and so the agent can tell a crashed tool
   * apart from the guard blocking a write, which is a distinction this payload otherwise makes
   * for every other case.
   */
  error?: string;
  /**
   * Set only when a proposal was declined with nothing to decide (see `nothing_to_decide` in
   * webmcp/adapter.ts) and no domain notes explained why either — i.e. the filter or request
   * matched no records and produced no actions at all. That combination used to reach the
   * agent as `{ requested: 0, applied: 0, rejected: [] }` with no explanation, indistinguishable
   * from silence. Not a `rejected` bucket: the zero-count filter (see T8-2 above) would strip
   * a `{ count: 0 }` entry anyway, and the reconciliation invariant requires the rejected total
   * to stay 0 when `requested` is 0 — so this is a reason attached to the outcome itself, not a
   * counted item within it. Deliberately not phrased as an operator refusal: no human ever saw
   * this proposal.
   */
  reason?: string;
}

export function toolResult(p: ToolPayload) {
  return { ...p, content: [{ type: 'text' as const, text: JSON.stringify(p) }] };
}
