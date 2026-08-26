const money = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

export interface BlastRadiusProps {
  /** Records in the human's current selection. Every figure here is the subset, not the ask. */
  records: number;
  /** Records the agent asked for, drawn as a ghost behind the fill so narrowing is visible. */
  requested: number;
  /** Rows in the whole console, so the bar reads as a proportion of everything. */
  datasetSize: number;
  valueDelta: number;
  /**
   * False when nothing in the diff touches a priced field. A status-only change has a net of
   * zero and always will, and a 32px "EUR 0" competing with the record count for hero space
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

/** Width in percent, with a sliver floor so one record out of two hundred is still visible. */
function share(n: number, total: number) {
  if (total <= 0 || n <= 0) return 0;
  return Math.max((n / total) * 100, 0.8);
}

export function BlastRadius(props: BlastRadiusProps) {
  const { records, requested, datasetSize, valueDelta, showMoney, irreversible, actionsOnly } = props;

  if (actionsOnly) {
    return (
      <section className="br" aria-label="Blast radius">
        <div className="br-figures">
          <div className="br-figure">
            <span key={irreversible} className="br-count mono">{irreversible}</span>
            <span className="br-label">
              {irreversible === 1 ? 'message held' : 'messages held'}
            </span>
          </div>
        </div>
        <p className="br-caption">
          No records change. Each one leaves for a customer and cannot be recalled.
        </p>
      </section>
    );
  }

  return (
    <section className="br" aria-label="Blast radius">
      <div className="br-figures">
        <div className="br-figure">
          {/* Keyed on the value so the pulse animation restarts whenever the number moves. */}
          <span key={records} className="br-count mono">{records}</span>
          <span className="br-label">records</span>
        </div>
        {showMoney && (
          <div className="br-figure br-figure--money">
            <span key={valueDelta} className="br-money mono">{money.format(valueDelta)}</span>
            <span className="br-label">net change</span>
          </div>
        )}
      </div>

      {irreversible > 0 && (
        <p className="br-irreversible">
          <span className="mono">{irreversible}</span>
          {irreversible === 1 ? ' irreversible action' : ' irreversible actions'} held below
        </p>
      )}

      <div
        className="br-bar"
        role="img"
        aria-label={`${records} of ${datasetSize} shipments in the console`}
      >
        <div className="br-bar-requested" style={{ width: `${share(requested, datasetSize)}%` }} />
        <div className="br-bar-fill" style={{ width: `${share(records, datasetSize)}%` }} />
      </div>

      <p className="br-caption">
        <span className="mono">{records}</span> of <span className="mono">{datasetSize}</span>{' '}
        shipments in the console
        {records < requested && (
          <span className="br-caption-narrowed">
            {' '}· narrowed from <span className="mono">{requested}</span>
          </span>
        )}
      </p>
    </section>
  );
}
