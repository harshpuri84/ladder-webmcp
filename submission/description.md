# Ladder — submission description

## Why this use case fits WebMCP

Thursday, 19:40. A flight from Frankfurt to Chicago is cancelled. Two consolidations were on
it, so 42 shipments belonging to 31 different customers are now unbooked. Nobody assembled that
list. The cancellation did.

There are ninety minutes to the first cutoff, and three ways out. Rebook on the same carrier
tomorrow morning, which is free and costs eighteen hours. Put it on a competitor's freighter
tonight, which recovers the time and costs money. Truck it to another airport and fly from
there, which lands one day late instead of two.

The person responsible has to decide which shipments are worth which remedy. Today they see the
agent's function call. What they need to see is that this one carries lithium-ion batteries and
therefore cannot go on tomorrow's passenger flight at all, that this one's temperature-controlled
container has twelve hours of endurance left and cannot wait until morning, and that this one is
ordinary freight whose customer will not notice.

WebMCP solved how an agent acts. What it did not solve is what happens when the agent is wrong,
and that is the part standing between a demo and production.

Ladder is a web app where that decision is made against consequences instead of arguments.

## How it improves the experience

Before a write tool changes anything, Ladder runs the tool's real `execute()` against a
`structuredClone` of the app's state, behind a Proxy that records every write. Nothing real is
touched. What the tool *would* do becomes a diff.

The person sees the blast radius: how many records, how much money, how many of the actions are
irreversible, and a bar showing that share against the whole dataset. They untick what they do
not want, and every figure moves as they do it. The button they press says "Apply 27 of 42".

Then the same `execute()` runs again, against real state, through a Proxy that lets the approved
writes through, silently skips the ones that were narrowed out, and throws if the tool goes
anywhere the preview never showed. A violation rolls the entire commit back.

## What people and agents can do together that was hard before

The person's edit stops being a veto and becomes a message.

When someone cuts 42 down to 27, the tool does not return "success". It returns what actually
happened and why the rest did not:

```json
{
  "status": "partially_applied",
  "requested": 42,
  "applied": 27,
  "rejected": [
    { "reason": "not screened to passenger standard", "count": 1, "ids": ["HAWB-70041"] },
    { "reason": "the operator removed these from the change", "count": 14, "ids": [] }
  ],
  "replan_required": true
}
```

Different refusals carry different reasons, and the agent can tell them apart. A row the tool
itself declined comes back as `customs hold open` with the exact ids. A message the person did
not approve comes back as its own bucket. A record that changed while they were deciding says
so. The agent is never left guessing which kind of no it received.

The agent now knows something it did not know before, in a form it can act on, and nobody typed
an explanation. That figure is not decoration either: `applied` plus every rejected count equals
`requested` on every path the app can reach, including the ones where nothing lands.

Autonomy then works the same way. After a run of clean approvals Ladder drafts a standing rule
with caps and an expiry, and a person ratifies it the way they would approve a pull request.
A person can also set one up front, before the agent does anything. When a rule is ratified,
Ladder calls `unregisterTool()` and re-registers the tool with a description that states the
rule, so **the agent's own toolset changes as trust is granted**. When the rule expires, the
tool reverts. Irreversible tools can never carry a rule at all.

## How WebMCP was implemented

Six tools on `document.modelContext`. Two reads carry `readOnlyHint` and run without a prompt.
Four writes route through the engine above.

**On `agent.requestUserInteraction()`.** The spec defines this hook for pausing `execute()` to
ask the user. Chrome 151's testing build does not implement it. Measured on 26 August 2026:
`execute` receives only its first argument, so there is no agent object and no `AbortSignal`.
Ladder feature-detects for the hook and renders its approval surface in the page because no
shipping runtime provides one. We are not claiming to mount on the platform primitive, and we
are not listing `AbortSignal` handling as delivered. Both paths are written and both are
spec-conformant; neither is exercised in the runtime a judge will open.

We also measured that a pending `execute` survives 96 seconds and returns its structured result
intact, which is why the approval can take as long as a person needs.

## Why the recommendation differs per shipment

Every alternative a rule removed is shown with the rule that removed it, and the rule carries an
identifier. Standalone lithium-ion is cargo-aircraft-only, so it cannot take a passenger flight.
A piece built for a freighter main deck does not fit a belly hold. An active container's
endurance can be shorter than the road route. Cargo not screened to passenger standard cannot
fly one until it is re-screened.

So the same remedy is correct for most of the flight and impossible for a handful, and the
interface says which rule decided. Engineers tend to read this as a policy engine. That is the
right reading.

## What the reference material does not do

This is worth stating precisely rather than as a claim about other entries.

In the Chrome team's own conference talk on WebMCP (Tara Agyemang, AI Engineer Europe, June
2026), both live demos run the agent straight through to a completed action. The second ends
with a real ticket purchase, money spent, no intermediate confirmation. The guidance given for
gating a consequential step is manual and generic: do not register the tool for that step, and
let the user do it by hand.

That is a reasonable answer, and it is the only one on offer. It means an action is either fully
automatic or fully manual, with nothing in between, and it puts the decision at tool-registration
time rather than at the moment the change is actually understood.

Ladder is the in-between. The tool stays registered, the agent still calls it, and the human
decides against consequences at the moment they exist. The same talk states as best practice that
the UI should stay in sync with the tool calls happening; this is that principle with the
approval step added.

## What it does not do

**Ladder is not a sandbox.** It governs writes and effects that pass through the tool context it
provides. A tool that reaches around that context, by importing the real store or calling a
server directly, is not governed by it. This is a review and transaction layer for cooperative
tools, not containment for code you do not trust. Everything below is the same kind of statement.

Nothing persists: standing rules, history and the activity log are in memory and a reload clears
them. There is no auth and no durable audit trail. Approval is per record, not per field.

The guarantee holds for records whose fields are primitives or values replaced wholesale. It
does not extend to mutation inside a nested object, because the recorder is two levels deep by
design. Tools must be deterministic: a field set from a clock differs between preview and commit
and will abort every time. Irreversible actions are held and released, never previewed as a
diff. Concurrent commits against one store are not supported.

All of that is in the README, and every one of those limits is enforced loudly rather than
guessed around. A field set from a clock aborts the commit every time. A malformed entity or
record key is rejected before a preview even starts. And a write below the second level, the one
thing this recorder cannot preview, is refused at the moment it is attempted: objects read at
that depth are read-only views that throw on any write, with the full path in the message, and a
commit that hits one rolls back whole and returns denied. The depth limit is real and we would
rather widen it than live with it. What it never does is let an unpreviewed write land quietly
on real state.
