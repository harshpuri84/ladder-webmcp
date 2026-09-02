import type { DiffGroup } from '../core/diff';
import type { WriteRecord } from '../core/types';
import type { BlockedAlternative, RemedyId, Shipment } from '../domain/types';
import { ProofMark } from './ProofMark';
import { readProofRow } from './remedy-diff';
import { remedyCostWords, remedyFull, remedyShort } from './remedy-words';

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
 * The remedies dropped to the muted ink under the caption that says why, and the rule spelled
 * out underneath in the words the domain itself uses. Not struck through: a strike on this sheet
 * is a correction somebody made, and a rule closing an option is a different fact from an
 * operator or a proof cutting a figure. No mark in the gutter: the dagger on this sheet means
 * one thing, a row referred to a second person, and this is not that. The rule's id is in the
 * receipt's payload for anyone who needs to quote it; a proof sheet addressed to an operator
 * does not end on a developer's slug.
 */
function BlockedRow({ rule, remedies }: { rule: string; remedies: RemedyId[] }) {
  return (
    <li className="dg-blocked">
      <div className="dg-blocked-body">
        {remedies.map(r => (
          <span className="dg-blocked-remedy" key={r}>{remedyFull(r)}</span>
        ))}
        <span className="dg-blocked-rule">{rule}</span>
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
   * then not theirs to mark at all, so it carries no control; the line above the referred
   * group says who decides it instead.
   */
  referred?: boolean;
  /** A referred row opens on demand; the specimen on the landing page is inert and so prints
   *  it open, since nobody can open it there. */
  expanded?: boolean;
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
  group, record, subtitle, checked, referred = false, expanded = false, onToggle,
}: DiffGroupRowProps) {
  const delta = group.valueDelta;
  const { remedy, otherWrites } = readProofRow(group, record);

  const remedyBlock = remedy && (
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
              ? 'Blocked by rule, 1 alternative'
              : `Blocked by rule, ${remedy.blocked.length} alternatives`}
          </p>
          <ul className="dg-blocked-list">
            {byRule(remedy.blocked).map(r => (
              <BlockedRow key={r.ruleId} rule={r.rule} remedies={r.remedies} />
            ))}
          </ul>
        </>
      )}
    </div>
  );

  const otherBlock = otherWrites.length > 0 && (
    <ul className="dg-changes">
      {otherWrites.map(w => (
        <FieldRow key={w.field} write={w} />
      ))}
    </ul>
  );

  // A referred row is not this operator's to read line by line before they can reach their
  // own: it is one line, the id, the customer, the remedy and the amount, and the reason and
  // the blocked alternatives open under it on demand. Three of these stacked as full cards put
  // the operator's first row below the fold (2 Sep 2026, 1512x945).
  if (referred) {
    return (
      <details className="dg dg--referred" open={expanded || undefined}>
        <summary className="dg-refer-summary">
          <span className="dg-id mono">{group.id}</span>
          <span className="dg-refer-customer">{record?.customer ?? ''}</span>
          {remedy && <span className="dg-refer-remedy">{remedyShort(remedy.to)}</span>}
          {delta !== 0 && (
            <span className="dg-delta mono">{signedPrice.format(delta)}</span>
          )}
          {/* The word that says the line opens, and the word that says it closes. Hidden
              from the name: the disclosure state is already announced. */}
          <span className="dg-refer-toggle" aria-hidden="true">
            <span className="dg-refer-toggle-closed">reason</span>
            <span className="dg-refer-toggle-open">close</span>
          </span>
        </summary>
        <div className="dg-body">
          <div className="dg-sub">{subtitle}</div>
          {remedyBlock}
          {otherBlock}
        </div>
      </details>
    );
  }

  // A referred row (above) is never struck: nothing has been declined on it. It is set apart
  // instead, by carrying no control at all, a double rule down its edge, and its place under
  // the line that names whose decision it is. None of that is a colour. A marked row carries a
  // solid rule down the same edge, and the register draws the same two rule forms on the same
  // rows (see `console-row--marked` and `console-row--referred` in styles.css), so the eye
  // crosses from the sheet to the register on one device.
  return (
    <label className={`dg${checked ? ' dg--marked' : ' dg--struck'}`}>
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
        {remedyBlock}
        {otherBlock}
      </div>
    </label>
  );
}
