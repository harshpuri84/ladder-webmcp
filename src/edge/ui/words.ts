import type { DiffGroup } from '../../core/diff';
import type { Pop, RolloutMode } from '../types';

/** The word printed on a legend. Short enough to set in tracked caps at 9.5px. */
export const modeWord: Record<RolloutMode, string> = {
  shadow: 'shadow',
  staged: 'staged',
  immediate: 'all nodes',
};

/** The same three, said the way an engineer would say them out loud. */
export const modeFull: Record<RolloutMode, string> = {
  shadow: 'evaluated alongside the live config, serving nothing',
  staged: 'one node in ten, then the rest after a hold',
  immediate: 'every node at once',
};

/** Shadow never converges on its own — it waits for a person to promote it. */
export function convergeWords(minutes: number): string {
  if (minutes >= 1440) return 'held for promotion';
  if (minutes >= 60) return `${Math.round(minutes / 60)} h to converge`;
  return `${minutes} min to converge`;
}

export const pct = (n: number) => `${n.toFixed(2)}%`;
export const pct1 = (n: number) => `${n.toFixed(1)}%`;

/** 1,274,000 rather than 1.27M: this is a readout, and a readout shows the figure. */
export const rps = (n: number) => n.toLocaleString('en-GB');

export interface DetentRead {
  id: string;
  city: string;
  mode: RolloutMode | null;
  exposedPct: number;
  convergeMinutes: number;
  from: string;
  to: string | null;
}

const afterOf = (g: DiffGroup, field: string) => g.writes.find(w => w.field === field)?.after;

/**
 * What one previewed site is about to become, read off the diff the engine built rather than off
 * the record — the record has not been written yet, and the whole point of the preview is that it
 * never will be unless the operator latches it.
 */
export function readDetent(g: DiffGroup, pop: Pop | undefined): DetentRead {
  return {
    id: g.id,
    city: pop?.city ?? '',
    mode: (afterOf(g, 'rolloutMode') as RolloutMode | undefined) ?? null,
    exposedPct: (afterOf(g, 'exposedPct') as number | undefined) ?? 0,
    convergeMinutes: (afterOf(g, 'convergeMinutes') as number | undefined) ?? 0,
    from: pop?.configVersion ?? '',
    to: (afterOf(g, 'pendingVersion') as string | undefined) ?? null,
  };
}
