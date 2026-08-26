import type { ActionRecord, WriteRecord } from './types';

export interface DiffGroup {
  group: string; entity: string; id: string;
  writes: WriteRecord[]; valueDelta: number; version: number;
}

export interface Diff {
  proposalId: string;
  groups: DiffGroup[];
  actions: ActionRecord[];
  totals: { records: number; valueDelta: number; irreversible: number };
}

export function buildDiff(
  proposalId: string,
  writes: WriteRecord[],
  actions: ActionRecord[],
  valueOf: (w: WriteRecord) => number,
  versionOf: (entity: string, id: string) => number,
): Diff {
  const byGroup = new Map<string, DiffGroup>();
  for (const w of writes) {
    let g = byGroup.get(w.group);
    if (!g) {
      g = { group: w.group, entity: w.entity, id: w.id, writes: [], valueDelta: 0,
            version: versionOf(w.entity, w.id) };
      byGroup.set(w.group, g);
    }
    g.writes.push(w);
    g.valueDelta += valueOf(w);
  }
  const groups = [...byGroup.values()];
  return {
    proposalId, groups, actions,
    totals: {
      records: groups.length,
      valueDelta: groups.reduce((n, g) => n + g.valueDelta, 0),
      irreversible: actions.length,
    },
  };
}
