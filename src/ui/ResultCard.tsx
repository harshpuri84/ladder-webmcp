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
        note: partial
          ? `${o.payload.applied} of ${o.payload.requested} went through as approved. The rest is accounted for above, and ${o.toolName} has been told to replan around it.`
          : `${o.toolName} did exactly what you approved — ${o.payload.applied} of ${o.payload.requested}, nothing left over.`,
      };
    }
    case 'auto_applied':
      return {
        tone: 'auto',
        stamp: 'Standing rule',
        title: 'Applied automatically',
        note: o.ruleDescription
          ? `Matched the standing rule for ${o.toolName} — ${o.ruleDescription} — so this went through with no review.`
          : `Matched the standing rule for ${o.toolName}, so this went through with no review.`,
      };
    case 'stale':
      return {
        tone: 'moved',
        stamp: 'Superseded',
        title: 'The records moved on',
        note: `They changed while this was open, so nothing was applied against a stale picture. ${o.toolName} has been told to preview them again.`,
      };
    case 'blocked':
      return {
        tone: 'blocked',
        stamp: 'Blocked',
        title: 'Ladder blocked this',
        note: 'The tool tried to write outside what you approved, so every change was rolled back. The guard did its job.',
      };
    case 'tool_error':
      return {
        tone: 'fault',
        stamp: 'Tool error',
        title: 'The tool errored',
        note: `${o.toolName} threw while it ran. Nothing was blocked and nothing was written — this is a fault in the tool, not the guard stopping it.`,
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
          : `${o.toolName} found nothing it could change, so no panel was needed — every matching row was already accounted for. The agent has been told why.`,
      };
    }
    case 'refused':
      return {
        tone: 'sent',
        stamp: 'Revise',
        title: 'Sent back to the agent',
        note: 'You refused the whole change. The agent has been told, in the same words as above.',
      };
    default:
      return {
        tone: 'sent',
        stamp: 'Revise',
        title: 'Sent back to the agent',
        note: 'Your judgement left as structured data, not as a silent success.',
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
                <dt>refused</dt>
                <dd className="mono">{r.count}</dd>
                <span className="rc-reason">— {r.reason}</span>
              </div>
            ))
          )}
          <div className="rc-row">
            <dt>replan required</dt>
            <dd className="mono">{p.replan_required ? 'yes' : 'no'}</dd>
          </div>
        </dl>
      )}
      <p className="rc-note">{note}</p>
      {p.error && <p className="rc-note">{p.error}</p>}
    </aside>
  );
}
