import { useEffect, useRef, useState } from 'react';
import type { Decision, PendingProposal, ProposalOutcome } from '../../webmcp/adapter';
import { onProposal, onResult } from '../../webmcp/adapter';
import { edgeStore } from '../store';
import { CANDIDATE_RELEASE } from '../seed';
import type { RolloutMode } from '../types';
import { modeFull, modeWord, pct, readDetent } from './words';
import { followUpTail, followUpTime } from './follow-up-words';
import { ExposureMeter } from './ExposureMeter';
import { Detent, PageDetent } from './Detent';
import { RunRecord } from './RunRecord';

const RESULT_HOLD_MS = 14000;

/** How many site ids a skip line names before it stops. */
const NAMED_SKIPS = 8;

interface Filter {
  ids?: string[];
  region?: string;
  running?: string;
  canary?: boolean;
  drained?: boolean;
  frozen?: boolean;
  incident?: boolean;
}

/** The slice of the estate the agent named, in the words an engineer would use. */
function where(f: Filter): string {
  const bits: string[] = [];
  if (f.region) bits.push(`in ${f.region}`);
  if (f.running) bits.push(`still running ${f.running}`);
  if (f.canary === true) bits.push('on the canary ring');
  if (f.canary === false) bits.push('outside the canary ring');
  if (f.frozen === true) bits.push('inside a change freeze');
  if (f.frozen === false) bits.push('outside every change freeze');
  if (f.incident === true) bits.push('with an incident open');
  if (f.incident === false) bits.push('with no incident open');
  if (f.drained === true) bits.push('drained for maintenance');
  return bits.join(' ');
}

/** A named list of codes is a subject, not a modifier — see the same note in the freight panel. */
const scoped = (f: Filter) => {
  const w = where(f);
  if (f.ids?.length) {
    const head = f.ids.length === 1 ? 'one site, by code' : `${f.ids.length} sites, by code`;
    return w ? `${head}, ${w}` : head;
  }
  return w ? `every site ${w}` : 'every site in the estate';
};

/** The ask in plain words, above the numbers, so every figure is read against a purpose. */
function describeRequest(toolName: string, input: unknown): string {
  const i = (input ?? {}) as Filter & { release?: string; mode?: RolloutMode; message?: string };
  switch (toolName) {
    case 'roll_config': {
      const release = i.release ?? CANDIDATE_RELEASE;
      if (i.mode) {
        return `Put ${release} on ${scoped(i)} as ${modeWord[i.mode]}, ${modeFull[i.mode]}, wherever no rule closes it.`;
      }
      return `Stage ${release} across ${scoped(i)}, taking the most cautious mode still open to each.`;
    }
    case 'page_oncall': {
      const w = where(i);
      const who = w ? `every rotation covering sites ${w}` : 'every on-call rotation in the estate';
      return `Page ${who}: “${i.message ?? ''}”`;
    }
    default:
      return `${toolName} ${JSON.stringify(input ?? {})}`;
  }
}

/** Sites the tool itself left alone, folded to one line per reason, each naming its sites. */
function byReason(notes: { id: string; reason: string }[]) {
  const byText = new Map<string, string[]>();
  for (const n of notes) byText.set(n.reason, [...(byText.get(n.reason) ?? []), n.id]);
  return [...byText].map(([reason, ids]) => ({ reason, count: ids.length, ids }));
}

/**
 * The bench drawer. It is the same decision the freight console's proof panel carries and a
 * completely different instrument: the estate stays on screen above it, the sites arrive as a
 * field of latches rather than a column of proof rows, and the measurement half lives on a rail
 * beside them instead of at the top of a sheet.
 */
export function BenchDrawer() {
  const [queue, setQueue] = useState<PendingProposal[]>([]);
  const [outcome, setOutcome] = useState<ProposalOutcome | null>(null);
  const [selectedFor, setSelectedFor] = useState<string | null>(null);
  const [groups, setGroups] = useState<ReadonlySet<string>>(new Set());
  const [actions, setActions] = useState<ReadonlySet<string>>(new Set());

  // Two decisions dispatched in the same React batch (a double click, or Escape racing the
  // button) both close over the same head. A ref is the only thing both calls see consistently
  // inside that batch, so it is what stops one proposal being resolved twice — or, worse, a
  // second proposal being dropped from the queue with its promise never settled.
  const resolvedIds = useRef<Set<string>>(new Set());

  // Where focus goes when the drawer rises, and where it is handed back when it shuts.
  const drawerRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

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

  // A record standing over the rack reserves its own height under the last band, so the estate
  // can always be scrolled clear of it rather than read through its lip.
  useEffect(() => {
    document.body.classList.toggle('rk-record', Boolean(outcome));
    return () => { document.body.classList.remove('rk-record'); };
  }, [outcome]);

  // The rack behind the drawer loses the light while a decision is open. Driven off `head` rather
  // than off queue length, so two proposals back to back never let the rack flash back up for a
  // frame between them.
  useEffect(() => {
    document.body.classList.toggle('rk-drawn', Boolean(head));
    return () => { document.body.classList.remove('rk-drawn'); };
  }, [head]);

  /*
   * F2, this product's half. The drawer opened with `document.activeElement` still on <body>, so
   * the engineer tabbed through the autonomy and authority bars behind it to reach the latches,
   * and could tab straight back out of a panel marked `aria-modal="true"`.
   *
   * Unlike the freight console's proof panel, this drawer really is modal: the rack behind it is
   * already `pointer-events: none` while `body.rk-drawn` is set, so nothing back there was ever
   * meant to be worked during a decision. `inert` is what makes the rest of that claim true — it
   * takes the rack out of the tab order and out of the accessibility tree, which is what
   * `aria-modal` has been asserting all along. Set on the node rather than in CSS because inertness
   * is not a style; read off the class the rack already carries, so there is still one signal.
   */
  useEffect(() => {
    const rack = document.querySelector('.rk-body');
    if (head) {
      if (!openerRef.current) {
        const a = document.activeElement;
        openerRef.current = a instanceof HTMLElement && a !== document.body ? a : null;
      }
      rack?.setAttribute('inert', '');
      drawerRef.current?.focus();
      return () => rack?.removeAttribute('inert');
    }
    const opener = openerRef.current;
    openerRef.current = null;
    // The browser parks focus on <body> when a focused drawer unmounts. Anything else means the
    // engineer has already put focus somewhere deliberate, and it is not ours to move.
    if (document.activeElement && document.activeElement !== document.body) return;
    if (opener?.isConnected) { opener.focus(); return; }
    // Nothing to go back to — the agent opened this, not a click. The rack is where the engineer
    // was reading before it rose, so its first control is where they are put down.
    rack?.querySelector<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')?.focus();
  }, [head]);

  useEffect(() => {
    if (!head) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // The drawer is a dialog, so Escape has to close it — and closing it means resolving the
      // proposal with a real decision, never a silent dismiss that leaves the agent waiting.
      if (e.key === 'Escape') decideOn(head, null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [head]);

  // Everything the agent asked for starts latched: unlatching is the human act, and starting from
  // nothing would make "commit 0 of 22" the resting state. Everything except a site above this
  // operator's exposure authority — that one was never theirs to latch or to unlatch, so it must
  // not arrive marked as though committing would send it.
  if (head && head.diff.proposalId !== selectedFor) {
    const cannot = new Set(head.authority.referred);
    setSelectedFor(head.diff.proposalId);
    setGroups(new Set(head.diff.groups.map(g => g.group).filter(k => !cannot.has(k))));
    setActions(new Set(head.diff.actions.map(a => a.actionId)));
  }

  const record = outcome && (
    <RunRecord outcome={outcome} shifted={Boolean(head)} onDismiss={() => setOutcome(null)} />
  );

  if (!head) return record;

  const { diff, notes, authority } = head;
  // The two halves of the field: what this operator can decide, and what a second person has to.
  // Referred sites stay in the field — the operator is accountable for the whole rollout and has
  // to see all of it — they are simply not theirs to latch.
  const referredKeys = new Set(authority.referred);
  const referredGroups = diff.groups.filter(g => referredKeys.has(g.group));
  const authorisable = diff.groups.filter(g => !referredKeys.has(g.group));
  const referredTo = authority.target?.label.toLowerCase() ?? 'second approver';
  const selectedGroups = diff.groups.filter(g => groups.has(g.group));
  const selectedActions = diff.actions.filter(a => actions.has(a.actionId));
  const reads = diff.groups.map(g => readDetent(g, edgeStore.state.pops[g.id]));
  const readById = new Map(reads.map(r => [r.id, r]));

  const exposureOf = (ids: string[]) =>
    Math.round(ids.reduce((n, id) => n + (readById.get(id)?.exposedPct ?? 0), 0) * 100) / 100;
  const selectedExposure = exposureOf(selectedGroups.map(g => g.id));
  const requestedExposure = exposureOf(diff.groups.map(g => g.id));
  const referredExposure = exposureOf(referredGroups.map(g => g.id));
  const slowest = selectedGroups.reduce(
    (n, g) => Math.max(n, readById.get(g.id)?.convergeMinutes ?? 0), 0,
  );

  const nothingPicked = selectedGroups.length === 0 && selectedActions.length === 0;
  // Counted against what was theirs to decide, never against the whole diff: "2 / 2 sites" with
  // one more referred is the truth; "2 / 3" would read as the operator having struck a site out.
  const whole =
    selectedGroups.length === authorisable.length && selectedActions.length === diff.actions.length;
  const decided = resolvedIds.current.has(diff.proposalId);
  const waiting = queue.length - 1;

  const toggle = (set: ReadonlySet<string>, key: string) => {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
  };
  const decide = (d: Decision | null) => decideOn(head, d);

  return (
    <>
      <div className="dw-scrim" />
      <aside
        className="dw"
        key={diff.proposalId}
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Review this rollout"
      >
        <header className="dw-head">
          <span className="dw-tool rd">{head.toolName}</span>
          <p className="dw-ask">{describeRequest(head.toolName, head.input)}</p>
          <span className="dw-state">Proposed · nothing applied</span>
          {waiting > 0 && <span className="dw-waiting">{waiting} more waiting</span>}
          {/*
            * Stated only where the two calls establish it, and nothing at all where they do not.
            * Every word is read off calls this drawer actually received — the earlier one's clock
            * time, and the fact that this one names only sites that call was refused on. Nothing
            * about the agent, because a tool call shows nothing about the agent.
            */}
          {head.followUp && (
            <p className="dw-follows">
              Follows the <span className="rd">{followUpTime(head.followUp)}</span> run. Asks only
              about {followUpTail(head.followUp)}.
            </p>
          )}
        </header>

        <div className="dw-main">
          <div className="dw-rail">
            <ExposureMeter
              selectedPct={selectedExposure}
              requestedPct={requestedExposure}
              referredPct={referredExposure}
              marked={selectedGroups.length}
              requested={diff.groups.length}
            />

            <div className="rail-block">
              <div className="rail-row">
                <span>Slowest to converge</span>
                <b className="rd">{slowest >= 1440 ? 'held' : `${slowest} min`}</b>
              </div>
              <div className="rail-row">
                <span>Pages held</span>
                <b className="rd">{selectedActions.length} of {diff.actions.length}</b>
              </div>
              <div className="rail-row">
                <span>Estate untouched</span>
                <b className="rd">
                  {Object.keys(edgeStore.state.pops).length - selectedGroups.length} sites
                </b>
              </div>
            </div>

            {referredGroups.length > 0 && (
              <div className="rail-block">
                <span className="lg">Not yours to authorise. Referred.</span>
                <p className="skip-line">
                  <b className="rd">{referredGroups.length}</b>{' '}
                  {referredGroups.length === 1 ? 'site exposes' : 'sites expose'} more than your{' '}
                  <b className="rd">{pct(authority.role.limit)}</b> limit
                  {authority.target
                    ? `. Committing sends ${referredGroups.length === 1 ? 'it' : 'them'} to a ${referredTo}, who decides ${referredGroups.length === 1 ? 'it' : 'them'} separately.`
                    : '. There is nobody above you to refer them to.'}
                </p>
                <p className="skip-ids rd">{referredGroups.map(g => g.id).join(', ')}</p>
              </div>
            )}

            {notes.length > 0 && (
              <div className="rail-block">
                <span className="lg">Closed by a rule, skipped by the tool</span>
                {byReason(notes).map(n => (
                  <div className="skip" key={n.reason}>
                    <p className="skip-line">
                      <b className="rd">{n.count}</b> {n.reason}
                    </p>
                    <p className="skip-ids rd">
                      {n.ids.slice(0, NAMED_SKIPS).join(', ')}
                      {n.ids.length > NAMED_SKIPS && ` and ${n.ids.length - NAMED_SKIPS} more`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dw-field">
            {diff.groups.map(g => (
              <Detent
                key={g.group}
                read={readById.get(g.id)!}
                checked={groups.has(g.group)}
                referredTo={referredKeys.has(g.group) ? referredTo : undefined}
                onToggle={() => setGroups(s => toggle(s, g.group))}
              />
            ))}
            {diff.actions.map(a => (
              <PageDetent
                key={a.actionId}
                action={a}
                checked={actions.has(a.actionId)}
                onToggle={() => setActions(s => toggle(s, a.actionId))}
              />
            ))}
          </div>
        </div>

        <footer className="dw-foot">
          <button
            className="commit"
            type="button"
            disabled={nothingPicked || decided}
            onClick={() => decide({ groups: [...groups], actions: [...actions] })}
          >
            <span className="commit-grade">{whole ? 'Commit as proposed' : 'Commit as cut down'}</span>
            <span className="commit-count">
              {diff.groups.length === 0 && diff.actions.length > 0
                ? `${selectedActions.length} / ${diff.actions.length} pages`
                : `${selectedGroups.length} / ${authorisable.length} sites`}
            </span>
            <span className="commit-sub">
              {nothingPicked
                ? 'nothing latched'
                : `${selectedExposure.toFixed(2)}% of production traffic`}
              {selectedActions.length > 0 && diff.groups.length > 0 &&
                ` · ${selectedActions.length} page${selectedActions.length === 1 ? '' : 's'} released`}
              {/* Reconciles the count on this button with the one on the meter: the meter reads
                  the whole proposal, this reads what was theirs, and the difference is named
                  rather than left for the operator to work out. */}
              {referredGroups.length > 0 &&
                ` · ${referredGroups.length} referred to a ${referredTo}`}
            </span>
          </button>
          <button className="abort" type="button" disabled={decided} onClick={() => decide(null)}>
            Take nothing
          </button>
        </footer>
      </aside>
      {record}
    </>
  );
}
