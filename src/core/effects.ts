import type { ActionRecord } from './types';

export interface Effects { notify(to: string, message: string): Promise<void>; }

export type SendFn = (kind: string, payload: Record<string, unknown>) => void;

const defaultSend: SendFn = (kind, payload) => console.info(`[${kind}]`, payload);

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

export function releasingEffects(allowed: Set<string>, send: SendFn = defaultSend): {
  effects: Effects; released: string[]; dropped: string[]; flush(): void;
} {
  const released: string[] = [], dropped: string[] = [];
  const pending: { kind: string; payload: Record<string, unknown> }[] = [];
  const seen = new Map<string, number>();
  return {
    released, dropped,
    flush() { for (const p of pending) send(p.kind, p.payload); pending.length = 0; },
    effects: {
      async notify(to, message) {
        const payload = { to, message };
        const id = identify('notify', payload, seen);
        if (allowed.has(id)) { released.push(id); pending.push({ kind: 'notify', payload }); }
        else { dropped.push(id); }
      },
    },
  };
}
