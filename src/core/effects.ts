import type { ActionRecord } from './types';

export interface Effects { notify(to: string, message: string): Promise<void>; }

/**
 * An action's identity is its content, never its position in the call sequence.
 * Preview and commit run the same tool twice; if the id depended on call order,
 * a human's approval would bind to whichever action happened to come second.
 * The occurrence suffix keeps two genuinely identical actions distinguishable.
 */
function identify(kind: string, payload: Record<string, unknown>, seen: Map<string, number>): string {
  const base = `${kind}:${JSON.stringify(payload)}`;
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return `${base}#${n}`;
}

export function collectingEffects(): { effects: Effects; actions: ActionRecord[] } {
  const actions: ActionRecord[] = [];
  const seen = new Map<string, number>();
  return {
    actions,
    effects: {
      async notify(to, message) {
        const payload = { to, message };
        actions.push({ actionId: identify('notify', payload, seen), kind: 'notify', payload, reversible: false });
      },
    },
  };
}

export function releasingEffects(allowed: Set<string>): { effects: Effects; released: string[]; dropped: string[] } {
  const released: string[] = [], dropped: string[] = [];
  const seen = new Map<string, number>();
  return {
    released, dropped,
    effects: {
      async notify(to, message) {
        const payload = { to, message };
        const id = identify('notify', payload, seen);
        if (allowed.has(id)) { released.push(id); console.info('[notify]', to, message); }
        else { dropped.push(id); }
      },
    },
  };
}
