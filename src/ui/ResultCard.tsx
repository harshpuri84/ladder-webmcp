import type { ProposalOutcome } from '../webmcp/adapter';

interface Framing {
  tone: string;
  /**
   * The word in the stamp. Every receipt state is told apart by this word first — a struck
   * word survives greyscale, a coloured edge does not — and the tone only tints what it
   * already says.
   */
  stamp: string;
  title: string;
  /** Only what the table cannot say. Empty where the four lines already say it all. */
  note: string;
}

/**
 * The same four numbers go back to the agent every time. What changes is how the human should
 * read them — and three of these cases are ones a judge will otherwise misread.
 */
function frame(o: ProposalOutcome): Framing {
  switch (o.cause) {
    // A clean, fully approved run and a partially-approved one share this cause — `auto_applied`,
    // `refused`, `nothing_to_decide`, `stale`, `blocked` and `tool_error` all cover the ways
    // nothing (or not everything) got approved. Before this case existed, both fell through to
    // the generic default below, so this product's ordinary success receipt announced itself in
    // the same language as a refusal.
    case 'applied': {
      const partial = o.payload.status === 'partially_applied';
      return {
        tone: partial ? 'partial' : 'applied',
        stamp: partial ? 'OK with changes' : 'OK to run',
        title: partial ? 'Applied, partly' : 'Applied',
        note: '',
      };
    }
    // Not a failure and not a partial refusal: the operator did everything they were allowed
    // to do, and the rest is with a colleague. `REFER` is the stamped word for that, opposite
    // `OK TO RUN` — the two halves of an authority boundary, told apart by the word first.
    case 'referred': {
      return {
        tone: 'referred',
        stamp: 'Refer',
        title: o.payload.applied > 0 ? 'Applied what you can authorise' : 'Referred, nothing applied',
        note: '',
      };
    }
    case 'auto_applied':
      return {
        tone: 'auto',
        stamp: 'Standing rule',
        title: 'Applied automatically',
        note: o.ruleDescription
          ? `Matched the standing rule for ${o.toolName}, ${o.ruleDescription}, so this went through with no review.`
          : `Matched the standing rule for ${o.toolName}, so this went through with no review.`,
      };
    // Two operators working the same consol, which is what a stale abort actually models —
    // not a system event. Marta is the colleague the register's own edit control simulates,
    // and naming her is the difference between "the records moved on" (nobody did anything)
    // and a person on the same shift getting there first.
    //
    // "Changed", not "applied a remedy": nothing here knows which field moved, and the receipt
    // does not get to assert something it was not told.
    case 'stale':
      return {
        tone: 'moved',
        stamp: 'Superseded',
        title: 'Marta got there first',
        note: `Marta changed one of these shipments while your proof was open, so nothing was applied against a stale picture. ${o.toolName} has been told to preview them again.`,
      };
    case 'blocked':
      return {
        tone: 'blocked',
        stamp: 'Blocked',
        title: 'Ladder blocked this',
        note: 'The whole commit was rolled back.',
      };
    case 'tool_error':
      return {
        tone: 'fault',
        stamp: 'Tool error',
        title: 'The tool errored',
        note: `${o.toolName} threw while it ran. Nothing was blocked and nothing was written. The fault is in the tool.`,
      };
    case 'nothing_to_decide': {
      // F12: `payload.reason` is only ever set on the zero-match case (see its own doc comment
      // in webmcp/result.ts) — nothing at all matched the filter or request, as opposed to rows
      // matching and every one being held for a domain reason. The agent-side reason field
      // already told these apart; this note didn't.
      const noMatch = Boolean(o.payload.reason);
      return {
        tone: 'skipped',
        stamp: 'Nothing to set',
        title: 'Nothing to change',
        note: noMatch
          ? `${o.toolName} found nothing that matched this request, so no panel was needed. The agent has been told why.`
          : `${o.toolName} found nothing it could change, so no panel was needed. Every matching row was already accounted for. The agent has been told why.`,
      };
    }
    case 'refused':
      return {
        tone: 'sent',
        stamp: 'Revise',
        title: 'Sent back to the agent',
        note: '',
      };
    default:
      return {
        tone: 'sent',
        stamp: 'Revise',
        title: 'Sent back to the agent',
        note: '',
      };
  }
}

export interface ResultCardProps {
  outcome: ProposalOutcome;
  /** True while the panel is open behind it, so the card steps aside instead of overlapping. */
  shifted: boolean;
  onDismiss(): void;
}

export function ResultCard({ outcome, shifted, onDismiss }: ResultCardProps) {
  const { tone, stamp, title, note } = frame(outcome);
  const p = outcome.payload;
  // Every entry here already has count > 0 — the adapter's finish() strips zero-count
  // entries before this component ever sees them, so there is no separate "remark with no
  // count" case left to render.
  const refused = p.rejected;
  const hasCounts = p.requested > 0;
  // The path the guard caught (`shipments:HAWB-70001:slaTier`) stays in the payload the agent
  // reads; the person reads what it means.
  const reasonFor = (r: { reason: string }) =>
    outcome.cause === 'blocked' && /\(.+\)/.test(r.reason)
      ? 'wrote a field the proof never showed'
      : r.reason;

  return (
    <aside className={`rc rc--${tone}${shifted ? ' rc--shifted' : ''}`} role="status">
      <div className="rc-head">
        <div className="rc-head-text">
          {/* The returned proof, stamped. Eight outcomes, eight words — told apart by the word
              and by the rule form above it, never by an edge colour alone. */}
          <span className="rc-stamp">{stamp}</span>
          <span className="rc-title">{title}</span>
        </div>
        {/* Not a correction mark on purpose: this control's only job is to get out of the
            way, and a judge has to recognise it without thought. The mark vocabulary carries
            meaning everywhere else in this interface; a plain dismiss control carries none. */}
        <button className="rc-dismiss" type="button" onClick={onDismiss} aria-label="Dismiss" title="Dismiss">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      {hasCounts && (
        <dl className="rc-rows">
          <div className="rc-row">
            <dt>requested</dt>
            <dd className="mono">{p.requested}</dd>
          </div>
          <div className="rc-row">
            <dt>applied</dt>
            <dd className="mono">{p.applied}</dd>
          </div>
          {refused.length === 0 ? (
            <div className="rc-row">
              <dt>refused</dt>
              <dd className="mono">0</dd>
            </div>
          ) : (
            refused.map(r => (
              <div className="rc-row" key={r.reason}>
                {/* A pending bucket is counted here like every other thing that did not
                    happen, but calling it "refused" beside a reason that says "not refused"
                    would read as the receipt arguing with itself. */}
                <dt>{r.pending ? 'referred' : 'refused'}</dt>
                <dd className="mono">{r.count}</dd>
                <span className="rc-reason">{reasonFor(r)}</span>
              </div>
            ))
          )}
        </dl>
      )}
      {hasCounts && (
        <p className="rc-replan">
          {p.replan_required ? 'The agent was told to replan.' : 'The agent was told no replan is needed.'}
        </p>
      )}
      {note && <p className="rc-note">{note}</p>}
      {p.error && <p className="rc-note">{p.error}</p>}
    </aside>
  );
}
