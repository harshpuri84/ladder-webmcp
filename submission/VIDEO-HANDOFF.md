# Video handoff — for a fresh session

You are making a three-minute video for the OpenAI WebMCP Challenge from a screen recording the
author captured. This document is everything a session with no prior context needs. Read it before
reading anything else.

**Deadline: Thursday 3 September 2026.** The welcome email says 1:00pm PT; the official community
post says `2026-09-04T00:00:00Z`. Work to the earlier.

---

## 1 · Start here

Read the `hyperframes` skill first. It is the mandatory entry point and it routes to the workflow
that owns each intent. The ones this job needs:

| Skill | Why |
|---|---|
| `hyperframes` | Entry point. Read first, always. |
| `talking-head-recut` | The overlay workflow — timed graphic cards, kinetic titles, data callouts, synced to the transcript, with the footage playing untouched underneath. Despite the name, this is the "package existing footage" workflow. |
| `embedded-captions` | Burned-in captions. Every beat must read with the sound off. |
| `media-use` | Voiceover from the script. |
| `oversized-cursor` | House cursor technique for UI scenes — this is a screen recording, so it applies throughout. |
| `motion-doctrine`, `cut-the-curve`, `seam-craft` | The motion law. Load `motion-doctrine` before composing anything, or the result reads as stacked slides. |

The HyperFrames CLI is installed (0.8.17). Skills were installed globally on 29 August.

## 2 · What the video is

**Ladder.** Two live products on one engine:

- https://ladder-webmcp.vercel.app — a freight console. Three tabs: `#/problem`, `#/proof`,
  `#/elsewhere`. Cream "Printer's Proof" world.
- https://ladder-webmcp.vercel.app/edge.html — an edge config rollout. Dark instrument rack.

**The claim.** WebMCP settled how an agent acts on a page. It did not settle what happens when the
agent is wrong. Ladder runs a write tool's real `execute()` against a copy of the page's state,
shows the human exactly what it would do, lets them cut it down, re-runs the same function behind
a guard that admits only what was approved, and returns a truthful structured account of every
refusal.

**The judges** are platform engineers from Chrome, Shopify, Vercel, Cloudflare, Netlify and
OpenAI. They watch the video, then open the URLs and prompt them freely.

## 3 · The script is the deliverable, not a suggestion

`submission/demo-script.md` — nine beats, ~446 words, about 167 seconds spoken at a natural pace.
The narration is synthesized, so **those words go to the voice tool verbatim** and the picture is
cut to fit them.

**Every figure in it was measured against the running build, not estimated.** An earlier draft said
the panel opens at 27 records and EUR 1,331; it opens at 23, captioned *struck down from 27*, at
EUR 0. If a figure in the footage disagrees with the narration, the narration is wrong and must be
re-measured — never the other way round.

`submission/demo-plan.md` — the recording plan, pre-flight order, and known failure modes.

## 4 · The figures, so you can check the footage against them

| Moment | What is on screen |
|---|---|
| Panel opens | **23** marked · *struck down from 27* · EUR 0 · four rows disabled |
| Why | 4 of 27 cost more than a gateway operator may authorise, set aside before the operator looks |
| Where the money is | all EUR 1,331 sits in those four; the 23 an operator may authorise are free rebooks |
| After three unticks | **20** · stamp changes grade from *OK to run* to *OK with changes* |
| Payload | requested 27 · applied 20 · 3 removed · 4 referred to a duty manager |
| The agent's follow-up | *Follows the 19:41 run — asks only about 4 rows sent to a duty manager* |
| The close | *replan required: no — propose_remedy did exactly what you approved* |
| Edge rollout | 36 requested · 23 applied · **7 referred to a traffic lead** · 6 closed by named rules |

## 5 · Constraints that are not negotiable

- **The author has red-green colour vision deficiency.** Nothing in any overlay may carry meaning
  by colour alone. Every state must read with all colour removed. The product itself obeys this
  and the video must not undo it.
- **No employer name anywhere.** Not in overlays, captions, titles or metadata. Public submission.
- **Never fabricate.** Do not script an agent's response and present it as a model's output. Do not
  add a figure that is not on screen. This submission's strongest asset is that it states its own
  limits; one invented frame costs all of it.
- **No marketing voice.** No "seamlessly", no "just works", no "revolutionary". The narration
  sounds like the page: plain, short, concrete. Overlays should match it.
- Every beat must read with the sound off.

## 6 · What the overlays should do

The footage is a screen recording, so the overlays' job is to **make the figures that move
legible**, not to decorate.

The single most important moment is the sculpt: 23 → 20, and the stamp changing grade. That is the
whole product in four seconds. Give it a data callout and let it breathe.

Second most important: the payload — `requested 27 · applied 20 · 3 removed · 4 referred`. Those
four numbers reconcile, and that reconciliation is the entry's central technical claim. If one
overlay earns a hold, it is that one.

Do not overlay the honest-limits beat. It should read as the page wrote it.

## 7 · The prompts typed on camera

These two strings, **verbatim**. They are covered by `src/domain/__tests__/shipped-prompts.test.ts`,
which drives the real registered tools and fails if a wording stops reaching one. They also appear
on the proof tab itself, so the video and the page teach the same string.

**Do not substitute your own wording.** A prompt that does not reach the tool produces a video that
teaches a judge something false.

> **Propose a remedy for every shipment on CONSOL-A.**

Reaches `propose_remedy {consol:'CONSOL-A'}`. 27 of the 42 ride that consol. Four cost more than a
gateway operator may authorise, so they are set apart before the operator looks and cannot be
marked by hand. The panel opens at **23 marked**.

> **Show me the shipments carrying lithium-ion batteries.**

Reaches `search_shipments {lithiumBattery:true}`. Two of the 42. No panel opens — a read has
nothing to approve. The register narrows to those two and says the agent set the view; the count
above the table reads `2 of 42`, and one click restores it.

**A warning that cost a take already:** record in a chat with **no project and no repository
attached**. With the repo open, Codex answered by reading `remedy-policy.ts` and `seed.ts` instead
of calling the tool. The numbers were right and it was not a demo — the giveaway was source
citations in the transcript and a register that never moved.

## 8 · The judge walkthrough

The proof tab carries **"Run it yourself"** — seven steps, each with what to do and what you
should see if it worked. Step 1 is open; the rest sit behind a closed fold so a judge who knows
what they want can ignore it.

1. Propose · 2. Cut it down · 3. Apply · 4. Refer, and sign as the second person ·
5. Watch a change land underneath you · 6. Make the tool misbehave · 7. Ask it to look, not to change

**Why it matters to the video:** a review named the free-prompt session as this entry's
highest-variance surface — the part the author does not control. The mechanics that distinguish
this submission are all *downstream* of the first call, and a judge who tries one prompt and stops
sees none of them. The closing beat should point at this rather than only at the URL.

## 9 · One honest caveat that may or may not be needed

No shipping browser lets a third-party agent invoke a page's WebMCP tools. If the recording was
made in Codex or ChatGPT's built-in browser with a real agent, that caveat does not apply and
beat 2's clause about it should be **cut**. If it was made against localhost with the dev double,
the clause stays.

**Ask the author which it was.** Do not guess — this is the one place where getting it wrong turns
an honest submission into a misleading one.
