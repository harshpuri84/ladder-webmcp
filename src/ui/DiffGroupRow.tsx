import type { DiffGroup } from '../core/diff';

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

export function DiffGroupRow({ group, subtitle, checked, onToggle }: DiffGroupRowProps) {
  const delta = group.valueDelta;

  return (
    <label className={`dg${checked ? '' : ' dg--off'}`}>
      {/* One checkbox for the whole record. Approving half of a two-sided change is how
          data goes incoherent, and the engine's unit of approval is the group. */}
      <input
        className="dg-check"
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Include ${group.id}`}
      />
      <div className="dg-body">
        <div className="dg-head">
          <span className="dg-id mono">{group.id}</span>
          {delta !== 0 && (
            <span className={`dg-delta mono ${delta > 0 ? 'is-up' : 'is-down'}`}>
              {signedPrice.format(delta)}
            </span>
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
              <span className="dg-arrow" aria-hidden="true">→</span>
              <span className={`dg-after${isMono(w.field) ? ' mono' : ''}`}>
                {formatValue(w.field, w.after)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </label>
  );
}
