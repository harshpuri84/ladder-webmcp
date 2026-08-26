import type { Diff } from './diff';
import { fieldKey, groupKey } from './types';

export interface WriteSet {
  previewed: Set<string>;
  allowed: Set<string>;
  actions: Set<string>;
  versions: Record<string, number>;
}

export function buildWriteSet(diff: Diff, approvedGroups: string[], approvedActions: string[]): WriteSet {
  const approved = new Set(approvedGroups);
  const previewed = new Set<string>(), allowed = new Set<string>();
  const versions: Record<string, number> = {};

  for (const g of diff.groups) {
    versions[groupKey(g.entity, g.id)] = g.version;
    for (const w of g.writes) {
      const k = fieldKey(w.entity, w.id, w.field);
      previewed.add(k);
      if (approved.has(g.group)) allowed.add(k);
    }
  }
  return { previewed, allowed, actions: new Set(approvedActions), versions };
}
