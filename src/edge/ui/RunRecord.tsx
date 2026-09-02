import { useState } from 'react';
import type { OutcomeCause, ProposalOutcome } from '../../webmcp/adapter';
import type { ToolPayload } from '../../webmcp/result';

/** How many ids a bucket names before it stops counting them out. */
const NAMED = 8;

const VERDICT: Record<OutcomeCause, string> = {
  applied: 'Applied',
  auto_applied: 'Applied under the standing rule',
  referred: 'Referred',
  refused: 'Refused',
  nothing_to_decide: 'Nothing to decide',
  stale: 'Aborted. A site changed after the preview',
  blocked: 'Blocked by the guard',
  tool_error: 'The tool failed',
};

const CLEAN = new Set<OutcomeCause>(['applied', 'auto_applied']);
const ABORTED = new Set<OutcomeCause>(['stale', 'blocked', 'tool_error']);

/**
 * The ledger the receipt prints before it prints reasons: the same four buckets the agent gets,
 * summed. `applied` plus every count below always equals `requested`; that is the payload's own
 * invariant, and the ledger is only it read out loud.
 */
function ledger(payload: ToolPayload, cause: OutcomeCause, awaiting?: string) {
  let removed = 0;
  let closed = 0;
  let held = 0;
  for (const r of payload.rejected) {
    if (r.pending) continue;
    if (r.reason.startsWith('the operator')) removed += r.count;
    else if (ABORTED.has(cause)) held += r.count;
    else closed += r.count;
  }
  const referred = payload.referred?.count ?? 0;
  const rows: { n: number; word: string; lamp?: boolean }[] = [
    { n: payload.requested, word: 'requested' },
    { n: payload.applied, word: 'applied' },
  ];
  if (removed > 0) rows.push({ n: removed, word: 'removed by you' });
  if (closed > 0) rows.push({ n: closed, word: 'closed by a rule', lamp: true });
  if (held > 0) rows.push({ n: held, word: 'held back, nothing applied', lamp: true });
  if (referred > 0) rows.push({ n: referred, word: `referred to a ${awaiting ?? 'second approver'}`, lamp: true });
  return rows;
}

/**
 * The run record. What happened, in the estate's own words: a ledger of the buckets, then one
 * line per reason naming its sites. The exact structured payload that went back over the tool
 * boundary is here too, behind a disclosure. A judge who wants to read the message the agent got
 * should not have to open a console for it, and an engineer who does not should not have half
 * their screen taken by it.
 */
export function RunRecord({
  outcome, shifted, onDismiss,
}: {
  outcome: ProposalOutcome;
  shifted: boolean;
  onDismiss(): void;
}) {
  const { payload, cause, toolName, ruleDescription } = outcome;
  const clean = CLEAN.has(cause);
  const [wireOpen, setWireOpen] = useState(false);
  const rows = ledger(payload, cause, payload.referred?.awaiting);

  return (
    <section className={shifted ? 'rr rr--shifted' : 'rr'} aria-label="Run record">
      <header className="rr-head">
        <span className="lg">Run record</span>
        <span className="rd rr-tool">{toolName}</span>
        <span className={clean ? 'rr-verdict rr-verdict--applied' : 'rr-verdict rr-verdict--held'}>
          {VERDICT[cause]}
        </span>
        <span className="rr-tool rd">
          {payload.applied} of {payload.requested} applied
          {payload.actions_released > 0 && ` · ${payload.actions_released} paged`}
        </span>
        <button className="rr-dismiss" type="button" onClick={onDismiss}>Clear</button>
      </header>

      <div className="rr-body">
        <dl className="rr-ledger">
          {rows.map(r => (
            <div className={r.lamp ? 'rr-sum rr-sum--lamp' : 'rr-sum'} key={r.word}>
              <dt className="rd">{r.n}</dt>
              <dd>{r.word}</dd>
            </div>
          ))}
        </dl>

        <div className="rr-buckets">
          {ruleDescription && (
            <p className="rr-line">
              Nothing was shown before this went out: it was inside the standing rule.
            </p>
          )}
          {payload.error && <p className="rr-line"><b>{payload.error}</b></p>}
          {payload.reason && <p className="rr-line">{payload.reason}</p>}

          {payload.rejected.length === 0 && !payload.error && !payload.reason && (
            <p className="rr-line">
              Everything the agent asked for went out. Nothing was held back.
            </p>
          )}

          {payload.rejected.map(r => (
            <div className="rr-bucket" key={r.reason}>
              <p className="rr-line">
                <b className="rd">{r.count}</b> not applied. {r.reason}
              </p>
              <p className="rr-ids rd">
                {r.ids.slice(0, NAMED).join(', ')}
                {r.ids.length > NAMED && ` and ${r.ids.length - NAMED} more`}
              </p>
            </div>
          ))}

          {payload.replan_required && (
            <p className="rr-line rr-replan">The agent was told to replan.</p>
          )}

          <details className="rr-wire" open={wireOpen} onToggle={e => setWireOpen(e.currentTarget.open)}>
            <summary className="lg">
              Returned to the agent
              <span className="rr-wire-word">{wireOpen ? 'Hide' : 'Show'}</span>
            </summary>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </details>
        </div>
      </div>
    </section>
  );
}
