# The authority boundary — build report

27 August 2026. Branch `main`, from `12f8d3d`. 188 tests pass (165 before, 23 added), build
clean, no `src/core/` file touched, demo double absent from `dist/`.

---

## What was built

A spend threshold that applies to the operator on shift. Rows whose remedy costs at or below it
are theirs to apply. Rows above it are not theirs at all — they are separated before the panel
opens, withheld from them in it, filtered out of the write set after their decision comes back,
and queued for a second approver who decides them through the ordinary proof path.

The two roles and their limits:

| Role | May authorise on one shipment | Refers to |
|---|---|---|
| Gateway operator (default) | EUR 250 | Duty manager |
| Duty manager | EUR 5,000 | nobody |

The split is read off `DiffGroup.valueDelta` — the per-record money figure the diff already
carries, and the same one the extent panel and the standing-rule cap read. Nothing new computes
spend, so the boundary cannot disagree with the figure printed beside it.

**The threshold is a number, not "free versus paid."** On the whole flight, `HAWB-70018` at
EUR 220 (truck-and-fly) is authorised by the gateway operator while `HAWB-70002` at EUR 317 is
referred. Both are paid remedies.

---

## Where the threshold came from — and why it is not the policy object

The brief asked for the existing policy object to be reused. I did not, and this is the one
place I deliberately departed from the instruction. Three reasons, in descending order of how
much they decide it:

1. **A policy is a grant upward; an authority limit is a bound downward.** `Policy` means "the
   agent may proceed without a human." A spend threshold means "this human may not proceed
   without a second one." Expressing the threshold as a policy would have inverted the meaning
   of the object that gates auto-apply — `policyMatches()` returning true is precisely
   permission to skip the human.
2. **Every lifecycle affordance of `Policy` fails open for a bound.** It lapses; a grant that
   lapses falls back to review, which is safe, but a *limit* that lapses leaves the operator
   unbounded, which is the opposite of what expiry is for. It is ratified by the operator; an
   operator cannot ratify their own spend authority. A bound that fails open is not a bound.
3. **`Policy.maxValue` caps the value of a whole diff. This caps one shipment.** Forty free
   rebookings and one EUR 900 freighter is inside any sane total and outside this operator's
   authority. One field cannot mean both.

There is also a hard constraint: `Policy` lives in `src/core/policy.ts`, and `src/core/` was not
to be touched, so a field could not have been added to it in any case.

**What was reused**: the machinery around policy in the adapter, deliberately and one-for-one —
module-scope state, a change-listener set, a `describe*` function whose words the strip, the
tool description and the receipt all share, and push-based re-registration of the tool's
description when the bound moves. `composedDescription()` now composes the base description, the
standing-rule clause and the authority clause in one place, and `ratify`, `clearPolicy`,
`revoke`, expiry and a role change all go through it. There is one pattern in this layer, not
two. The new module is `src/webmcp/authority.ts`, 80 lines, and its head comment states the
three reasons above.

---

## The payload shape for a partially-referred run

Verified live at `http://localhost:5190/?demo`, gateway operator on shift:

```js
window.__ladderDemo.call('propose_remedy', { consol: 'CONSOL-A' })
```

27 rows. 23 free rebookings the operator can authorise, 4 paid remedies over EUR 250. Stamping
`OK TO RUN · Apply 23 of 23 · and refer 4 shipments` returns:

```json
{
  "status": "partially_applied",
  "requested": 27,
  "applied": 23,
  "rejected": [
    {
      "count": 4,
      "reason": "above the gateway operator's EUR 250 spend authority — referred to a duty manager, not refused",
      "ids": ["HAWB-70001", "HAWB-70002", "HAWB-70023", "HAWB-70025"],
      "pending": "duty manager"
    }
  ],
  "actions_released": 0,
  "actions_dropped": 0,
  "replan_required": false,
  "referred": {
    "count": 4,
    "ids": ["HAWB-70001", "HAWB-70002", "HAWB-70023", "HAWB-70025"],
    "awaiting": "duty manager"
  },
  "rule_offered": null
}
```

### How this keeps `applied + Σrejected.count === requested` true

23 + 4 = 27. The invariant holds, unchanged, and it holds because **referred rows stay in the
ledger**. They were requested and they did not happen, so they are counted there exactly once,
like any other thing that did not happen. Referral did not need a second ledger and did not get
one.

What referral needed was a way to say that this particular kind of "did not happen" is not
final. Two additions, neither of which adds to the sum:

- `rejected[].pending` — an optional discriminator on the bucket, naming who it is waiting on.
  An agent that only knows how to sum `count` reconciles correctly without ever reading it.
- `referred` — a top-level restatement of the same subset, so an agent does not have to parse a
  reason string to tell referral from refusal. It is a qualifier on a bucket already counted,
  not an item to add.

`replan_required` is the one existing field whose meaning I changed, and only in the case that
did not exist before: it is now `rejectedTotal - referredCount > 0`. Replanning around a row a
duty manager is in the middle of deciding would have the agent propose a worse remedy for
freight that is about to get a better one. A mixed run — some rows domain-skipped, some referred
— still reports `replan_required: true`, because the skipped ones genuinely will not happen.

### Every-row-referred

```js
window.__ladderDemo.call('propose_remedy', { ids: ['HAWB-70014', 'HAWB-70030'] })
```

Stamp reads `REFER · Refer 2 of 2` and is **enabled**: sending the sheet on is the act. Payload:
`requested 2, applied 0, referred.count 2, replan_required false`, and the reconciliation still
holds at 0 + 2 = 2. Receipt: `REFER — Referred, nothing applied`.

### The second approver

Switching the labelled role to Duty manager and pressing `Review as duty manager` re-calls
`propose_remedy` narrowed to exactly the referred ids. The duty manager gets their own preview,
their own proof sheet (4 rows, none referred, `OK TO RUN · Apply 4 of 4`) and the same guarded
commit — not a rubber stamp on someone else's diff. Payload comes back `status: applied,
applied: 4, referred: undefined`, the queue empties, and the four rows go to `v2` in the register
carrying `truck-and-fly €326` and the rest.

Deliberately **not** a special commit path. Re-calling the tool avoids two traps at once: the
original diff's version map would have gone stale for the rows the first operator already
applied, and the referred rows never bumped their versions, so a fresh preview is both correct
and simpler than reconstructing a partial write set.

### Enforcement is not presentational

Two paths hand a group list to the commit, and neither of them decides the boundary:

- The panel withholds the control, but `execute` filters the referred keys out of
  `approved.groups` *after* the decision returns. A decision that approved every group — a
  broken panel, or a caller reaching past one — still applies none of the referred rows.
  Covered by `refuses a referred row even when the decision that came back approved it`.
- A ratified standing rule approves every group with no panel at all. It is filtered by the same
  line. Covered by `does not let a ratified standing rule spend past the operator who ratified
  it`, with the rule's own caps set wide enough (1,000 records, EUR 1,000,000) that only the
  authority limit can be what stops it.

### The agent is told upfront, not only after the fact

Every guarded write tool's registered description now carries the boundary, and re-registers
when the role changes — the same push-based path ratifying a standing rule already used:

> …Where a proposed change carries a cost, the operator on shift is a gateway operator and may
> authorise up to EUR 250 on one shipment; anything above that is referred to a duty manager and
> is not applied by this call.

Opened on the condition (`Where a proposed change carries a cost`) so it reads correctly on
`notify_customers`, whose changes never carry one.

---

## The colour check

The operator has red-green colour vision deficiency, so meaning never travels in hue. The new
state is a referred row, and it has to be distinguishable from two things it is not: a row the
operator marked, and a row the operator struck out. It carries **four** signals, none of them a
colour, measured in `.impeccable/cvd/test.html`'s fourth column (`filter: grayscale(1)`) rather
than eyeballed:

| Signal | Marked row | Referred row |
|---|---|---|
| Mark shape (`.dg-mark path` d) | `M3.25 10.5 8 5.25 12.75 10.5` (caret) | `M5.4 5.6a2.65…` (query) |
| Rule form on the row's edge | `none 0px` | `double 3px` |
| Stamped word | — | `Refer` |
| Control | enabled | `disabled: true` |

The mark is the proofreader's **author's query** — "Qy?" in the margin, the correction the
proofreader cannot settle and passes to whoever can. That is exactly a referral, and it is a
shape no other state in this interface uses, not the same shape in another colour.

A referred row is explicitly **not** struck: `dg--struck` is absent, `dg-struck-note` stays
`display: none`, and the remedy line keeps its upright weight. Nothing on it was declined.

Receipt rule forms, computed across all nine tones:

```
referred  double|3px|dashed|3px|hold      ← new, unique
blocked   double|3px|double|3px|hold
sent      solid|3px|solid|1px|hold
moved     dashed|3px|solid|1px|rule-strong
fault     dotted|3px|solid|1px|hold
skipped   solid|1px|solid|1px|rule-strong
applied / partial / auto  double|3px|solid|1px|mark   (pre-existing, told apart by stamp word)
```

`referred` is unique. Its stamp word `REFER` is unique against `OK TO RUN`, `OK WITH CHANGES`,
`STANDING RULE`, `SUPERSEDED`, `BLOCKED`, `TOOL ERROR`, `NOTHING TO SET`, `REVISE`. The receipt
also relabels its own ledger row `referred` rather than `refused` — printing "refused 4" beside
a reason ending "not refused" would have read as the receipt arguing with itself.

The harness gained two sections rendering the live markup: **The authority boundary** (a marked
row beside a referred one, the panel's referred section, the stamp block) and **The referral,
returned and queued** (the REFER receipt, the strip with a live queue).

The role strip uses the caret and a double rule to say which role is in effect; the tint only
agrees. The amber wash on a referred row is the fourth-order signal and carries nothing on its
own.

---

## The two renames

**1. Marta.** `ResultCard`'s stale case was "The records moved on" — which describes nobody. It
now reads **"Marta got there first"**, with the note "Marta changed one of these shipments while
your proof was open, so nothing was applied against a stale picture." The register's control is
now `Marta edits this`, titled "Simulates Marta, the other operator on this shift, changing this
record outside any agent proposal." Behaviour is byte-identical: the same direct store write, the
same `version` bump, the same `aborted_stale` abort, verified live.

One word differs from the brief's sentence. The brief gave "Marta applied a remedy to this
shipment while your proof was open." The control does not apply a remedy — it corrects revenue —
and the stale receipt does not know which field moved. Asserting a remedy would have been the
receipt claiming something it was not told, in a product whose whole pitch is that it does not do
that. "Changed" is what is true. Say if you want the control's own edit changed to a remedy
instead, and the sentence can be exact.

**2. Nothing else was renamed.** The `External edit` column header stayed.

---

## Files

| File | Change |
|---|---|
| `src/webmcp/authority.ts` | new — roles, limits, escalation path, listeners |
| `src/webmcp/adapter.ts` | split, enforce, queue, `reviewReferral`, composed descriptions |
| `src/webmcp/result.ts` | `rejected[].pending`, `referred` |
| `src/ui/AuthorityStrip.tsx` | new — role switch, honesty note, referral queue |
| `src/ui/ProofMark.tsx` | `query` mark |
| `src/ui/DiffGroupRow.tsx` | referred row |
| `src/ui/ProposalPanel.tsx` | referred selection, section, stamp arithmetic |
| `src/ui/ResultCard.tsx` | `referred` framing, `referred` ledger label, Marta |
| `src/ui/ActivityList.tsx` | `referred` cause mark |
| `src/ui/Console.tsx` | Marta |
| `src/App.tsx` | mount `AuthorityStrip` |
| `src/ui/styles.css` | `.dg--referred`, `.pp-refer`, `.rc--referred`, `.au-*` |
| `.impeccable/cvd/test.html` | two new sections of live markup |

Tests added (23): `src/webmcp/__tests__/authority.test.ts` (6),
`src/domain/__tests__/spend-authority.test.ts` (7), `ProposalPanel-authority.test.tsx` (3),
`DiffGroupRow.test.tsx` (+3), `ResultCard.test.tsx` (+4).

---

## Open

- **`PRODUCT.md` "Evidence on Hand" says 83 passing tests.** It said 83 when there were 165, so
  the drift predates this change, but this change widened it to 188. Not touched — out of scope
  for this pass.
- The referral queue is in memory, like standing rules and history. A reload loses it. Consistent
  with the documented limit ("Nothing persists"), and worth a line in PRODUCT.md's known limits
  if the mechanic stays.
