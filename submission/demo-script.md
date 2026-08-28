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
| Rows previewed | 27 (consol A holds 27 of the 42) |
| Value | EUR 1,331 |
| Above a gateway operator's EUR 250 authority | 4, referred to a duty manager |
| Authorisable by this operator | 23 |
| Operator unticks | 3 |
| **Applied** | **20** |
| Reconciliation | 20 applied + 3 removed + 4 referred = 27 requested |

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

> An agent can call the tools this page owns. WebMCP settled that, and it is the hard part.
> What it did not settle is what happens when the agent is wrong. You see a function call and a
> name. You can take it or refuse it. You cannot see what it would do, and you cannot take part
> of it.

### 3 — 0:40 to 1:05 · Consequences, not arguments

**Screen:** the panel arrives. Hold on the figures, then scroll the rows slowly enough to read
two or three.

> Ladder runs the tool's real execute against a copy of the page's state first. Nothing real is
> touched. What the tool would do becomes this: twenty-seven shipments, one thousand three
> hundred and thirty-one euros, and exactly which remedy lands on which shipment.

### 4 — 1:05 to 1:20 · Referred, not refused

**Screen:** the referral block. Let the four ids read.

> Four of them cost more than a gateway operator may authorise. They are marked referred, not
> refused, and they go to a duty manager. The agent is told which four.

### 5 — 1:20 to 1:45 · The sculpt. The money shot.

**Screen:** untick three rows, slowly. Every figure moves. The stamp changes to **Apply 20 of 27**.
Press it.

> And the operator can cut it down. Three of these are not worth spending money on tonight.
> Every figure moves as I strike them out. The stamp now reads: apply twenty of twenty-seven.

### 6 — 1:45 to 2:05 · A refusal is a message

**Screen:** cut to the agent pane. Let the returned payload land.

> The agent is not told "success". It is told what happened and why the rest did not. Twenty
> applied. Three the operator removed. Four waiting on a duty manager. Every refusal names the
> exact shipments it covers, so the agent can propose a corrected follow-up instead of guessing.

### 7 — 2:05 to 2:20 · The guard

**Screen:** tick "Simulate a buggy tool" — let the label read, it is labelled deliberate — run a
proposal, approve it, hold on the denial card. **No row in the table changes.**

> If the tool goes off script at commit time and writes a field the operator was never shown,
> the whole commit rolls back. Nothing lands.

### 8 — 2:20 to 2:48 · The same engine, a different product

**Screen:** cut to `/edge.html`. Hold on the rack. Then the drawer, and the referral line.

> None of this is about freight. Same engine, different product: a config rollout across
> thirty-six points of presence. The agent stages a release everywhere. Seven sites put more
> production traffic in front of it than a release engineer may authorise, so those go to a
> traffic lead. The same boundary, measured in traffic instead of money. The two products share
> the engine and nothing else, and a test walks the import graph in both directions to keep it
> that way.

### 9 — 2:48 to 3:00 · The limit, and the link

**Screen:** the "What this does not do" section, then both URLs.

> Ladder is a guard, not a sandbox. A tool that reaches around the context it is handed is not
> governed by it, and that is written on the page rather than left for you to find. It is open
> source. Wrap your own tool.

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
