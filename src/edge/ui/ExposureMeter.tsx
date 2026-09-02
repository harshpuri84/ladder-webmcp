import { pct } from './words';

/**
 * The blast radius, drawn as an instrument face rather than as a hero number on a card.
 *
 * The measurement is the share of ALL production traffic that would begin serving an unproven
 * release, so the scale has to be a share of the whole or the figure means nothing. A rollout
 * usually moves two or three percent, which on a 0–100 face is a sliver — true, and worth seeing,
 * but unreadable. So the face switches range the way a bench meter does, and prints which range
 * it is on. The dashed outline is everything the agent asked for; the filled bar is what the
 * operator has actually latched. Watching the second shrink inside the first is the whole
 * interaction.
 *
 * Two readouts, not one. The figure the engineer can sign is only part of what the agent asked
 * for; the rest is above their authority and goes to a second person. Hiding that share behind
 * "of 7.86% proposed" made the operator subtract to find the number they were accountable for
 * explaining. Both stand on the face at rest, each under its own legend.
 */
const RANGES = [1, 5, 25, 100];
const TICKS = [25, 50, 75];

export function ExposureMeter({
  selectedPct, requestedPct, referredPct = 0, marked, requested,
}: {
  selectedPct: number;
  requestedPct: number;
  /** Share above this operator's limit, going to a second approver. Never theirs to latch. */
  referredPct?: number;
  marked: number;
  requested: number;
}) {
  const range = RANGES.find(r => requestedPct <= r) ?? 100;
  const fraction = (v: number) => Math.max(0.006, Math.min(1, v / range));
  const width = (v: number) => `${fraction(v) * 100}%`;
  const referred = referredPct > 0;

  return (
    <section aria-label="Exposure">
      <span className="lg">Production traffic exposed</span>
      {/*
        * The readout, and the only announced thing in the drawer. Everything else here is this
        * same reading drawn — the bar, the hatched band, the axis — and DESIGN.md Part II's rule
        * is that the figure above the bar is legible at rest, without watching it move. A screen
        * reader gets the same guarantee: `role="status"` is polite, so it waits for a gap rather
        * than cutting across the engineer, and there is exactly one of it, because two would read
        * one unlatch out twice. It moves only when a latch moves, never on a keystroke.
        */}
      <div role="status">
        <div className="mtr-pair">
          <span className="mtr-cell">
            <span className="mtr-val">{pct(selectedPct)}</span>
            <span className="mtr-lg">you can authorise</span>
          </span>
          {referred && (
            <span className="mtr-cell mtr-cell--referred">
              <span className="mtr-val">{pct(referredPct)}</span>
              <span className="mtr-lg">referred</span>
            </span>
          )}
        </div>
        <span className="mtr-unit">
          of <span className="rd">{pct(requestedPct)}</span> proposed{' · '}
          <span className="rd">{marked}</span> of <span className="rd">{requested}</span>{' '}
          {requested === 1 ? 'site' : 'sites'} latched
        </span>
      </div>

      <div className="mtr-scale" role="img" aria-label={`${pct(selectedPct)} of production traffic, on a ${range} percent range`}>
        {TICKS.map(t => <span className="mtr-tick" key={t} style={{ left: `${t}%` }} />)}
        <span className="mtr-req" style={{ width: width(requestedPct) }} />
        <span className="mtr-sel" style={{ transform: `scaleX(${fraction(selectedPct)})` }} />
      </div>
      <div className="mtr-axis">
        <span>0</span>
        <span>{range}% OF PRODUCTION TRAFFIC</span>
      </div>
    </section>
  );
}
