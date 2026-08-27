import type { DiffGroup } from '../core/diff';
import type { WriteRecord } from '../core/types';
import type { BlockedAlternative, RemedyId, Shipment } from '../domain/types';
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
 * One rule, and every alternative it took off the table.
 *
 * Grouped by rule rather than one entry per alternative, because a rule that rules out two
 * options rules them out for one reason: printing the same sentence twice under two deletions
 * says the shipment failed two different tests, which is not what happened. A temperature clock
 * that expires before tomorrow morning also expires before a road route, and reading it as one
 * fact with two casualties is both shorter and truer.
 *
 * Set the way a proof sets a deletion: the loop in the gutter, the remedies struck through, and
 * the rule spelled out underneath in the words the domain itself uses. Three signals, none of
 * them a colour — the amber only ever agrees with the loop and the rule through the words.
 */
function BlockedRow({ rule, ruleId, remedies }: { rule: string; ruleId: string; remedies: RemedyId[] }) {
  return (
    <li className="dg-blocked">
      <span className="dg-blocked-mark">
        <ProofMark name="dele" size={13} />
      </span>
      <div className="dg-blocked-body">
        {remedies.map(r => (
          <span className="dg-blocked-remedy" key={r}>{remedyFull(r)}</span>
        ))}
        <span className="dg-blocked-rule">{rule}</span>
        <span className="dg-blocked-id mono">{ruleId}</span>
      </div>
    </li>
  );
}

interface BlockingRule {
  ruleId: string;
  rule: string;
  remedies: RemedyId[];
}

/** Folds the blocked alternatives to one entry per rule, in the order the domain listed them. */
function byRule(blocked: BlockedAlternative[]): BlockingRule[] {
  const out: BlockingRule[] = [];
  for (const alt of blocked) {
    const existing = out.find(r => r.ruleId === alt.ruleId);
    if (existing) existing.remedies.push(alt.remedy);
    else out.push({ ruleId: alt.ruleId, rule: alt.rule, remedies: [alt.remedy] });
  }
  return out;
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
  /**
   * Set when this row's spend is above what the operator on shift may authorise. The row is
   * then not theirs to mark at all, so the control is withheld rather than shown and ignored,
   * and the row says who it went to instead.
   */
  referredTo?: { limitEur: number; role: string };
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
export function DiffGroupRow({
  group, record, subtitle, checked, referredTo, onToggle,
}: DiffGroupRowProps) {
  const delta = group.valueDelta;
  const { remedy, otherWrites } = readProofRow(group, record);
  // A referred row is never struck: nothing has been declined on it. It is set apart instead —
  // a query mark in the gutter, a double rule down its edge, and the word REFER — none of which
  // is a colour, and all three of which read with the hue removed entirely.
  const referred = Boolean(referredTo);

  return (
    <label className={`dg${referred ? ' dg--referred' : checked ? '' : ' dg--struck'}`}>
      {/* One checkbox for the whole record. Approving half of a two-sided change is how
          data goes incoherent, and the engine's unit of approval is the group. */}
      <input
        className="dg-check"
        type="checkbox"
        checked={referred ? false : checked}
        disabled={referred}
        onChange={onToggle}
        aria-label={referred ? `${group.id} — referred, not yours to approve` : `Include ${group.id}`}
      />
      <span className="dg-mark">
        <ProofMark name={referred ? 'query' : checked ? 'insert' : 'stet'} size={15} />
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
                  {byRule(remedy.blocked).map(r => (
                    <BlockedRow key={r.ruleId} rule={r.rule} ruleId={r.ruleId} remedies={r.remedies} />
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

        {/* The stamped word. A struck line has to say why it is struck; a referred row has to
            say whose decision it now is, and what put it out of this operator's reach. */}
        <span className="dg-struck-note">Struck out — stands as it is</span>
        {referredTo && (
          <span className="dg-refer-note">
            <span className="dg-refer-word">Refer</span>
            <span className="dg-refer-tail">
              over your EUR <span className="mono">{referredTo.limitEur}</span> limit — needs
              the {referredTo.role.toLowerCase()}
            </span>
          </span>
        )}
      </div>
    </label>
  );
}
