# Redesign report — 2026-08-26 — ladder-webmcp

> Note: this file did not exist in the checkout at branch `design/printers-proof` /
> `7c97770`. The entries below are the measurement log for the post-redesign regression fix
> and the dismiss-control change, written fresh rather than appended.

## Edit-column-under-scrim regression — fix

**Symptom (measured before fix, 1280×900, proposal open via
`window.__ladderDemo.call('reprice_shipments', { origin: 'Shanghai', pct: 8 })`):**

| box | left | right | width |
|---|---|---|---|
| `.console` | 26 | 694 | 668 |
| `.pp` (panel) | 720 | 1280 | 560 |
| `.console-table` | 27 | 773 | 746 |
| `.console-scroll` | 27 | 693 | 666 (clientWidth; `scrollWidth` 746) |
| `.console-edit-row` (first) | 676.7 | 755.0 | 78.3 |

`document.elementFromPoint` at the button's centre (716, 578) → `pp-scrim`. Cause: the table
(746px) exceeds the console's content box (668px). `.console-scroll` carries `overflow-x: auto`
(not `visible`), so the excess is clipped/scrolled rather than spilling visibly — but at the
default (unscrolled) position the button's layout rect still reports its unclipped coordinates,
and a click at that position lands past the scroll container's actual painted edge, in the gap
between the console (694) and the panel (720), where only the scrim is present.

Root cause of the width growth since the second historical fix (`8303a6e`, table 710 inside a
712 console): cell padding grew from `8px 16px` to `7px 18px` (+4px/column × 7 = +28px) and the
customs-hold badge gained a `ProofMark` dagger icon (+width on the Status column), pushing total
content+padding from 710 to 746 while the console (per the same activity-list-hidden layout)
narrowed from 712 to 668 — a combined 78px shortfall.

**Fix (layout, not stacking):** scoped to `body.pp-active` only — normal browsing keeps the
existing generous padding.

```css
body.pp-active .console-table {
  min-width: 0;                 /* the 720px phone-floor was itself wider than the console */
}
body.pp-active .console-table th,
body.pp-active .console-table td {
  padding-left: 9px;
  padding-right: 9px;
}
```

No z-index was touched; `.console-edit-row`'s existing `z-index: 12` (clears the scrim only,
per its own comment) was left as-is — it was never the cause, the table was simply wider than
its clipping container.

**Measured after fix:**

At 1280×900 (proposal open, animations settled ≥1s):

| box | left | right | width |
|---|---|---|---|
| `.console` | 26 | 694 | 668 |
| `.pp` | 720 | 1280 | 560 |
| `.console-table` / `.console-scroll` | 27 | 693 | 666 |
| max `.console-edit-row` right (200 rows) | — | 680.4 | — |

- `overflowCount` (edit-row rects with `right > console.right`) over all 200 rows: **0**.
- `document.elementFromPoint` at the first edit button's centre → `console-edit-row` / `BUTTON`.
- Clicked "Edit a row" on SHP-10003 (v1→v2) while its `reprice_shipments` proposal (17 records)
  was open, then applied: receipt stamped **Superseded / "The records moved on"** —
  requested 17, applied 0, refused 17, replan required yes. Repeated on SHP-10038 with the same
  result. Price fields for the edited rows remained at their pre-proposal values (struck-through
  old value shown, no new value applied).
- Escape closes the panel: `pp-active` removed, `.console` returns to 934px wide (full content
  box, no panel present), `.al` (activity list) reappears at 272px.

At 1440×900 (proposal open, settled): `.console` 26–854 (828 wide), `.console-table` 27–853
(826 wide), edit-row rects fully inside (max right 828.2 < console right 854),
`elementFromPoint` at the first button's centre → the button. No scoped rule was even needed
here — the unconstrained console content box is wider than the table at this viewport; the
`body.pp-active` override applies but has ~28px of slack to spare.

## Dismiss control — vocabulary → plain ×

`ResultCard.tsx`'s dismiss button rendered `<ProofMark name="dele" size={15} title="Dismiss" />`
(the deletion-loop correction mark). Replaced with a plain `×` glyph in a `<span aria-hidden>`;
kept `aria-label="Dismiss"` and added `title="Dismiss"` on the button itself (previously only on
the mark, which is `aria-hidden`/non-text so it carried no accessible name of its own — the
button's `aria-label` was already the accessible name; `title` is now on the element that's
actually hoverable for a tooltip). Removed the now-unused `ProofMark` import from
`ResultCard.tsx` (`noUnusedLocals` is on). Bumped `.rc-dismiss` to `font-size: 1.15rem` and
centred the glyph so the × reads at roughly the same visual weight as the icon it replaced.

Verified via DOM after a real apply → superseded flow:
`<button class="rc-dismiss" type="button" aria-label="Dismiss" title="Dismiss"><span
aria-hidden="true">×</span></button>`.

## Verification

- `npm test`: 115/115 passed, 16 test files.
- `npm run build`: `tsc -b && vite build` clean, no warnings.
- `dist/` grepped for `fake-model-context`, `__ladderDemo`, `editRowExternally`: no matches —
  demo double confirmed absent from the production build.
- `node .claude/skills/impeccable/scripts/detect.mjs --json src/ui/ResultCard.tsx
  src/ui/styles.css` → `[]`.
- Changed files: `src/ui/ResultCard.tsx`, `src/ui/styles.css`. No changes to `src/core/`,
  `src/domain/`, or `src/webmcp/adapter.ts`.
