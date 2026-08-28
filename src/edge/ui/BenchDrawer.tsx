import { useEffect, useRef, useState } from 'react';
import type { Decision, PendingProposal, ProposalOutcome } from '../../webmcp/adapter';
import { onProposal, onResult } from '../../webmcp/adapter';
import { edgeStore } from '../store';
import { CANDIDATE_RELEASE } from '../seed';
import type { RolloutMode } from '../types';
import { modeFull, modeWord, readDetent } from './words';
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
  if (f.ids?.length) bits.push(`${f.ids.length === 1 ? 'one site' : `${f.ids.length} sites`} by code`);
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

const scoped = (f: Filter) => {
  const w = where(f);
  return w ? `every site ${w}` : 'every site in the estate';
};

/** The ask in plain words, above the numbers, so every figure is read against a purpose. */
function describeRequest(toolName: string, input: unknown): string {
  const i = (input ?? {}) as Filter & { release?: string; mode?: RolloutMode; message?: string };
  switch (toolName) {
    case 'roll_config': {
      const release = i.release ?? CANDIDATE_RELEASE;
      if (i.mode) {
        return `Put ${release} on ${scoped(i)} as ${modeWord[i.mode]} — ${modeFull[i.mode]} — wherever no rule closes it.`;
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

  // The rack behind the drawer loses the light while a decision is open. Driven off `head` rather
  // than off queue length, so two proposals back to back never let the rack flash back up for a
  // frame between them.
  useEffect(() => {
    document.body.classList.toggle('rk-drawn', Boolean(head));
    return () => { document.body.classList.remove('rk-drawn'); };
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
  // nothing would make "commit 0 of 22" the resting state.
  if (head && head.diff.proposalId !== selectedFor) {
    setSelectedFor(head.diff.proposalId);
    setGroups(new Set(head.diff.groups.map(g => g.group)));
    setActions(new Set(head.diff.actions.map(a => a.actionId)));
  }

  const record = outcome && (
    <RunRecord outcome={outcome} shifted={Boolean(head)} onDismiss={() => setOutcome(null)} />
  );

  if (!head) return record;

  const { diff, notes } = head;
  const selectedGroups = diff.groups.filter(g => groups.has(g.group));
  const selectedActions = diff.actions.filter(a => actions.has(a.actionId));
  const reads = diff.groups.map(g => readDetent(g, edgeStore.state.pops[g.id]));
  const readById = new Map(reads.map(r => [r.id, r]));

  const exposureOf = (ids: string[]) =>
    Math.round(ids.reduce((n, id) => n + (readById.get(id)?.exposedPct ?? 0), 0) * 100) / 100;
  const selectedExposure = exposureOf(selectedGroups.map(g => g.id));
  const requestedExposure = exposureOf(diff.groups.map(g => g.id));
  const slowest = selectedGroups.reduce(
    (n, g) => Math.max(n, readById.get(g.id)?.convergeMinutes ?? 0), 0,
  );

  const nothingPicked = selectedGroups.length === 0 && selectedActions.length === 0;
  const whole =
    selectedGroups.length === diff.groups.length && selectedActions.length === diff.actions.length;
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
        role="dialog"
        aria-modal="true"
        aria-label="Review this rollout"
      >
        <header className="dw-head">
          <span className="dw-tool rd">{head.toolName}</span>
          <p className="dw-ask">{describeRequest(head.toolName, head.input)}</p>
          <span className="dw-state">Proposed · nothing applied</span>
          {waiting > 0 && <span className="dw-waiting">{waiting} more waiting</span>}
        </header>

        <div className="dw-main">
          <div className="dw-rail">
            <ExposureMeter
              selectedPct={selectedExposure}
              requestedPct={requestedExposure}
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

            {notes.length > 0 && (
              <div className="rail-block">
                <span className="lg">Closed by a rule — skipped by the tool</span>
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
                : `${selectedGroups.length} / ${diff.groups.length} sites`}
            </span>
            <span className="commit-sub">
              {nothingPicked
                ? 'nothing latched'
                : `${selectedExposure.toFixed(2)}% of production traffic`}
              {selectedActions.length > 0 && diff.groups.length > 0 &&
                ` · ${selectedActions.length} page${selectedActions.length === 1 ? '' : 's'} released`}
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
