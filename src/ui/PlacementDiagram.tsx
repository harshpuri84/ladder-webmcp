/**
 * Where the tool lives, drawn.
 *
 * The argument this page has to make is not that WebMCP is unfinished; it is that WebMCP is
 * *right*, and that everything Ladder does is only available because the tool's `execute()`
 * runs inside the tab the operator already has open. That is an argument about position, so
 * the drawing is about position too: two bands with the same composition, differing in one
 * fact — which side of a boundary the operator stands on.
 *
 * Same language as `EngineDiagram`, its sibling on this page: printers' rules, ProofMark
 * shapes, `currentColor` at ProofMark's own 1.4 weight, square corners, no library. The two
 * bands are compositionally identical on purpose. A reader who cannot see the difference in
 * one glance has been shown a picture instead of an argument.
 *
 * **The two boundaries are told apart by rule form, never by hue.** The server's boundary is
 * dashed, the way a stripper drew an edge on a plate they had no view inside; the tab's is a
 * solid trim line, a real edge on the operator's own sheet. Print the page in one ink and
 * nothing here becomes ambiguous — which is the binding constraint, not a preference: the
 * operator this product is built for has red-green colour vision deficiency.
 *
 * Two arrangements of one drawing rather than one that scrolls sideways, for the same reason
 * `EngineDiagram` has two. CSS shows exactly one, so only one is ever in the accessibility
 * tree.
 */

import { ProofMark } from './ProofMark';

const TITLE =
  'Two placements for one tool: on a server with the operator outside, in the page with the ' +
  'operator inside.';

/**
 * The whole drawing in words. A screen reader gets the argument, not "diagram", and so does
 * anyone holding a printed copy of this page in one ink.
 */
const DESCRIPTION = [
  'Two placements for the same tool, drawn as two bands.',
  'Upper band, before WebMCP: the tool lives on a server.',
  'The agent calls an MCP server, and the MCP server reaches the records.',
  "A dashed boundary encloses the server and the records: the server's tools, the server's",
  'credentials. The operator is drawn outside that boundary, connected to nothing, and finds',
  'out afterwards.',
  'Lower band, WebMCP: the tool lives in the page.',
  "The agent calls the browser's WebMCP runtime, which calls into a solid boundary labelled",
  "the operator's own tab, the operator's own session.",
  "That boundary encloses the page, Ladder's guard, the app state, and the operator, who is in",
  'the room. Nothing crosses it to a server.',
  'The one thing to take from the drawing: in the second band the operator is inside the',
  'boundary.',
].join(' ');

/**
 * A chevron at the run's own weight: a rule terminal, not a seventh mark.
 *
 * Deliberately a local copy of the one in `EngineDiagram` rather than an export prised out of
 * it. Six lines of path data are cheaper than reaching into a shipped component, and the two
 * drawings stay independently editable.
 */
function Chevron({ x, y, dir }: { x: number; y: number; dir: 'right' | 'down' }) {
  const d = dir === 'right' ? 'M -4.5 -4.5 L 0 0 L -4.5 4.5' : 'M -4.5 -4.5 L 0 0 L 4.5 -4.5';
  return <path d={d} transform={`translate(${x} ${y})`} />;
}

/**
 * The operator, and the only thing that changes between the bands.
 *
 * `dagger` is the reference mark: set apart from the main run, which is exactly what an
 * operator on the far side of a server boundary is. `insert` is the caret: this correction
 * goes in, which is exactly what an operator inside the tab does. Both marks are hidden from
 * assistive technology and both are redundant — the word `Operator` and the caption say it.
 */
function Operator({
  x,
  y,
  mark,
  caption,
}: {
  x: number;
  y: number;
  mark: 'dagger' | 'insert';
  caption: string;
}) {
  return (
    <g>
      <g transform={`translate(${x} ${y})`}>
        <ProofMark name={mark} size={14} />
      </g>
      <text className="pd-label" x={x + 22} y={y + 12}>Operator</text>
      <text className="pd-label pd-note" x={x + 22} y={y + 30}>{caption}</text>
    </g>
  );
}

/** The two bands set as two horizontal runs, the way two states of a job are imposed on a sheet. */
function PlacementRow() {
  return (
    <svg
      className="pd-svg pd-svg--row"
      viewBox="0 0 700 352"
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
      <text className="pd-label pd-band" x={0} y={14}>Before: the tool lives on a server</text>
      <text className="pd-label pd-note" x={692} y={14} textAnchor="end">
        the server's tools, the server's credentials
      </text>

      {/* Dashed: a boundary drawn around somewhere the operator has no view into. */}
      <rect x={252} y={28} width={440} height={68} strokeDasharray="5 4" />

      <path d="M60 70 H596" />
      <Chevron x={268} y={70} dir="right" />
      <Chevron x={490} y={70} dir="right" />

      <text className="pd-label" x={60} y={56} textAnchor="middle">Agent</text>
      <path d="M60 62 V78" />
      <text className="pd-label" x={372} y={56} textAnchor="middle">MCP server</text>
      <path d="M372 62 V78" />
      <text className="pd-label" x={596} y={56} textAnchor="middle">Records</text>
      <path d="M596 62 V78" />

      {/* Below the boundary's bottom rule, and joined to nothing. */}
      <Operator x={296} y={114} mark="dagger" caption="finds out afterwards" />

      {/* ---------- lower band: the tool in the page ---------- */}
      <text className="pd-label pd-band" x={0} y={206}>WebMCP: the tool lives in the page</text>
      <text className="pd-label pd-note" x={692} y={206} textAnchor="end">
        the operator's own tab, the operator's own session
      </text>

      {/* Solid: the trim line of the operator's own sheet. */}
      <rect x={252} y={220} width={440} height={118} />

      <path d="M60 262 H606" />
      <Chevron x={100} y={262} dir="right" />
      <Chevron x={268} y={262} dir="right" />
      <Chevron x={389} y={262} dir="right" />
      <Chevron x={545} y={262} dir="right" />

      <text className="pd-label" x={60} y={248} textAnchor="middle">Agent</text>
      <path d="M60 254 V270" />
      <text className="pd-label" x={168} y={248} textAnchor="middle">WebMCP runtime</text>
      <path d="M168 254 V270" />
      <text className="pd-label" x={326} y={248} textAnchor="middle">The page</text>
      <path d="M326 254 V270" />
      <text className="pd-label" x={470} y={248} textAnchor="middle">Ladder's guard</text>
      <path d="M470 254 V270" />
      <text className="pd-label" x={606} y={248} textAnchor="middle">App state</text>
      <path d="M606 254 V270" />

      {/* Same x as the band above. Only the boundary moved. */}
      <Operator x={296} y={294} mark="insert" caption="in the room" />
    </svg>
  );
}

/** The same two bands set down the page, for a width where a horizontal run stops being readable. */
function PlacementColumn() {
  return (
    <svg
      className="pd-svg pd-svg--column"
      viewBox="0 0 320 690"
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
      <text className="pd-label pd-band" x={0} y={14}>Before: the tool lives on a server</text>
      <text className="pd-label pd-note" x={0} y={34}>
        the server's tools,
        <tspan x={0} dy={15}>the server's credentials</tspan>
      </text>

      <rect x={10} y={134} width={302} height={116} strokeDasharray="5 4" />

      <path d="M44 82 V218" />
      <Chevron x={44} y={126} dir="down" />
      <Chevron x={44} y={192} dir="down" />

      <path d="M35 82 H53" />
      <text className="pd-label" x={64} y={86}>Agent</text>
      <path d="M35 166 H53" />
      <text className="pd-label" x={64} y={170}>MCP server</text>
      <path d="M35 212 H53" />
      <text className="pd-label" x={64} y={216}>Records</text>

      <Operator x={26} y={262} mark="dagger" caption="finds out afterwards" />

      {/* ---------- lower band ---------- */}
      <text className="pd-label pd-band" x={0} y={344}>WebMCP: the tool lives in the page</text>
      <text className="pd-label pd-note" x={0} y={364}>
        the operator's own tab,
        <tspan x={0} dy={15}>the operator's own session</tspan>
      </text>

      <rect x={10} y={464} width={302} height={210} />

      <path d="M44 412 V602" />
      <Chevron x={44} y={434} dir="down" />
      <Chevron x={44} y={476} dir="down" />
      <Chevron x={44} y={524} dir="down" />
      <Chevron x={44} y={574} dir="down" />

      <path d="M35 412 H53" />
      <text className="pd-label" x={64} y={416}>Agent</text>
      <path d="M35 452 H53" />
      <text className="pd-label" x={64} y={456}>WebMCP runtime</text>
      <path d="M35 496 H53" />
      <text className="pd-label" x={64} y={500}>The page</text>
      <path d="M35 548 H53" />
      <text className="pd-label" x={64} y={552}>Ladder's guard</text>
      <path d="M35 596 H53" />
      <text className="pd-label" x={64} y={600}>App state</text>

      <Operator x={26} y={628} mark="insert" caption="in the room" />
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
