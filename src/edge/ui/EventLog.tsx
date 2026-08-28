import { useEffect, useState } from 'react';
import { onResult } from '../../webmcp/adapter';

interface Entry { id: number; at: string; text: string; }

/** The strip along the bottom of the rack: every run this session, newest first, one line each.
 *  It catches results a drawer never showed — a standing rule firing, a call with nothing to
 *  decide — which would otherwise happen with no trace on the panel at all.
 *
 *  This is the first thing on the panel that moves when a call lands, so its empty line says what
 *  will appear rather than only that nothing has. "No tool call this session yet" reported the
 *  emptiness and taught nothing; a judge who has not yet worked out that this instrument is
 *  driven by an agent learned nothing from the one slot best placed to tell them. */
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
        ? <span className="log-empty">
            Empty until an agent calls a tool. Each run prints here: the tool, sites applied of
            sites requested, and any rotation it paged.
          </span>
        : entries.map(e => (
            <span className="log-line rd" key={e.id}>{e.at}&nbsp; {e.text}</span>
          ))}
    </div>
  );
}
