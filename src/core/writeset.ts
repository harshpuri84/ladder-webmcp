import type { Diff } from './diff';
import { fieldKey, groupKey } from './types';

export interface WriteSet {
  previewed: Set<string>;
  allowed: Set<string>;
  expected: Map<string, unknown>;   // fieldKey -> the value the human was shown
  actions: Set<string>;
  versions: Record<string, number>;
}

export function buildWriteSet(diff: Diff, approvedGroups: string[], approvedActions: string[]): WriteSet {
  const approved = new Set(approvedGroups);
  const previewed = new Set<string>(), allowed = new Set<string>();
  const expected = new Map<string, unknown>();
  const versions: Record<string, number> = {};

  for (const g of diff.groups) {
    versions[groupKey(g.entity, g.id)] = g.version;
    for (const w of g.writes) {
      const k = fieldKey(w.entity, w.id, w.field);
      previewed.add(k);
      expected.set(k, w.after);
      if (approved.has(g.group)) allowed.add(k);
    }
  }
  return { previewed, allowed, expected, actions: new Set(approvedActions), versions };
}
