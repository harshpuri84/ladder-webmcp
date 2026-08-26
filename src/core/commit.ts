import { recordingProxy } from './recorder';
import { releasingEffects } from './effects';
import { fieldKey } from './types';
import type { Note, WriteRecord } from './types';
import type { WriteSet } from './writeset';
import type { Ctx, Exec } from './shadow';
import type { SendFn } from './effects';

export class ScopeViolation extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`write outside the approved set: ${key}`);
    this.key = key;
  }
}

export class Divergence extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`approved field would receive a value the preview never showed: ${key}`);
    this.key = key;
  }
}

const same = (a: unknown, b: unknown) =>
  Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);

export type CommitStatus = 'applied' | 'partially_applied' | 'denied' | 'aborted_stale' | 'aborted_diverged';

export interface CommitOutcome {
  status: CommitStatus;
  applied: WriteRecord[];
  skipped: number;
  released: string[];
  dropped: string[];
  notes: Note[];
  violation?: string;
}

export async function runCommit<S extends object, R>(
  state: S, exec: Exec<S, R>, ws: WriteSet,
  opts: { versionOf(e: string, id: string): number; bumpVersion(e: string, id: string): void; send?: SendFn },
): Promise<CommitOutcome> {
  for (const [gk, seen] of Object.entries(ws.versions)) {
    const [entity, id] = gk.split(':');
    if (opts.versionOf(entity, id) !== seen) {
      return { status: 'aborted_stale', applied: [], skipped: 0, released: [], dropped: [], notes: [] };
    }
  }

  const snapshot = structuredClone(state);
  const applied: WriteRecord[] = [];
  const notes: Note[] = [];
  let skipped = 0;
  let violation: string | undefined;
  let divergence: string | undefined;
  const { effects, released, dropped, flush } = releasingEffects(ws.actions, opts.send);

  const db = recordingProxy(state, {
    onWrite: w => applied.push(w),
    guard: k => {
      const key = fieldKey(k.entity, k.id, k.field);
      if (ws.allowed.has(key)) {
        const want = ws.expected.get(key);
        if (!same(want, k.after)) { divergence = key; throw new Divergence(key); }
        return 'allow';
      }
      if (ws.previewed.has(key)) { skipped++; return 'skip'; }
      violation = key;
      throw new ScopeViolation(key);
    },
  });

  try {
    await exec({ db, effects, notes } as Ctx<S>);
  } catch (e) {
    for (const k of Object.keys(snapshot as object)) {
      (state as Record<string, unknown>)[k] = (snapshot as Record<string, unknown>)[k];
    }
    for (const k of Object.keys(state as object)) {
      if (!(k in (snapshot as object))) delete (state as Record<string, unknown>)[k];
    }
    return {
      status: e instanceof Divergence ? 'aborted_diverged' : 'denied',
      applied: [], skipped: 0, released: [], dropped: [], notes,
      violation: (e instanceof ScopeViolation || e instanceof Divergence) ? e.key : undefined,
    };
  }

  if (violation !== undefined || divergence !== undefined) {
    for (const k of Object.keys(snapshot as object)) {
      (state as Record<string, unknown>)[k] = (snapshot as Record<string, unknown>)[k];
    }
    for (const k of Object.keys(state as object)) {
      if (!(k in (snapshot as object))) delete (state as Record<string, unknown>)[k];
    }
    return {
      status: divergence !== undefined ? 'aborted_diverged' : 'denied',
      applied: [], skipped: 0, released: [], dropped: [], notes,
      violation: divergence ?? violation,
    };
  }

  for (const gk of new Set(applied.map(w => `${w.entity}:${w.id}`))) {
    const [entity, id] = gk.split(':');
    opts.bumpVersion(entity, id);
  }

  flush();

  return {
    status: skipped > 0 ? 'partially_applied' : 'applied',
    applied, skipped, released, dropped, notes,
  };
}
