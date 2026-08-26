# Ladder — video shot list

Under 3 minutes. Captions burned in. Filmed inside ChatGPT desktop's built-in browser, so judges
see their own test environment working.

**Before you record**
- Reload the page so the console is at its seeded state and no standing rules exist.
- Turn the "Simulate a buggy tool" toggle OFF. It goes on at 1:45 and the viewer must see you do it.
- Window at 1280 wide or more. The console narrows when a panel opens and needs the room.
- Receipt cards fade in over about a second. Hold on each one before cutting.

---

## 0:00–0:15 — Cold open. No logo, no title card.

**On screen:** the agent fires a bulk reprice. The panel slams in: **17 RECORDS**, **+€7,484**,
the proportion bar filling a slice of the whole dataset.

**Say:** "Every demo this week shows an agent doing something. This one shows what happens when
it is wrong."

## 0:15–0:35 — Consequences, not arguments.

**On screen:** scroll the diff slowly. Land on the "7 skipped, customs hold open" strip.

**Say:** "The agent asked to reprice a lane. The platform would show me the function call. This
shows me what the call does: seventeen records, seven and a half thousand euros, and seven rows
the tool left alone because they are held at customs."

## 0:35–1:05 — The sculpt. This is the money shot.

**On screen:** untick three rows, slowly enough to read. Every figure moves: 17 to 14, €7,484 to
€6,332, the bar retreats, the button changes to **Apply 14 of 17**. Press it.

**Cut to the ChatGPT pane** and let the agent's reply land on screen.

**Say:** "I do not have to accept or reject the whole thing. I cut it down, and the agent is told
exactly what I removed and why. Requested seventeen, applied fourteen, three refused. Her
judgement went back as structured data, not as a silent success."

## 1:05–1:30 — Trust, granted rather than assumed.

**On screen:** open "Add a standing rule", set twenty records and five hundred euros, ratify.
The chip flips to a standing rule. **Show the tool's description changing** — the Inspector, or
the demo console, whichever reads faster on camera. Then call the tool within the cap: it applies
with a receipt and no panel.

**Say:** "I can grant the agent room to move. Up to twenty records, under five hundred euros,
nothing irreversible. When I do, its own tool description changes. The agent can see what it is
now allowed to do without asking."

## 1:30–1:45 — The world moves underneath.

**On screen:** open a fresh proposal. While it sits there, click "Edit a row" on one of its rows.
Watch the version badge tick from v1 to v2. Press Apply. The card reads **"The records moved on"**
and nothing changes in the table.

**Say:** "Someone else touched a record while I was deciding. It refuses rather than applying
against a stale picture."

## 1:45–2:10 — The guard fires.

**On screen:** tick **"Simulate a buggy tool"** and let the label and its explanation be readable.
Run a proposal, approve it. The commit is denied, the card names the field that went out of
scope, and **no row in the table changes**.

**Say:** "This switch makes the tool go off script at commit time and write a field I was never
shown. That is deliberate, and it is labelled as deliberate. Ladder blocks the write, names it,
and rolls the whole commit back. Nothing lands."

## 2:10–2:35 — The primitive.

**On screen:** the code. One `execute()`, written normally. Then the wrapper.

**Say:** "The developer writes one function, the way they already do. Ladder runs it twice: once
against a copy to see what it would do, once for real against only what the human approved. It is
open source. Wrap your own tool."

## 2:35–3:00 — The case, and the honest part.

**On screen:** the live URL, full screen, inside ChatGPT's browser.

**Say:** "The spec has a hook for asking the user mid-call. No shipping browser implements it yet,
so Ladder renders its own surface and detects for the hook. What the hook cannot express even
where it exists is this: consequences instead of arguments, part of a change instead of all or
nothing, and a reason the agent can reason with."

---

## Rules

- Every beat has to read with the sound off. Captions carry the words.
- No dead air. If a state takes time to settle, cut rather than wait.
- The thumbnail is the blast-radius card at 17 records and €7,484.
- Do not claim Ladder mounts on `requestUserInteraction`. It does not, and a Chrome engineer is
  judging.
