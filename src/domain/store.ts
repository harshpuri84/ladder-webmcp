import type { AppState } from './types';
import { seedShipments } from './seed';

type Listener = () => void;

export interface Store {
  state: AppState;
  /**
   * State is mutated in place, so `state` is the same object forever and a snapshot of it can
   * never signal a change — useSyncExternalStore compares snapshots and would bail out of
   * every re-render. This counter is the snapshot instead.
   */
  readonly version: number;
  subscribe(fn: Listener): () => void;
  notify(): void;
}

export function createStore(): Store {
  const listeners = new Set<Listener>();
  const state: AppState = { shipments: seedShipments(200) };
  let version = 0;
  return {
    state,
    get version() { return version; },
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    notify() { version += 1; listeners.forEach(fn => fn()); },
  };
}

export const store = createStore();
