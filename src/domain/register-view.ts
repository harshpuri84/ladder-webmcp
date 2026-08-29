/**
 * What the register is drawing, when an agent's read set it.
 *
 * This is the one thing an agent may do to the operator's screen. It is deliberately not part
 * of `store.ts`: nothing here is a record, nothing here has a version, and nothing here is
 * anything the commit guard has an opinion about. A shipment that falls out of this view is
 * still on the register, still in `store.state.shipments`, still countable — the register's own
 * "n of 42 house shipments" line is what keeps saying so, and it goes on reading the full total
 * out of the store rather than out of this. A view is what is drawn; the record is what is.
 *
 * Held at module scope for the same reason `Console`'s filter box is (see the `session` cell
 * there): the register unmounts every time a judge leaves for the problem tab, and a view an
 * agent set should survive that round trip the way the operator's own filter does.
 */

/** The rows one read tool asked the operator to look at, and what to say about it. */
export interface RegisterView {
  /** The tool that set it, printed to the operator as the agent's own name for what it did. */
  toolName: string;
  /** The ids the call matched, in the order the tool returned them. The register intersects
   *  with this rather than re-running the filter, so what is drawn is exactly what the agent
   *  was handed back — the two cannot drift into disagreeing about the same call. */
  ids: string[];
  /** The filter in the operator's words, not the agent's arguments — "lithium-ion cargo",
   *  not `{"lithiumBattery":true}`. */
  words: string;
}

let view: RegisterView | null = null;
let version = 0;
const listeners = new Set<() => void>();

export function registerView(): RegisterView | null {
  return view;
}

/** The snapshot for `useSyncExternalStore`. A counter, not the view itself: `setRegisterView`
 *  writes a fresh object every call, so the object would compare unequal on every render even
 *  when nothing moved. */
export function registerViewVersion(): number {
  return version;
}

export function onRegisterViewChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function setRegisterView(next: RegisterView): void {
  view = next;
  version += 1;
  listeners.forEach(fn => fn());
}

/** The operator taking their view back. Also the reset a suite needs — the cell above outlives
 *  a mount on purpose, and a test file is many page loads in one module registry. */
export function clearRegisterView(): void {
  if (view === null) return;
  view = null;
  version += 1;
  listeners.forEach(fn => fn());
}
