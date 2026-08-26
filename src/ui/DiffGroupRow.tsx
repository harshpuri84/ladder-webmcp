import type { DiffGroup } from '../core/diff';
import { ProofMark } from './ProofMark';

const price = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const signedPrice = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

function formatValue(field: string, value: unknown) {
  if (field === 'price' && typeof value === 'number') return price.format(value);
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

/** Ids, money and dates are monospaced; a status word is prose and stays in the body face. */
const isMono = (field: string) => field === 'price' || field === 'eta';

export interface DiffGroupRowProps {
  group: DiffGroup;
  /** Customer and lane, which live on the record rather than in the diff. */
  subtitle: string;
  checked: boolean;
  onToggle(): void;
}

/**
 * One line of the proof. Marked up, not colour-coded.
 *
 * Kept: the correction is the caret and the new value's weight; the old value is struck through
 * the way a compositor strikes what comes out. Struck out: the operator has declined the whole
 * correction, so a rule is drawn across it and it carries the `stet` mark — let the record
 * stand as it is. Both readings survive greyscale, because a strikethrough and a caret are
 * shapes. The blue and the amber only ever agree with the mark that is already there.
 */
export function DiffGroupRow({ group, subtitle, checked, onToggle }: DiffGroupRowProps) {
  const delta = group.valueDelta;

  return (
    <label className={`dg${checked ? '' : ' dg--struck'}`}>
      {/* One checkbox for the whole record. Approving half of a two-sided change is how
          data goes incoherent, and the engine's unit of approval is the group. */}
      <input
        className="dg-check"
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Include ${group.id}`}
      />
      <span className="dg-mark">
        <ProofMark name={checked ? 'insert' : 'stet'} size={15} />
      </span>
      <div className="dg-body">
        <div className="dg-head">
          <span className="dg-id mono">{group.id}</span>
          {delta !== 0 && (
            <span className="dg-delta mono">{signedPrice.format(delta)}</span>
          )}
        </div>
        <div className="dg-sub">{subtitle}</div>
        <ul className="dg-changes">
          {group.writes.map(w => (
            <li key={w.field} className="dg-change">
              <span className="dg-field">{w.field}</span>
              <span className={`dg-before${isMono(w.field) ? ' mono' : ''}`}>
                {formatValue(w.field, w.before)}
              </span>
              <span className={`dg-after${isMono(w.field) ? ' mono' : ''}`}>
                {formatValue(w.field, w.after)}
              </span>
            </li>
          ))}
        </ul>
        {/* The word, not just the rule through it: a struck line has to say why it is struck. */}
        <span className="dg-struck-note">Struck out — stands as it is</span>
      </div>
    </label>
  );
}
