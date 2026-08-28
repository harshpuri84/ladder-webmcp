import type { EdgeState } from './types';
import { seedPops, seedReleases } from './seed';
import type { WriteRecord } from '../core/types';
import { configureHost, type HostBinding } from '../webmcp/adapter';
import { NEVER_ELIGIBLE } from './policy-eligibility';

type Listener = () => void;

export interface EdgeStore {
  state: EdgeState;
  /** State is mutated in place, so the state object is the same object forever and a snapshot of
   *  it can never signal a change. This counter is the snapshot instead. */
  readonly version: number;
  subscribe(fn: Listener): () => void;
  notify(): void;
}

export function createEdgeStore(): EdgeStore {
  const listeners = new Set<Listener>();
  const state: EdgeState = { pops: seedPops(), releases: seedReleases() };
  let version = 0;
  return {
    state,
    get version() { return version; },
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    notify() { version += 1; listeners.forEach(fn => fn()); },
  };
}

export const edgeStore = createEdgeStore();

/**
 * Everything this application is, as far as `webmcp/adapter.ts` is concerned — the second host
 * to answer the same five questions, which is the whole claim being tested here. The adapter
 * knows about records, versions and value; it has never heard of a point of presence.
 *
 * The wiring sits beside the store rather than in the entry point because the store is the thing
 * being bound: anything holding this module holds a configured adapter, whether it was reached
 * from `edge.html`'s entry, a panel rendered on its own, or a test.
 */
export const edgeHost: HostBinding<EdgeState> = {
  // A getter, not a captured reference: the store mutates state in place, and reading it fresh
  // keeps that an implementation detail rather than a promise this binding has made for it.
  get state() { return edgeStore.state; },
  notify() { edgeStore.notify(); },
  // Two entities here, unlike the freight host, so the entity argument actually selects. -1 for
  // a record that does not exist, so a commit against a row the preview invented can never match
  // a real version and is refused as stale.
  versionOf: (entity, id) =>
    entity === 'pops' ? (edgeStore.state.pops[id]?.version ?? -1) : (edgeStore.state.releases[id] ? 1 : -1),
  bumpVersion: (entity, id) => {
    if (entity !== 'pops') return;
    const p = edgeStore.state.pops[id];
    if (p) p.version += 1;
  },
  /**
   * Nothing in this domain carries money, so every write moves a value of zero and no row is
   * ever above an operator's spend authority. That is the honest answer here, and it is also the
   * only one the binding can give: `HostBinding` takes a number and the adapter renders it in a
   * fixed unit (see the note in `task-edge-report.md`). Exposure — the share of production
   * traffic a rollout puts in front of an unproven release — is the figure this product would
   * want a standing rule capped against, and it is surfaced in the interface instead.
   */
  valueDeltaOf: (_w: WriteRecord) => 0,
  neverEligible: NEVER_ELIGIBLE,
};

configureHost(edgeHost);
