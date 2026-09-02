import { money, remedyFull } from './remedy-words';
import type { RemedyTallyLine } from './remedy-diff';

export interface RemedySummaryProps {
  /** One line per remedy actually proposed in the current selection, richest first. */
  lines: RemedyTallyLine[];
}

/**
 * The tally and nothing under it. A line that counted how many rows lost an alternative to a
 * rule stood here until 2 Sep 2026; each such row already says so on its own line below, and
 * the count was the sheet explaining its rows before the reader reached them.
 */
export function RemedySummary({ lines }: RemedySummaryProps) {
  if (lines.length === 0) return null;

  return (
    <section className="rm" aria-label="Remedies in this run">
      <p className="rm-caption">Remedies in this run</p>
      <ul className="rm-list">
        {lines.map(line => (
          <li className="rm-line" key={line.remedy}>
            <span className="rm-count mono">{line.count}</span>
            <span className="rm-name">{remedyFull(line.remedy)}</span>
            <span className="rm-cost mono">{line.cost === 0 ? 'free' : money(line.cost)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
