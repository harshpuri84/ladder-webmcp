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
}

export function toolResult(p: ToolPayload) {
  return { ...p, content: [{ type: 'text' as const, text: JSON.stringify(p) }] };
}
