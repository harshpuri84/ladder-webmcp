import type { AppState } from './types';
import { seedShipments } from './seed';

type Listener = () => void;

export interface Store {
  state: AppState;
  subscribe(fn: Listener): () => void;
  notify(): void;
}

export function createStore(): Store {
  const listeners = new Set<Listener>();
  return {
    state: { shipments: seedShipments(200) },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    notify() { listeners.forEach(fn => fn()); },
  };
}

export const store = createStore();
