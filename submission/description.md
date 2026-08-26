# Ladder — submission description

## Why this use case fits WebMCP

WebMCP lets a page hand an agent typed tools instead of a screen to scrape. That solves how an
agent acts. It does not solve what happens when the agent is wrong.

Every reference app for this challenge demonstrates an agent doing something correctly. None of
them show the moment that actually blocks agents from touching real systems: the agent proposes
a change to forty-seven records, and a person has to decide whether to let it happen. Today that
decision is made against a function call. You see `update_shipments({ origin: "Shanghai",
setStatus: "Delivered" })` and you have no idea whether that is three rows or four hundred, or
what it costs.

Ladder is a web app where that decision is made against consequences instead of arguments.

## How it improves the experience

Before a write tool changes anything, Ladder runs the tool's real `execute()` against a
`structuredClone` of the app's state, behind a Proxy that records every write. Nothing real is
touched. What the tool *would* do becomes a diff.

The person sees the blast radius: how many records, how much money, how many of the actions are
irreversible, and a bar showing that share against the whole dataset. They untick what they do
not want, and every figure moves as they do it. The button they press says "Apply 12 of 47".

Then the same `execute()` runs again, against real state, through a Proxy that lets the approved
writes through, silently skips the ones that were narrowed out, and throws if the tool goes
anywhere the preview never showed. A violation rolls the entire commit back.

## What people and agents can do together that was hard before

The person's edit stops being a veto and becomes a message.

When someone cuts 47 down to 12, the tool does not return "success". It returns what actually
happened and why the rest did not:

```json
{
  "status": "partially_applied",
  "requested": 47,
  "applied": 12,
  "rejected": [{ "reason": "the operator removed these from the change", "count": 35, "ids": [] }],
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

## What it does not do

The guarantee holds for records whose fields are primitives or values replaced wholesale. It
does not extend to mutation inside a nested object, because the recorder is two levels deep by
design. Tools must be deterministic: a field set from a clock differs between preview and commit
and will abort every time. Irreversible actions are held and released, never previewed as a
diff. Concurrent commits against one store are not supported.

All of that is in the README, and the code rejects what it cannot handle rather than guessing.
