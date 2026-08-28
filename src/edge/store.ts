import type { EdgeState } from './types';
import { seedPops, seedReleases } from './seed';
import type { WriteRecord } from '../core/types';
import { configureHost, type HostBinding } from '../webmcp/adapter';
import { NEVER_ELIGIBLE } from './policy-eligibility';
import { edgeAuthority } from './authority';

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
   * Nothing in this domain carries money, and the boundary does not need it to. The figure that
   * bounds a decision here is `exposedPct`: the share of *production* traffic this rollout puts
   * in front of an unproven release at this one site. It is what the standing rule's cap is
   * measured against, what the drawer's meter shows, and what the authority limit bites on.
   *
   * Every other field a rollout writes — the pending version, the mode, the convergence time,
   * the blocked-mode list — moves no traffic on its own and is worth zero here.
   */
  valueDeltaOf: (w: WriteRecord) =>
    w.field === 'exposedPct' ? (w.after as number) - (w.before as number) : 0,
  neverEligible: NEVER_ELIGIBLE,
  // `ids` is this application's own way of narrowing a call to named sites — the only argument
  // that names records outright rather than describing a set. The adapter asks this question of
  // every host and learns nothing about the field from either answer.
  targetedIds: (input: unknown) => {
    const ids = (input as { ids?: unknown } | null | undefined)?.ids;
    return Array.isArray(ids) && ids.every(x => typeof x === 'string') ? (ids as string[]) : null;
  },
  // The roles, the unit and the word for one record. See ./authority.ts.
  authority: edgeAuthority,
};

configureHost(edgeHost);
