/**
 * Reading a remedy proposal back out of an ordinary diff.
 *
 * propose_remedy writes plain record fields — `remedy`, `remedyCost`, `recoveredHours`,
 * `blockedAlternatives` — so the engine carries it with no special case anywhere in core. That
 * is the right trade for the engine and the wrong shape for a human: four field substitutions
 * do not read as "put this on a truck because lithium keeps it off a passenger belly".
 * This module turns the one into the other, in one place, so the row and the tally above it
 * cannot drift apart.
 *
 * Fields the recorder never wrote are absent, not zero: writing the same value a record
 * already holds is not a change and never reaches the diff (see core/recorder.ts). A free
 * rebook therefore carries no `remedyCost` write at all, which is why `cost` falls back to
 * what the record holds now rather than assuming a missing write means nothing.
 */
import type { DiffGroup } from '../core/diff';
import type { WriteRecord } from '../core/types';
import type { BlockedAlternative, RemedyId, Shipment } from '../domain/types';

/** The four fields propose_remedy writes. Anything else in a group is not a remedy proposal. */
const REMEDY_FIELDS = ['remedy', 'remedyCost', 'recoveredHours', 'blockedAlternatives'];

export interface RemedyProposal {
  /** The remedy the record carried before, if it carried one. Almost always null. */
  from: RemedyId | null;
  to: RemedyId;
  cost: number;
  recoveredHours: number;
  blocked: BlockedAlternative[];
}

export interface ProofRow {
  /** Null when this group is not a remedy proposal — a test tool, or a future write tool. */
  remedy: RemedyProposal | null;
  /** Writes this module did not account for, rendered as ordinary field substitutions. */
  otherWrites: WriteRecord[];
}

const isRemedyId = (v: unknown): v is RemedyId =>
  v === 'rebook' || v === 'competitor' || v === 'truck';

/**
 * `record` is the live store row, read for the values propose_remedy left unchanged. It is
 * safe to read during a proposal: the preview runs against a structural clone (core/shadow.ts),
 * so nothing here has been applied yet — which is exactly what the sheet says it is.
 */
export function readProofRow(group: DiffGroup, record: Shipment | undefined): ProofRow {
  const find = (field: string) => group.writes.find(w => w.field === field);
  const otherWrites = group.writes.filter(w => !REMEDY_FIELDS.includes(w.field));

  const remedyWrite = find('remedy');
  const to = remedyWrite?.after ?? record?.remedy;
  if (!isRemedyId(to)) return { remedy: null, otherWrites: group.writes };

  const cost = find('remedyCost')?.after ?? record?.remedyCost ?? 0;
  const recoveredHours = find('recoveredHours')?.after ?? record?.recoveredHours ?? 0;
  const blocked = find('blockedAlternatives')?.after ?? record?.blockedAlternatives ?? [];

  return {
    remedy: {
      from: isRemedyId(remedyWrite?.before) ? remedyWrite.before : null,
      to,
      cost: typeof cost === 'number' ? cost : 0,
      recoveredHours: typeof recoveredHours === 'number' ? recoveredHours : 0,
      blocked: Array.isArray(blocked) ? (blocked as BlockedAlternative[]) : [],
    },
    otherWrites,
  };
}

export interface RemedyTallyLine {
  remedy: RemedyId;
  count: number;
  cost: number;
}

const REMEDY_ORDER: RemedyId[] = ['rebook', 'competitor', 'truck'];

/**
 * Reduces a set of proof rows to the shape of the decision: how many take each remedy, what
 * each group costs, and how many rows had an alternative taken away by a rule.
 *
 * This exists because the distribution is the argument. Most of the forty-two share the free
 * rebook and a handful are genuinely constrained; scrolling a list to find that out is work,
 * and an operator with ninety minutes will not do it. Run against the operator's selection, so
 * it moves with the checkboxes the same way the extent figures above it do.
 */
export function summariseRemedies(rows: ProofRow[]): { lines: RemedyTallyLine[]; constrained: number } {
  const byRemedy = new Map<RemedyId, RemedyTallyLine>();
  let constrained = 0;

  for (const { remedy } of rows) {
    if (!remedy) continue;
    const line = byRemedy.get(remedy.to) ?? { remedy: remedy.to, count: 0, cost: 0 };
    line.count += 1;
    line.cost += remedy.cost;
    byRemedy.set(remedy.to, line);
    if (remedy.blocked.length > 0) constrained += 1;
  }

  const lines = REMEDY_ORDER.filter(r => byRemedy.has(r)).map(r => byRemedy.get(r)!);
  return { lines, constrained };
}
