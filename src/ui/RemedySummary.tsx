import { ProofMark } from './ProofMark';
import { money, remedyFull } from './remedy-words';
import type { RemedyTallyLine } from './remedy-diff';

export interface RemedySummaryProps {
  /** One line per remedy actually proposed in the current selection, richest first. */
  lines: RemedyTallyLine[];
  /** Rows in the selection where a rule took at least one alternative away. */
  constrained: number;
  /** Rows in the selection, for the "3 of 41" reading on the constrained line. */
  total: number;
}

export function RemedySummary({ lines, constrained, total }: RemedySummaryProps) {
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
      {/* The dagger says "set apart from the run" before the words do, and before any hue
          does — the same mark held actions and flagged cargo already carry. */}
      <p className="rm-constrained">
        <ProofMark name="dagger" size={13} />
        {constrained === 0 ? (
          total === 1 ? (
            <>Every alternative was open on the one marked row.</>
          ) : (
            <>Every alternative was open on all <span className="mono">{total}</span> marked rows.</>
          )
        ) : (
          <>
            <span className="mono">{constrained}</span> of <span className="mono">{total}</span>{' '}
            marked {total === 1 ? 'row' : 'rows'} {constrained === 1 ? 'has' : 'have'} an
            alternative a rule took away. Each one is named on the row.
          </>
        )}
      </p>
    </section>
  );
}
