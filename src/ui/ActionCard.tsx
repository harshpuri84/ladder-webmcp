import { Fragment } from 'react';
import type { ActionRecord } from '../core/types';

function renderValue(v: unknown) {
  return typeof v === 'string' ? v : JSON.stringify(v);
}

export interface ActionCardProps {
  action: ActionRecord;
  checked: boolean;
  onToggle(): void;
}

/**
 * An irreversible effect the engine caught on its way out and is holding. It is never counted
 * in the record or money totals — sending a message is not a row edit — so it gets its own
 * card, its own checkbox, and a shape a judge cannot mistake for a diff row.
 */
export function ActionCard({ action, checked, onToggle }: ActionCardProps) {
  return (
    <label className={`ac${checked ? '' : ' ac--off'}`}>
      <input
        className="ac-check"
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Release ${action.kind} ${action.actionId}`}
      />
      <div className="ac-body">
        <div className="ac-head">
          <span className="ac-flag">Held — cannot be undone</span>
          <span className="ac-kind mono">{action.kind}</span>
        </div>
        <dl className="ac-payload">
          {Object.entries(action.payload).map(([k, v]) => (
            <Fragment key={k}>
              <dt>{k}</dt>
              <dd>{renderValue(v)}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </label>
  );
}
