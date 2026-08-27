# Ladder — the interface, rebuilt on the remedy domain

**27 Aug 2026.** Worktree `ladder-webmcp-wt-reframe`, branch `domain/disruption-reframe`.
Commits `0c655a0` (the scope-violation switch) and `8251da1` (the interface).

## Two of the four "read first" documents were not in this worktree

`.superpowers/sdd/2026-08-26-ladder-webmcp/reframe-domain-report.md` does not exist anywhere in
the repository — the only file in that directory is `redesign-report.md` from the interface
task before this one. `docs/DISRUPTION-SCENARIO.md` is not in this worktree either; it exists,
untracked, in the sibling checkout at `Lab/ladder-webmcp`, and that is the copy I read.

So the domain half of the brief was read from the code — `src/domain/remedy-policy.ts`,
`types.ts`, `seed.ts` and `tools.ts` — rather than from the agent's account of it. Nothing was
assumed about what the domain does; everything below is measured off the fixture.

## What the fixture actually decides, which is what the panel had to show

Running `recommendRemedy` over all 42 seeded shipments:

| | rows |
|---|---|
| free same-carrier rebook | 37 |
| truck to another gateway | 4 |
| every remedy blocked — a domain skip, no diff row | 1 |
| **rows carrying at least one blocked alternative** | **7** |

The competitor freighter is never *recommended*, because it is never the cheapest available
option: when the rebook is open it is free, and when the rebook is blocked the truck is
cheaper than a spot rate on any of these weights. It is still reachable — an agent can force
`remedy: 'competitor'` and blocked rows come back named — and it appears in the panel wherever
a rule blocked it.

Two consequences for the interface, both taken as given rather than designed around:

- The brief's example row ("the free rebook is blocked by lithium-ion and the only option is
  the freighter") is structurally present but lands on the truck, not the freighter:
  `HAWB-70001` reads *rebook blocked by `lithium-cargo-aircraft-only`, remedy = truck, €326*.
  The shape the brief asked for is exactly what renders; the fixture's economics pick a
  different fallback.
- 37 free / 4 paid / 1 escalation / 7 constrained is a real distribution, so making it visible
  was a matter of showing it rather than staging it.

**One mismatch worth flagging.** `docs/DISRUPTION-SCENARIO.md` describes a Frankfurt → Chicago
cancellation. `src/domain/seed.ts` seeds `NX-4821, Singapore → Frankfurt, 2026-09-14`. The
interface renders the fixture, never the document — the docket line at the top of the page is
counted and read straight off `DISRUPTED_FLIGHT` and the store — so the page cannot drift from
the data. But the two disagree, and one of them should be corrected before this is filmed.

The scenario also carries a wall clock ("Thursday 19:40, ninety minutes to the first cutoff")
that the fixture does not. Nothing in the interface states a time, because stating one would
be inventing data, and because nothing that runs inside a tool may read a clock.

## The proof line

Preserved whole: proof paper, Charter, the marks in `ProofMark.tsx`, the "PROOF FOR APPROVAL"
slug before any figure, the stamp block counting "Apply 41 of 42", the extent recomputing live,
group-level checkboxes only.

What is new sits inside the existing row, in the existing vocabulary:

```
☑ ⌃  HAWB-70001                                              +€326
      Northwind Retail · CONSOL-A · premium SLA · promised 2026-09-16
      REMEDY   Truck to another gateway, fly from there
               €326 · recovers 24 h
      BLOCKED BY RULE — 1 ALTERNATIVE
      ⌐ ̶S̶a̶m̶e̶ ̶c̶a̶r̶r̶i̶e̶r̶,̶ ̶t̶o̶m̶o̶r̶r̶o̶w̶ ̶m̶o̶r̶n̶i̶n̶g̶
        Standalone lithium-ion batteries are cargo-aircraft-only, so this cannot
        go on a passenger belly flight.
        lithium-cargo-aircraft-only
```

- The remedy is a substitution: struck old value where there is one, heavier weight on what
  goes in. No arrow, no hue — the same treatment the field diffs had.
- A blocked alternative is a **deletion**: the deletion loop in the gutter (`dele`, already in
  the mark set), the remedy struck through, the rule in the domain's own sentence, the rule id
  in mono beside it. A rule took it out; that is what the loop means.
- The rule id is deliberate. Engineers read this as a policy engine and that is the correct
  reading, so the rules are named the way a linter names its rules and the name is on the sheet.
- **The distribution is carried by mass.** An unconstrained row is two lines. A constrained row
  grows by exactly what it lost. Scrolling forty-two, the handful stands out before a word of
  it is read — which is the whole point of showing forty-two at once.

Above the list, recomputed from the selection alongside the extent figures:

```
REMEDIES IN THIS RUN
 37  Same carrier, tomorrow morning                              free
  4  Truck to another gateway, fly from there                  €1,420
 ═══════════════════════════════════════════════════════════════════
 † 7 of 41 marked rows have an alternative a rule took away.
   Each one is named on the row.
```

Ruled above and below with the dagger — the same "set apart from the run" treatment held
actions and flagged cargo already carry, so one mark keeps one meaning across the interface.

`money` is now the remedy's cost: `deltaOf` reads `remedyCost`, and a run of nothing but free
rebookings shows no money figure at all rather than a large "EUR 0" competing for hero space.

## The register

`House · Customer · Consol · SLA · Promised · Revenue · Cargo · Remedy · External edit`.

Cargo names the facts a remedy can founder on — Lithium-ion, Main deck only, Unscreened,
Active temp *N*h, Pharma lane, Customs held — each as a daggered flag, so the constrained
handful is visible at rest, before any agent has proposed anything, and a blocked alternative
in the panel later refers back to something already on screen. Remedy fills in after a commit,
carrying the same caret the proof line used when the correction went in.

The filter matches every column as rendered, so an id or a cargo word pasted out of a receipt
finds its row.

## The scope-violation demonstration, restored

`propose_remedy` now carries the switch that `update_shipments` used to. With it on the tool
previews exactly what its description promises, then on the commit re-run rewrites one of the
same rows' `slaTier` — a field the proof never showed. `core/commit.ts` refuses it, names it,
and rolls the whole commit back.

Driven live: **BLOCKED / Ladder blocked this — requested 1, applied 0, refused 1 —** *the tool
tried to write outside the approved set (`shipments:HAWB-70002:slaTier`); everything was rolled
back*, `replan required: yes`. `slaTier` unchanged in the register afterwards.

Copy, adapted and kept honest:

> Makes `propose_remedy` rewrite a shipment's SLA tier at commit time — a field the proof never
> showed and you never approved — so you can watch Ladder's guard stop it and roll the whole
> commit back. A deliberate demonstration, not a real bug.

**This is the one change to `src/domain`**, and it was unavoidable: the behaviour being
demonstrated is a tool writing off-script, and only a tool can do that. It is confined to a
module-level flag, a setter, and eight lines inside `proposeRemedy.exec`; the constraint layer,
the types and the seed are untouched.

## The stale beat, and the layout regression it depends on

This is where the register's new width bit.

Measured at 1200px **before** the fix: the console's scroll frame is 586px and the table's
intrinsic minimum is 815px, so the table scrolls inside its own frame and the External-edit
column ends up *outside* the visible frame. `document.elementFromPoint` at the button's centre
returned `pp-scrim`. No click could land. The existing `body.pp-active .console-table
{ min-width: 0 }` cannot help: it removes a floor, and the problem is an intrinsic minimum.

A ladder of media queries dropping one column per breakpoint would have fixed the demo viewport
and left the next one broken, so the column is now pinned to the right edge of its own scroll
frame (`position: sticky; right: 0; z-index: 12`, opaque ground, hairline left rule). That
clears the scrim at every width at once. It is the one place in this interface where stacking
does real work, and it is stated once, in a commented rule.

### Layout measurements, proposal open

| viewport | scroll frame | table | Edit button | `elementFromPoint` at its centre |
|---|---|---|---|---|
| 1440 | 826px (27→853) | 894px | 743–821 | `button.console-edit-row` ✓ |
| 1280 | 666px (27→693) | 894px | 583–661 | `button.console-edit-row` ✓ |
| 1200 | 586px (27→613) | 894px | 503–581 | `button.console-edit-row` ✓ |
| 1120 | 506px (27→533) | 894px | 423–501 | `button.console-edit-row` ✓ |

The panel is fixed at `right: 0`, width 560px, so its left edge is 880 / 720 / 640 / 560 — the
button's right edge clears both the frame and the panel at every row of that table.

**Verified with a real mouse click, not a scripted one.** At 1440 and again at 1280 I clicked
the button through the browser's own input path with a proposal open: `HAWB-70001` went `v1 →
v2` and its revenue `€3,086 → €3,111` in the register, and applying the still-open proposal then
returned **SUPERSEDED / The records moved on — requested 27, applied 0, refused 27** *(a record
changed after the preview; nothing was applied)*, with the Remedy column left empty across the
board.

Below the 1080px breakpoint the shell stacks and the panel deliberately overlays the register
(`body.pp-active .app-shell { margin-right: 0 }`, unchanged from the previous build). The
external-edit beat is not reachable there and was not before; it is a phone-width layout, not
the demo viewport.

## Colour vision — the four-column check

`.impeccable/cvd/test.html` was rebuilt from the live markup of the running app (rows lifted out
of the real DOM, checkbox state frozen to attributes) rather than hand-written, so it is the
actual components against the actual stylesheet. Sections: the build this replaced, proof lines,
extent + tally + held matter + stamp, the eight receipts, the rungs, the register + run log.

Read in **normal vision, deuteranopia, protanopia, and no colour at all**:

| element | what tells it apart with no colour | verdict |
|---|---|---|
| remedy taken vs alternative blocked | caret vs deletion loop, and the blocked remedy is struck through | pass |
| blocked-alternative block | small-caps caption "BLOCKED BY RULE — n ALTERNATIVES", hanging rule down the left, the rule sentence | pass |
| rule id | mono, smaller, on its own line | pass |
| row taken vs row struck by the operator | caret vs stet, rule through the whole correction, "STRUCK OUT — STANDS AS IT IS" | pass |
| the tally | count / remedy / price in three columns, tabular figures | pass |
| the constrained line | dagger + double rules above and below + the sentence | pass |
| held action | dagger + double rules + "HELD — CANNOT BE UNDONE" | pass |
| cargo flags in the register | dagger + boxed word ("Lithium-ion", "Main deck only", "Customs held") | pass |
| remedy in the register | caret + word + cost; "—" when none | pass |
| the eight receipts | the stamp word, not the edge tone | pass |

Nothing in the new material carries meaning in hue. The blue stays the operator's mark and the
amber stays held / declined / rule-blocked; both only ever agree with a mark, a rule form, a
strikethrough or a weight step that already said it.

The "no colour at all" column also confirmed the one thing worth worrying about: the blocked
alternative and the operator-struck row use the same amber and the same strikethrough, and they
are still unmistakable, because the marks differ (`dele` vs `stet`) and the words differ
("Blocked by rule" vs "Struck out — stands as it is").

## Checks

- `npm test` — **19 files, 159 tests, all passing**. 56 core tests unmodified.
- `npm run build` — clean. `dist/` carries no `__ladderDemo` and no `fake-model-context`
  (grep over `dist/` returns nothing).
- `npm run lint` — 3 warnings, all pre-existing on `main` (verified by stashing: 3 before, 3
  after). A fourth (`only-export-components` on the new `RemedySummary.tsx`) was removed by
  moving `summariseRemedies` into `remedy-diff.ts`, where the reduction belongs anyway.
- Design detector over every changed source file — **`[]`**, clean.
  The only finding anywhere was `em-dash-overuse`, advisory-only, on `.impeccable/cvd/test.html`
  — which already tripped it before this task (19 em-dashes then, 23 now); they are the sheet's
  established caption grammar plus the domain's own rule sentences.
  **The detector reports itself DEGRADED** on this machine: `htmlparser2`, `css-select`,
  `css-tree` and `domutils` are not resolvable from the skill's install directory
  (`~/.claude/skills/impeccable/` has no `node_modules` and neither does `~`), so it fell back
  to regex matching and did not evaluate custom properties, selector matching or computed
  contrast. Installing them would have meant writing into the user's skill installation, which
  I did not do. Treat the clean result as an undercount, not a clean bill of health — the
  colour work above was checked by eye in four simulated columns instead, which is what that
  part of the detector would have been standing in for.
- `erasableSyntaxOnly`: no parameter properties, no `enum`, no `namespace` in anything added.
- Determinism: nothing added reads a clock or a random source inside a tool. The one `Date.now`
  in the interface is the activity log's timestamp, which predates this work and runs in React,
  not in a tool.
- Reconciliation, `applied + Σrejected.count === requested`, observed on every path driven:
  partial apply 39 + 1 + 2 = 42; refusal 0 + 1 + 14 = 15; stale 0 + 27 = 27; scope violation
  0 + 1 = 1. Asserted in the new buggy-tool test on the abort path.

## New and changed files

New: `src/ui/remedy-words.ts` (the id → phrase lexicon; nothing in `src/domain` imports it),
`src/ui/remedy-diff.ts` (reading a remedy proposal back out of an ordinary diff, plus the
tally reduction), `src/ui/RemedySummary.tsx`, `src/ui/__tests__/DiffGroupRow.test.tsx`,
`src/domain/__tests__/buggy-tool.test.ts`.

Changed: `DiffGroupRow.tsx`, `ProposalPanel.tsx`, `Console.tsx`, `RungStrip.tsx`, `App.tsx`,
`styles.css`, `.impeccable/cvd/test.html`, four existing test files for the new ids and the
four-tool count, and `src/domain/tools.ts` for the demonstration switch.

`src/core/` untouched.

## Open

1. **The lane disagrees with the scenario document.** Fixture says Singapore → Frankfurt; the
   document says Frankfurt → Chicago. Decide which is canonical before filming.
2. **The competitor freighter is never the recommendation** on this fixture. If the video wants
   a row that recovers tonight at a price, the seed needs a shipment where the truck is blocked
   and the freighter is not — an active container with endurance under 30h *and* a blocked
   rebook. That is a seed change, so I left it alone.
3. **`docs/` is untracked in the sibling checkout.** `DISRUPTION-SCENARIO.md` is not in git at
   all; if it is the design of record it should be committed.
