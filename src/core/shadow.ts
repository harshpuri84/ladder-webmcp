import { recordingProxy } from './recorder';
import { buildDiff, type Diff } from './diff';
import { collectingEffects, type Effects } from './effects';
import type { Note, WriteRecord } from './types';

export interface Ctx<S> { db: S; effects: Effects; notes: Note[]; }
export type Exec<S, R> = (ctx: Ctx<S>) => Promise<R>;

export interface ShadowOpts {
  proposalId: string;
  versionOf(entity: string, id: string): number;
  valueOf?(w: WriteRecord): number;
}

export async function runShadow<S extends object, R>(
  state: S, exec: Exec<S, R>, opts: ShadowOpts,
): Promise<{ ok: boolean; diff: Diff; notes: Note[]; error?: Error }> {
  const fork = structuredClone(state);
  const writes: WriteRecord[] = [];
  const notes: Note[] = [];
  const { effects, actions } = collectingEffects();
  const db = recordingProxy(fork, { onWrite: w => writes.push(w) });

  try {
    await exec({ db, effects, notes });
  } catch (e) {
    return { ok: false, error: e as Error, notes,
             diff: buildDiff(opts.proposalId, [], [], () => 0, opts.versionOf) };
  }
  return { ok: true, notes,
           diff: buildDiff(opts.proposalId, writes, actions, opts.valueOf ?? (() => 0), opts.versionOf) };
}
