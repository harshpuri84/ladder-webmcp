import { useState, useSyncExternalStore } from 'react';
import { store } from '../domain/store';
import { setBuggyToolEnabled } from '../domain/tools';
import type { Shipment } from '../domain/types';
import { ProofMark } from './ProofMark';
import { remedyCostWords, remedyShort } from './remedy-words';

function subscribe(onStoreChange: () => void) {
  return store.subscribe(onStoreChange);
}

function getSnapshot() {
  return store.version;
}

/**
 * Marta's edit: a stand-in for the other operator on this shift touching this exact record
 * while an agent's proposal on it is still open. She has a name because what a stale abort
 * models is a colleague working the same consol, not a system event, and a receipt that says
 * "the records moved on" describes nobody. It writes directly to the live store — not through
 * a tool, not through Ladder at all — and bumps `version`, the same field the commit-time
 * guard checks. Any pending commit that still expects the old version aborts as stale rather
 * than applying against a world that already moved.
 *
 * The edit itself is a revenue correction, because it has to be a field the register renders
 * (so the change is visible, not just asserted) and a field the remedy proposal does not
 * touch (so nothing about it can be mistaken for the agent's own work).
 */
function editRowExternally(id: string) {
  const s = store.state.shipments[id];
  if (!s) return;
  s.version += 1;
  s.revenueEur += 25;
  store.notify();
}

/**
 * The cargo facts a remedy can founder on, in the order remedy-policy.ts checks them. Each is
 * a plain flag on the record; the constraint layer, not this table, decides what any of them
 * costs a shipment. Naming them here is what lets an operator see the constrained handful in
 * the register before an agent has proposed anything.
 */
function constraintsOn(s: Shipment): string[] {
  const out: string[] = [];
  if (s.lithiumBattery) out.push('Lithium-ion');
  if (s.oversizeMainDeckOnly) out.push('Main deck only');
  if (s.screeningStatus !== 'cleared') out.push('Unscreened');
  if (s.activeTempControl) out.push(`Active temp ${s.tempEnduranceHours}h`);
  if (s.pharmaQualifiedLane) out.push('Pharma lane');
  if (s.customsStatus !== 'released') out.push('Customs held');
  return out;
}

const revenue = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/**
 * The register's two working controls, held at module scope as well as in component state.
 * `ProofPage` — and this table with it — is only rendered while the proof tab is open, so
 * anything kept in component state alone is thrown away the moment a judge leaves for the
 * problem tab to read what a consol is, and is back to empty when they return. Module scope is
 * the same device `ProofPage`'s own `graceElapsedOnce` uses, for the same reason: what these
 * two hold is a page load's worth of memory, not a mount's.
 *
 * The buggy-tool box is the half that could fail in front of a camera. The flag it sets lives
 * at module scope in `domain/tools.ts` and nothing clears it on unmount, so seeding the box
 * from `useState(false)` on the way back in put it visually back to off while `propose_remedy`
 * stayed armed to rewrite an SLA tier at commit time — the one control that explains the beat
 * reading the opposite of what the tool was doing. Seeding from the same cell that wrote the
 * flag is what keeps the two saying the same thing.
 *
 * Deliberately not lifted into `App`: state ownership stays here, where the filtering is, and
 * the alternative — keeping the whole page mounted and hidden behind `.app-tab-offstage` the
 * way `ActivityList` is — would park a 42-row table and a second `<main>` in the DOM of both
 * prose tabs to preserve two scalars.
 */
const session = { filter: '', buggyTool: false };

/** Test-only. The cell above deliberately outlives a mount; a test file is many page loads in
 *  one module registry, so a suite that touches either control has to put it back — including
 *  the domain flag, which is half of the pair this fix exists to keep in agreement. */
export function resetConsoleSession(): void {
  session.filter = '';
  session.buggyTool = false;
  setBuggyToolEnabled(false);
}

export function Console() {
  // Subscribed for the re-render only: the snapshot is a counter, because the state object
  // is mutated in place and never changes identity. Memoising the rows against a mutable
  // store is what made this table go stale after a commit, so the filter runs each render.
  useSyncExternalStore(subscribe, getSnapshot);
  const [filter, setFilterState] = useState(session.filter);
  const [buggyTool, setBuggyTool] = useState(session.buggyTool);

  const setFilter = (value: string) => {
    session.filter = value;
    setFilterState(value);
  };

  const toggleBuggyTool = (on: boolean) => {
    session.buggyTool = on;
    setBuggyTool(on);
    setBuggyToolEnabled(on);
  };

  const all = Object.values(store.state.shipments);
  const q = filter.trim().toLowerCase();
  // F8: receipts and panel notes hand the operator ids ("HAWB-70019 skipped, every remedy
  // blocked") and rule words, so every one of those has to find its row when pasted back in
  // — the id, the customer, the consol, the tier, and the cargo flags exactly as rendered.
  const shipments = q
    ? all.filter(
        s =>
          s.id.toLowerCase().includes(q) ||
          s.customer.toLowerCase().includes(q) ||
          s.consol.toLowerCase().includes(q) ||
          s.slaTier.toLowerCase().includes(q) ||
          s.promisedDelivery.toLowerCase().includes(q) ||
          (s.remedy !== null && remedyShort(s.remedy).toLowerCase().includes(q)) ||
          constraintsOn(s).some(c => c.toLowerCase().includes(q)),
      )
    : all;

  return (
    <div className="console">
      <div className="console-toolbar">
        <input
          className="console-filter"
          type="text"
          placeholder="Filter by customer, consol or cargo…"
          spellCheck={false}
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <span className="console-count">
          {shipments.length} of {Object.keys(store.state.shipments).length} house shipments
        </span>
      </div>
      <div className="console-demo-row">
        <label className="console-buggy-toggle">
          <input
            type="checkbox"
            checked={buggyTool}
            onChange={e => toggleBuggyTool(e.target.checked)}
          />
          Simulate a buggy tool
        </label>
        <p className="console-demo-note">
          Makes <code>propose_remedy</code> rewrite a shipment&rsquo;s SLA tier at commit time —
          a field the proof never showed and you never approved — so you can watch Ladder&rsquo;s
          guard stop it and roll the whole commit back. A deliberate demonstration, not a real
          bug.
        </p>
      </div>
      {/* The register is wider than a phone; it scrolls in its own frame, the page never does. */}
      <div className="console-scroll">
        <table className="console-table">
          <thead>
            <tr>
              <th>House</th>
              <th>Customer</th>
              <th>Consol</th>
              <th>SLA</th>
              <th>Promised</th>
              <th>Revenue</th>
              <th>Cargo</th>
              <th>Remedy</th>
              <th>External edit</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map(s => {
              const constraints = constraintsOn(s);
              return (
                <tr key={s.id}>
                  <td className="mono">
                    {s.id}
                    <span className="console-version">v{s.version}</span>
                  </td>
                  <td>{s.customer}</td>
                  <td className="mono">{s.consol}</td>
                  <td>{s.slaTier}</td>
                  <td className="mono">{s.promisedDelivery}</td>
                  <td className="mono">{revenue.format(s.revenueEur)}</td>
                  <td>
                    {constraints.length === 0 ? (
                      <span className="console-none" aria-label="no cargo constraints">
                        —
                      </span>
                    ) : (
                      constraints.map(c => (
                        // The dagger says "set apart from the run" before the amber does — the
                        // colour is the second reading, never the first.
                        <span className="badge" key={c}>
                          <ProofMark name="dagger" size={11} />
                          {c}
                        </span>
                      ))
                    )}
                  </td>
                  <td>
                    {s.remedy === null ? (
                      <span className="console-none" aria-label="no remedy proposed yet">
                        —
                      </span>
                    ) : (
                      // The caret is the same mark the proof line used when this correction
                      // went in, so a row that took one reads the same in both places.
                      <span className="console-remedy">
                        <ProofMark name="insert" size={12} />
                        {remedyShort(s.remedy)}
                        <span className="console-remedy-cost mono">
                          {remedyCostWords(s.remedyCost)}
                        </span>
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="console-edit-row"
                      type="button"
                      title="Simulates Marta, the other operator on this shift, changing this record outside any agent proposal."
                      onClick={() => editRowExternally(s.id)}
                    >
                      Marta edits this
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
