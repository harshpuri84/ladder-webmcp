# Submission site — design note

**Date:** 2026-08-27. **Status:** agreed.

## The problem this solves

Ladder is one page. A judge who opens the live URL sees a freight register and a
chip, and has to infer the argument. The argument is the entry: what the
disruption is, how the shadow-commit engine works, why the engine is not about
freight at all. Today that argument lives in `submission/description.md`, which
judges may never open, and in a video they watch once.

The submission is judged by browser and platform engineers — Chrome, Shopify,
Vercel, Cloudflare, Netlify, OpenAI. Their question is not "does this demo run",
it is "is this a primitive I could adopt". Nothing on the page answers that.

## The shape

Three tabs on the existing app. One URL, deep-linkable by hash.

| Hash | Tab | What it holds |
|---|---|---|
| `#/problem` | The problem | The disruption. What WebMCP solved and what it left. How the engine works, as a diagram. The refusal payload. What Ladder does **not** do. |
| `#/proof` | The proof | The app exactly as it stands. Nothing in it changes. |
| `#/elsewhere` | Same engine, other work | What the engine needs from an application, named as the actual `HostBinding` interface, and a link to the second product that runs on it. Prose, no drawn UI. |

Default landing is `#/problem`: a cold judge needs the story before the
instrument.

## The one hard requirement

**A pending proposal forces the proof tab open.**

Tools register with the browser on mount, not per tab, so an agent can call
`propose_remedy` while a judge is reading the problem tab. If the panel opened
over a page of prose with no register behind it, the agent would wait out its
96 seconds against a diagram. Any arriving proposal switches the active tab to
`#/proof` before the panel renders.

This is the only behaviour in this change that can fail in front of a judge, so
it is built first and tested first.

## Honesty constraints

- **Nothing on the site is drawn.** This started as three labelled mockups. They
  were cut on 28 August: a drawing has to be captioned as a drawing, and a judge
  who reads that caption immediately asks why nothing is real. The reusability
  claim is now carried by a second product — an edge config rollout, its own Vite
  entry, its own design language — wired to the same engine and running. A claim a
  judge can open beats a claim a judge has to be told to discount.
- The "what Ladder does not do" section is not optional and is not softened. A
  tool that reaches around `ctx.db` and `ctx.effects` to touch state directly is
  ungoverned. Ladder is a guard, not a sandbox. This is already in the README;
  it now appears where judges will read it.

## What does not change

`src/core/` is finished, domain-free and covered by 195 tests. The proof tab is
the current app, moved behind a tab and otherwise untouched. This change is
additive: new pages, a tab bar, a hash route.
