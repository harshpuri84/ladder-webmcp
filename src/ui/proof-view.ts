/**
 * What the open proof sheet says about each row of the register.
 *
 * The panel narrates a decision and the register is the world that decision is about, so the
 * register has to show, on its own rows, which of them the open proposal touches and how. This
 * is the panel's reading of its head, published for the register to draw: nothing here is a
 * record, nothing here is a decision, and nothing here reaches the adapter. The panel writes it
 * from the head it already holds, so no second surface ever has to subscribe to `onProposal`
 * and race the panel for the adapter's buffer.
 *
 * Held at module scope the way `register-view.ts` is, and for the same reason: the register
 * unmounts on a tab change and the proposal does not.
 */
import type { RemedyId } from '../domain/types';

export type ProofRowState = 'marked' | 'struck' | 'referred';

/** One row as the sheet reads it: its state, and the remedy the sheet proposes for it, so the
 *  register can print the proposal in the row itself rather than only rule its edge. */
export interface ProofRow {
  state: ProofRowState;
  /** Null when the group is not a remedy proposal (a test tool, a future write tool). */
  remedy: RemedyId | null;
  cost: number;
}

export interface ProofView {
  proposalId: string;
  rows: ReadonlyMap<string, ProofRow>;
}

let view: ProofView | null = null;
let version = 0;
const listeners = new Set<() => void>();

export function proofView(): ProofView | null {
  return view;
}

/** The snapshot for `useSyncExternalStore`: a counter, because the map is rebuilt on every untick. */
export function proofViewVersion(): number {
  return version;
}

export function onProofViewChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function setProofView(next: ProofView | null): void {
  if (next === null && view === null) return;
  view = next;
  version += 1;
  listeners.forEach(fn => fn());
}
