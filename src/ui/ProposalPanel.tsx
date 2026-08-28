import { useEffect, useRef, useState } from 'react';
import { onProposal, onResult } from '../webmcp/adapter';
import type { Decision, PendingProposal, ProposalOutcome } from '../webmcp/adapter';
import { store } from '../domain/store';
import type { CustomsStatus, RemedyId, ScreeningStatus, SlaTier } from '../domain/types';
import { BlastRadius } from './BlastRadius';
import { DiffGroupRow } from './DiffGroupRow';
import { RemedySummary } from './RemedySummary';
import { ActionCard } from './ActionCard';
import { ResultCard } from './ResultCard';
import { ProofMark, RegistrationCorners } from './ProofMark';
import { readProofRow, summariseRemedies } from './remedy-diff';
import { money, remedyFull } from './remedy-words';

// 8s read back as "already fading" from a paused frame two seconds in — that turned out to be
// an opaque-background bug on the auto-apply tone (see .rc--auto in styles.css), not the hold
// itself, but the hold is lengthened anyway so a demo video has real margin either way.
const RESULT_HOLD_MS = 12000;

/** Every field propose_remedy and notify_customers accept as a filter, in the agent's words. */
interface Filter {
  ids?: string[];
  customer?: string;
  consol?: string;
  slaTier?: SlaTier;
  lithiumBattery?: boolean;
  activeTempControl?: boolean;
  pharmaQualifiedLane?: boolean;
  oversizeMainDeckOnly?: boolean;
  screeningStatus?: ScreeningStatus;
  customsStatus?: CustomsStatus;
}

/**
 * "on CONSOL-A for Ashgrove Pharma carrying lithium-ion batteries" — the slice of the cancelled
 * flight the agent named, in the words a person would use rather than as a filter object.
 */
function where(f: Filter): string {
  const bits: string[] = [];
  if (f.ids?.length) bits.push(`${f.ids.length === 1 ? 'one shipment' : `${f.ids.length} shipments`} by id`);
  if (f.consol) bits.push(`on ${f.consol}`);
  if (f.customer) bits.push(`for ${f.customer}`);
  if (f.slaTier) bits.push(`on the ${f.slaTier} tier`);
  if (f.lithiumBattery) bits.push('carrying lithium-ion batteries');
  if (f.oversizeMainDeckOnly) bits.push('built for a main deck');
  if (f.pharmaQualifiedLane) bits.push('on a pharma-qualified lane');
  if (f.activeTempControl) bits.push('in an active temperature-controlled container');
  if (f.screeningStatus === 'pending') bits.push('not yet screened to passenger standard');
  if (f.customsStatus === 'held') bits.push('still held by customs');
  return bits.join(' ');
}

const scoped = (f: Filter) => {
  const w = where(f);
  return w ? `everything ${w}` : 'every shipment on the cancelled flight';
};

/**
 * The ask in plain words. A naked diff makes a judge work out what the agent wanted; one line
 * of intent above the numbers means every figure below it is read against a purpose.
 */
function describeRequest(toolName: string, input: unknown): string {
  const i = (input ?? {}) as Filter & { remedy?: RemedyId; message?: string };
  switch (toolName) {
    case 'propose_remedy': {
      if (i.remedy) {
        return `Put ${scoped(i)} on ${remedyFull(i.remedy).toLowerCase()}, wherever no rule blocks it.`;
      }
      return `Find the cheapest remedy still open to ${scoped(i)}.`;
    }
    case 'notify_customers': {
      const w = where(i);
      const who = w ? `every customer with a shipment ${w}` : 'every customer on the cancelled flight';
      return `Message ${who}: ‘${i.message ?? ''}’`;
    }
    default:
      return `${toolName} ${JSON.stringify(input ?? {})}`;
  }
}

/**
 * How many shipment ids a skip line names before it stops. A skip is something the operator has
 * to go and do by hand — a shipment with no remedy left needs escalating tonight, by a person —
 * so the ids are worth the room. Past a handful they stop being a to-do list and become a wall,
 * and the count plus the receipt's own `ids` array carry the rest.
 */
const NAMED_SKIPS = 6;

/** Rows the tool itself left alone, folded to one line per reason, each naming its shipments. */
function byReason(notes: { id: string; reason: string }[]) {
  const byText = new Map<string, string[]>();
  for (const n of notes) byText.set(n.reason, [...(byText.get(n.reason) ?? []), n.id]);
  return [...byText].map(([reason, ids]) => ({ reason, count: ids.length, ids }));
}

const tierWord: Record<SlaTier, string> = {
  premium: 'premium SLA',
  standard: 'standard SLA',
  basic: 'basic SLA',
};

/** Who this house shipment belongs to, which consol it rode, and when it was promised. */
function subtitleFor(id: string): string {
  const s = store.state.shipments[id];
  if (!s) return '';
  return `${s.customer} · ${s.consol} · ${tierWord[s.slaTier]} · promised ${s.promisedDelivery}`;
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
  // from nothing would make "Apply 0 of 47" the resting state. Everything except the rows this
  // operator has no authority over — those were never theirs to start ticked or to untick.
  if (head && head.diff.proposalId !== selectedFor) {
    const cannot = new Set(head.authority.referred);
    setSelectedFor(head.diff.proposalId);
    setGroups(new Set(head.diff.groups.map(g => g.group).filter(g => !cannot.has(g))));
    setActions(new Set(head.diff.actions.map(a => a.actionId)));
  }

  const resultCard = outcome && (
    <ResultCard outcome={outcome} shifted={Boolean(head)} onDismiss={() => setOutcome(null)} />
  );

  if (!head) return resultCard;

  const { diff, notes, authority } = head;
  // The two halves of the sheet: what this operator can decide, and what a second person has
  // to. Referred rows stay on the sheet — the operator is accountable for the whole recovery
  // and has to see all of it — they are simply not theirs to mark.
  const referredKeys = new Set(authority.referred);
  const authorisable = diff.groups.filter(g => !referredKeys.has(g.group));
  const referredGroups = diff.groups.filter(g => referredKeys.has(g.group));
  const referredSpend = referredGroups.reduce((n, g) => n + g.valueDelta, 0);
  const referredTo = { limitEur: authority.role.limit, role: authority.target?.label ?? 'second approver' };
  const selectedGroups = diff.groups.filter(g => groups.has(g.group));
  const selectedActions = diff.actions.filter(a => actions.has(a.actionId));
  const valueDelta = selectedGroups.reduce((n, g) => n + g.valueDelta, 0);
  // Read from the whole diff, not the selection, so the figure does not vanish the moment the
  // human unticks the last priced row — that is exactly when the zero is worth seeing. The
  // priced field is the remedy's cost: a run that is entirely free same-carrier rebookings
  // genuinely has nothing to spend, and the money figure stays off rather than shouting zero.
  const touchesPrice = diff.groups.some(g => g.writes.some(w => w.field === 'remedyCost'));

  // The remedy breakdown, read off the same selection the extent above it is read off, so the
  // two never disagree about what is marked.
  const selectedRows = selectedGroups.map(g => readProofRow(g, store.state.shipments[g.id]));
  const { lines: remedyLines, constrained } = summariseRemedies(selectedRows);
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
    selectedGroups.length === authorisable.length &&
    selectedActions.length === diff.actions.length;
  // A sheet where every row is above this operator's limit still has to be stampable: sending
  // it on is the act. Left disabled, the boundary would look like a dead end rather than a
  // handover — and the freight would sit in Frankfurt while the panel said "nothing marked".
  const onlyReferral = nothingPicked && referredGroups.length > 0;
  const grade = onlyReferral ? 'Refer'
    : nothingPicked ? 'Nothing marked'
    : whole ? 'OK to run'
    : 'OK with changes';

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

          <RemedySummary
            lines={remedyLines}
            constrained={constrained}
            total={selectedGroups.length}
          />

          {referredGroups.length > 0 && (
            <section className="pp-refer">
              <p className="pp-refer-caption">
                <ProofMark name="query" size={13} />
                <span className="pp-refer-caption-caps">Not yours to authorise</span>
                <span className="pp-refer-caption-tail"> — referred, not refused</span>
              </p>
              <p className="pp-refer-line">
                <span className="mono">{referredGroups.length}</span>{' '}
                {referredGroups.length === 1 ? 'shipment costs' : 'shipments cost'} more than
                your EUR <span className="mono">{authority.role.limit}</span> limit
                {referredSpend > 0 && (
                  <> — <span className="mono">{money(referredSpend)}</span> in total</>
                )}
                . {authority.target
                  ? `Applying will send ${referredGroups.length === 1 ? 'it' : 'them'} to a ${authority.target.label.toLowerCase()}, who decides ${referredGroups.length === 1 ? 'it' : 'them'} separately.`
                  : 'There is nobody above you to refer them to.'}
              </p>
              <p className="pp-refer-ids mono">
                {referredGroups.slice(0, NAMED_SKIPS).map(g => g.id).join(', ')}
                {referredGroups.length > NAMED_SKIPS &&
                  ` and ${referredGroups.length - NAMED_SKIPS} more`}
              </p>
            </section>
          )}

          {notes.length > 0 && (
            <section className="pp-notes">
              <p className="pp-notes-caption">
                <ProofMark name="dele" size={13} />
                <span className="pp-notes-caption-caps">Left alone by the tool</span>
                <span className="pp-notes-caption-tail"> — not by Ladder</span>
              </p>
              {byReason(notes).map(n => (
                <div className="pp-note" key={n.reason}>
                  <p className="pp-note-line">
                    <span className="mono">{n.count}</span> skipped — {n.reason}
                  </p>
                  {/* Named, not just counted. A shipment nobody can help is a real outcome and
                      the operator has to know which one it is to go and do something about it. */}
                  <p className="pp-note-ids mono">
                    {n.ids.slice(0, NAMED_SKIPS).join(', ')}
                    {n.ids.length > NAMED_SKIPS && ` and ${n.ids.length - NAMED_SKIPS} more`}
                  </p>
                </div>
              ))}
            </section>
          )}

          <div className="pp-list">
            {diff.groups.map(g => (
              <DiffGroupRow
                key={g.group}
                group={g}
                record={store.state.shipments[g.id]}
                subtitle={subtitleFor(g.id)}
                checked={groups.has(g.group)}
                referredTo={referredKeys.has(g.group) ? referredTo : undefined}
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
            disabled={(nothingPicked && !onlyReferral) || decided}
            onClick={() => decide({ groups: [...groups], actions: [...actions] })}
          >
            <span className="pp-stamp-grade">{grade}</span>
            <span className="pp-stamp-label">
              {/* Counted against what this operator can authorise, not against the whole
                  sheet: "Apply 23 of 27" with four rows referred would read as four rows they
                  struck out, which is the one thing they did not do. */}
              {diff.totals.records === 0 && diff.actions.length > 0
                ? `Release ${selectedActions.length} of ${diff.actions.length}`
                : authorisable.length === 0 && referredGroups.length > 0
                ? `Refer ${referredGroups.length} of ${referredGroups.length}`
                : `Apply ${selectedGroups.length} of ${authorisable.length}`}
            </span>
            {referredGroups.length > 0 && authorisable.length > 0 && (
              <span className="pp-stamp-sub">
                and refer {referredGroups.length}{' '}
                {referredGroups.length === 1 ? 'shipment' : 'shipments'}
              </span>
            )}
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
