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
   * Set only when the tool itself threw during preview, before touching a single row. A crash
   * is not rejected work — modelling it as a zero-count `rejected` bucket is what made it
   * fragile: a later, correct rule ("suppress a bucket reporting nothing") could silently
   * delete it. This is its own field precisely so it survives that rule, and so the agent can
   * tell a crashed tool apart from the guard blocking a write, which is a distinction this
   * payload otherwise makes for every other case.
   */
  error?: string;
}

export function toolResult(p: ToolPayload) {
  return { ...p, content: [{ type: 'text' as const, text: JSON.stringify(p) }] };
}
