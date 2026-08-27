import { Fragment } from 'react';
import type { ActionRecord } from '../core/types';
import { ProofMark } from './ProofMark';

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
 * in the record or money totals — sending a message is not a row edit — so it is set apart
 * the way a printer sets apart matter that is not part of the run: double rules above and
 * below, and a dagger against it. Not a coloured edge, which would be a hue carrying meaning
 * on its own, and not a shape a judge could mistake for a diff row.
 */
export function ActionCard({ action, checked, onToggle }: ActionCardProps) {
  return (
    <label className={`ac${checked ? '' : ' ac--struck'}`}>
      <input
        className="ac-check"
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Release ${action.kind} ${action.actionId}`}
      />
      <span className="ac-mark">
        <ProofMark name="dagger" size={15} />
      </span>
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
        <span className="ac-struck-note">Struck out — not sent</span>
      </div>
    </label>
  );
}
