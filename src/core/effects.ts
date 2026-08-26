import type { ActionRecord } from './types';

export interface Effects { notify(to: string, message: string): Promise<void>; }

export function collectingEffects(): { effects: Effects; actions: ActionRecord[] } {
  const actions: ActionRecord[] = [];
  return {
    actions,
    effects: {
      async notify(to, message) {
        actions.push({ actionId: `act-${actions.length + 1}`, kind: 'notify',
                       payload: { to, message }, reversible: false });
      },
    },
  };
}

export function releasingEffects(allowed: Set<string>): { effects: Effects; released: string[]; dropped: string[] } {
  const released: string[] = [], dropped: string[] = [];
  let n = 0;
  return {
    released, dropped,
    effects: {
      async notify(to, message) {
        const id = `act-${++n}`;
        if (allowed.has(id)) { released.push(id); console.info('[notify]', to, message); }
        else { dropped.push(id); }
      },
    },
  };
}
