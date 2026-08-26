import { useState, useSyncExternalStore } from 'react';
import { store } from '../domain/store';

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

export function Console() {
  // Subscribed for the re-render only: the snapshot is a counter, because the state object
  // is mutated in place and never changes identity. Memoising the rows against a mutable
  // store is what made this table go stale after a commit, so the filter runs each render.
  useSyncExternalStore(subscribe, getSnapshot);
  const [filter, setFilter] = useState('');

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
      <table className="console-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Lane</th>
            <th>Status</th>
            <th>Price</th>
            <th>ETA</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map(s => (
            <tr key={s.id}>
              <td className="mono">{s.id}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
