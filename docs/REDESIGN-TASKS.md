# Redesign tasks

Written 1 September 2026 from a design review of the live site, the local app under `?demo`,
and the rendered video. Self-contained. A fresh session can execute this without the review
conversation.

Submission closes Thursday 3 September, 1:00pm PT. Do the tasks in the order below. Sections A
to D are the app. Section E is the video. Section F is the copy pass that runs over everything.
Stop after any section if time runs out; each one ships on its own.

## Before the first edit

- Work in a worktree: `git worktree add ../wt-redesign -b redesign` and edit there. Never run
  `git reset --hard`, `git checkout -- .` or `git clean` in the shared clone.
- Read `DESIGN.md` and `PRODUCT.md` first. Two visual worlds, one binding constraint: the operator
  has red-green colour vision deficiency. Nothing may carry meaning by colour alone. Blue and amber
  are the only two hues. No rounded corners. No new icons; `src/ui/ProofMark.tsx` is the whole set.
- Run `npx vitest run` before and after. 394 tests pass at the start. Tests assert copy strings in
  several places; when a task changes copy, update the test, not the copy.
- Drive the app under `?demo` on `http://localhost:5190` (`npm run dev`). In the console:
  `window.__ladderDemo.call('propose_remedy', { consol: 'CONSOL-A' })` opens the panel. The
  recorder in `../ladder-webmcp-recorder/record.mjs` lists every selector and beat.
- Screenshot at 1512x945 before and after each section. Keep the befores; they are interview
  material.
- Do not commit or push. Leave that to the author.

## Scores at the start

Three outside critics, fed screenshots only, no code:

| Surface | Score |
|---|---|
| Landing page alone | 4/10 |
| Site as a whole | 5/10 |
| App in use (panel, receipts, states) | 5.5/10 |
| Video | 5/10 |

Target before recording: a fresh critic (same prompt, screenshots only) scores the landing page
and the panel at 8 or above.

## Measured facts the tasks refer to

| Fact | Value |
|---|---|
| Proof tab at 1512x945, runtime present: first table row starts at | 856px from top |
| Same page, viewport height | 945px |
| Blocks above the table | title, tab strip, flight header, prompt line, standing rules, spend authority, filter, buggy toggle |
| Video: first product UI on screen | 0:54 |
| Video: proof sheet first on screen | 1:36 |
| Video: second product on screen | 2:36 of 3:05 |
| `propose_remedy {consol: "CONSOL-A"}` | 27 matched, panel opens at 23, 4 referred, EUR 0 net |
| After unticking HAWB-70003, 70005, 70007 | Apply 20 of 23, and refer 4 |
| Returned payload | requested 27, applied 20, 3 removed, 4 referred |
| `roll_config {}` on edge | 36 requested, 23 applied, 6 closed by rule, 7 referred to a traffic lead |

---

## A. Landing page (`src/ui/pages/ProblemPage.tsx`, `src/ui/styles.css`)

**A1. Put a proof sheet on the landing page.**
Render the real `ProposalPanel` with the CONSOL-A fixture, read-only, as the first thing beside
the title. Label it "Specimen" in the eyebrow style the panel already uses for "Proof for
approval". It must show 23, the struck 27, the four referred rows and the stamp. Nobody without a
WebMCP runtime ever sees this screen today, and it is the product.
Done when: a Safari user sees the stamp above the fold at 1512x945 without clicking anything.

**A2. Give the page a first viewport.**
"Ladder" at display size (the hero figure size, 50px, already in the scale). Under it, one line:
"Every agent write comes here as a proof before it lands." That sentence exists today at 13px above
the tab strip. Move the tab strip below the hero. The standfirst paragraph that opens the page now
becomes the second thing read, not the first.
Done when: name, claim and specimen are all visible before any scrolling.

**A3. One drawing instead of three rulers.**
`src/ui/PlacementDiagram.tsx` and `src/ui/EngineDiagram.tsx` are three copies of the same
horizontal rule with ticks. The placement argument is spatial: the operator is outside the
boundary on a server and inside it in the page. Redraw as one figure, at least 2x the current
height, where the operator is a drawn figure that visibly sits outside the dashed box in the top
band and inside the solid box in the bottom band. Keep it SVG, `currentColor`, 1.4 stroke, one ink.
Fold the engine strip into the same figure as the inside of the solid box (fork, proof, guard,
result) or cut it. Keep both `aria-label` descriptions; rewrite them to match the new drawing.
Do not use a generated image for this. Generated images put gibberish in labels and add tone that
breaks the one-ink rule.
Done when: a viewer covering the captions can still tell which band has the human inside.

**A4. Removal pass.**
- Delete the floating section numbers 1 to 6 in the right column.
- Delete the blue outline drawn around the tab panel (it reads as a focus ring). Keep the real
  focus ring on the proposal panel when it holds focus; that one is functional.
- The dagger mark appears eleven times on this page as bullet, icon and marker. Keep it on the
  "What this does not do" list only.
- Three "Measured" margin boxes carry the same Chrome 151 / 26 Aug 2026 stamp. Keep one, at the
  `requestUserInteraction` paragraph.
- The right column is empty for most of the page. Either the margin notes that survive sit exactly
  beside their referent, or drop the column and set the page at a single 68ch measure.
Done when: the page has no element that exists to explain another element.

**A5. Cut the self-narration.**
Delete these margin notes and phrases. They are process notes to the author, not information for
a reader:
- "Counted, not typed" and its body
- "Taken in the browser, not read off the spec"
- "Done here off the sample itself so it cannot come to disagree with it"
- "Every reviewer who read this code reasoned inside the abstraction and none of them asked that
  question. An outside reader did."
- "which is the whole bet this design makes"
- "The load-bearing one" margin note (fold its one fact, "this cannot be had on a server", into
  the consequence paragraph it annotates)
Keep "Check the sum" as a single mono line under the payload; it is a fact, not narration.
Done when: no sentence on the page describes why the page is honest.

## B. Proof tab, the console behind the panel (`src/ui/Console.tsx`, `src/ui/AuthorityStrip.tsx`, `src/ui/ToolPill.tsx`, `src/ui/ActivityList.tsx`)

**B1. Register first.**
The table starts at 856px on a 945px viewport. Target: first row at or above 400px with the
runtime present. Order from the top: flight header strip (keep, it is good), prompt line (keep,
one line, no explanatory sentence under it), table. Everything else moves below the table or into
a disclosure.
- Standing rules: collapse to one line, "Standing rules: none. Add one." The two tool chips and
  their captions expand on click.
- Spend authority: one line, "Acting as Gateway operator, EUR 250. Switch." The "no sign-in, no
  server" paragraph goes. It is on the walkthrough already.
- "Simulate a buggy tool": move into the walkthrough step 6, where it is used. It does not belong
  above the register.
- The runtime-absent banner (Safari, Chrome without the flag): one line under the flight header,
  "Agent half needs WebMCP. How." with the two runtimes behind the disclosure.
Done when: at 1512x945 the operator sees the header, the prompt and at least eight rows.

**B2. The "Marta edits this" column.**
Forty-two identical buttons pad the table. Keep the mechanism, it is the stale-abort proof. Show
the control on row hover and in the walkthrough step 5, or as one button in the toolbar that edits
a named row. The column header "External edit" goes.
Done when: the table has no column whose every cell is the same button.

**B3. The tool inventory chip.**
It sits bottom-left at `z-index: 9` and covers the HAWB id of row four in most desktop shots and
body text on tablet. Move it into the flight header strip as "4 tools" beside the counts. The
popover it opens is a wall of text; both write tools carry the same paragraph. Show name, one-line
standing, and a "full description" disclosure per tool.
Done when: nothing floats over the register at any width from 768 up.

**B4. The activity rail figures disagree with the receipt.**
After the CONSOL-A run the rail reads "27 req 20 applied 7 refused". The receipt for the same run
reads 4 referred, 3 refused. The follow-up run logs "4 req 0 applied 4 refused" when nothing was
refused; all four were referred. Make the rail carry the same buckets as the receipt: applied,
removed, referred. The stale run reads "Stale" in the rail and "SUPERSEDED" in its card; pick one
word and use it in both.
Done when: every number in the rail can be found on the receipt for that run.

## C. The panel and the receipts (`src/ui/ProposalPanel.tsx`, `src/ui/DiffGroupRow.tsx`, `src/ui/ResultCard.tsx`, `src/ui/BlastRadius.tsx`)

**C1. The money is hidden.**
The hero reads "23 records marked, EUR 0 net change" while the box under it says four shipments
cost EUR 1,331. The number an operator needs is the one the headline hides. Show both in the hero:
"EUR 0 you can authorise. EUR 1,331 referred." Same for the edge product's exposure meter.
Done when: the cost of the whole proposal is readable in the first two seconds.

**C2. Three lines above the figure.**
Tool name, quoted paraphrase, "Proof for approval, nothing here has been applied yet". Keep the
quote. Move the tool name into the eyebrow of the quote. Drop the "nothing applied yet" line; the
stamp button says what pressing it does.

**C3. The stamp and its partner.**
The blue button carries three lines. Two is the limit: "Apply 23 of 23" over "and refer 4". The
grey button reads "REVISE / Refuse all", two different verbs. It refuses, so it says "Refuse all".

**C4. Struck rows over-mark.**
A struck row strikes the id, the remedy, the cost and the recovery time, then repeats "STRUCK OUT,
STANDS AS IT IS" in amber caps. Dim the row to `--ink-muted`, strike the id only, drop the caption.
The unticked checkbox already says it.

**C5. Referred rows.**
The faint checkbox reads as disabled. The "?" glyph reads as help. The "REFER" chip is drawn like a
button. Replace with one amber line at the top of the group, "4 shipments over your EUR 250 limit.
The duty manager decides these.", and no checkbox on those rows at all.

**C6. Receipt cards.**
Keep the four-line table (requested, applied, referred, refused). Drop the paragraph under it that
restates the table. Render `replan required: yes` as a sentence, "The agent was told to replan."
The blocked receipt leaks the path `shipments:HAWB-70001:slaTier`; say "wrote a field the proof
never showed" and keep the path in the JSON only.

**C7. Add-a-rule form.**
Two Cancel buttons show at once (one in the chip row, one in the form). Keep one. The native date
input matches nothing else on the sheet; set it in the mono face with the same 1px rule as the
other inputs.

**C8. Mobile and tablet.**
At 390 wide the sticky footer cuts the referred box mid-sentence and the button order flips
relative to desktop. Keep the order (Refuse left, Apply right) and give the scroll area bottom
padding equal to the footer height. At 1024 the console beside the panel is 440px wide with every
prose paragraph intact; B1 fixes most of this, then verify.

## D. Edge product (`src/edge/ui/RunRecord.tsx`, `src/edge/ui/BenchDrawer.tsx`)

**D1.** The run record fills half the screen with raw JSON. Show the bucket list; put the JSON
behind a "Returned to the agent" disclosure, open by default only in the run record's own tab.

**D2.** A clipped line of dimmed header text peeks above the run record. Give the record a solid
top edge or push it below the rack's last band.

**D3.** Apply C1 to the exposure meter: exposure the engineer can authorise and exposure referred,
both readable at rest.

## E. The video (`../ladder-webmcp-recorder/videos/ladder-launch/shots.mjs`, `build.mjs`, `record.mjs`)

Re-shoot, do not patch. Target 2:15. Read `submission/VIDEO-STATE.md` for the pipeline. Rules that
override the current cut:

- No shot of essay prose. The landing page appears only as the title card and the specimen.
- Captions ride over the footage. Delete the cream fade band at the bottom of every shot.
- Every dark shot (terminal, edge) goes full bleed. No cream letterbox around a dark product.
- Every number the voice says gets a punch-in on that number at the moment it is said.
- The left-edge black strip (another pane bleeding in) is a crop error. Fix the camera positions
  in `CAM` so no shot shows it.
- Opening card: 3 seconds, not 5.5. Closing card: 4 seconds, no black tail.

Narration. Every figure below was measured on the shipped build on 28 August and again on 1
September. Re-measure before recording. The `say` lines go to the voice tool verbatim; the `line`
captions may shorten them and may never change a fact.

| At | Screen | Say |
|---|---|---|
| 0:00 | Black. Terminal. One line types. Silent. | (caption only) nothing applied. waiting for a human. |
| 0:04 | Title card, then the specimen | This is Ladder. When an agent calls a tool on a web page, Ladder shows the person who owns those records what is about to change, and lets them keep some of it and drop the rest. The agent is told which was which. |
| 0:16 | Register, punch to the flight header | Here is the situation. A flight from Frankfurt to Chicago is cancelled. Forty-two shipments were on it, from thirty-one customers, and one operator on shift has to rebook them before the cutoff. |
| 0:26 | Terminal, full frame | The agent proposes a remedy for everything on consol A. |
| 0:31 | Panel opens, punch to 23 and the struck 27, then the referred box | Ladder runs the tool for real, but against a copy of the page. Twenty-seven shipments matched. Four of them cost more than this operator is allowed to sign off, so they are set aside before she reads the list. |
| 0:44 | Three unticks, punch to the count, then the stamp | She unticks three. The count moves, the bar moves, and the button changes from OK to run to OK with changes. Apply twenty of twenty-three. |
| 0:58 | Terminal payload, punch to the four lines | Here is what the agent gets back. Not "success". Twenty applied. Three she removed. Four waiting on a duty manager. That adds up to the twenty-seven it asked for, and every group lists its shipment numbers. |
| 1:10 | Follow-up panel, role switch, four-row sheet, receipt | So the agent asks again, about those four only. The page recognises them as the four it just referred. She still cannot sign them, so they go to the duty manager, who gets a sheet with four rows and signs it. The receipt says replan required, no. |
| 1:30 | Buggy toggle, then the Blocked card | Now the tool misbehaves on purpose. It tries to write a field that was never on the proof. Ladder rolls the whole commit back. Nothing changed. |
| 1:42 | Edge rack full bleed, drawer, commit bar | The engine does not know what a shipment is. Same code, different product. A config rollout across thirty-six edge sites. Twenty-three go out. Six are held by a rule. Seven need a traffic lead. |
| 1:58 | Terminal title bar, then the URL card | Ladder is a guard, not a sandbox. A tool that goes around it is not covered, and that is written on the page. The calls in this film were scripted, because no browser lets an outside agent call these tools yet. Everything after the call is the real code. It is open source. Wrap your own tool. |

Verify on screen before recording: the receipt line after the duty manager signs. The 28 August
rehearsal recorded it as "replan required: no". If the shipped build says something else, the
narration changes, never the build.

Do not say "seamlessly", "just works", "revolutionary", or "WebMCP" more than once. Do not script
an agent's reply and present it as a model's output.

## F. Copy pass, last (`src/ui/prompts.ts`, `src/ui/remedy-words.ts`, `src/ui/follow-up-words.ts`, `src/edge/ui/words.ts`, every `.tsx` with prose)

Run over every string a user can read. Cut on sight:
- Any sentence that explains why the interface is being honest.
- "A deliberate demonstration" (appears twice on one screen).
- Helper text that restates the control above it.
- Em dashes. Replace with a full stop or a comma.
- Any "X, not Y" or "Refuse and you lose X. Accept and you get Y." construction. Say the one thing.
Keep: rule ids before rule sentences, mono for every id and figure, limits stated in one sentence.

## Done means

- `npx vitest run` passes.
- `npm run build` produces `dist/` with no warnings.
- A fresh critic (screenshots only, the prompt in `~/.claude/skills/design-direction/references/critic.md`) scores the landing page and the open panel at 8 or above.
- Before and after screenshots of each section are saved beside this file in `docs/redesign-shots/`.
