import { useState, useSyncExternalStore } from 'react';
import { store } from '../domain/store';
import { setBuggyToolEnabled } from '../domain/tools';
import {
  clearRegisterView, onRegisterViewChange, registerView, registerViewVersion,
} from '../domain/register-view';
import type { Shipment } from '../domain/types';
import { ProofMark } from './ProofMark';
import { remedyCostWords, remedyShort } from './remedy-words';

function subscribe(onStoreChange: () => void) {
  return store.subscribe(onStoreChange);
}

function getSnapshot() {
  return store.version;
}

function subscribeView(onViewChange: () => void) {
  return onRegisterViewChange(onViewChange);
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
  // Third of the same kind: a view an agent set outlives a mount on purpose too, and a suite
  // that ran one search would otherwise hand the next `it` a register already narrowed.
  clearRegisterView();
}

export function Console() {
  // Subscribed for the re-render only: the snapshot is a counter, because the state object
  // is mutated in place and never changes identity. Memoising the rows against a mutable
  // store is what made this table go stale after a commit, so the filter runs each render.
  useSyncExternalStore(subscribe, getSnapshot);
  // A second subscription rather than a second field on the store's counter: what an agent set
  // the view to is not a record and has no version the commit guard reads, and folding it into
  // `store.version` would have every filtered search look, to anything watching, exactly like a
  // shipment changing.
  useSyncExternalStore(subscribeView, registerViewVersion);
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

  const total = Object.keys(store.state.shipments).length;
  const view = registerView();
  // The agent's narrowing and the operator's filter box are two separate narrowings of the
  // same register, applied in that order, and neither clears the other: an operator who types
  // into the box while a search is on screen is looking *within* what the agent showed them,
  // which is the only reading of those two controls that does not throw one of them away.
  //
  // Intersected against the ids the tool returned rather than re-running the filter here. The
  // line below the toolbar says the agent's search matched these rows; if this recomputed the
  // match, that sentence would be an assertion about a set this table had worked out for
  // itself and could disagree with.
  const onRegister = Object.values(store.state.shipments);
  const all = view ? onRegister.filter(s => view.ids.includes(s.id)) : onRegister;
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
        {/* Counted against the register, never against whatever narrowing is on top of it. An
            agent that could move this denominator could make six rows read as the whole flight. */}
        <span className="console-count">
          {shipments.length} of {total} house shipments
        </span>
      </div>
      {view && (
        // The one thing on this page an agent changed without being asked, said plainly, with
        // the way out beside it. `role="status"` because it is the only change to the register
        // that happens while the operator's hands are still: the filter box and Marta's button
        // are both things they did. The registration mark is the press's alignment target,
        // printed outside the trim and never part of the printed work — the shape already
        // means "this is what you line the sheet up by, not something on the sheet". Amber,
        // not the operator's blue: this narrowing is not their own mark, and the mark and the
        // sentence both say so before any colour does.
        <div className="console-agent-view" role="status">
          <p className="console-agent-view-line">
            <ProofMark name="registration" size={12} />
            <span>
              The agent set this view. <code>{view.toolName}</code> matched{' '}
              {view.ids.length} of {total} rows — {view.words}. Nothing was changed and nothing
              left the register; the rest are still on it.
            </span>
          </p>
          <button
            className="console-agent-view-clear"
            type="button"
            onClick={() => clearRegisterView()}
          >
            Show all {total}
          </button>
        </div>
      )}
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
                    {/* Forty-two of these, and the visible words are the same four on every
                        row on purpose — the note above the register explains who Marta is and
                        a per-row rewording would break that one explanation into forty-two.
                        So the row it belongs to is carried in the accessible name instead,
                        which is the only reading where the four words arrive alone. The
                        visible label stays the leading phrase of that name, so a voice-control
                        user can still say what they can see. */}
                    <button
                      className="console-edit-row"
                      type="button"
                      aria-label={`Marta edits this: ${s.id}`}
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
