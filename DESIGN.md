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
| Ink faint (non-text tint only) | `--ink-faint` | `#6C6659` |
| Rule (hairline) | `--rule` | `#CFC8B5` |
| Rule strong (border) | `--rule-strong` | `#A79E88` |
| The mark (blue) | `--mark` `--mark-wash` `--mark-tint` | `#1B4B9E` + washes |
| Held / set apart (amber) | `--hold` `--hold-wash` | `#8A5A00` + wash |

## Type

- **Body face** `--face`: Charter, then Bitstream Charter, Sitka Text, Cambria, Constantia,
  Source Serif 4, Georgia. Resolved from the machine; not a package, not a download. Carter cut
  Charter for text that must survive being proofed on bad paper at low resolution, which is
  literally this brief.
- **Mono** `--face-mono`: Menlo, Cascadia Mono, DejaVu Sans Mono, Consolas. Used, via the
  `.mono` class, for identifiers and for tabular columns: every id, code fragment and tool name,
  and every figure that is read down a column against its neighbours: a cost or a revenue down
  a table, a tally line, a delta on a row. **Display-size figures are set in the serif's own
  lining figures** (`font-variant-numeric: lining-nums tabular-nums`): the hero count, the struck
  ask beside it and the money on either side of the authority line. Mono at 50px gave a spindly
  euro sign and a one that read as an ell; Charter's figures at that size are the same voice as
  the headline beside them. **A figure inside a running serif sentence is set in the serif's own
  figures** too: "4 shipments over your €250 limit", "42 house shipments" are prose and stay in
  Charter. Swapping to mono mid-sentence is the machine-made tell; a typesetter reserves mono for
  what is looked up, compared or typed.
- **One currency form.** Every euro figure, on the sheet, in the register, in a tool description
  and in a receipt, is the glyph then the figure with no decimals: `€250`, `€1,331`. The authority
  vocabulary's `amount()` produces the same form, so "EUR 250" no longer appears anywhere.
- Base is `15px / 1.5` on `body`.

**The scale, as shipped.** Fourteen distinct sizes are in use, which is more than the system
needs. New work uses only these six and adds none:

| Use | Size |
|---|---|
| Hero figure (blast radius), on the specimen sheet; the struck ask beside it | `50px` / `31px` |
| Hero figure, in the panel; the struck ask beside it | `40px` / `26px` |
| The landing page's claim | `40px`, the panel's hero size; the name above it is a running head at `1rem` |
| Section heading | `1rem` |
| Body | `0.86rem` |
| Secondary body, descriptions | `0.78rem` |
| Small label, inline meta | `0.76rem` |
| Eyebrow / group label | `0.72rem`, `600`, uppercase, `letter-spacing: 0.16em` |
| Caption (figure label, field name, column head) | `0.82rem`, italic, `400`, muted ink |

Tracked capitals are reserved for three things: the sheet's register ("Agent proposal"), the
stamps, and the run log's heading. Every other caption is set in italic at the caption size.
When everything is a label nothing is a heading; a run of capitals now means one thing when it
appears.

**The devices on a proof sheet, counted.** The specimen card carries three typographic devices
and no more: the tracked capitals above, the italic captions, and the struck ask beside the
count. Registration crosshairs, a "Specimen" tag, a tick-mark tally with its own legend and a
dagger with four meanings were all on the same card on 1 Sep 2026, and an outside reader called
it an aesthetic worn as a costume. Anything added to the sheet now has to displace one of the
three.

## Shape and depth

- **Corners are effectively square.** `2px` on a chip, `1px` on an input, `0` everywhere else.
  A rounded card is out of the world.
- **One shadow recipe**, a slip lying on a desk: a tight contact shadow plus one soft lift.
  `0 1px 2px rgba(23,21,15,0.10), 0 7px 14px -6px rgba(23,21,15,0.24)`. A hairline border
  wrapped in a 30px halo is the shape of a card nobody drew — never that. The one exception is
  the open panel, a sheet lying *over* the register: the same two layers, cast sideways with a
  24px spread, and a light scrim under it so the register stays readable through it.
- Structure is carried by **rules and space**, not by boxes. Group with `border-top`, `divide`,
  or an eyebrow label before reaching for a card.
- **One double rule per sheet.** The double rule is the imprint rule, under the head of the
  proof; everything else set apart is set apart by a single rule, a mark and a position. Two
  double rules in one document compete for the same register. The landing page's masthead
  carries its own imprint rule, and the specimen sheet beside it is dropped (`--hero-drop`,
  measured at 46px) so the two rules land on one line.
- **No registration corners.** They were printed on every sheet until 2 Sep 2026 and encoded
  nothing; the `registration` mark survives only where it means something (the agent-set view,
  the read tool that sets the register).
- **Three rule weights, one meaning each.** The double rule is the imprint; the strong rule
  (`--rule-strong`) is a sheet's trim, its outer border and the head of its register; every
  division inside a sheet is the hairline (`--rule`), including the rule over the referred group
  and the foot of the stamp block. A darker rule between two sections that are not different in
  kind was the tell.
- **Three nesting levels, three devices.** A sheet is a bordered surface with a shadow; a
  referred group is a double rule down its edge and no tint; a rule-closed alternative is muted
  ink under its caption, with no mark and no rule of its own. The same hairline at every level is
  how depth gets lost.
- **A row's state is a rule form down its left edge, on the sheet and on the register alike.**
  Solid in `--mark` for a row that is marked, double in `--hold` for a row that is referred, the
  id struck through for a row the operator struck; 3px on both sides, reserved on every row so an
  id does not move when its rule arrives. No glyph rides beside it on the register. That is the
  whole join between the slip and the register it lies on: the same two rows carry the same two
  rules at the same weight, and the eye crosses the gutter on them.
- **The stamp block is the foot of the same sheet**, under one hairline, on the same paper. A
  third paper tint within a hundred pixels of the stamp was a tell.
- **The operator's stamp is inked.** `.pp-stamp` is filled `--mark` with a double paper rule
  inside a 2px blue frame, the way a rubber stamp prints one; Refuse is the same form outlined
  in the plain ink. It is the one filled control on the sheet.

## Marks

`src/ui/ProofMark.tsx` is the icon system and the only one. One stroke weight, one cap style,
one 16-unit box, `currentColor` throughout, so a mark inherits the weight of the line beside it.

| Mark | Means |
|---|---|
| `insert` | The caret. This correction goes in. |
| `dele` | The deletion loop. This comes out. |
| `stet` | Dots beneath a struck line. Let it stand; change nothing. |
| `dagger` | The reference mark. Set apart from the main run: a held effect, a follow-up note, a stated limit, a tool that is never automatic. **Never on a proof row**: a referred row is its double rule and its position, a rule-closed alternative is its caption and muted ink, and a cargo flag is its ruled chip. Four meanings of one glyph on one card was the tell. |
| `query` | "Qy?" in the margin. The proofreader cannot settle this and passes it on. |
| `registration` | The registration target, printed outside the trim. |

**Never draw a new SVG icon.** If a new meaning is needed, argue for it against this vocabulary
first; almost always one of the six already means it.

## Motion

`--ease: cubic-bezier(0.16, 0.84, 0.28, 1)`. Durations 180–260ms. Entrances are an 8px rise with
an opacity fade. Two moments are authored and no more: the proof arriving (the panel's slide),
and a figure moving when the operator unticks a row. A tick-mark tally that counted up as a sheet
opened was the third until 2 Sep 2026; it restated the count above it, needed a three-item legend
to be read, and was the sparkline every generated dashboard ships. Nothing bounces, glows, scales
up or parallaxes. All of it is disabled under `prefers-reduced-motion`. Motion never carries
meaning on its own — the figures that change during a decision must be legible without seeing
them move, and audible without seeing them at all. The extent caption (`.br-caption`) carries
`role="status"` and is visually hidden: unticking a row is spoken in words ("20 of 42 shipments
in the register, struck down from 27") while the count and the struck original draw it. It is the
only live region on the panel, and it is spoken rather than printed because printing it stated
the same figures twice in a hundred pixels.

## Voice

Plain, short, concrete. Says what happened and what it costs. States limits out loud rather than
softening them. Identifiers and tool names are set in mono so a reader can tell a name from a
description; a figure is set in mono only where it is a reading or a column (see Type). No
exclamation, no marketing verbs, no emoji.

## Layout

`--panel-width: 560px`. The proposal panel is `position: fixed` at the right edge; the shell
reserves that width as a right margin whenever `body.pp-active` is set, so the register stays
both visible and clickable during a decision — the scrim dims the register but does not take
pointer events, because the external-edit control has to be reachable *while* a proposal is open
or the stale-abort cannot be demonstrated by hand at all. While the panel is open the register's
sheet runs on under the panel's edge by `--panel-overlap` (44px; measured 2 Sep 2026 at 1512:
sheet right 996, panel left 952), and the sheet's right padding grows by the same amount so
nothing printed on it goes under the panel. The panel's shadow then falls on paper: it is a slip
lying on the register, not a second sheet stapled beside it. The panel's head is sized so its
quote sits level with the tab labels and its imprint rule lands on the register's head rule
(both at 68px at 1512), so the two double rules read as one line across the gutter. Below
`1638px`, which is where the full register stops fitting beside the panel, the register sheds
the consol and cargo columns, keeps house, customer, SLA, promised and revenue (plus the remedy
column once one has landed), and lets its columns hug their content rather than spreading four
across the sheet with the slack inside the customer column. Rows are ruled every fifth line, the
ledger's convention, not every line.

**The register knows a proposal is open.** The panel publishes what its sheet says about each
row (`src/ui/proof-view.ts`: marked, struck, referred) and the register draws it on the row as
the rule form described under Shape and depth (solid for marked, double for referred, the id
struck through for struck), with a visually hidden word for a screen reader. No glyph: the sheet's
rows carry the same rule forms, and one device on both sides is the join. The register never
subscribes to `onProposal`; the panel is the only subscriber, because the adapter's buffer drains
to whoever attaches first.

The open tab is cut into the sheet under a double `--rule-strong` edge, the sheet's own head rule
carried up over it. It used to be marked in `--mark`, which left blue saying three things at once:
the open tab, a marked row, and the stamp. Blue now says the operator's mark and nothing else.

The name appears once, as a running head over the landing page's claim; the two working tabs
carry no wordmark (one at the end of the tab row read as a fourth tab). The activity list is
`position: fixed` bottom-right and hides entirely during a decision; the tool count is printed
with the walkthrough under the register, where the agent is driven from, and the inventory it
opens takes a row of its own there.

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

The rack's nine columns stand only at `1440px` and above. Below that it sheds requests/sec, nodes
and utilisation; below `1182px` it also sheds city; below `900px` it sheds the traffic graticule,
the drawer goes to `82vh` and stacks its rail above the field, and the run record stacks its
buckets above the returned payload.

Measured on both the dev server and the production build, 30 August 2026: no horizontal overflow
at 1512, 1440, 1439, 1366, 1280, 1200, 1182, 1181, 1100, 1024, 900 or 768. An earlier version of
this paragraph claimed `1180px` and said the rack was verified at two widths; it was verified at
two widths, and it overflowed at most of the ones in between — worst at 1200px, by 210px. Two
points are not a curve.

**Below roughly `856px` the rack still overflows, and that is not fixed.** Which of four columns
survives on a phone when the rollout is the product's subject is a design decision nobody has
taken. This document claims nothing below 900px, and the freight console — which does claim phone
width — is clean from 320px.

## Modes by surface

| Surface | Mode | What success looks like |
|---|---|---|
| The rack | **Operate** | The on-call engineer reads the whole estate in one look, cold, at 02:40 |
| The bench drawer | **Operate** | They cut a thirty-site rollout down and can see the exposure fall as they do |
| The run record | **Read** | A judge can read what the agent was told without opening a console |
