# Design

<!-- impeccable:design-schema 1 -->

Documented from the shipped implementation on 2026-08-27, not invented. Ladder already had a
coherent visual world in code before this file existed. New surfaces **inherit** it. Nothing
here may be replaced without the user; a new page is an extension, never an identity exercise.

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
decision must be legible without seeing them move.

## Voice

Plain, short, concrete. Says what happened and what it costs. States limits out loud rather than
softening them. Identifiers, figures and tool names are set in mono so a reader can tell a name
from a description. No exclamation, no marketing verbs, no emoji.

## Layout

`--panel-width: 560px`. The proposal panel is `position: fixed` at the right edge; the shell
reserves that width as a right margin whenever `body.pp-active` is set, so the register stays
both visible and clickable during a decision. Below `1500px` the register hides five columns
rather than the panel narrowing. The activity list is `position: fixed` bottom-right and hides
entirely during a decision; the tool inventory chip is bottom-left at `z-index: 9`, under the
panel.

## Modes by surface

| Surface | Mode | What success looks like |
|---|---|---|
| The proof (console + panel) | **Operate** | The operator decides fast and correctly, cold, mid-shift |
| The problem | **Read** | A judge understands the mechanism and its limits without being sold to |
| Same engine, other work | **Read** | A judge believes the engine is domain-free, and can tell a mockup from the real thing |
