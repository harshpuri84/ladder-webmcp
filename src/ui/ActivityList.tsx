import { useEffect, useState } from 'react';
import { onResult } from '../webmcp/adapter';
import type { ProposalOutcome } from '../webmcp/adapter';
import { ProofMark } from './ProofMark';
import type { MarkName } from './ProofMark';
import { followUpTail, followUpTime } from './follow-up-words';

let seq = 0;

interface ActivityEntry {
  key: number;
  toolName: string;
  requested: number;
  applied: number;
  /** The receipt's own buckets, read off the same `rejected` ledger the receipt prints: rows
   *  the operator struck out, rows sent up to a second person, and everything else the agent
   *  was told no about. A referral is not a refusal, and the rail says which was which. */
  removed: number;
  referred: number;
  refused: number;
  cause: ProposalOutcome['cause'];
  at: number;
  /** The earlier run this one narrows, when there is one — see `followUpFor` in the adapter.
   *  Null on every ordinary line, and nothing is drawn for it. */
  followUp: ProposalOutcome['followUp'];
}

/**
 * The mark against each line of the run log. Colour is not carrying this: `applied` and
 * `auto_applied` took the correction (a caret), everything else did not (a deletion loop), and
 * the two states that are set apart from the run — blocked and errored — carry a dagger. A
 * referred run carries the query mark, the same one the row itself carried on the sheet. The
 * cause is also printed in words on the same line.
 */
const CAUSE_MARK: Record<ProposalOutcome['cause'], MarkName> = {
  applied: 'insert',
  auto_applied: 'insert',
  referred: 'query',
  refused: 'dele',
  nothing_to_decide: 'dele',
  stale: 'stet',
  blocked: 'dagger',
  tool_error: 'dagger',
};

/**
 * The word against each run, and the same word the receipt stamps on it: a run the rail calls
 * "Superseded" is one the card calls "Superseded", so a judge reading the two does not have to
 * work out that "stale" and "superseded" are one event.
 */
const OUTCOME_WORD: Record<ProposalOutcome['cause'], string> = {
  applied: 'Applied',
  auto_applied: 'Standing rule',
  referred: 'Referred',
  refused: 'Refused',
  nothing_to_decide: 'Nothing to set',
  stale: 'Superseded',
  blocked: 'Blocked',
  tool_error: 'Tool error',
};

/**
 * The two reasons the adapter writes for a row the operator took out of the change by hand.
 * Matched by the literal reason rather than by a kind the payload does not carry, because the
 * reason is exactly what the receipt prints beside the same count: the rail's "removed" and
 * the card's line say the one thing in the same words.
 */
const OPERATOR_REMOVED = [
  'the operator removed these from the change',
  'the operator did not approve these messages',
];

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function toEntry(o: ProposalOutcome): ActivityEntry {
  let removed = 0;
  let referred = 0;
  let refused = 0;
  for (const r of o.payload.rejected) {
    if (r.pending) referred += r.count;
    else if (OPERATOR_REMOVED.includes(r.reason)) removed += r.count;
    else refused += r.count;
  }
  return {
    key: ++seq,
    toolName: o.toolName,
    requested: o.payload.requested,
    applied: o.payload.applied,
    removed,
    referred,
    refused,
    cause: o.cause,
    at: Date.now(),
    followUp: o.followUp,
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
    // Two boxes on purpose. The outer one is a bare full-height column that draws nothing; the
    // inner one is the slip, and it is the one that sticks. See `.al` / `.al-panel` in
    // styles.css for why a single box cannot do both.
    <aside className="al" aria-label="Activity">
      <div className="al-panel">
        <p className="al-heading">Proofs returned</p>
        <hr className="rule" />
        {entries.length === 0 ? (
          // Says what would fill it rather than only that it is empty. It is a backstop, not the
          // page's guidance: this slip is 272px wide and drops below the register entirely under
          // 1080px — so the prompt itself is printed at the head of the sheet and this line only
          // points back at it, never repeats it.
          <p className="al-empty">
            Nothing yet. Say the prompt at the head of the sheet and every proof that comes back
            is logged here.
          </p>
        ) : (
          <ul className="al-list">
            {entries.map(e => (
              <li key={e.key} className={`al-row al-row--${e.cause}`}>
                <div className="al-row-top">
                  <ProofMark name={CAUSE_MARK[e.cause] ?? 'dele'} size={13} className="al-mark" />
                  <span className="al-tool mono">{e.toolName}</span>
                  <span className="al-outcome">{OUTCOME_WORD[e.cause] ?? e.cause}</span>
                </div>
                {/* Only the buckets the receipt has a line for. Applied always prints, even at
                    zero, because a run that applied nothing is the fact a judge is reading for. */}
                <div className="al-row-figures mono">
                  <span>{e.requested} req</span>
                  <span>{e.applied} applied</span>
                  {e.removed > 0 && <span>{e.removed} removed</span>}
                  {e.referred > 0 && <span>{e.referred} referred</span>}
                  {e.refused > 0 && <span>{e.refused} refused</span>}
                </div>
                {/* Only where the two calls actually establish it. The run log is the surface a
                    judge watches across several calls, so this is where a loop being closed reads
                    as a sequence rather than as one panel's caption. */}
                {e.followUp && (
                  <p className="al-followup">
                    <ProofMark name="dagger" size={11} className="al-followup-mark" />
                    <span>
                      Follows {followUpTime(e.followUp)}, asks only about{' '}
                      {followUpTail(e.followUp)}
                    </span>
                  </p>
                )}
                <span className="al-time mono">{timeFmt.format(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
