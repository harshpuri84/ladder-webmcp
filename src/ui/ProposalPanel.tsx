import { useEffect, useRef, useState } from 'react';
import { onProposal, onResult } from '../webmcp/adapter';
import type { Decision, PendingProposal, ProposalOutcome } from '../webmcp/adapter';
import { store } from '../domain/store';
import { BlastRadius } from './BlastRadius';
import { DiffGroupRow } from './DiffGroupRow';
import { ActionCard } from './ActionCard';
import { ResultCard } from './ResultCard';
import { ProofMark, RegistrationCorners } from './ProofMark';

// 8s read back as "already fading" from a paused frame two seconds in — that turned out to be
// an opaque-background bug on the auto-apply tone (see .rc--auto in styles.css), not the hold
// itself, but the hold is lengthened anyway so a demo video has real margin either way.
const RESULT_HOLD_MS = 12000;

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

  // A double-click (or Escape racing a button) fires two decisions before React ever gets to
  // re-render between them — both land in the same batch, both closing over the same `head`.
  // `setQueue(q => q.slice(1))` alone can't tell those two calls apart: applied twice in one
  // batch, it drops two proposals instead of one, and the second's `resolve` is never called —
  // an agent left waiting forever. A ref is the only thing both calls see consistently within
  // that single batch (state reads inside it are still the pre-batch value), so it's what
  // guards against deciding the same head twice.
  const resolvedIds = useRef<Set<string>>(new Set());

  // Shared by the footer buttons and the Escape handler below, so both go through the exact
  // same guard rather than Escape reimplementing decide() and drifting from it.
  const decideOn = (p: PendingProposal, d: Decision | null) => {
    const id = p.diff.proposalId;
    if (resolvedIds.current.has(id)) return;
    resolvedIds.current.add(id);
    p.resolve(d);
    setQueue(q => q.filter(x => x !== p));
  };

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

  // Task 9's "Edit a row" beat needs the console reachable while a decision is pending, but
  // the panel is `position: fixed` over the right side of the viewport and would otherwise sit
  // on top of it. This flag on <body> lets styles.css narrow the console for exactly as long
  // as something is actually on screen. Driven off `head`, not `queue.length` or the raw
  // onProposal events, so a second queued proposal keeps the flag set through the gap between
  // the first one resolving and the next one appearing — the console must not spring back to
  // full width for a frame in between.
  useEffect(() => {
    document.body.classList.toggle('pp-active', Boolean(head));
    return () => { document.body.classList.remove('pp-active'); };
  }, [head]);

  // F11: the panel carries role="dialog" and aria-modal="true", which sets the expectation
  // that Escape closes it. It has to take the same path Refuse does — resolving the proposal
  // with a real decision — rather than a silent dismiss, which would just be F1 again by
  // another route: a proposal vanishing off screen with its promise never settled.
  useEffect(() => {
    if (!head) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') decideOn(head, null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [head]);

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
  // Read from the whole diff, not the selection, so the figure does not vanish the moment the
  // human unticks the last priced row — that is exactly when the zero is worth seeing.
  const touchesPrice = diff.groups.some(g => g.writes.some(w => w.field === 'price'));
  const waiting = queue.length - 1;
  const nothingPicked = selectedGroups.length === 0 && selectedActions.length === 0;

  const toggle = (set: ReadonlySet<string>, key: string) => {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
  };

  // A no-op on an already-resolved head: the second of two decisions dispatched in the same
  // batch (a double-click, or Escape racing a button click) must neither resolve `head` again
  // nor remove a second proposal from the queue.
  const decide = (d: Decision | null) => decideOn(head, d);
  const decided = resolvedIds.current.has(diff.proposalId);

  // The grade the stamp will carry. Everything the agent asked for, or a cut-down subset —
  // the two readings a proof comes back with when it comes back at all.
  const whole =
    selectedGroups.length === diff.totals.records &&
    selectedActions.length === diff.actions.length;
  const grade = nothingPicked ? 'Nothing marked' : whole ? 'OK to run' : 'OK with changes';

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
        <RegistrationCorners />
        <header className="pp-head">
          <div className="pp-head-top">
            <span className="pp-tool mono">{head.toolName}</span>
            {waiting > 0 && (
              <span className="pp-waiting">{waiting} more waiting</span>
            )}
          </div>
          <p className="pp-request">“{describeRequest(head.toolName, head.input)}”</p>
          <p className="pp-slug">
            <span className="pp-slug-caps">Proof for approval</span>
            <span className="pp-slug-tail"> · nothing here has been applied yet</span>
          </p>
          <hr className="rule" />
        </header>

        <div className="pp-scroll">
          <BlastRadius
            records={selectedGroups.length}
            requested={diff.totals.records}
            datasetSize={Object.keys(store.state.shipments).length}
            valueDelta={valueDelta}
            showMoney={touchesPrice}
            irreversible={selectedActions.length}
            actionsOnly={diff.totals.records === 0 && diff.actions.length > 0}
          />

          {notes.length > 0 && (
            <section className="pp-notes">
              <p className="pp-notes-caption">
                <ProofMark name="dele" size={13} />
                <span className="pp-notes-caption-caps">Left alone by the tool</span>
                <span className="pp-notes-caption-tail"> — not by Ladder</span>
              </p>
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

        <hr className="rule" />
        <footer className="pp-foot">
          {/*
            The stamp block. A press proof does not come back yes or no — it comes back graded,
            and the grade is the whole point of this product: the operator cuts a change down
            rather than accepting or rejecting it whole. "OK to run" is everything as asked;
            "OK with changes" is the partial consent the engine was built for.
            The count stays in the label because narrowing has to be legible without reading
            anything else, and it is what the button's accessible name is made of.
          */}
          <button
            className="pp-stamp"
            type="button"
            disabled={nothingPicked || decided}
            onClick={() => decide({ groups: [...groups], actions: [...actions] })}
          >
            <span className="pp-stamp-grade">{grade}</span>
            <span className="pp-stamp-label">
              {diff.totals.records === 0 && diff.actions.length > 0
                ? `Release ${selectedActions.length} of ${diff.actions.length}`
                : `Apply ${selectedGroups.length} of ${diff.totals.records}`}
            </span>
            {selectedActions.length > 0 && (
              <span className="pp-stamp-sub">
                {diff.totals.records === 0
                  ? selectedActions.length === 1 ? 'held action' : 'held actions'
                  : `and release ${selectedActions.length} ${
                      selectedActions.length === 1 ? 'held action' : 'held actions'
                    }`}
              </span>
            )}
          </button>
          <button className="pp-refuse" type="button" disabled={decided} onClick={() => decide(null)}>
            Refuse all
          </button>
          {/* The third grade of the proof tradition, against the control that produces it.
              Hidden from assistive tech so the button keeps its own plain name. */}
          <span className="pp-refuse-grade" aria-hidden="true">Revise</span>
        </footer>
      </aside>
      {resultCard}
    </>
  );
}
