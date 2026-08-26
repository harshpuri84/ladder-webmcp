import { useState, useSyncExternalStore } from 'react';
import { store } from '../domain/store';
import { setBuggyToolEnabled } from '../domain/tools';

const priceFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function subscribe(onStoreChange: () => void) {
  return store.subscribe(onStoreChange);
}

function getSnapshot() {
  return store.version;
}

/**
 * The "Edit a row" beat: a stand-in for another operator or another system touching this exact
 * record while an agent's proposal on it is still open. It writes directly to the live store —
 * not through a tool, not through Ladder at all — and bumps `version`, the same field the
 * commit-time guard checks. Any pending commit that still expects the old version aborts as
 * stale rather than applying against a world that already moved.
 */
function editRowExternally(id: string) {
  const s = store.state.shipments[id];
  if (!s) return;
  s.version += 1;
  s.price += 25;
  store.notify();
}

export function Console() {
  // Subscribed for the re-render only: the snapshot is a counter, because the state object
  // is mutated in place and never changes identity. Memoising the rows against a mutable
  // store is what made this table go stale after a commit, so the filter runs each render.
  useSyncExternalStore(subscribe, getSnapshot);
  const [filter, setFilter] = useState('');
  const [buggyTool, setBuggyTool] = useState(false);

  const toggleBuggyTool = (on: boolean) => {
    setBuggyTool(on);
    setBuggyToolEnabled(on);
  };

  const all = Object.values(store.state.shipments);
  const q = filter.trim().toLowerCase();
  const shipments = q
    ? all.filter(
        s =>
          s.customer.toLowerCase().includes(q) ||
          s.origin.toLowerCase().includes(q) ||
          s.destination.toLowerCase().includes(q),
      )
    : all;

  return (
    <div className="console">
      <div className="console-toolbar">
        <input
          className="console-filter"
          type="text"
          placeholder="Filter by customer or lane…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <span className="console-count">
          {shipments.length} of {Object.keys(store.state.shipments).length} shipments
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
          Makes <code>update_shipments</code> write a field at commit time that the preview
          never showed, so you can watch Ladder's guard stop it. A deliberate demonstration,
          not a real bug.
        </p>
      </div>
      <table className="console-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Lane</th>
            <th>Status</th>
            <th>Price</th>
            <th>ETA</th>
            <th>External edit</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map(s => (
            <tr key={s.id}>
              <td className="mono">
                {s.id}
                <span className="console-version">v{s.version}</span>
              </td>
              <td>{s.customer}</td>
              <td>
                {s.origin} → {s.destination}
              </td>
              <td>
                {s.status}
                {s.customsHold && <span className="badge">Customs hold</span>}
              </td>
              <td className="mono">{priceFormatter.format(s.price)}</td>
              <td className="mono">{s.eta}</td>
              <td>
                <button
                  className="console-edit-row"
                  type="button"
                  title="Simulates another operator or system changing this record outside any agent proposal."
                  onClick={() => editRowExternally(s.id)}
                >
                  Edit a row
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
