/**
 * Where the tool lives, drawn.
 *
 * One figure, two bands with the same composition: an agent calls a tool that sits inside a
 * boundary. In the upper band the boundary is a server's, drawn dashed because nobody on this
 * side of it has a view in, and the operator stands outside it. In the lower band the boundary
 * is the operator's own tab, drawn as a solid trim line, and the operator stands inside it, at
 * the proof, where the engine runs: fork, proof, guard, result, and the rolled-back return.
 *
 * Printers' rules, `currentColor` at ProofMark's own 1.4 weight, square corners, one ink. The
 * boundaries are told apart by rule form and never by hue; the operator this is drawn for has
 * red-green colour vision deficiency, and the drawing has to say which band has the human
 * inside with every caption covered.
 *
 * Two arrangements of one drawing rather than one that scrolls sideways. CSS shows exactly
 * one, so only one is ever in the accessibility tree.
 */

import { ProofMark } from './ProofMark';

const TITLE =
  'Two placements for one tool: on a server with the operator outside the boundary, in the ' +
  'page with the operator inside it.';

/**
 * The whole drawing in words. A screen reader gets the argument, not "diagram", and so does
 * anyone holding a printed copy of this page in one ink.
 */
const DESCRIPTION = [
  'Two placements for the same tool, drawn as two bands.',
  'Upper band, before WebMCP: the tool lives on a server.',
  'The agent calls an MCP server, whose execute runs there, and the server reaches the records.',
  "A dashed boundary encloses the server and the records: the server's tools, the server's",
  'credentials. The operator is drawn below that boundary, outside it, joined to nothing, and',
  'finds out afterwards.',
  'Lower band, WebMCP: the tool lives in the page.',
  "The agent's tool call crosses a solid boundary, the operator's own tab and the operator's",
  'own session, and inside it the same function runs twice.',
  "First Ladder forks the page's state and records every write the tool would make.",
  'Then the proof: the operator, drawn inside the boundary at this stage, reads the recorded',
  'writes and cuts them down.',
  'Then the same function replays under a guard that lets the approved writes through and',
  'skips the rest, into the app state.',
  'A result goes back to the agent saying what applied and what did not.',
  'A dashed return path runs from the guard back to the fork, labelled rolled back: if the',
  'tool goes anywhere the proof never showed, the whole commit is undone.',
  'The one thing to take from the drawing: in the second band the operator is inside the',
  'boundary.',
].join(' ');

/** A chevron at the run's own weight: a rule terminal, not a seventh mark. */
function Chevron({ x, y, dir }: { x: number; y: number; dir: 'right' | 'up' | 'down' }) {
  const d =
    dir === 'right' ? 'M -4.5 -4.5 L 0 0 L -4.5 4.5' :
    dir === 'up' ? 'M -4.5 4.5 L 0 0 L 4.5 4.5' :
    'M -4.5 -4.5 L 0 0 L 4.5 -4.5';
  return <path d={d} transform={`translate(${x} ${y})`} />;
}

/**
 * The operator, drawn: a head and a pair of shoulders in the run's own ink. The only thing that
 * moves between the bands is which side of a boundary this figure stands on, so it is drawn
 * large enough to be found with the captions covered. The words beside it say the same thing.
 */
function Operator({
  x,
  y,
  caption,
  side = 'right',
}: {
  x: number;
  y: number;
  caption: string;
  side?: 'right' | 'below';
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={7} />
      <path d={`M${x - 15} ${y + 34} C ${x - 15} ${y + 15}, ${x + 15} ${y + 15}, ${x + 15} ${y + 34}`} />
      {side === 'right' ? (
        <>
          <text className="pd-label pd-band" x={x + 26} y={y + 12}>Operator</text>
          <text className="pd-label pd-note" x={x + 26} y={y + 30}>{caption}</text>
        </>
      ) : (
        <>
          <text className="pd-label pd-band" x={x} y={y + 54} textAnchor="middle">Operator</text>
          <text className="pd-label pd-note" x={x} y={y + 72} textAnchor="middle">{caption}</text>
        </>
      )}
    </g>
  );
}

/** A station on the run: a tick across the rule and its name above, one or two lines. */
function Station({ x, y, lines, mono }: { x: number; y: number; lines: string[]; mono?: boolean }) {
  const first = lines.length > 1 ? y - 29 : y - 14;
  return (
    <g>
      <text className="pd-label" x={x} y={first} textAnchor="middle">
        {lines.map((line, i) => (
          <tspan
            key={line}
            x={x}
            dy={i === 0 ? 0 : 15}
            className={mono && i === lines.length - 1 ? 'pd-mono' : undefined}
          >
            {line}
          </tspan>
        ))}
      </text>
      <path d={`M${x} ${y - 8} V${y + 8}`} />
    </g>
  );
}

/** The two bands set as two horizontal runs, one above the other. */
function PlacementRow() {
  return (
    <svg
      className="pd-svg pd-svg--row"
      viewBox="0 0 700 704"
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

      {/* ---------- upper band: the tool on a server ---------- */}
      <text className="pd-label pd-band" x={0} y={16}>Before WebMCP: the tool lives on a server</text>
      <text className="pd-label pd-note" x={692} y={16} textAnchor="end">
        the server's tools, the server's credentials
      </text>

      {/* Dashed: a boundary drawn around somewhere the operator has no view into. */}
      <rect x={104} y={40} width={588} height={110} strokeDasharray="5 4" />

      <path d="M50 110 H620" />
      <Chevron x={100} y={110} dir="right" />
      <Chevron x={470} y={110} dir="right" />

      <Station x={50} y={110} lines={['Agent']} />
      <Station x={330} y={110} lines={['MCP server', 'execute()']} mono />
      <Station x={620} y={110} lines={['Records']} />

      {/* Below the boundary's bottom rule, and joined to nothing. */}
      <Operator x={330} y={186} caption="outside the boundary, finds out afterwards" side="below" />

      {/* ---------- lower band: the tool in the page ---------- */}
      <text className="pd-label pd-band" x={0} y={346}>WebMCP: the tool lives in the page</text>
      <text className="pd-label pd-note" x={692} y={346} textAnchor="end">
        the operator's own tab, the operator's own session
      </text>

      {/* Solid: the trim line of the operator's own sheet. */}
      <rect x={104} y={370} width={588} height={320} />

      <path d="M50 450 H650" />
      <Chevron x={100} y={450} dir="right" />
      <Chevron x={230} y={450} dir="right" />
      <Chevron x={350} y={450} dir="right" />
      <Chevron x={470} y={450} dir="right" />
      <Chevron x={590} y={450} dir="right" />
      <text className="pd-label pd-mono pd-note" x={112} y={471}>WebMCP</text>

      <Station x={50} y={450} lines={['Agent']} />
      <Station x={170} y={450} lines={['The page', 'execute()']} mono />
      <Station x={290} y={450} lines={['Fork and', 'record']} />
      <Station x={410} y={450} lines={['Proof, cut', 'down']} />
      <Station x={530} y={450} lines={['Replay', 'under guard']} />
      <Station x={650} y={450} lines={['App state']} />

      {/* Inside the boundary, at the proof. */}
      <Operator x={410} y={520} caption="inside the boundary, in the room" side="below" />

      {/* The rollback: the dashed rule a stripper drew when a plate had to go back. Broken where
          the annotation sits, so the label is read rather than struck through. */}
      <g strokeDasharray="4 4">
        <path d="M530 458 V640 H444" />
        <path d="M326 640 H290 V466" />
      </g>
      <Chevron x={290} y={462} dir="up" />
      <g className="pd-return">
        <g transform="translate(332 633)"><ProofMark name="stet" size={14} /></g>
        <text className="pd-label pd-mono" x={352} y={645}>rolled back</text>
      </g>
      {/* The result: the run leaves the box the way it came in, dotted, back to the agent. */}
      <path d="M650 458 V668 H60 V470" strokeDasharray="1.4 5" />
      <Chevron x={60} y={466} dir="up" />
      <text className="pd-label pd-mono pd-note" x={640} y={662} textAnchor="end">result to the agent</text>
    </svg>
  );
}

/** The same two bands set down the page, for a width where a horizontal run stops being readable. */
function PlacementColumn() {
  return (
    <svg
      className="pd-svg pd-svg--column"
      viewBox="0 0 320 950"
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

      {/* ---------- upper band ---------- */}
      <text className="pd-label pd-band" x={0} y={14}>Before WebMCP: the tool lives on a server</text>
      <text className="pd-label pd-note" x={0} y={34}>
        the server's tools,
        <tspan x={0} dy={15}>the server's credentials</tspan>
      </text>

      <rect x={10} y={122} width={302} height={124} strokeDasharray="5 4" />

      <path d="M44 82 V222" />
      <Chevron x={44} y={118} dir="down" />
      <Chevron x={44} y={190} dir="down" />

      <path d="M35 82 H53" />
      <text className="pd-label" x={64} y={86}>Agent</text>
      <path d="M35 156 H53" />
      <text className="pd-label" x={64} y={152}>MCP server</text>
      <text className="pd-label pd-mono" x={64} y={168}>execute()</text>
      <path d="M35 222 H53" />
      <text className="pd-label" x={64} y={226}>Records</text>

      <Operator x={44} y={278} caption="outside the boundary, finds out afterwards" />

      {/* ---------- lower band ---------- */}
      <text className="pd-label pd-band" x={0} y={372}>WebMCP: the tool lives in the page</text>
      <text className="pd-label pd-note" x={0} y={392}>
        the operator's own tab,
        <tspan x={0} dy={15}>the operator's own session</tspan>
      </text>

      <rect x={10} y={480} width={302} height={460} />

      <path d="M44 440 V870" />
      <Chevron x={44} y={476} dir="down" />
      <Chevron x={44} y={540} dir="down" />
      <Chevron x={44} y={604} dir="down" />
      <Chevron x={44} y={700} dir="down" />
      <Chevron x={44} y={800} dir="down" />
      <text className="pd-label pd-mono pd-note" x={54} y={470}>WebMCP</text>

      <path d="M35 440 H53" />
      <text className="pd-label" x={64} y={444}>Agent</text>
      <path d="M35 512 H53" />
      <text className="pd-label" x={64} y={508}>The page</text>
      <text className="pd-label pd-mono" x={64} y={524}>execute()</text>
      <path d="M35 576 H53" />
      <text className="pd-label" x={64} y={580}>Fork and record</text>
      <path d="M35 640 H53" />
      <text className="pd-label" x={64} y={644}>Proof, cut down</text>
      <Operator x={100} y={672} caption="inside the boundary, in the room" />
      <path d="M35 770 H53" />
      <text className="pd-label" x={64} y={774}>Replay under guard</text>
      <path d="M35 870 H53" />
      <text className="pd-label" x={64} y={874}>App state</text>

      <g strokeDasharray="4 4">
        <path d="M44 770 H24 V720" />
        <path d="M24 690 V576 H36" />
      </g>
      <Chevron x={40} y={576} dir="right" />
      <g className="pd-return">
        <g transform="translate(17 698)"><ProofMark name="stet" size={14} /></g>
        <text className="pd-label pd-mono" transform="rotate(-90 9 790)" x={9} y={790}>rolled back</text>
      </g>
      <path d="M44 870 V900" strokeDasharray="1.4 5" />
      <Chevron x={44} y={902} dir="down" />
      <text className="pd-label pd-mono pd-note" x={56} y={922}>result to the agent</text>
    </svg>
  );
}

export function PlacementDiagram() {
  return (
    <div className="pd">
      <PlacementRow />
      <PlacementColumn />
    </div>
  );
}
