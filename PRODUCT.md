# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is **an operator who is accountable for the records an agent wants to change**.
They are mid-shift, they did not initiate the change, and they are being asked to let an agent
alter 47 things at once. They are not necessarily technical, but they are answerable for the
outcome. Their job in this interface is to understand the consequences fast enough to decide
with confidence, and to be able to decide partially rather than all-or-nothing.

A developer evaluating whether to wrap their own tools in this pattern is a real second
audience, but they are served by the README and the source, not by the console. When the two
conflict, the operator wins.

## Product Purpose

An AI agent calls a web page's tools. Instead of applying the change, Ladder runs the tool's real
`execute()` against a copy of application state, shows the operator exactly what it would do,
lets them cut it down, applies only the approved subset, and returns a truthful structured
account to the agent.

Success is that the operator decides against consequences rather than against a function call,
and that the agent learns something from the refusal instead of receiving an unexplained failure.

## Positioning

A reference implementation of a pattern, not a product. The artifact is the idea plus proof that
it works, and the console exists to demonstrate the mechanism. The next step after it ships is
design partners for an SDK, not more features.

The mechanism a neighbouring product could not truthfully copy: the same `execute()` runs twice,
once against a clone to compute the blast radius and once against real state through a guard
that admits only what the human approved. Approval binds to values, not just keys. Anything the
preview never showed rolls the entire commit back.

## Operating Context

The operator is working inside an ordinary records console. The agent arrives through the
browser's WebMCP runtime, either ChatGPT desktop's built-in browser or Chrome 149+ with
`chrome://flags/#enable-webmcp-testing` enabled. Proposals interrupt whatever the operator was
doing, so the decision surface has to be readable cold.

Judging happens on 3 September 2026, by a panel of platform and developer-relations engineers
from Chrome, Shopify, Cloudflare, Vercel, Netlify and OpenAI, who will watch a three-minute
video and then open the live URL and prompt it freely.

## Capabilities and Constraints

Six tools on `document.modelContext`: two reads carrying `readOnlyHint`, four guarded writes.
Preview, sculpt, enforced commit, structured result. Standing rules a human ratifies, after which
the tool is re-registered with a wider description so the agent's own toolset changes.

Measured against Chrome 151 on 26 August 2026: `execute` receives only its first argument, so
`agent.requestUserInteraction()` and `AbortSignal` are defined in the spec but absent from the
runtime. A pending `execute` survives 96 seconds.

Known limits, all deliberate and all documented:

- Ladder is not a sandbox. It governs writes and effects that pass through the tool context it
  provides. A tool that reaches around that context is not governed by it.
- The recorder is two levels deep. Mutation inside a nested object field is not seen.
- Tools must be deterministic. A field set from a clock differs between the two runs and aborts.
- Nothing persists. Standing rules, history and the activity log are in memory.
- Approval is per record, not per field.
- Irreversible actions are held and released whole, never previewed as a diff, and can never be
  covered by a standing rule.

## Brand Commitments

The name is Ladder: autonomy is climbed, not assumed. The engine in `src/core/` carries no domain
vocabulary and never will; the freight console is one skin over a general layer.

No employer association anywhere. Public repository, personal accounts, and no reference to the
author's employer in code, fixture data, copy, or commit history.

## Evidence on Hand

- Live: https://ladder-webmcp.vercel.app
- Public repository: https://github.com/harshpuri84/ladder-webmcp
- 83 passing tests, including regression coverage for every defect found in review.
- A dev-only test double behind `?demo`, gated out of the production build, that registers the
  same tools and lets a human drive the panel without a WebMCP runtime.
- Fixture data is 200 deterministically seeded shipments with invented customer names. There are
  no real customers, no real rates, and no benchmarks. Future work must not invent any.

## Product Principles

1. **Consequences, not arguments.** The operator decides against what a change would do, never
   against the call that would do it.
2. **Partial consent is the point.** Yes and no are not the only answers. Cutting a change down
   is the primary interaction, not an edge case.
3. **A refusal is a message, not a failure.** Every no carries a structured reason the agent can
   act on. If anything the agent asked about did not happen, it is told to replan.
4. **Say the limit out loud.** Every boundary is stated plainly and the code refuses what it
   cannot handle rather than guessing. No claim ships that the code cannot back.
5. **Autonomy is granted, never assumed.** It attaches to a rule a human ratified, with caps and
   an expiry, and it lapses on its own.

## Accessibility & Inclusion

**The primary operator has red-green colour vision deficiency.** This is a confirmed product
fact, not an assumption, and it is binding on every future visual decision.

What it rules out, verified by simulating deuteranopia and protanopia against the build on
26 August 2026: the red-before and green-after diff convention, which collapses to a single
olive, taking the amber customs-hold badge with it. Three distinct meanings became one colour.

The rules that follow:

- No two hues that collapse under red-green deficiency may carry competing meanings anywhere.
- Every state is legible without colour. Meaning is carried by mark, rule form, strikethrough,
  position and weight; colour only ever confirms what another signal already says.
- Blue and amber are the only coloured pair, chosen because they stay separable under both
  deuteranopia and protanopia by hue and by luminance.
- The decision surface carries figures that change as the operator acts. Those changes must not
  be conveyed by colour or motion alone.

The simulation harness lives at `.impeccable/cvd/test.html` and any palette change is checked
against it before shipping.
