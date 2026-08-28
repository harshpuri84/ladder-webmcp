# Design

<!-- impeccable:design-schema 1 -->

Documented from the shipped implementation on 2026-08-27, not invented. Ladder already had a
coherent visual world in code before this file existed. New surfaces **inherit** it. Nothing
here may be replaced without the user; a new page is an extension, never an identity exercise.

**Two worlds live in this repository, and they are separate on purpose.** Part I, The Printer's
Proof, governs the air-freight console at `index.html` (`src/ui/`). Part II, The Instrument Rack,
governs the edge config console at `edge.html` (`src/edge/ui/`). A surface inherits the world of
the product it belongs to and never borrows from the other one: two products on one engine that
looked alike would be the strongest possible argument that they are one product wearing two hats,
which is the opposite of what this repository is trying to show. The binding accessibility
constraint below is the only thing they share, and it binds both absolutely.

---

# Part I — The freight console

## The world

**The Printer's Proof.** A change arrives as a proof sheet the operator marks up and stamps.
Chosen above taste for one reason: the proof tradition is the only common artifact with *graded*
consent — OK to run, OK with changes, revise — which is exactly this product's interaction, a
human cutting a change down rather than taking or leaving it whole.

The ground is paper, not a dark canvas, because luminance has to do the work hue cannot (see
Colour). Surfaces are stock on a desk. Rules are printers' rules. Corrections are drawn marks.

## The binding constraint

**The operator has red-green colour vision deficiency.** This governs every visual decision and
is not negotiable.

- Exactly **two hues carry meaning**: `--mark` (blue, the operator's own mark) and `--hold`
  (amber, held / declined / set apart). They stay separable under deuteranopia and protanopia by
  both hue and luminance.
- **Neither ever carries a meaning alone.** Every state is already said by a mark, a rule form,
  a strikethrough, a position or a weight. Colour only agrees with what another signal said.
- Remove all colour and nothing in the interface becomes ambiguous. That is the test.
- Any palette change is checked against `.impeccable/cvd/test.html` before shipping — four
  columns: normal, deuteranopia, protanopia, and no colour at all.

## Tokens

All defined in `src/ui/styles.css` `:root`. **Never hard-code a colour in a component.**

| Role | Token | Value |
|---|---|---|
| Desk (page ground) | `--desk` | `#E3DED0` |
| Paper (sheet) | `--paper` | `#F5F2EA` |
| Paper raised (card, panel) | `--paper-raised` | `#FBF9F3` |
| Paper sunk (well, input) | `--paper-sunk` | `#EEEADF` |
| Ink (body, 16.2:1) | `--ink` | `#17150F` |
| Ink muted (secondary, 7.0:1) | `--ink-muted` | `#56514A` |
| Ink faint (non-text tint only) | `--ink-faint` | `#8C8677` |
| Rule (hairline) | `--rule` | `#CFC8B5` |
| Rule strong (border) | `--rule-strong` | `#A79E88` |
| The mark (blue) | `--mark` `--mark-wash` `--mark-tint` | `#1B4B9E` + washes |
| Held / set apart (amber) | `--hold` `--hold-wash` | `#8A5A00` + wash |

## Type

- **Body face** `--face`: Charter, then Bitstream Charter, Sitka Text, Cambria, Constantia,
  Source Serif 4, Georgia. Resolved from the machine; not a package, not a download. Carter cut
  Charter for text that must survive being proofed on bad paper at low resolution, which is
  literally this brief.
- **Mono** `--face-mono`: Menlo, Cascadia Mono, DejaVu Sans Mono, Consolas. Used for every
  identifier, figure, code fragment and tool name, via the `.mono` class.
- Base is `15px / 1.5` on `body`.

**The scale, as shipped.** Fourteen distinct sizes are in use, which is more than the system
needs. New work uses only these six and adds none:

| Use | Size |
|---|---|
| Hero figure (blast radius) | `50px` / `31px` |
| Section heading | `1rem` |
| Body | `0.86rem` |
| Secondary body, descriptions | `0.78rem` |
| Small label, inline meta | `0.76rem` |
| Eyebrow / group label | `0.72rem`, `600`, uppercase, `letter-spacing: 0.16em` |

## Shape and depth

- **Corners are effectively square.** `2px` on a chip, `1px` on an input, `0` everywhere else.
  A rounded card is out of the world.
- **One shadow recipe**, a slip lying on a desk: a tight contact shadow plus one soft lift.
  `0 1px 2px rgba(23,21,15,0.10), 0 7px 14px -6px rgba(23,21,15,0.24)`. A hairline border
  wrapped in a 30px halo is the shape of a card nobody drew — never that.
- Structure is carried by **rules and space**, not by boxes. Group with `border-top`, `divide`,
  or an eyebrow label before reaching for a card.

## Marks

`src/ui/ProofMark.tsx` is the icon system and the only one. One stroke weight, one cap style,
one 16-unit box, `currentColor` throughout, so a mark inherits the weight of the line beside it.

| Mark | Means |
|---|---|
| `insert` | The caret. This correction goes in. |
| `dele` | The deletion loop. This comes out. |
| `stet` | Dots beneath a struck line. Let it stand; change nothing. |
| `dagger` | The reference mark. Set apart from the main run. |
| `query` | "Qy?" in the margin. The proofreader cannot settle this and passes it on. |
| `registration` | The registration target, printed outside the trim. |

**Never draw a new SVG icon.** If a new meaning is needed, argue for it against this vocabulary
first; almost always one of the six already means it.

## Motion

`--ease: cubic-bezier(0.16, 0.84, 0.28, 1)`. Durations 180–260ms. Entrances are an 8px rise with
an opacity fade. Motion never carries meaning on its own — the figures that change during a
decision must be legible without seeing them move, and audible without seeing them at all. The
extent caption under the bar (`.br-caption`) carries `role="status"`, so unticking a row is spoken
as well as drawn. It is the only live region on the panel: the hero count, the struck original and
the bar are the same fact drawn, and announcing each of them would read one untick out four times.

## Voice

Plain, short, concrete. Says what happened and what it costs. States limits out loud rather than
softening them. Identifiers, figures and tool names are set in mono so a reader can tell a name
from a description. No exclamation, no marketing verbs, no emoji.

## Layout

`--panel-width: 560px`. The proposal panel is `position: fixed` at the right edge; the shell
reserves that width as a right margin whenever `body.pp-active` is set, so the register stays
both visible and clickable during a decision — the scrim dims the register but does not take
pointer events, because the external-edit control has to be reachable *while* a proposal is open
or the stale-abort cannot be demonstrated by hand at all. Below `1638px`, which is where nine
columns stop fitting beside the panel, the register hides five columns rather than the panel
narrowing. The activity list is `position: fixed` bottom-right and hides
entirely during a decision; the tool inventory chip is bottom-left at `z-index: 9`, under the
panel.

**The panel is a dialog and deliberately not a modal one.** It carries `role="dialog"` and no
`aria-modal`, and `.pp-scrim` is `pointer-events: none` — a dim, not a barrier. That is what the
sentence above is for: the register behind the scrim is not decoration, it is the world the
decision is about, and it has to keep moving while the decision is open. "Marta edits this" is the
proof of it — a judge presses it *during* an open proposal to make a colleague change a record
mid-decision, and the commit then aborts stale. A modal panel would make the product's own
stale-abort beat unreachable with a mouse, which is exactly what it did until 28 Aug 2026.

Focus is **moved, never trapped**. The panel takes focus when it opens — it is last in the
document, so the first row control is one Tab away rather than the fifty-one it was — and shows a
2px inset ring while it holds it. When it closes, focus goes back where it came from, or to the
register's tab panel when the agent opened the panel with nobody focused; an operator who tabbed
out into the register mid-decision keeps their place. Escape resolves the proposal with a real
refusal, never a silent dismiss.

## Modes by surface

| Surface | Mode | What success looks like |
|---|---|---|
| The proof (console + panel) | **Operate** | The operator decides fast and correctly, cold, mid-shift |
| The problem | **Read** | A judge understands the mechanism and its limits without being sold to |
| Same engine, other work | **Read** | A judge believes the engine is domain-free, and can go and open the second product that proves it |


---

# Part II — The edge console

Documented from the shipped implementation on 2026-08-28. Governs `edge.html` and everything under
`src/edge/ui/`. It shares the engine (`src/core/`) and the guard (`src/webmcp/`) with Part I and
shares no token, no face, no component and no ground with it.

## The world

**The Instrument Rack.** A 19-inch anodised rack panel: graphite faces cut into a darker bay,
every edge an engraved hairline, bone silkscreen legends, and every identifier and figure set as
a counter readout. The estate is one instrument, read down the column.

Chosen from the audience's own world rather than from the category's: the on-call engineer this
is built for reads racks, and the rack is the only common artifact whose whole grammar is *many
identical channels compared at a glance* — which is exactly the task, thirty-six sites judged
against one another in one look. It refuses the page this category always ships: rounded cards,
sparklines, and a red or green dot per region.

## Why dark, and why Part I is not

One sentence of scene decides it, in each case. The freight operator is mid-shift in a lit gateway
office working on paper; the on-call engineer is at 02:40 with one lamp on. The two products are
not lit the same way because they are not used in the same room.

## The binding constraint, restated

The operator has red-green colour vision deficiency. In this category that rules out its single
most common convention — the red and green status dot. **There is not one anywhere in
`src/edge/ui/`.**

Status is carried by **form** first:

| Form | Means |
|---|---|
| Hollow legend | Ready; nothing pending |
| Filled legend | Staged by this operator |
| Hatched legend | Closed by a rule |
| Dashed and struck through | Out of rotation |
| Hollow latch square | This site is not going out |
| Filled latch square plus a 3px left bracket | Latched |
| Struck-through target release | Unlatched, said a second time |

Two hues agree with the form and never carry a meaning alone: `--lamp` (amber — closed, held,
waiting on a person) and `--mark` (cool blue-white — the operator's own latch). They separate
under both deficiencies by hue and, more usefully here, by luminance: 5.7:1 against 10.9:1 on the
panel face. Verified on 2026-08-28 by driving the built page under Chrome's own
`Emulation.setEmulatedVisionDeficiency` at `deuteranopia` and `achromatopsia`; the greyscale pass
is the real test and every state above survives it.

## Tokens

All defined in `src/edge/ui/panel.css` `:root`. **Never hard-code a colour in a component.**

| Role | Token | Value |
|---|---|---|
| Bay (page ground) | `--rack` | `#0C0E11` |
| Panel face | `--panel` | `#171A1F` |
| Panel raised (latched, hover, head) | `--panel-hi` | `#1F242A` |
| Panel sunk (rail, well, unlatched) | `--panel-sunk` | `#101317` |
| Engraved edge, light above | `--bezel-hi` | `rgba(255,255,255,0.075)` |
| Engraved edge, dark below | `--bezel-lo` | `rgba(0,0,0,0.62)` |
| Scored hairline | `--score` | `#262B32` |
| Scored, structural | `--score-strong` | `#39414A` |
| Silkscreen (13.8:1) | `--legend` | `#E9E7E1` |
| Silkscreen secondary (5.9:1) | `--legend-mid` | `#9AA0A6` |
| Silkscreen faint (non-body tint) | `--legend-dim` | `#6E757C` |
| Signal lamp (5.7:1) | `--lamp` `--lamp-wash` `--lamp-line` | `#D9922B` + washes |
| The operator's latch (10.9:1) | `--mark` `--mark-wash` `--mark-line` | `#A6CFF2` + washes |

## Type

Neither face is a package; both resolve from the machine, the convention Part I already keeps.

- **Legend** `--face-legend`: Helvetica Neue, Helvetica, Segoe UI, Liberation Sans, Arial. Only
  ever set small, `700`, uppercase, tracked `0.13–0.26em`. That is what a silkscreened panel
  legend is; it is never used for running prose above 13px.
- **Readout** `--face-mono`: `ui-monospace`, SF Mono, Roboto Mono, Noto Sans Mono, DejaVu Sans
  Mono — deliberately a different stack from Part I's Menlo-first one, because two products in one
  repository should not share a typing hand. Applied through `.rd`, which also switches on
  `tabular-nums` so a column of figures lines up like a counter. Every identifier, every figure,
  every version, every rule id.

**The scale.** Six sizes, and new work adds none.

| Use | Size |
|---|---|
| Meter readout | `34px` |
| Head readout | `15px` |
| Row figure, body | `12–13px` |
| Secondary row text, skip lines | `11–11.5px` |
| Legend (`.lg`, `.st`, band meta) | `9.5–10.5px` |
| Head title | `15px` at `0.26em` tracking |

## Shape and depth

- **Zero corner radius. Everywhere.** A rounded corner is out of this world entirely.
- **Every panel face carries an engraved edge**: `inset 0 1px 0 var(--bezel-hi), inset 0 -1px 0
  var(--bezel-lo)`. That single recipe is what makes a face read as milled rather than drawn.
- Depth beyond that is one recipe, for the drawer only: a contact shadow plus a long soft lift,
  `0 -2px 4px rgba(0,0,0,0.5), 0 -22px 46px -18px rgba(0,0,0,0.95)`.
- Structure is carried by **scored lines, bands and cut windows**, never by cards. The readout
  cluster, the region bands and the rail are all divided by 1px rules; there is not a card in the
  product.
- The detent field is a 1px `gap` grid over a `--score` ground, so the dividers between latches
  are the ground showing through rather than borders that could double up.

## Instruments

- **Graticule** (`.gr`) — traffic share against a 0–10% scale with ticks at the quarters. A ruled
  measurement, not a sparkline.
- **Exposure meter** (`.mtr-*`) — the blast radius. Range-switching like a bench meter (1 / 5 / 25
  / 100% full scale, the range printed on the axis), a hatched band for everything the agent asked
  for and a solid bar for what the operator kept. Hatch against solid, so the pair survives
  greyscale.
- **Lamp** (`.lamp`) — a 9px square that is dark or lit. Always beside the word it agrees with.
- **State legend** (`.st`) — the four forms in the table above.
- **Detent** (`.dt`) — one latch per site; the whole cell is the control.

**No icons are drawn in this world.** Part I has a six-mark proof vocabulary (`ProofMark`); this
one has none and needs none, because a panel labels with words and forms rather than with pictures.
Adding an icon set here is a system change, not a local decision.

## Motion

`--ease: cubic-bezier(0.2, 0.9, 0.25, 1)`. **One authored moment:** a proposal opens the bench
drawer — it rises 28px over 260ms — and the rack behind it loses the light rather than moving
(`opacity 0.34`, `saturate(0.5)`, 240ms). No transform on the rack: this is furniture, not a modal.
The only other transition in the product is the exposure bar's 160ms `scaleX`, and it never carries
meaning on its own — the figure above it is legible at rest, and announced: the exposure readout
and its `x of y sites latched` line sit in one `role="status"`, so unlatching a site is spoken as
well as drawn. One live region, not several — the bar, the hatched band and the axis are the same
reading drawn. All of it is disabled under `prefers-reduced-motion`.

## Voice

Plain, short, concrete, and in the trade's own words: sites, latches, exposure, converge, freeze,
rotation. A rule is always named by its id before its sentence (`change-freeze-window — A change
freeze is in effect…`), because the id is the half a follow-up call can be written against. No
exclamation, no marketing verbs, no emoji.

## Layout

Full width, no reserved margin. The head panel and autonomy bar are static; the rack is six region
bands, each a `table-layout: fixed` grid whose column widths are declared once so all six line up
down the whole face. The run log is `position: fixed` at the bottom. The bench drawer is
`position: fixed` at the bottom edge at `min(66vh, 640px)`, full width, with a measurement rail on
the left and the detent field on the right; the run record sits at the same edge and shifts above
the drawer when both are open.

**The drawer is modal, and unlike Part I's panel it means it.** The rack behind it was already
`pointer-events: none` while `body.rk-drawn` is set — nothing back there was ever meant to be
worked during a decision — so `aria-modal="true"` is kept and made true: `.rk-body` is given
`inert` while the drawer is out, which takes the whole estate out of the tab order and out of the
accessibility tree as well as out of reach of the pointer. Focus moves onto the drawer as it
rises, showing a 2px inset ring, and returns to the rack's first control when it shuts. Escape
resolves the proposal with a real refusal.

The two products differ here on purpose. The freight console's register is the subject of the
decision and stays live; the rack is the *object* of one, and an engineer reaching past an open
drawer to change a site by hand at 02:40 is a mistake, not a demonstration.

Below `1180px` the rack sheds requests/sec, nodes and utilisation. Below `900px` it also sheds city
and the traffic graticule, the drawer goes to `82vh` and stacks its rail above the field, and the
run record stacks its buckets above the returned payload. Verified with no horizontal overflow at
1512px and 900px.

## Modes by surface

| Surface | Mode | What success looks like |
|---|---|---|
| The rack | **Operate** | The on-call engineer reads the whole estate in one look, cold, at 02:40 |
| The bench drawer | **Operate** | They cut a thirty-site rollout down and can see the exposure fall as they do |
| The run record | **Read** | A judge can read what the agent was told without opening a console |
