import type { ActionRecord } from '../../core/types';
import { convergeWords, modeWord, pct, type DetentRead } from './words';

/**
 * One latch per site. The control is the whole cell, and the latch square is the state: filled
 * when this site is going out tonight, hollow when the operator has taken it off. The struck-out
 * target release on an unlatched cell says the same thing a second time, with no colour involved.
 *
 * `referredTo` names the role this site is above the operator's exposure authority for. Such a
 * cell is not theirs to latch — it arrives unlatched, it cannot be toggled, and it says in words
 * why, because a disabled control with no reason on it reads as a broken one. The enforcement is
 * not here: `execute()` in webmcp/adapter.ts filters these out of the write set whatever comes
 * back from this field.
 */
export function Detent({
  read, checked, referredTo, onToggle,
}: {
  read: DetentRead;
  checked: boolean;
  referredTo?: string;
  onToggle(): void;
}) {
  const referred = referredTo !== undefined;
  return (
    <button
      type="button"
      className={`dt ${checked ? 'dt--on' : 'dt--off'}${referred ? ' dt--referred' : ''}`}
      aria-pressed={checked}
      disabled={referred}
      aria-label={referred ? `${read.id}. Not yours to authorise, it goes to the ${referredTo}` : undefined}
      onClick={onToggle}
    >
      <span className="dt-top">
        <span className="dt-latch" aria-hidden="true" />
        <span className="dt-id rd">{read.id}</span>
        <span className="dt-city">{read.city}</span>
      </span>
      <span className="dt-mode">
        <b>{read.mode ? modeWord[read.mode] : 'no change'}</b>
        <span className="rd">{pct(read.exposedPct)} exposed</span>
        <span>{convergeWords(read.convergeMinutes)}</span>
      </span>
      <span className="dt-ver rd">
        {read.from} <span className="to">→ {read.to ?? '—'}</span>
      </span>
      {referred && (
        <span className="dt-referred">Not yours. Goes to the {referredTo}</span>
      )}
    </button>
  );
}

/**
 * A held page sits in the same field, because the operator is deciding it in the same breath —
 * but it is not a record and never a diff. It is one irreversible thing that either leaves or
 * does not, and it can never be covered by a standing rule.
 */
export function PageDetent({
  action, checked, onToggle,
}: {
  action: ActionRecord;
  checked: boolean;
  onToggle(): void;
}) {
  const to = String(action.payload.to ?? '');
  const message = String(action.payload.message ?? '');
  return (
    <button
      type="button"
      className={checked ? 'dt dt--page dt--on' : 'dt dt--page dt--off'}
      aria-pressed={checked}
      onClick={onToggle}
    >
      <span className="dt-top">
        <span className="dt-latch" aria-hidden="true" />
        <span className="dt-id rd">{to}</span>
        <span className="dt-city">page · not reversible</span>
      </span>
      <span className="dt-page-msg">“{message}”</span>
    </button>
  );
}
