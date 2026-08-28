import type { AppState } from './types';
import { seedShipments } from './seed';
import type { WriteRecord } from '../core/types';
import { configureHost, type HostBinding } from '../webmcp/adapter';
import { NEVER_ELIGIBLE } from './policy-eligibility';

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
  const state: AppState = { shipments: seedShipments() };
  let version = 0;
  return {
    state,
    get version() { return version; },
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    notify() { version += 1; listeners.forEach(fn => fn()); },
  };
}

export const store = createStore();

/**
 * Everything this application is, as far as `webmcp/adapter.ts` is concerned. The adapter is
 * host-agnostic — it knows about records, versions and value, never about shipments — so the
 * three questions it cannot answer on its own are answered here, once.
 *
 * The wiring lives beside the store rather than in an entry point because the store is the
 * thing being bound: anything holding this module holds a configured adapter, whether it was
 * reached from the app's own entry, a panel rendered on its own, or a test.
 */
export const freightHost: HostBinding<AppState> = {
  // A getter, not a captured reference: the store mutates state in place today (see `version`
  // above for why), and reading it fresh keeps that an implementation detail rather than a
  // promise this binding has quietly made on its behalf.
  get state() { return store.state; },
  notify() { store.notify(); },
  // The entity is ignored because there is only one: every record in this application is a
  // house shipment. -1 for a record that does not exist, so a commit against a row the preview
  // invented can never match a real version and is refused as stale.
  versionOf: (_entity, id) => store.state.shipments[id]?.version ?? -1,
  bumpVersion: (_entity, id) => { const s = store.state.shipments[id]; if (s) s.version += 1; },
  // `remedyCost` is the only field in this domain that carries money. Everything else a remedy
  // writes — the remedy itself, recovered hours — moves no value, so it is worth zero to the
  // spend authority and to a standing rule's cap alike.
  valueDeltaOf: (w: WriteRecord) =>
    w.field === 'remedyCost' ? (w.after as number) - (w.before as number) : 0,
  neverEligible: NEVER_ELIGIBLE,
};

configureHost(freightHost);
