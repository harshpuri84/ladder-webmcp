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

/** Fraction 0–1, with a sliver floor so one record out of two hundred is still visible. */
function share(n: number, total: number) {
  if (total <= 0 || n <= 0) return 0;
  return Math.max(n / total, 0.008);
}

/**
 * The extent of the change, stated three ways so no one of them has to be trusted alone: the
 * count, the money, and the proportion of the register the marked rows occupy.
 *
 * The bar is driven by `transform: scaleX` from a left origin, never by animating `width` —
 * this is the most-watched motion in the product and it must not force layout on every frame.
 * Nothing sits inside the scaled elements, so nothing needs counter-scaling. The requested
 * extent is hatched and the marked extent is solid: a texture difference, legible with the
 * colour taken out, with the tick at the requested edge as the third reading.
 */
export function BlastRadius(props: BlastRadiusProps) {
  const { records, requested, datasetSize, valueDelta, showMoney, irreversible, actionsOnly } = props;

  if (actionsOnly) {
    return (
      <section className="br" aria-label="Extent of this change">
        <div className="br-figures">
          <div className="br-figure">
            <span key={irreversible} className="br-count mono">{irreversible}</span>
            <span className="br-label">
              {irreversible === 1 ? 'message held' : 'messages held'}
            </span>
          </div>
        </div>
        <p className="br-held">
          <ProofMark name="dagger" size={13} />
          No records change. Each one leaves for a customer and cannot be recalled.
        </p>
      </section>
    );
  }

  const narrowed = records < requested;

  return (
    <section className="br" aria-label="Extent of this change">
      <div className="br-figures">
        <div className="br-figure">
          <span className="br-count-line">
            {/* Keyed on the value so the pulse restarts when the number moves — but the pulse
                is never the only signal: the struck original beside it says the same thing in
                a mark, and the caption says it in words. */}
            <span key={records} className="br-count mono">{records}</span>
            {/* The ask, struck. Hidden from assistive tech because the caption below already
                says "struck down from 47" in words — this is the same fact as a mark. */}
            {narrowed && (
              <span className="br-count-was mono" aria-hidden="true">{requested}</span>
            )}
          </span>
          <span className="br-label">records marked</span>
        </div>
        {showMoney && (
          <div className="br-figure br-figure--money">
            <span key={valueDelta} className="br-money mono">{money.format(valueDelta)}</span>
            <span className="br-label">net change</span>
          </div>
        )}
      </div>

      {irreversible > 0 && (
        <p className="br-held">
          <ProofMark name="dagger" size={13} />
          <span className="mono">{irreversible}</span>
          {irreversible === 1 ? ' irreversible action' : ' irreversible actions'} held below,
          counted in neither figure above
        </p>
      )}

      <div
        className="br-bar"
        role="img"
        aria-label={`${records} of ${datasetSize} shipments in the register`}
      >
        <div className="br-bar-ask" style={{ transform: `scaleX(${share(requested, datasetSize)})` }} />
        <div className="br-bar-take" style={{ transform: `scaleX(${share(records, datasetSize)})` }} />
        {/* At 11 of 200 the hatched ask is a sliver, so the fill retreating inside it would read
            only in the caption. This tick marks where the ask ended and stays legible at any
            fill. It sits outside both scaled elements, so it needs no counter-scaling. */}
        <div className="br-bar-tick" style={{ left: `${share(requested, datasetSize) * 100}%` }} />
      </div>

      <p className="br-caption">
        <span className="mono">{records}</span> of <span className="mono">{datasetSize}</span>{' '}
        shipments in the register
        {narrowed && (
          <span className="br-caption-narrowed">
            {' '}· struck down from <span className="mono">{requested}</span>
          </span>
        )}
      </p>
    </section>
  );
}
