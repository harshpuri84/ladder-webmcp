import { useEffect, useState } from 'react';
import { onResult } from '../../webmcp/adapter';

interface Entry { id: number; at: string; text: string; }

/** The strip along the bottom of the rack: every run this session, newest first, one line each.
 *  It catches results a drawer never showed — a standing rule firing, a call with nothing to
 *  decide — which would otherwise happen with no trace on the panel at all. */
export function EventLog() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => onResult(o => {
    const at = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const text =
      `${o.toolName} · ${o.payload.applied} of ${o.payload.requested} applied` +
      (o.payload.actions_released > 0 ? ` · ${o.payload.actions_released} paged` : '') +
      (o.cause === 'auto_applied' ? ' · under the standing rule' : '');
    setEntries(list => [{ id: list.length, at, text }, ...list].slice(0, 4));
  }), []);

  return (
    <div className="log">
      <span className="lg log-line--head">Run log</span>
      {entries.length === 0
        ? <span className="log-empty">No tool call this session yet</span>
        : entries.map(e => (
            <span className="log-line rd" key={e.id}>{e.at}&nbsp; {e.text}</span>
          ))}
    </div>
  );
}
