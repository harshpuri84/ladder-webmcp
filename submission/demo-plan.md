# Recording plan — Sunday 30 August

## Shape: split screen, you record, I drive

Left half of the MacBook screen: the terminal running this session. Right half: a Chromium window
I control. You start the screen recording and do nothing else; every navigation, tool call,
untick and apply is executed from the terminal side, so the two halves move together and the
picture is deterministic. Narration is synthesized afterwards from `demo-script.md` and laid over
the cut.

**This was rehearsed end to end on 28 August, not planned on paper.** The full beat sequence ran:
tool call, panel at 23 marked, three unticked, stamp changing grade, apply, and the returned
payload reading `requested 27 · applied 20 · 4 referred · 3 removed`. It works.

## The one thing to say out loud, because it is true

No shipping browser yet lets an outside agent call a page's WebMCP tools. Chrome's flag registers
them; nothing lets a third party invoke them. So the calls in this video go through the page's own
registration rather than the browser's transport. **Everything after the call — the preview
against a forked state, the guard, the commit, the rollback, the structured refusal — is the
production path, unchanged.**

That belongs in the description and, in one clause, in beat 2. It costs nothing: the submission
already says no browser implements the interaction hook, and a judge who spots an unstated
shortcut will discount everything else. A judge who is told plainly will not.

**What we will not do:** script the agent pane and present it as a model's output. That is a
fabrication, and it is the one thing that would make every honest claim in this project worthless.

## The setup

| Piece | What |
|---|---|
| Browser | Chromium driven from the terminal, viewport **1512 x 945** |
| URLs | `http://localhost:5190/?demo#/proof` and `http://localhost:5190/edge.html?demo` |
| Terminal | This session, left half of the screen |
| Capture | Your screen recorder, full screen, both halves in frame |
| Voice | `demo-script.md`, synthesized, laid over the cut afterwards |

**Why localhost and `?demo` rather than the live URL:** the dev double is the only way an outside
caller can reach the registered tools at all, and it is gated out of the production build on
purpose. Its own source says it plainly: *"It is NOT WebMCP and it does not pretend to be."*
Everything downstream of the call is identical to production.

**Try ChatGPT desktop once in rehearsal.** If its built-in browser registers the tools and a real
model calls one, re-shoot beats 3 to 6 there and the transport caveat disappears entirely. It was
fixed but never verified, so treat it as a bonus, not the plan.

## What the 28 August rehearsal found

Every beat was driven end to end against the running build. All nine work. Three things the
script had wrong or missing:

1. **The referral beat is four steps, not two.** The script said "switch to duty manager and
   apply". It cannot: the follow-up opens with the stamp reading **Refer 4 of 4**, because a
   gateway operator cannot authorise any of those rows. The real chain is Refer → switch role →
   the run-log line offers **Review as duty manager** → a four-row sheet → Apply 4 of 4. Longer,
   and much better: it is the only place both humans and the agent are visible in one sequence.
2. **The closing line was on screen and not in the script.** After the duty manager signs, the
   receipt reads *replan required: no — propose_remedy did exactly what you approved*. That is
   the loop shutting, in the product's own words. It now ends beat 6.
3. **Beat 4 was explaining the referral twice.** Folded into beat 3, which paid for the longer
   beat 6.

Everything else held: the buggy-tool guard returns **Blocked · Ladder blocked this** with nothing
applied, and the edge rollout returns 36 requested, 23 applied, 7 referred to a traffic lead, with
the other 6 closed by named rules — a change freeze, an incident, two drained sites, and one
already serving the candidate.

## Pre-flight, in order

1. `git pull`, `npm ci`, `npx vitest run` — **check the exit code directly, do not pipe it**.
2. Re-measure the figures in `demo-script.md`. If any moved, fix the script before recording,
   not in the edit.
3. Open the live URLs, not localhost: a judge will open those, and so should the camera.
4. Chrome flag on, restarted, and confirm the page's own runtime line reads **present** — the
   freight banner disappears and the edge operating plate says so.
5. Reload for a clean fixture. No standing rules, filter empty, buggy-tool toggle **off**.
6. Window at 1512+ so the register keeps all nine columns while a panel is open.

## The prompts

Use these, in this order. The edge ones ship on the page itself and are covered by a test that
fails if they drift from what the tool does.

| Beat | Prompt |
|---|---|
| 3–6 | *Find the cheapest remedy for everything on consol A that still meets each customer's promise.* |
| 7 | Same again, after ticking "Simulate a buggy tool" |
| 8 | *Stage the candidate release at every site.* |

## What is done by hand, and why

The three unticks in beat 5 are clicked by a person. That is not a shortcut — it is the beat. The
whole product is that a human cuts an agent's change down, so a machine doing it would be the one
place automation actually lies about what is happening.

Everything else the human does is a click on Apply, a toggle, and a tab change.

## Rehearsal, the day before

Run the beats end to end twice against the live URLs before recording anything. The purpose is
not the picture; it is to catch a figure that moved and a beat that takes longer than its
narration allows. Time each beat and write the real duration next to it in `demo-script.md`.

## Hard-reload before every take

A stale Vite hot-reload module graph leaves the page with two instances of the adapter: the demo
double registers into one, the panel subscribes to the other, and a tool call goes pending with no
panel ever opening. It looks exactly like a broken build and is not. Caught twice on 28 August.

Navigate with a cache-busting query (`?demo&fresh=1`) or hard-reload before each take, and wait
about 1.5 seconds after load before the first call so registration has completed.

## Known failure modes

- **The buggy-tool toggle survives a reload but not a fixture reset.** Confirm it is off before
  every take; a guard firing out of an unchecked box reads as a bug in the product.
- **The panel dims the register but no longer blocks it.** Clicking a row during a decision now
  works, which is what makes the stale-abort demonstrable. Do not click one by accident mid-beat.
- **Below 1638px the register drops five columns during a decision.** Correct, but the narration
  in beat 3 points at cargo flags that would not be on screen.
- **A pending call survives 96 seconds.** Measured. Do not leave a proposal open longer than that
  while adjusting the shot.

## Still owed, and it belongs to this day

Nobody has yet watched a real agent read a refusal and propose a corrected follow-up. The contract
is in the tool description and the ids are in the payload, but the loop closing has never been
observed. **Try it during rehearsal.** If the model reads `partially_applied`, takes the referred
ids, and proposes a follow-up, record that exchange — it is the strongest thirty seconds available
and it answers the objection an OpenAI judge is most likely to raise. If it does not, say nothing
about replanning in the narration beyond what beat 6 already claims, which is only that the agent
is *told* enough to act.
