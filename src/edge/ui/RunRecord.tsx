import type { OutcomeCause, ProposalOutcome } from '../../webmcp/adapter';

/** How many ids a bucket names before it stops counting them out. */
const NAMED = 8;

const VERDICT: Record<OutcomeCause, string> = {
  applied: 'Applied',
  auto_applied: 'Applied under the standing rule',
  referred: 'Referred',
  refused: 'Refused',
  nothing_to_decide: 'Nothing to decide',
  stale: 'Aborted — a site changed after the preview',
  blocked: 'Blocked by the guard',
  tool_error: 'The tool failed',
};

const CLEAN = new Set<OutcomeCause>(['applied', 'auto_applied']);

/**
 * The run record. Two halves on purpose: what happened, in the estate's own words, and beside it
 * the exact structured payload that went back over the tool boundary. A judge will want to read
 * the second one, and a product whose whole claim is "the refusal is a message the agent can act
 * on" should not make them open a console to see the message.
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
                <b className="rd">{r.count}</b> not applied — {r.reason}
              </p>
              <p className="rr-ids rd">
                {r.ids.slice(0, NAMED).join(', ')}
                {r.ids.length > NAMED && ` and ${r.ids.length - NAMED} more`}
              </p>
            </div>
          ))}

          {payload.replan_required && (
            <p className="rr-line" style={{ marginTop: 10 }}>
              The agent was told to replan rather than to retry the same call.
            </p>
          )}
        </div>

        <div className="rr-wire">
          <span className="lg">Returned to the agent</span>
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}
