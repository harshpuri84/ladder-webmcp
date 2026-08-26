import { useEffect, useState } from 'react';
import { onResult } from '../webmcp/adapter';
import type { ProposalOutcome } from '../webmcp/adapter';

let seq = 0;

interface ActivityEntry {
  key: number;
  toolName: string;
  requested: number;
  applied: number;
  refused: number;
  cause: ProposalOutcome['cause'];
  at: number;
}

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function toEntry(o: ProposalOutcome): ActivityEntry {
  return {
    key: ++seq,
    toolName: o.toolName,
    requested: o.payload.requested,
    applied: o.payload.applied,
    refused: o.payload.rejected.reduce((n, r) => n + r.count, 0),
    cause: o.cause,
    at: Date.now(),
  };
}

/**
 * Every outcome onResult publishes, newest first, one line each. Deliberately thin: no
 * filters, no detail view, no export — the receipt card already tells the full story for the
 * proposal in front of you, this is only for seeing the run of them.
 */
export function ActivityList() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => onResult(o => setEntries(list => [toEntry(o), ...list])), []);

  return (
    <aside className="al" aria-label="Activity">
      <p className="al-heading">Activity</p>
      {entries.length === 0 ? (
        <p className="al-empty">Nothing yet.</p>
      ) : (
        <ul className="al-list">
          {entries.map(e => (
            <li key={e.key} className={`al-row al-row--${e.cause}`}>
              <div className="al-row-top">
                <span className="al-tool mono">{e.toolName}</span>
                <span className="al-outcome">{e.cause.replace(/_/g, ' ')}</span>
              </div>
              <div className="al-row-figures mono">
                <span>{e.requested} req</span>
                <span>{e.applied} applied</span>
                <span>{e.refused} refused</span>
              </div>
              <span className="al-time mono">{timeFmt.format(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
