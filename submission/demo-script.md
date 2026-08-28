# Ladder — demo video

**Under three minutes. Recorded Sunday 30 August. Submission closes Thursday 3 September,
1:00pm PT (22:00 CEST).**

Narration is synthesized, so the words below are the deliverable: they go to the voice tool
verbatim, and the screen is cut to fit them rather than the other way round. Every figure in the
narration was measured against the shipped build on 28 August, not estimated. If the build
changes, re-measure before recording — the numbers are the one thing an edit cannot fix.

---

## The measured figures

One call carries the whole argument. `propose_remedy {"consol": "CONSOL-A"}`:

| | |
|---|---|
| Rows matched | 27 (consol A holds 27 of the 42) |
| Above a gateway operator's EUR 250 authority | 4 — set aside before the operator looks, and **disabled**: they cannot be latched by hand |
| **Panel opens at** | **23 marked · "struck down from 27" · EUR 0** |
| Where the money is | all EUR 1,331 of it sits in the four referred rows; the 23 an operator may authorise are free rebooks |
| Stamp on open | *OK to run — Apply 23 of 23, and refer 4 shipments* |
| Operator unticks | 3 (HAWB-70003, 70005, 70007) |
| **Stamp after** | ***OK with changes* — Apply 20 of 23, and refer 4 shipments** |
| **Applied** | **20** |
| Reconciliation | 20 applied + 3 removed + 4 referred = 27 requested |

**Measured by driving the shipped build on 28 August, not read off the source.** An earlier draft
of this script said the panel opens at 27 and EUR 1,331. It does not, and reading it aloud over
the real screen would have put the narration at odds with the picture in the most important beat.

Second product, `roll_config {}` — no filter, no mode:

| | |
|---|---|
| Sites | 36, carrying 100% of production traffic |
| Closed by a rule before the drawer | 6 |
| Applied | 23 |
| **Referred to a traffic lead** | **7** |

---

## The shot list

### 1 — 0:00 to 0:22 · The problem

**Screen:** `#/problem`, top of the page. Hold on the standfirst, then the opening paragraph.

> Thursday, nineteen forty. A flight from Frankfurt to Chicago is cancelled. Two consolidations
> were on it — one air waybill covering many separate customers' shipments — so forty-two
> shipments belonging to thirty-one different customers are now unbooked. Nobody assembled that
> list. The cancellation did. There are ninety minutes to the first cutoff.

### 2 — 0:22 to 0:40 · What WebMCP left

**Screen:** cut to the agent pane. The prompt is typed and sent.

> An agent can call the tools this page owns. WebMCP settled that, and it is the hard part. What
> it did not settle is what happens when the agent is wrong. You see a function call and a name.
> You can take it or refuse it. You cannot take part of it.

### 3 — 0:40 to 1:05 · Consequences, not arguments

**Screen:** the panel arrives. Hold on the figures, then scroll the rows slowly enough to read
two or three.

> Ladder runs the tool's real execute against a copy of the page's state first. Nothing real is
> touched. What the tool would do becomes this: twenty-seven shipments matched, and exactly which
> remedy lands on which one.

### 4 — 1:05 to 1:20 · Referred, not refused

**Screen:** the count reading **23**, the caption *struck down from 27*, then the four disabled
rows. Hover one to show it cannot be ticked.

> Four of them cost more than a gateway operator may authorise, so Ladder has already set those
> aside. Twenty-seven, struck down to twenty-three. They are referred, not refused — a duty
> manager decides them, and the agent is told exactly which four. Every euro in this run is in
> those four; everything the operator may authorise tonight is free.

### 5 — 1:20 to 1:45 · The sculpt. The money shot.

**Screen:** untick three rows, slowly. Every figure moves. The stamp changes to **Apply 20 of 27**.
Press it.

> And the operator can cut the rest down. Every figure moves as I strike three out — and the
> stamp changes grade. It said "OK to run". It now says "OK with changes": apply twenty of
> twenty-three, and refer four.

### 6 — 1:45 to 2:05 · A refusal is a message

**Screen:** cut to the agent pane. Let the returned payload land.

> The agent is not told "success". It is told what happened and why the rest did not. Requested
> twenty-seven. Applied twenty. Three the operator removed. Four waiting on a duty manager. Each
> refusal names the exact shipments it covers, so the agent can propose a corrected follow-up
> instead of guessing which half of its request survived.

### 7 — 2:05 to 2:20 · The guard

**Screen:** tick "Simulate a buggy tool" — let the label read, it is labelled deliberate — run a
proposal, approve it, hold on the denial card. **No row in the table changes.**

> If the tool goes off script at commit time and writes a field the operator was never shown,
> the whole commit rolls back. Nothing lands.

### 8 — 2:20 to 2:48 · The same engine, a different product

**Screen:** cut to `/edge.html`. Hold on the rack. Then the drawer, and the referral line.

> None of this is about freight. Same engine, different product: a config rollout across
> thirty-six points of presence. Stage a release everywhere, and seven sites put more production
> traffic in front of it than a release engineer may authorise. Those go to a traffic lead. The
> same boundary, measured in traffic instead of money. The two share the engine and nothing else,
> and a test walks the import graph both ways to keep it that way.

### 9 — 2:48 to 3:00 · The limit, and the link

**Screen:** the "What this does not do" section, then both URLs.

> Ladder is a guard, not a sandbox. A tool that reaches around the context it is handed is not
> governed by it — and that is written on the page, not left for you to find. It is open source.
> Wrap your own tool.

---

## Rules for the cut

- Every beat must read with the sound off. Captions carry the words.
- Hold on a figure that changes. The sculpt in beat 5 is the whole product; give it its seconds.
- Record at **1512 wide or more**. The register hides five columns below 1638px while a panel is
  open — correct behaviour, but it hides the cargo flags the narration refers to.
- The thumbnail is the panel at **27 records, EUR 1,331**.
- Do not claim Ladder mounts on `requestUserInteraction`. It does not, no shipping browser
  implements it, and a Chrome engineer is judging.
- Do not say "fully autonomous", "seamlessly", or "just works". The submission's strongest asset
  is that it states its limits; the narration should sound like the page.
