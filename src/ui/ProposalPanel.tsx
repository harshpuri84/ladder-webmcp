import { useEffect, useState } from 'react';
import { onProposal, onResult } from '../webmcp/adapter';
import type { Decision, PendingProposal, ProposalOutcome } from '../webmcp/adapter';
import { store } from '../domain/store';
import { BlastRadius } from './BlastRadius';
import { DiffGroupRow } from './DiffGroupRow';
import { ActionCard } from './ActionCard';
import { ResultCard } from './ResultCard';

const RESULT_HOLD_MS = 8000;

interface Filter {
  customer?: string;
  origin?: string;
  destination?: string;
  status?: string;
}

/** "from Shanghai to Rotterdam" — the lane the agent named, in the words a person would use. */
function where(f: Filter): string {
  const bits: string[] = [];
  if (f.origin && f.destination) bits.push(`from ${f.origin} to ${f.destination}`);
  else if (f.origin) bits.push(`out of ${f.origin}`);
  else if (f.destination) bits.push(`into ${f.destination}`);
  if (f.customer) bits.push(`for ${f.customer}`);
  if (f.status) bits.push(`currently ${f.status}`);
  return bits.join(' ');
}

const scoped = (f: Filter) => {
  const w = where(f);
  return w ? `everything ${w}` : 'everything';
};

/**
 * The ask in plain words. A naked diff makes a judge work out what the agent wanted; one line
 * of intent above the numbers means every figure below it is read against a purpose.
 */
function describeRequest(toolName: string, input: unknown): string {
  const i = (input ?? {}) as Filter & {
    pct?: number; setStatus?: string; setEta?: string; message?: string;
  };
  switch (toolName) {
    case 'reprice_shipments': {
      const pct = i.pct ?? 0;
      const verb = pct < 0 ? 'Cut' : 'Raise';
      return `${verb} prices ${Math.abs(pct)}% on ${scoped(i)}.`;
    }
    case 'update_shipments': {
      const parts: string[] = [];
      if (i.setStatus) parts.push(`status to ${i.setStatus}`);
      if (i.setEta) parts.push(`ETA to ${i.setEta}`);
      if (!parts.length) return `Update ${scoped(i)}.`;
      return `Set ${parts.join(' and ')} on ${scoped(i)}.`;
    }
    case 'cancel_shipments':
      return `Cancel ${scoped(i)}.`;
    case 'notify_customers': {
      const w = where(i);
      const who = w ? `every customer with a shipment ${w}` : 'every customer';
      return `Message ${who}: ‘${i.message ?? ''}’`;
    }
    default:
      return `${toolName} ${JSON.stringify(input ?? {})}`;
  }
}

/** Rows the tool itself left alone, folded to one line per reason. */
function byReason(notes: { id: string; reason: string }[]) {
  const counts = new Map<string, number>();
  for (const n of notes) counts.set(n.reason, (counts.get(n.reason) ?? 0) + 1);
  return [...counts].map(([reason, count]) => ({ reason, count }));
}

function subtitleFor(id: string): string {
  const s = store.state.shipments[id];
  if (!s) return '';
  return `${s.customer} · ${s.origin} → ${s.destination}`;
}

export function ProposalPanel() {
  // A queue, not a slot. The adapter broadcasts each pending proposal to its listeners with no
  // queue of its own, so two tool calls that arrive together each broadcast independently. A
  // single-slot panel would replace the first and orphan its promise, and nothing in the
  // runtime times that promise out — the agent behind it would wait forever.
  const [queue, setQueue] = useState<PendingProposal[]>([]);
  const [outcome, setOutcome] = useState<ProposalOutcome | null>(null);

  const [selectedFor, setSelectedFor] = useState<string | null>(null);
  const [groups, setGroups] = useState<ReadonlySet<string>>(new Set());
  const [actions, setActions] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => onProposal(p => {
    if (p) setQueue(q => (q.includes(p) ? q : [...q, p]));
  }), []);

  useEffect(() => onResult(o => setOutcome(o)), []);

  useEffect(() => {
    if (!outcome) return;
    const t = setTimeout(() => setOutcome(null), RESULT_HOLD_MS);
    return () => clearTimeout(t);
  }, [outcome]);

  const head = queue[0] ?? null;

  // Everything the agent asked for starts ticked: narrowing is the human act, and starting
  // from nothing would make "Apply 0 of 47" the resting state.
  if (head && head.diff.proposalId !== selectedFor) {
    setSelectedFor(head.diff.proposalId);
    setGroups(new Set(head.diff.groups.map(g => g.group)));
    setActions(new Set(head.diff.actions.map(a => a.actionId)));
  }

  const resultCard = outcome && (
    <ResultCard outcome={outcome} shifted={Boolean(head)} onDismiss={() => setOutcome(null)} />
  );

  if (!head) return resultCard;

  const { diff, notes } = head;
  const selectedGroups = diff.groups.filter(g => groups.has(g.group));
  const selectedActions = diff.actions.filter(a => actions.has(a.actionId));
  const valueDelta = selectedGroups.reduce((n, g) => n + g.valueDelta, 0);
  const waiting = queue.length - 1;
  const nothingPicked = selectedGroups.length === 0 && selectedActions.length === 0;

  const toggle = (set: ReadonlySet<string>, key: string) => {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
  };

  const decide = (d: Decision | null) => {
    head.resolve(d);
    setQueue(q => q.slice(1));
  };

  return (
    <>
      <div className="pp-scrim" />
      <aside
        className="pp"
        key={diff.proposalId}
        role="dialog"
        aria-modal="true"
        aria-label="Review this change"
      >
        <header className="pp-head">
          <div className="pp-head-top">
            <span className="pp-tool mono">{head.toolName}</span>
            {waiting > 0 && (
              <span className="pp-waiting">{waiting} more waiting</span>
            )}
          </div>
          <p className="pp-request">“{describeRequest(head.toolName, head.input)}”</p>
        </header>

        <div className="pp-scroll">
          <BlastRadius
            records={selectedGroups.length}
            requested={diff.totals.records}
            datasetSize={Object.keys(store.state.shipments).length}
            valueDelta={valueDelta}
            irreversible={selectedActions.length}
          />

          {notes.length > 0 && (
            <section className="pp-notes">
              <p className="pp-notes-caption">Left alone by the tool, not by Ladder</p>
              {byReason(notes).map(n => (
                <p className="pp-note" key={n.reason}>
                  <span className="mono">{n.count}</span> skipped — {n.reason}
                </p>
              ))}
            </section>
          )}

          <div className="pp-list">
            {diff.groups.map(g => (
              <DiffGroupRow
                key={g.group}
                group={g}
                subtitle={subtitleFor(g.id)}
                checked={groups.has(g.group)}
                onToggle={() => setGroups(s => toggle(s, g.group))}
              />
            ))}
            {diff.actions.map(a => (
              <ActionCard
                key={a.actionId}
                action={a}
                checked={actions.has(a.actionId)}
                onToggle={() => setActions(s => toggle(s, a.actionId))}
              />
            ))}
          </div>
        </div>

        <footer className="pp-foot">
          <button
            className="pp-apply"
            type="button"
            disabled={nothingPicked}
            onClick={() => decide({ groups: [...groups], actions: [...actions] })}
          >
            {/* The label counts, so narrowing is legible without reading anything else. */}
            <span className="pp-apply-label">
              {diff.totals.records === 0 && diff.actions.length > 0
                ? `Release ${selectedActions.length} of ${diff.actions.length}`
                : `Apply ${selectedGroups.length} of ${diff.totals.records}`}
            </span>
            {selectedActions.length > 0 && (
              <span className="pp-apply-sub">
                {diff.totals.records === 0
                  ? selectedActions.length === 1 ? 'held action' : 'held actions'
                  : `and release ${selectedActions.length} ${
                      selectedActions.length === 1 ? 'held action' : 'held actions'
                    }`}
              </span>
            )}
          </button>
          <button className="pp-refuse" type="button" onClick={() => decide(null)}>
            Refuse all
          </button>
        </footer>
      </aside>
      {resultCard}
    </>
  );
}
