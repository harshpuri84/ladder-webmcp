/**
 * The shape of a picture, not of a running thing.
 *
 * Everything under `src/ui/mock/` is drawn. It imports nothing from `src/core/`, `src/webmcp/`
 * or `src/domain/`, and no engine ever runs behind it. That separation is the point: the
 * argument this tab makes is that the four beats are the same whatever the records are, and an
 * argument made by a second running copy of the freight console would be no argument at all.
 *
 * The four beats live here rather than on a domain because they are the claim. A domain that
 * could name its own steps could quietly differ from the others, and the sameness of the words
 * is exactly what a reader is being asked to check.
 */

export interface MockRow {
  id: string;
  label: string;
  detail: string;
  change: string;
  cost: string;
  /** Struck out by the operator at the sculpt step. */
  cut?: boolean;
  /** Declined by the tool itself, with the rule that declined it. Never shown as a diff row. */
  declined?: string;
}

export interface MockDomain {
  id: string;
  /** What this kind of work is called, for the selector. */
  name: string;
  /** The audience this domain is for, one short clause. */
  who: string;
  toolName: string;
  /** What the agent was asked, in a person's words. */
  prompt: string;
  /** Units, e.g. "shipments", "products", "regions". */
  noun: string;
  rows: MockRow[];
  /** The money or magnitude line under the record count, already formatted. */
  magnitude: string;
  payload: Record<string, unknown>;
}

export const STEPS = ['The call', 'The blast radius', 'The operator cuts it down', 'What went back'] as const;
export type StepIndex = 0 | 1 | 2 | 3;
