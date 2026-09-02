import { ProofMark } from './ProofMark';

const money = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

export interface BlastRadiusProps {
  /** Records in the human's current selection. Every figure here is the subset, not the ask. */
  records: number;
  /** Records the agent asked for, drawn as a hatched ghost so narrowing is visible. */
  requested: number;
  /** Rows in the whole console, so the bar reads as a proportion of everything. */
  datasetSize: number;
  valueDelta: number;
  /**
   * What the rows above this operator's limit would cost, in total. Set at the same size as
   * the count, because it is the tension on the sheet: money this reader cannot sign for. The
   * referred rows are on the sheet but never in `valueDelta`, because they are not this
   * person's to mark.
   */
  referredValue?: number;
  /** How many rows that money is spread over, for the figure's own label. */
  referredCount?: number;
  /**
   * False when nothing in the diff touches a priced field. A status-only change has a net of
   * zero and always will, and a large "EUR 0" competing with the record count for hero space
   * says nothing — so the figure appears only when it carries information.
   */
  showMoney: boolean;
  irreversible: number;
  /**
   * True when the proposal writes no rows at all and exists only to send irreversible
   * messages. The record count and the money are both zero there and always will be, so the
   * held count takes the hero slot rather than letting the scariest state be the quietest.
   */
  actionsOnly: boolean;
}

/**
 * The extent of the change: the count, with the ask struck beside it when the operator has cut
 * it down, and the money on either side of the authority line. Three figures on one baseline,
 * set in the serif's own lining figures at the display size; mono is kept for what is looked up
 * down a column. The caption under them is the same fact in words, for a screen reader.
 */
export function BlastRadius(props: BlastRadiusProps) {
  const {
    records, requested, datasetSize, valueDelta, referredValue = 0, referredCount = 0,
    showMoney, irreversible, actionsOnly,
  } = props;

  if (actionsOnly) {
    return (
      <section className="br" aria-label="Extent of this change">
        <div className="br-figures">
          <div className="br-figure">
            <span key={irreversible} className="br-count">{irreversible}</span>
            <span className="br-label">
              {irreversible === 1 ? 'message held' : 'messages held'}
            </span>
          </div>
        </div>
        <p className="br-held">
          <ProofMark name="dagger" size={13} />
          <span>No records change. Each one leaves for a customer and cannot be recalled.</span>
        </p>
      </section>
    );
  }

  const narrowed = records < requested;
  const referredWord = referredCount === 1 ? 'shipment' : 'shipments';

  return (
    <section className="br" aria-label="Extent of this change">
      {/*
        * Three figures at one size on one baseline. The count is what this operator decides;
        * the referred money is what they cannot; the net on the marked rows is what the stamp
        * will cost. Which is which is said by the caption under each, never by a size step.
        */}
      <div className="br-figures">
        <div className="br-figure">
          <span className="br-count-line">
            {/* Keyed on the value so the pulse restarts when the number moves — but the pulse
                is never the only signal: the struck original beside it says the same thing in
                a mark, and the caption says it in words. */}
            <span key={records} className="br-count">{records}</span>
            {/* The ask, struck. Hidden from assistive tech because the caption below already
                says "struck down from 47" in words — this is the same fact as a mark. */}
            {narrowed && (
              <span className="br-count-was" aria-hidden="true">{requested}</span>
            )}
          </span>
          <span className="br-label">marked</span>
        </div>
        {referredValue > 0 && (
          <div className="br-figure br-figure--referred">
            <span className="br-money br-money--referred">{money.format(referredValue)}</span>
            <span className="br-label">
              referred, {referredCount} {referredWord}
            </span>
          </div>
        )}
        {showMoney && (
          <div className="br-figure br-figure--net">
            <span key={valueDelta} className="br-money br-money--net">{money.format(valueDelta)}</span>
            <span className="br-label">{referredValue > 0 ? 'net on the marked rows' : 'net change'}</span>
          </div>
        )}
      </div>

      {irreversible > 0 && (
        <p className="br-held">
          <ProofMark name="dagger" size={13} />
          <span>
            {irreversible}
            {irreversible === 1 ? ' irreversible action' : ' irreversible actions'} held below,
            counted in neither figure above
          </span>
        </p>
      )}

      {/*
        * The one announced sentence on this panel, and spoken only: the count and the struck
        * original above are the same fact drawn, and printing it a second time under them
        * stated the figures twice in a hundred pixels. `role="status"` is polite: it waits for
        * a gap rather than cutting across the operator, and it is the only live region here,
        * because two would read one untick out twice. It is driven by the selection, never by
        * the register's filter, so it cannot fire on a keystroke.
        */}
      <p className="br-caption vh" role="status">
        {records} of {datasetSize} shipments in the register
        {narrowed && (
          <span className="br-caption-narrowed">
            {' '}· struck down from {requested}
          </span>
        )}
      </p>
    </section>
  );
}
