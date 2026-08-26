import type { ProposalOutcome } from '../webmcp/adapter';

interface Framing {
  tone: string;
  title: string;
  note: string;
}

/**
 * The same four numbers go back to the agent every time. What changes is how the human should
 * read them — and three of these cases are ones a judge will otherwise misread.
 */
function frame(o: ProposalOutcome): Framing {
  switch (o.cause) {
    case 'stale':
      return {
        tone: 'moved',
        title: 'The records moved on',
        note: `They changed while this was open, so nothing was applied against a stale picture. ${o.toolName} has been told to preview them again.`,
      };
    case 'blocked':
      return {
        tone: 'blocked',
        title: 'Ladder blocked this',
        note: 'The tool tried to write outside what you approved, so every change was rolled back. The guard did its job.',
      };
    case 'tool_error':
      return {
        tone: 'fault',
        title: 'The tool errored',
        note: `${o.toolName} threw while it ran. Nothing was blocked and nothing was written — this is a fault in the tool, not the guard stopping it.`,
      };
    case 'refused':
      return {
        tone: 'sent',
        title: 'Sent back to the agent',
        note: 'You refused the whole change. The agent has been told, in the same words as above.',
      };
    default:
      return {
        tone: 'sent',
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
  const { tone, title, note } = frame(outcome);
  const p = outcome.payload;
  const refused = p.rejected.filter(r => r.count > 0);
  // A reason with no count attached — a tool that threw before it touched a single row. It
  // still has to be readable, or the one case where nothing was blocked reads as blank.
  const remarks = p.rejected.filter(r => r.count === 0);

  return (
    <aside className={`rc rc--${tone}${shifted ? ' rc--shifted' : ''}`} role="status">
      <div className="rc-head">
        <span className="rc-title">{title}</span>
        <button className="rc-dismiss" type="button" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
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
      {remarks.map(r => (
        <p className="rc-remark" key={r.reason}>{r.reason}</p>
      ))}
      <p className="rc-note">{note}</p>
    </aside>
  );
}
