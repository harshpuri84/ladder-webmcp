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
import { ProofMark } from './ProofMark';
import { readProofRow, summariseRemedies } from './remedy-diff';
import { TABPANEL_ID } from './TabBar';
import { money, remedyFull } from './remedy-words';
import { followUpTail, followUpTime } from './follow-up-words';
import { setProofView, type ProofRow } from './proof-view';

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

/**
 * A named list of ids is a *subject*, not a modifier, so it cannot sit behind "everything" the
 * way the other clauses do — that read "everything 4 shipments by id". It matters more than
 * grammar usually would: a narrowed follow-up is exactly the call an agent makes after a
 * refusal, so this is the line above the figures in the one frame that shows the loop closing.
 */
const scoped = (f: Filter) => {
  const w = where(f);
  if (f.ids?.length) {
    const head = f.ids.length === 1 ? 'one shipment, by id' : `${f.ids.length} shipments, by id`;
    return w ? `${head}, ${w}` : head;
  }
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

/**
 * How many rows the landing specimen prints before it stops on a row boundary and says how
 * many are below. The specimen has no scroll: it is a sheet in the page, read once, so it ends
 * where a printed page would end rather than mid-line under a footer.
 */
const SPECIMEN_ROWS = 1;

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

/** Who this house shipment belongs to, which consol it rode, and when it was promised. A
 *  referred row already names the customer on its one line, so its subtitle starts at the consol. */
function subtitleFor(id: string, withCustomer = true): string {
  const s = store.state.shipments[id];
  if (!s) return '';
  const rest = `${s.consol} · ${tierWord[s.slaTier]} · promised ${s.promisedDelivery}`;
  return withCustomer ? `${s.customer} · ${rest}` : rest;
}

/**
 * `specimen`: render one proposal as a read-only sheet in the page flow, for the landing page.
 * The panel subscribes to nothing, takes no focus, sets no body class and resolves nothing;
 * the sheet is inert. Everything drawn is what a live proposal would draw.
 */
export function ProposalPanel({ specimen }: { specimen?: PendingProposal } = {}) {
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

  // The panel is where the operator has to be the moment it opens, and where they must not be
  // stuck. Both refs below serve that: one to put focus in, one to know where to hand it back.
  const panelRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Shared by the footer buttons and the Escape handler below, so both go through the exact
  // same guard rather than Escape reimplementing decide() and drifting from it.
  const decideOn = (p: PendingProposal, d: Decision | null) => {
    const id = p.diff.proposalId;
    if (resolvedIds.current.has(id)) return;
    resolvedIds.current.add(id);
    p.resolve(d);
    setQueue(q => q.filter(x => x !== p));
  };

  useEffect(() => {
    if (specimen) return;
    return onProposal(p => {
      if (p) setQueue(q => (q.includes(p) ? q : [...q, p]));
    });
  }, [specimen]);

  useEffect(() => {
    if (specimen) return;
    return onResult(o => setOutcome(o));
  }, [specimen]);

  useEffect(() => {
    if (!outcome) return;
    const t = setTimeout(() => setOutcome(null), RESULT_HOLD_MS);
    return () => clearTimeout(t);
  }, [outcome]);

  const head = specimen ?? queue[0] ?? null;

  // Task 9's "Edit a row" beat needs the console reachable while a decision is pending, but
  // the panel is `position: fixed` over the right side of the viewport and would otherwise sit
  // on top of it. This flag on <body> lets styles.css narrow the console for exactly as long
  // as something is actually on screen. Driven off `head`, not `queue.length` or the raw
  // onProposal events, so a second queued proposal keeps the flag set through the gap between
  // the first one resolving and the next one appearing — the console must not spring back to
  // full width for a frame in between.
  useEffect(() => {
    if (specimen) return;
    document.body.classList.toggle('pp-active', Boolean(head));
    return () => { document.body.classList.remove('pp-active'); };
  }, [head, specimen]);

  /*
   * What this sheet says about each row of the register, published for the register to draw
   * on its own rows: marked, struck by the operator, or referred. Read off the head and the
   * selection the panel already holds, never off the adapter, so the register needs no
   * subscription of its own and cannot race this one for the buffer. Cleared the moment the
   * sheet closes; the specimen on the landing page publishes nothing, because it is inert.
   */
  useEffect(() => {
    if (specimen) return;
    if (!head) { setProofView(null); return; }
    const cannot = new Set(head.authority.referred);
    const rows = new Map<string, ProofRow>();
    for (const g of head.diff.groups) {
      const state = cannot.has(g.group) ? 'referred' : groups.has(g.group) ? 'marked' : 'struck';
      const { remedy } = readProofRow(g, store.state.shipments[g.id]);
      rows.set(g.id, { state, remedy: remedy?.to ?? null, cost: remedy?.cost ?? 0 });
    }
    setProofView({ proposalId: head.diff.proposalId, rows });
  }, [head, groups, specimen]);
  useEffect(() => () => { if (!specimen) setProofView(null); }, [specimen]);

  /*
   * F2: the panel arrived with `document.activeElement` still on <body>. Measured with real key
   * dispatch, the first row checkbox was tab stop 51 — past the tab bar, the sheet, the authority
   * strip, the filter, and forty-two register buttons — to reach the decision the operator had
   * just been interrupted for. So focus moves onto the panel itself: it is last in the document,
   * so one Tab from there is the first row.
   *
   * Moved, never trapped. This dialog is deliberately not modal (see the scrim in styles.css and
   * the Layout note in DESIGN.md Part I): the register behind it stays live, because a colleague
   * editing a record mid-decision is the thing the stale abort exists to catch, and a judge has
   * to be able to do it while the panel is open.
   */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (specimen) return;
    if (head) {
      // Recorded once per opening, not once per queued proposal: two proposals back to back are
      // one interruption, and the second must not overwrite where the first came from.
      if (!openerRef.current) {
        const a = document.activeElement;
        openerRef.current = a instanceof HTMLElement && a !== document.body ? a : null;
      }
      wasOpen.current = true;
      panelRef.current?.focus();
      return;
    }
    // Nothing to hand back on first mount: this effect also runs when the page loads with no
    // proposal, and focusing the register's tab panel then scrolled the page's head off the
    // top of the viewport and drew its focus ring for no reason.
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const opener = openerRef.current;
    openerRef.current = null;
    // An operator who tabbed out into the register while deciding keeps their place; the browser
    // parks focus on <body> when a focused panel unmounts, and that is the only case worth
    // catching. Without this, closing the panel would yank them out of the row they had moved to.
    if (document.activeElement && document.activeElement !== document.body) return;
    if (opener?.isConnected) { opener.focus(); return; }
    // Nowhere to go back to — the agent opened this, not a click. The register is the sensible
    // place to land, and the tab panel is its focusable frame.
    document.getElementById(TABPANEL_ID)?.focus();
  }, [head, specimen]);

  // F11: the panel carries role="dialog" and aria-modal="true", which sets the expectation
  // that Escape closes it. It has to take the same path Refuse does — resolving the proposal
  // with a real decision — rather than a silent dismiss, which would just be F1 again by
  // another route: a proposal vanishing off screen with its promise never settled.
  useEffect(() => {
    if (!head || specimen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') decideOn(head, null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [head, specimen]);

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
  const { lines: remedyLines } = summariseRemedies(selectedRows);
  const waiting = queue.length - 1;
  const nothingPicked = selectedGroups.length === 0 && selectedActions.length === 0;

  // The specimen ends on a row boundary. Referred rows come first in its ordering (see
  // specimen.ts), so the first rows printed are the ones set apart, and the line under them
  // counts what a reader would find by opening the real sheet. The live panel prints everything
  // and scrolls.
  const rowCap = specimen ? SPECIMEN_ROWS : Number.POSITIVE_INFINITY;
  const shownReferred = referredGroups.slice(0, rowCap);
  const shownAuthorisable = authorisable.slice(0, Math.max(0, rowCap - shownReferred.length));
  const hiddenRows = diff.groups.length - shownReferred.length - shownAuthorisable.length;

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

  // A sheet where every row is above this operator's limit still has to be stampable: sending
  // it on is the act. Left disabled, the boundary would look like a dead end rather than a
  // handover — and the freight would sit in Frankfurt while the panel said "nothing marked".
  const onlyReferral = nothingPicked && referredGroups.length > 0;
  const actionsOnly = diff.totals.records === 0 && diff.actions.length > 0;

  // The stamp says both halves of what pressing it does, each with its count and, for the
  // referred half, who it goes to: "Apply 23 · Refer 4 to duty manager". Two lines at most.
  // The apply count is what is marked, live, so three unticks read "Apply 20"; it is not
  // counted against the whole sheet, because "of 27" with four rows referred would read as
  // four rows they struck out, which is the one thing they did not do.
  const awaiting = authority.target ? authority.target.label.toLowerCase() : 'a second approver';
  const heldWord = selectedActions.length === 1 ? 'held action' : 'held actions';
  const stampParts: string[] = [];
  if (actionsOnly) {
    stampParts.push(`Release ${selectedActions.length} of ${diff.actions.length} ${heldWord}`);
  } else {
    if (authorisable.length > 0) stampParts.push(`Apply ${selectedGroups.length}`);
    if (referredGroups.length > 0) stampParts.push(`Refer ${referredGroups.length} to ${awaiting}`);
    if (selectedActions.length > 0) stampParts.push(`Release ${selectedActions.length} ${heldWord}`);
  }

  const referredWord = referredGroups.length === 1 ? 'shipment' : 'shipments';
  const referredLine = authority.target
    ? `The ${authority.target.label.toLowerCase()} decides ${referredGroups.length === 1 ? 'it' : 'these'}.`
    : `There is nobody above you to refer ${referredGroups.length === 1 ? 'it' : 'them'} to.`;

  return (
    <>
      {!specimen && <div className="pp-scrim" />}
      {/*
        * A dialog, and deliberately not a modal one. `aria-modal` would promise that everything
        * behind the scrim is out of reach — and the register behind it is the one thing that must
        * stay reachable, so the promise would be false the moment it was made.
        */}
      <aside
        className={specimen ? 'pp pp--specimen' : 'pp'}
        key={diff.proposalId}
        ref={panelRef}
        tabIndex={specimen ? undefined : -1}
        role={specimen ? undefined : 'dialog'}
        aria-label={specimen ? undefined : 'Review this change'}
        inert={specimen ? true : undefined}
      >
        <header className="pp-head">
          {/* The register over the quote: whose words these are, and which tool they came
              through. Who signs it is on the stamp block at the foot, where the signing is. */}
          <div className="pp-head-top">
            <p className="pp-eyebrow">
              <span className="pp-eyebrow-caps">Agent proposal</span>
              <span className="pp-eyebrow-sep" aria-hidden="true">·</span>
              <span className="pp-tool mono">{head.toolName}</span>
            </p>
            {waiting > 0 && (
              <span className="pp-waiting">{waiting} more waiting</span>
            )}
          </div>
          <p className="pp-request">“{describeRequest(head.toolName, head.input)}”</p>
          {/*
            * The loop closing, stated as observed fact and nowhere near an inference. Every word
            * of it is read off two calls this panel actually received: the earlier one's clock
            * time, and the fact that this one names only records that call was refused on. It
            * says nothing about the agent, because nothing about the agent is visible from here.
            * When there is no such relationship this renders nothing at all — an empty state is
            * the correct answer, and the one this feature must be able to give.
            *
            * The dagger is the reference mark: it points at something set apart from the main
            * run, which is exactly what a line about an earlier run is. Colour carries none of
            * it — the mark and the words say it on their own.
            */}
          {head.followUp && (
            <p className="pp-followup">
              <ProofMark name="dagger" size={12} className="pp-followup-mark" />
              <span>
                Follows the <span className="mono">{followUpTime(head.followUp)}</span> run. Asks
                only about {followUpTail(head.followUp)}.
              </span>
            </p>
          )}
          <hr className="rule" />
        </header>

        <div className="pp-scroll">
          <BlastRadius
            records={selectedGroups.length}
            requested={diff.totals.records}
            datasetSize={Object.keys(store.state.shipments).length}
            valueDelta={valueDelta}
            referredValue={referredSpend}
            referredCount={referredGroups.length}
            showMoney={touchesPrice}
            irreversible={selectedActions.length}
            actionsOnly={actionsOnly}
          />

          <RemedySummary lines={remedyLines} />

          {notes.length > 0 && (
            <section className="pp-notes">
              <p className="pp-notes-caption">
                <ProofMark name="dele" size={13} />
                <span className="pp-notes-caption-caps">Left alone by the tool</span>
                <span className="pp-notes-caption-tail">, not by Ladder</span>
              </p>
              {byReason(notes).map(n => (
                <div className="pp-note" key={n.reason}>
                  <p className="pp-note-line">
                    {n.count} skipped: {n.reason}
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
            {/*
              * The rows this operator cannot mark, set aside at the top of the sheet before the
              * rows they can, under one line that says why and whose decision they now are.
              * Nothing on them has been declined, so they are never struck: they carry no
              * control at all, a double rule down the edge, and their position. The amber only
              * agrees with all of that.
              */}
            {referredGroups.length > 0 && (
              <section className="pp-refer" aria-label="Referred, not yours to authorise">
                {/* No mark on the line: the register draws the same rows with the same double
                    rule and no glyph, and the sheet says it the same way. */}
                <p className="pp-refer-line">
                  {referredGroups.length} {referredWord} over your{' '}
                  {money(authority.role.limit)} limit. {referredLine}
                </p>
                {shownReferred.map(g => (
                  <DiffGroupRow
                    key={g.group}
                    group={g}
                    record={store.state.shipments[g.id]}
                    subtitle={subtitleFor(g.id, false)}
                    checked={false}
                    referred
                    // Shut on the specimen too. Printed open it stood the sheet at 725px, and on
                    // a 714px laptop viewport the stamp fell 100px below the fold: the one
                    // control the whole page is about was the thing you could not see. The line
                    // above the group already says four are referred and to whom.
                    expanded={false}
                    onToggle={() => {}}
                  />
                ))}
              </section>
            )}
            {shownAuthorisable.map(g => (
              <DiffGroupRow
                key={g.group}
                group={g}
                record={store.state.shipments[g.id]}
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
            {hiddenRows > 0 && (
              <p className="pp-more">
                {hiddenRows} more {hiddenRows === 1 ? 'row' : 'rows'} on the sheet.
                {' '}The whole of it is on the proof tab.
              </p>
            )}
          </div>
        </div>

        <footer className="pp-foot">
          {/* Who signs. The role on shift and the limit it signs up to, set as the signature
              line of the sheet: the stamp below is theirs, and a row above that limit was set
              apart at the top before they read it. */}
          <p className="pp-foot-by">
            <span className="pp-foot-by-lead">For approval by</span>{' '}
            the {authority.role.label.toLowerCase()}, up to {money(authority.role.limit)}
          </p>
          {/* The commit boundary, in one line above the two controls: the sheet is a proposal
              until the stamp, and the words say so where the hand is about to go. */}
          <p className="pp-foot-nothing">Nothing changes until you stamp it.</p>
          {/*
            The stamp block. The counts are the label because narrowing has to be legible without
            reading anything else, and they are what the button's accessible name is made of.
            Refuse sits left and the stamp right at every width.
          */}
          <button className="pp-refuse" type="button" disabled={decided} onClick={() => decide(null)}>
            Refuse all
          </button>
          <button
            className="pp-stamp"
            type="button"
            disabled={(nothingPicked && !onlyReferral) || decided}
            onClick={() => decide({ groups: [...groups], actions: [...actions] })}
          >
            {/* A space between the parts as text, not only as a gap: the accessible name is
                the text, and "Apply 23Refer 4" is not a name. Flex layout ignores it. */}
            {stampParts.map((part, i) => (
              <span className="pp-stamp-part" key={part}>
                {i > 0 && ' '}
                <span className="pp-stamp-label">{part}</span>
                {i < stampParts.length - 1 && <span className="pp-stamp-sep" aria-hidden="true">·</span>}
              </span>
            ))}
          </button>
        </footer>
      </aside>
      {resultCard}
    </>
  );
}
