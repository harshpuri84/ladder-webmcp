/**
 * The engine, drawn.
 *
 * Not a flowchart: a proof sheet's imposition. The run is a printers' rule, each stage is a
 * tick crossing that rule with its correction mark set above it, and the rollback is the
 * dashed rule that a stripper drew when a plate had to go back. Every stroke is
 * `currentColor` at ProofMark's own 1.4 weight, so the drawing carries the ink of the text
 * beside it rather than announcing itself in a colour.
 *
 * Colour is doing no work here at all, which is deliberate — the operator this product is
 * built for has red-green colour vision deficiency, and the mechanism has to survive the
 * drawing being printed in one ink. Sequence is said by position, the return by a dash, and
 * every stage by both a mark and a word.
 *
 * Two arrangements of one stage list rather than one arrangement that scrolls sideways: an
 * SVG cannot reflow, and a five-stage run squeezed into a phone's width stops being readable
 * before it stops fitting. CSS shows exactly one of them, so only one is ever in the
 * accessibility tree.
 */

import { ProofMark } from './ProofMark';
import type { MarkName } from './ProofMark';

interface Stage {
  mark: MarkName;
  /** Pre-split because SVG text does not wrap, and the split is a typographic decision. */
  lines: string[];
}

/**
 * The marks are chosen from the six the system already has, for what they mean on a proof —
 * `query` is a call the reader cannot settle alone and passes on, `registration` is the
 * target printed outside the trim (the fork is exactly that: a copy made off the real sheet),
 * `dele` is what the operator strikes out, `insert` is what is allowed to go in, and `dagger`
 * sets the report apart from the run it describes. The rollback carries `stet` — let it
 * stand, change nothing — which is what a rolled-back commit leaves behind.
 */
const STAGES: Stage[] = [
  { mark: 'query', lines: ['Tool call'] },
  { mark: 'registration', lines: ['Fork and record'] },
  { mark: 'dele', lines: ['Proof — the operator', 'cuts it down'] },
  { mark: 'insert', lines: ['Replay under guard'] },
  { mark: 'dagger', lines: ['Result to the agent'] },
];

const TITLE = 'The engine: one tool function, run twice — once against a fork, once under guard.';

/**
 * The drawing's whole content in words. A screen reader gets the mechanism, not "diagram", and
 * so does anyone reading a printed copy of this page in one ink.
 */
const DESCRIPTION = [
  'How Ladder runs a write tool twice, in five stages.',
  'One: the agent makes a tool call.',
  "Two: Ladder forks the page's state and records every write the tool would make to it.",
  'Three: the proof — the operator reads the recorded writes and cuts them down.',
  'Four: the same tool function runs again under a guard that lets the approved writes',
  'through and skips the rest.',
  'Five: a result goes back to the agent saying what applied and what did not.',
  'A return path runs from the guard back to the start, labelled rolled back: if the tool',
  'goes anywhere the proof never showed, the whole commit is undone.',
].join(' ');

/** A chevron at the run's own weight. A rule terminal, not a new mark. */
function Chevron({ x, y, dir }: { x: number; y: number; dir: 'right' | 'up' | 'down' }) {
  const d =
    dir === 'right' ? 'M -4.5 -4.5 L 0 0 L -4.5 4.5' :
    dir === 'up' ? 'M -4.5 4.5 L 0 0 L 4.5 4.5' :
    'M -4.5 -4.5 L 0 0 L 4.5 -4.5';
  return <path d={d} transform={`translate(${x} ${y})`} />;
}

/**
 * The five stages set left to right along one rule, the way a run is imposed on a sheet.
 *
 * Marks and words both hang above the rule, which is where a proofreader's corrections go, and
 * it leaves the whole band below the rule to the rollback. A return path that had to weave
 * between labels would be the thing a reader traced twice.
 */
function EngineRow() {
  const centres = [96, 228, 360, 492, 624];

  return (
    <svg
      className="ed-svg ed-svg--row"
      viewBox="0 0 700 140"
      role="img"
      aria-label={DESCRIPTION}
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>{TITLE}</title>

      <path d="M96 78 H686" />
      {[162, 294, 426, 558, 684].map(x => <Chevron key={x} x={x} y={78} dir="right" />)}

      {STAGES.map((stage, i) => (
        <g key={stage.mark}>
          <g transform={`translate(${centres[i] - 8} 12)`}>
            <ProofMark name={stage.mark} size={16} />
          </g>
          <text className="ed-label" x={centres[i]} y={46} textAnchor="middle">
            {stage.lines.map((line, j) => (
              <tspan key={line} x={centres[i]} dy={j === 0 ? 0 : 15}>{line}</tspan>
            ))}
          </text>
          <path d={`M${centres[i]} 70 V86`} />
        </g>
      ))}

      {/* Broken where the annotation sits, so the label is read rather than struck through. */}
      <g strokeDasharray="4 4">
        <path d="M492 86 V126 H360" />
        <path d="M232 126 H96 V96" />
      </g>
      <Chevron x={96} y={92} dir="up" />
      <g className="ed-return">
        <g transform="translate(246 107)"><ProofMark name="stet" size={14} /></g>
        <text className="ed-label ed-mono" x={266} y={119}>rolled back</text>
      </g>
    </svg>
  );
}

/** The same run set down the page, for a width where five across stops being readable. */
function EngineColumn() {
  const centres = [40, 132, 224, 316, 408];

  return (
    <svg
      className="ed-svg ed-svg--column"
      viewBox="0 14 340 424"
      role="img"
      aria-label={DESCRIPTION}
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>{TITLE}</title>

      <path d="M140 24 V430" />
      {[86, 178, 270, 362, 426].map(y => <Chevron key={y} x={140} y={y} dir="down" />)}

      {STAGES.map((stage, i) => (
        <g key={stage.mark}>
          <path d={`M131 ${centres[i]} H149`} />
          <g transform={`translate(154 ${centres[i] - 8})`}>
            <ProofMark name={stage.mark} size={16} />
          </g>
          <text
            className="ed-label"
            x={180}
            y={stage.lines.length > 1 ? centres[i] - 3 : centres[i] + 4}
          >
            {stage.lines.map((line, j) => (
              <tspan key={line} x={180} dy={j === 0 ? 0 : 15}>{line}</tspan>
            ))}
          </text>
        </g>
      ))}

      <g strokeDasharray="4 4">
        <path d="M140 316 H24 V196" />
        <path d="M24 150 V40 H126" />
      </g>
      <Chevron x={130} y={40} dir="right" />
      <g className="ed-return">
        <g transform="translate(30 156)"><ProofMark name="stet" size={14} /></g>
        <text className="ed-label ed-mono" x={30} y={188}>rolled back</text>
      </g>
    </svg>
  );
}

export function EngineDiagram() {
  return (
    <div className="ed">
      <EngineRow />
      <EngineColumn />
    </div>
  );
}
