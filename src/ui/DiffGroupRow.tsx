import type { DiffGroup } from '../core/diff';
import type { WriteRecord } from '../core/types';
import type { BlockedAlternative, Shipment } from '../domain/types';
import { ProofMark } from './ProofMark';
import { readProofRow } from './remedy-diff';
import { remedyCostWords, remedyFull } from './remedy-words';

const signedPrice = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

function formatValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value === null || value === undefined) return '—';
  return JSON.stringify(value);
}

/** Ids, money and dates are monospaced; a status word is prose and stays in the body face. */
const isMono = (field: string) => field === 'remedyCost' || field === 'promisedDelivery';

/**
 * One alternative the constraint layer took off the table, with the rule that took it.
 *
 * This is the half that makes a recommendation honest rather than arbitrary, so it is set the
 * way a proof sets a deletion: the deletion loop in the gutter, the remedy struck through, and
 * the rule spelled out underneath in the words the domain itself uses. Three signals, none of
 * them a colour — the amber only ever agrees with the loop and the rule through the words.
 */
function BlockedRow({ alt }: { alt: BlockedAlternative }) {
  return (
    <li className="dg-blocked">
      <span className="dg-blocked-mark">
        <ProofMark name="dele" size={13} />
      </span>
      <div className="dg-blocked-body">
        <span className="dg-blocked-remedy">{remedyFull(alt.remedy)}</span>
        <span className="dg-blocked-rule">{alt.rule}</span>
        <span className="dg-blocked-id mono">{alt.ruleId}</span>
      </div>
    </li>
  );
}

/** The fallback path: any write this panel has no vocabulary for, set as a plain substitution. */
function FieldRow({ write }: { write: WriteRecord }) {
  return (
    <li className="dg-change">
      <span className="dg-field">{write.field}</span>
      <span className={`dg-before${isMono(write.field) ? ' mono' : ''}`}>
        {formatValue(write.before)}
      </span>
      <span className={`dg-after${isMono(write.field) ? ' mono' : ''}`}>
        {formatValue(write.after)}
      </span>
    </li>
  );
}

export interface DiffGroupRowProps {
  group: DiffGroup;
  /** The live record, for the fields the proposal left as they were. */
  record: Shipment | undefined;
  /** Customer, consol and tier, which live on the record rather than in the diff. */
  subtitle: string;
  checked: boolean;
  onToggle(): void;
}

/**
 * One line of the proof. Marked up, not colour-coded.
 *
 * Kept: the correction is the caret and the remedy's weight; whatever the record said before is
 * struck through the way a compositor strikes what comes out. Struck out: the operator has
 * declined the whole correction, so a rule is drawn across it and it carries the `stet` mark —
 * let the record stand as it is. Both readings survive greyscale, because a strikethrough and a
 * caret are shapes. The blue and the amber only ever agree with the mark that is already there.
 *
 * A row where every alternative was available is two lines. A row where a rule took one away
 * grows by exactly the size of what it lost, so the constrained handful is legible as mass
 * before a single word of it is read — which is the point of showing forty-two of these at once.
 */
export function DiffGroupRow({ group, record, subtitle, checked, onToggle }: DiffGroupRowProps) {
  const delta = group.valueDelta;
  const { remedy, otherWrites } = readProofRow(group, record);

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

        {remedy && (
          <div className="dg-remedy">
            <p className="dg-remedy-line">
              <span className="dg-field">remedy</span>
              {remedy.from && <span className="dg-before">{remedyFull(remedy.from)}</span>}
              <span className="dg-after">{remedyFull(remedy.to)}</span>
            </p>
            {/* The two figures the operator is actually spending: what it costs and what it
                buys back. Tabular, so forty-two of them compare down a column. */}
            <p className="dg-terms">
              <span className="dg-term mono">{remedyCostWords(remedy.cost)}</span>
              <span className="dg-term-sep" aria-hidden="true">·</span>
              <span className="dg-term">
                recovers <span className="mono">{remedy.recoveredHours}</span> h
              </span>
            </p>
            {remedy.blocked.length > 0 && (
              <>
                <p className="dg-blocked-caption">
                  {remedy.blocked.length === 1
                    ? 'Blocked by rule — 1 alternative'
                    : `Blocked by rule — ${remedy.blocked.length} alternatives`}
                </p>
                <ul className="dg-blocked-list">
                  {remedy.blocked.map(alt => (
                    <BlockedRow key={alt.remedy} alt={alt} />
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {otherWrites.length > 0 && (
          <ul className="dg-changes">
            {otherWrites.map(w => (
              <FieldRow key={w.field} write={w} />
            ))}
          </ul>
        )}

        {/* The word, not just the rule through it: a struck line has to say why it is struck. */}
        <span className="dg-struck-note">Struck out — stands as it is</span>
      </div>
    </label>
  );
}
