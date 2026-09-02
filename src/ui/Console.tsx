import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { store } from '../domain/store';
import { setBuggyToolEnabled } from '../domain/tools';
import {
  clearRegisterView, onRegisterViewChange, registerView, registerViewVersion,
} from '../domain/register-view';
import type { Shipment } from '../domain/types';
import { ProofMark } from './ProofMark';
import { remedyCostWords, remedyShort } from './remedy-words';
import {
  onProofViewChange, proofView, proofViewVersion, type ProofRow, type ProofRowState,
} from './proof-view';

/**
 * How the register draws a row the open proof sheet touches: the same rule form the row carries
 * on the sheet, down the row's left edge (see `console-row--*` in styles.css), and a word for
 * the reader who cannot see it. A solid rule for a row that is marked, a double rule for one
 * that is referred, the id struck through for one the operator struck. One device on both
 * sides of the gutter, at one weight, so the eye crosses from the sheet to the register on it.
 * Until 2 Sep 2026 each row also carried a glyph in the gutter, a caret or a dagger beside a
 * rule of a second weight: two encodings for one fact.
 */
const ROW_WORD: Record<ProofRowState, string> = {
  marked: 'marked on the open proof',
  struck: 'struck out on the open proof',
  referred: 'referred on the open proof',
};

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

/**
 * The buggy-tool switch, on its own so the walkthrough can print it at the step that uses it
 * rather than above the register. It reads and writes the same `session` cell as the console,
 * so it survives a tab round trip exactly as the filter does.
 */
export function BuggyToolToggle() {
  const [buggyTool, setBuggyTool] = useState(session.buggyTool);

  const toggleBuggyTool = (on: boolean) => {
    session.buggyTool = on;
    setBuggyTool(on);
    setBuggyToolEnabled(on);
  };

  return (
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
        Makes <code>propose_remedy</code> rewrite one shipment&rsquo;s SLA tier at commit time,
        a field the proof never showed. The guard stops it and rolls the whole commit back.
      </p>
    </div>
  );
}

/**
 * What the open sheet proposes for this row, in the row. A marked row carries the caret the
 * sheet's own line carries, a struck row carries the remedy struck through, and a referred row
 * carries the word beside the figure: three readings the strikethrough and the word tell apart
 * before any hue does. Once the sheet closes the cell goes back to what the record holds.
 */
function ProposedRemedy({ state, remedy, cost }: {
  state: ProofRowState; remedy: NonNullable<ProofRow['remedy']>; cost: number;
}) {
  return (
    <span className={`console-remedy console-remedy--${state}`}>
      {state === 'marked' && <ProofMark name="insert" size={12} />}
      <span className="console-remedy-word">{remedyShort(remedy)}</span>
      <span className="console-remedy-cost mono">{remedyCostWords(cost)}</span>
      {state === 'referred' && <span className="console-remedy-note">referred</span>}
    </span>
  );
}

interface ConsoleProps {
  /** The register's imprint: the one-line standing-rules and spend-authority controls, set
   *  into the toolbar beside the filter so nothing stands between the prompt and the rows. */
  imprint?: ReactNode;
}

export function Console({ imprint }: ConsoleProps = {}) {
  // Subscribed for the re-render only: the snapshot is a counter, because the state object
  // is mutated in place and never changes identity. Memoising the rows against a mutable
  // store is what made this table go stale after a commit, so the filter runs each render.
  useSyncExternalStore(subscribe, getSnapshot);
  // A second subscription rather than a second field on the store's counter: what an agent set
  // the view to is not a record and has no version the commit guard reads, and folding it into
  // `store.version` would have every filtered search look, to anything watching, exactly like a
  // shipment changing.
  useSyncExternalStore(subscribeView, registerViewVersion);
  // The open proof sheet's reading of each row, published by the panel (see proof-view.ts).
  useSyncExternalStore(onProofViewChange, proofViewVersion);
  const proof = proofView();
  const [filter, setFilterState] = useState(session.filter);

  const setFilter = (value: string) => {
    session.filter = value;
    setFilterState(value);
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

  // A column that is empty on every row is not a column yet. Until a remedy has landed on any
  // row, or the open sheet proposes one, there is nothing to compare down it, so it is not
  // printed; the operator sees it appear when the first proof opens, which is also the moment
  // it starts carrying information, and it stays once a remedy has landed.
  const anyProposed = Boolean(proof && [...proof.rows.values()].some(r => r.remedy !== null));
  const anyRemedy = anyProposed || onRegister.some(s => s.remedy !== null);

  return (
    <div className="console">
      <div className="console-toolbar">
        <input
          className="console-filter"
          type="text"
          placeholder="Filter by id or customer"
          spellCheck={false}
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        {/* Counted against the register, never against whatever narrowing is on top of it. An
            agent that could move this denominator could make six rows read as the whole flight.
            Unnarrowed, it says so in a word rather than as a figure over itself. */}
        <span className="console-count">
          {shipments.length === total
            ? `All ${total} house shipments`
            : `${shipments.length} of ${total} house shipments`}
        </span>
        {/* `display: contents`, so the lines and whatever they open are laid out by the
            toolbar itself: a line sits on the filter's row and an opened block takes a row of
            its own under it. */}
        {imprint && <div className="console-imprint">{imprint}</div>}
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
              {view.ids.length} of {total} rows, {view.words}. Nothing was changed and nothing
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
              <th className="console-num">Revenue</th>
              <th>Cargo</th>
              {anyRemedy && <th>Remedy</th>}
              {/* Marta's control rides here, drawn only on the row that is pointed at, so the
                  cell stays where a decision can reach it however many columns the register
                  sheds beside the panel. No heading: a column whose every cell is the same
                  hidden control is not a column the operator reads. */}
              <th className="console-edit-cell" aria-label="External edit" />
            </tr>
          </thead>
          <tbody>
            {shipments.map(s => {
              const constraints = constraintsOn(s);
              // Marta's control rides at the right edge of the row's last cell and is drawn
              // only when the row is pointed at or the control itself has focus: forty-two
              // identical buttons in a column of their own said nothing forty-one times. It
              // stays in the tab order throughout, and stands always on a device with no
              // pointer. The visible words are the same four on every row on purpose, so the
              // row it belongs to is carried in the accessible name, with the visible label as
              // the leading phrase so a voice-control user can still say what they see.
              const martaButton = (
                <button
                  className="console-edit-row"
                  type="button"
                  aria-label={`Marta edits this: ${s.id}`}
                  title="Simulates Marta, the other operator on this shift, changing this record outside any agent proposal."
                  onClick={() => editRowExternally(s.id)}
                >
                  Marta edits this
                </button>
              );
              const row = proof?.rows.get(s.id) ?? null;
              const state = row?.state ?? null;
              return (
                <tr key={s.id} className={state ? `console-row--${state}` : undefined}>
                  <td className="mono console-house">
                    {/* What the open sheet says about this row, on the row: the rule down the
                        row's left edge (see styles.css), and the word for a reader who cannot
                        see it. The hue only agrees. */}
                    {state && (
                      <span className="console-row-mark vh">{ROW_WORD[state]}</span>
                    )}
                    {s.id}
                    {/* Printed only once a record has moved on from its first version: on
                        forty-two first versions the same two characters said nothing. */}
                    {s.version > 1 && <span className="console-version">v{s.version}</span>}
                  </td>
                  <td>{s.customer}</td>
                  <td className="mono">{s.consol}</td>
                  <td>{s.slaTier}</td>
                  <td className="mono">{s.promisedDelivery}</td>
                  <td className="mono console-num">{revenue.format(s.revenueEur)}</td>
                  <td>
                    {constraints.length === 0 ? (
                      <span className="console-none" aria-label="no cargo constraints">
                        —
                      </span>
                    ) : (
                      constraints.map(c => (
                        // A ruled chip in tracked capitals: the form says "flagged" before the
                        // amber does. No dagger: on this product the dagger means a row referred
                        // to a second person, and a cargo constraint is not that.
                        <span className="badge" key={c}>{c}</span>
                      ))
                    )}
                  </td>
                  {anyRemedy && (
                    <td>
                      {row?.remedy ? (
                        <ProposedRemedy state={row.state} remedy={row.remedy} cost={row.cost} />
                      ) : s.remedy === null ? (
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
                  )}
                  <td className="console-edit-cell">{martaButton}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
