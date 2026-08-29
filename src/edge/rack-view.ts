/**
 * What the rack is drawing, when an agent's read set it.
 *
 * The freight console has the same idea and its own copy of it (`domain/register-view.ts`), and
 * the duplication is the point rather than an oversight: the two products share the engine and
 * the guard and nothing else, and a shared "what is on screen" module would be the first thing
 * in this repository that made them one product. Neither file knows the other exists.
 *
 * Nothing here is a site, nothing here has a version, and nothing here is anything the commit
 * guard has an opinion about. A site the rack stops drawing is still in the estate, still
 * carrying its traffic, still counted by its region band — which goes on counting against the
 * region, never against the view.
 */

/** The sites one read tool asked the engineer to look at, and what to say about it. */
export interface RackView {
  /** The tool that set it, printed to the engineer as the agent's own name for what it did. */
  toolName: string;
  /** The site codes the call matched, in the order the tool returned them. The rack intersects
   *  with this rather than re-running the filter, so what is drawn is exactly what the agent was
   *  handed back and the two cannot drift into disagreeing about the same call. */
  ids: string[];
  /** The filter in the trade's own words, not the agent's arguments — "canary sites in eu-west",
   *  not `{"region":"eu-west","canary":true}`. */
  words: string;
}

let view: RackView | null = null;
let version = 0;
const listeners = new Set<() => void>();

export function rackView(): RackView | null {
  return view;
}

/** The snapshot for `useSyncExternalStore`. A counter, not the view itself: `setRackView` writes
 *  a fresh object every call, so the object would compare unequal on every render. */
export function rackViewVersion(): number {
  return version;
}

export function onRackViewChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function setRackView(next: RackView): void {
  view = next;
  version += 1;
  listeners.forEach(fn => fn());
}

/** The engineer taking their rack back. Also the reset a suite needs — the cell above outlives a
 *  mount on purpose, and a test file is many page loads in one module registry. */
export function clearRackView(): void {
  if (view === null) return;
  view = null;
  version += 1;
  listeners.forEach(fn => fn());
}
