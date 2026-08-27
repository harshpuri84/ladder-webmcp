# Submission Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Ladder's single page into a three-tab submission site — the problem and the engine, the working proof, and the same engine doing other people's work — without touching the engine or the existing console.

**Architecture:** A tab bar and a hash route wrap the current app. The existing console, panel, pill and activity list move behind the `#/proof` tab unchanged. Two new Read-mode pages are added. A pending proposal forces the proof tab open so an agent can never wait against a page of prose.

**Tech Stack:** React 19, Vite 8, TypeScript 6 (`erasableSyntaxOnly`), Vitest + jsdom + @testing-library/react. No new dependencies. No router library — a hash and a `hashchange` listener.

**Spec:** `docs/SUBMISSION-SITE.md`
**Design contract:** `DESIGN.md` — the Printer's Proof world, documented from the shipped code. This change **inherits** it. Nothing in it is replaced.

## Global Constraints

- **Never modify `src/core/`.** It is finished, domain-free and covered by tests. Any change there fails the task.
- **Never change the behaviour of `src/ui/ProposalPanel.tsx`, `Console.tsx`, `RungStrip.tsx`, `AuthorityStrip.tsx`, `ActivityList.tsx`, `ResultCard.tsx`, `ToolPill.tsx` or `src/webmcp/`.** They may be *moved* into a page component and imported. Their internals stay as they are.
- **All 195 existing tests must still pass** after every task. Run `npx vitest run` before committing.
- `npx tsc --noEmit` must be clean. `erasableSyntaxOnly` is on: no TypeScript parameter properties, no `enum`, no `namespace`.
- **Read `DESIGN.md` before writing any markup or CSS.** Use only its six type sizes, its tokens, its one shadow recipe, its six ProofMarks. Never hard-code a colour. Never draw a new SVG icon.
- **Colour may never carry a meaning alone.** The primary operator has red-green colour vision deficiency. Every state must be readable with all colour removed.
- **No employer name anywhere** — not in code, comments, copy, fixture data or commit messages. This is a public repository.
- **Every mockup says it is a mockup, on its face.** A judge must never mistake a picture for a running system.
- Copy is given verbatim in each task. Use it as written. Do not rewrite it, do not add marketing verbs, do not add emoji.

---

### Task 1: Tab shell, hash route, and forced switch on a proposal

The only behaviour in this change that can fail in front of a judge. Built first.

**Files:**
- Create: `src/ui/TabBar.tsx`
- Create: `src/ui/useTab.ts`
- Create: `src/ui/pages/ProofPage.tsx`
- Create: `src/ui/pages/ProblemPage.tsx` (placeholder heading only — Task 2 fills it)
- Create: `src/ui/pages/ElsewherePage.tsx` (placeholder heading only — Task 3 fills it)
- Modify: `src/App.tsx`
- Modify: `src/ui/styles.css` (append a `/* ---------- tabs ---------- */` section at the end)
- Test: `src/ui/__tests__/useTab.test.tsx`

**Interfaces:**
- Produces: `export type TabId = 'problem' | 'proof' | 'elsewhere'` and `export function useTab(): { tab: TabId; setTab(t: TabId): void }` from `src/ui/useTab.ts`. Tasks 2 and 3 import `TabId` only if they need it.
- Produces: `ProofPage` renders exactly what `<main>` renders today for the console half — `RungStrip`, `AuthorityStrip`, `Console` — plus the WebMCP banner logic. `ProposalPanel`, `ActivityList` and `ToolPill` stay mounted at the `App` level (they are fixed-position and must survive a tab change), but `ActivityList` and `ToolPill` render only when `tab === 'proof'`.
- Consumes: `onProposal` from `src/webmcp/adapter.ts`, already exported.

**The three tab labels, verbatim:** `The problem`, `The proof`, `Same engine, other work`.

- [ ] **Step 1: Write the failing test**

`src/ui/__tests__/useTab.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTab } from '../useTab';

describe('useTab', () => {
  beforeEach(() => { window.location.hash = ''; });
  afterEach(() => { window.location.hash = ''; });

  it('lands on the problem tab when there is no hash', () => {
    const { result } = renderHook(() => useTab());
    expect(result.current.tab).toBe('problem');
  });

  it('reads the tab out of the hash on first render', () => {
    window.location.hash = '#/elsewhere';
    const { result } = renderHook(() => useTab());
    expect(result.current.tab).toBe('elsewhere');
  });

  it('falls back to the problem tab on a hash it does not know', () => {
    window.location.hash = '#/nonsense';
    const { result } = renderHook(() => useTab());
    expect(result.current.tab).toBe('problem');
  });

  it('writes the hash when the tab is set, so a tab is linkable', () => {
    const { result } = renderHook(() => useTab());
    act(() => result.current.setTab('proof'));
    expect(window.location.hash).toBe('#/proof');
    expect(result.current.tab).toBe('proof');
  });

  it('follows a hash changed outside React, so back and forward work', () => {
    const { result } = renderHook(() => useTab());
    act(() => {
      window.location.hash = '#/elsewhere';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.tab).toBe('elsewhere');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/ui/__tests__/useTab.test.tsx`
Expected: FAIL — `useTab` does not exist.

- [ ] **Step 3: Implement `src/ui/useTab.ts`**

```ts
import { useEffect, useState } from 'react';

export type TabId = 'problem' | 'proof' | 'elsewhere';

const TABS: TabId[] = ['problem', 'elsewhere', 'proof'];

/**
 * The tab lives in the hash rather than in state alone so a judge can be sent straight to one,
 * the video automation can jump to a beat without clicking, and the browser's own back button
 * does what it looks like it does.
 */
function readHash(): TabId {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return TABS.find(t => t === raw) ?? 'problem';
}

export function useTab(): { tab: TabId; setTab(t: TabId): void } {
  const [tab, setTabState] = useState<TabId>(readHash);

  // A hash changed outside React — the back button, a pasted link, the demo automation —
  // has to move the tab too, or the address bar and the page disagree.
  useEffect(() => {
    const onHash = () => setTabState(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setTab = (t: TabId) => {
    window.location.hash = `#/${t}`;
    setTabState(t);
  };

  return { tab, setTab };
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/ui/__tests__/useTab.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing test for the forced switch**

Append to `src/ui/__tests__/useTab.test.tsx` a second `describe` that renders `App` with a fake
`document.modelContext` (copy the `beforeAll` pattern from `src/ui/__tests__/ToolPill.test.tsx`),
starts on the problem tab, calls the registered `propose_remedy` tool, and asserts the hash
becomes `#/proof` and the console is in the document. Use `await act(async () => { ... })` around
the tool call and do not await the returned promise — it stays pending by design while the panel
is open.

- [ ] **Step 6: Run it and watch it fail**

Expected: FAIL — the tab does not move.

- [ ] **Step 7: Implement the shell in `src/App.tsx`**

Extract today's `<main>` console half into `src/ui/pages/ProofPage.tsx` verbatim — `WebmcpBanner`
and its `useShowBanner`/`useWebmcpAvailable` hooks move with it, along with `RungStrip`,
`AuthorityStrip` and `Console`. `Docket` stays in `App.tsx` only if it reads correctly on all
three tabs; if it does not, move it into `ProofPage` too.

`App.tsx` then renders: header, `TabBar`, the active page, and — outside the page — 
`ProposalPanel` always, with `ActivityList` and `ToolPill` only when `tab === 'proof'`.

The forced switch:

```tsx
// Tools register with the browser on mount, not per tab, so an agent can call one while a
// judge is reading the problem page. If the panel opened over prose with no register behind
// it, the agent would wait out its 96 seconds against a diagram. Any arriving proposal moves
// the tab first.
useEffect(() => onProposal(p => { if (p) setTab('proof'); }), [setTab]);
```

- [ ] **Step 8: Build `src/ui/TabBar.tsx`**

A row of three buttons above the content, separated from it by an `hr.rule`. Read `DESIGN.md`
first. The active tab is marked by **weight and an underline rule**, never by colour alone.
`role="tablist"`, each button `role="tab"` with `aria-selected`, and the page container
`role="tabpanel"`. Keyboard: left and right arrows move between tabs.

- [ ] **Step 9: Run every test**

Run: `npx vitest run`
Expected: PASS, 195 existing plus the new ones. Then `npx tsc --noEmit` clean and `npm run build` clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(site): put the console behind a tab and force it open on a proposal"
```

---

### Task 2: The problem tab

**Files:**
- Modify: `src/ui/pages/ProblemPage.tsx`
- Create: `src/ui/EngineDiagram.tsx`
- Modify: `src/ui/styles.css` (append)
- Test: `src/ui/__tests__/ProblemPage.test.tsx`

**Interfaces:**
- Consumes: `TabId`, `useTab` only if the "open the proof" button needs it — prefer a plain `<a href="#/proof">`.
- Consumes: `DISRUPTED_FLIGHT` and `store` from `src/domain/`, so every figure on the page is **counted off the fixture** rather than typed in. A figure typed as a literal is a defect: the page must not be able to drift from the register.

**Mode: Read.** The visitor's success is understanding the mechanism and its limits. Structure for comprehension first, then make it worth staying in. No card grid. Group with rules, eyebrows and space, per `DESIGN.md`.

**The copy, verbatim. Five sections.**

**1. Heading and situation**

> ## Thursday, 19:40
>
> A flight from Frankfurt to Chicago is cancelled. Two consolidations were on it, so 42 shipments
> belonging to 31 different customers are now unbooked. Nobody assembled that list. The
> cancellation did.
>
> There are ninety minutes to the first cutoff and three ways out. Rebook on the same carrier
> tomorrow morning, which is free and costs eighteen hours. Put it on a competitor's freighter
> tonight, which recovers the time and costs money. Truck it to another airport and fly from
> there, which lands one day late instead of two.
>
> The person responsible has to decide which shipments are worth which remedy. One of these
> carries lithium-ion batteries and cannot go on tomorrow's passenger flight at all. One has a
> temperature-controlled container with twelve hours of endurance left and cannot wait until
> morning. One is ordinary freight whose customer will not notice.

**2. What WebMCP settled, and what it left**

> ## The half that was missing
>
> WebMCP settled how an agent acts on a page. A tool is registered, the agent calls it, the page
> does the work. That is the hard part and it is solved.
>
> What it did not settle is what happens when the agent is wrong. The operator sees a function
> call and a name. They can accept it or refuse it. They cannot see what it would do, and they
> cannot take part of it.
>
> That is the part standing between a demo and production, and it is not a UI problem. Refusing
> the whole call throws away the ninety per cent that was right. Accepting it applies the ten per
> cent that was not.

**3. The engine** — `<EngineDiagram />` then:

> ## How it works
>
> Before a write tool changes anything, Ladder runs the tool's real `execute()` against a
> `structuredClone` of the page's state, behind a Proxy that records every write. Nothing real is
> touched. What the tool *would* do becomes a diff.
>
> The operator sees the blast radius, unticks what they do not want, and every figure moves as
> they do it. Then the **same** `execute()` runs again, against real state, through a Proxy that
> lets the approved writes through, silently skips the ones that were narrowed out, and throws if
> the tool goes anywhere the preview never showed. A violation rolls the entire commit back.
>
> The developer writes one function, the way they already do. Ladder runs it twice.

**4. What comes back**

> ## A refusal is a message
>
> When someone cuts 42 down to 27, the tool does not return success. It returns what happened and
> why the rest did not.

Then a `<pre>` block, in `--face-mono`, in a `--paper-sunk` well:

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

> Different refusals carry different reasons and the agent can tell them apart. A row the tool
> itself declined comes back with the exact ids. A record that changed while the operator was
> deciding says so. `applied` plus every rejected count equals `requested` on every path the app
> can reach, including the ones where nothing lands.

**5. What Ladder does not do** — this section is not optional and is not softened.

> ## What this does not do
>
> **Ladder is a guard, not a sandbox.** It governs writes and effects that pass through the tool
> context it hands your `execute()`. A tool that reaches around that context and touches state
> directly is not governed by it, and Ladder will report a clean success while it happens. Every
> reviewer who read this code reasoned inside the abstraction and none of them asked that
> question. An outside reader did.
>
> **The recorder is two levels deep.** A mutation inside a nested object field is not seen.
>
> **Tools must be deterministic.** A field set from a clock differs between the two runs and
> aborts the commit rather than guessing.
>
> **Nothing persists.** Standing rules, history and the activity log are in memory and a reload
> clears them.
>
> **Approval is per record, not per field.**
>
> The spec has a hook for asking the user mid-call. No shipping browser implements it yet, so
> Ladder renders its own surface and detects for the hook. Measured against Chrome 151 on
> 26 August 2026: `execute` receives only its first argument, and a pending call survives 96
> seconds.

- [ ] **Step 1: Write the failing test**

`src/ui/__tests__/ProblemPage.test.tsx` asserts: the five section headings render; the honest-limit
sentence "Ladder is a guard, not a sandbox" is present; and the shipment, customer and consol
figures in the opening paragraph equal the counts computed from `store.state.shipments`, so the
page cannot drift from the fixture.

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Build `src/ui/EngineDiagram.tsx`**

An inline SVG in the Printer's Proof language — printers' rules and ProofMarks, not rounded boxes,
not a flowchart library. Five stages, left to right, with a return arrow from the guard to the
start labelled `rolled back`:

`Tool call` → `Fork and record` → `Proof — the operator cuts it down` → `Replay under guard` → `Result to the agent`

Constraints: `currentColor` for every stroke; one stroke weight matching `ProofMark`; a `<title>`
and `role="img"` with an `aria-label` describing the five stages in words, because the whole
diagram must be comprehensible to a screen reader and with all colour removed. It must stack
vertically below 720px rather than scrolling horizontally.

- [ ] **Step 4: Write the page with the copy above, verbatim**

- [ ] **Step 5: Run every test, typecheck, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(site): the problem, the engine, and what it does not do"
```

---

### Task 3: The walkthrough component and the freight sequence

**Files:**
- Create: `src/ui/mock/types.ts`
- Create: `src/ui/mock/Walkthrough.tsx`
- Create: `src/ui/mock/domains.ts` (freight only in this task)
- Modify: `src/ui/pages/ElsewherePage.tsx`
- Modify: `src/ui/styles.css` (append)
- Test: `src/ui/__tests__/Walkthrough.test.tsx`

**These are mockups and are never wired to the engine.** They import nothing from `src/core/`,
`src/webmcp/` or `src/domain/`. The point is that the *shape* is identical across domains, and a
judge must be able to tell instantly that these are pictures.

**Interfaces:**
- Produces: `src/ui/mock/types.ts`

```ts
export interface MockRow {
  id: string;
  label: string;
  detail: string;
  change: string;
  cost: string;
  /** Struck out by the operator at the sculpt step. */
  cut?: boolean;
  /** Declined by the tool itself, with the rule that declined it. Never shown as a diff row. */
  declined?: string;
}

export interface MockDomain {
  id: string;
  /** What this kind of work is called, for the selector. */
  name: string;
  /** The audience this domain is for, one short clause. */
  who: string;
  toolName: string;
  /** What the agent was asked, in a person's words. */
  prompt: string;
  /** Units, e.g. "shipments", "products", "regions". */
  noun: string;
  rows: MockRow[];
  /** The money or magnitude line under the record count, already formatted. */
  magnitude: string;
  payload: Record<string, unknown>;
}

export const STEPS = ['The call', 'The blast radius', 'The operator cuts it down', 'What went back'] as const;
export type StepIndex = 0 | 1 | 2 | 3;
```

- Produces: `export const FREIGHT: MockDomain` from `domains.ts`. Task 4 adds two more to the same file and the same array export `DOMAINS`.
- Produces: `<Walkthrough domain={d} />` — self-contained, holds its own step index.

**Behaviour:** four steps. A step strip along the top shows all four with the current one marked
by weight and a rule, never by colour alone. Forward and back buttons. Step 2 reveals the rows;
step 3 strikes the `cut` rows through and the figures drop; step 4 shows the payload. Nothing
animates a meaning that is not also stated in text.

**The freight domain, verbatim:**

```
id: 'freight'
name: 'Air freight recovery'
who: 'a gateway operator, ninety minutes from cutoff'
toolName: 'propose_remedy'
prompt: 'The Chicago flight is cancelled. Find the cheapest remedy that still meets each customer’s promise.'
noun: 'shipments'
magnitude: '+€1,240 recovery cost'
rows: 6 representative rows drawn from the real fixture vocabulary — HAWB ids, a customer, a
consol, an SLA tier, a remedy and a cost. Two carry `cut: true`. One carries
`declined: 'customs hold open — LADDER-CUSTOMS'`.
payload: the four-key shape from Task 2 section 4, with freight reasons.
```

- [ ] **Step 1: Write the failing test**

`src/ui/__tests__/Walkthrough.test.tsx`: renders `<Walkthrough domain={FREIGHT} />`; asserts it
starts at step 1 showing the prompt and no rows; clicking forward twice shows the rows and then
strikes the cut ones; the record count at step 3 equals `rows.length - cut - declined`; step 4
renders the payload; and the word `Mockup` appears on the component at every step.

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Implement `types.ts`, `domains.ts` (freight only) and `Walkthrough.tsx`**

Read `DESIGN.md` first. Reuse `ProofMark` for the struck and declined rows — `dele` for a row the
operator cut, `dagger` for a row the tool declined. Do not import `remedy-words` or
`remedy-diff`; those are the real console's and are freight-coupled.

- [ ] **Step 4: Put it on `ElsewherePage` with the freight domain only**

Above it, verbatim:

> ## The nouns change. Nothing else does.
>
> The engine in `src/core/` has no idea what a shipment is. It records writes, computes a diff,
> and refuses anything the human did not approve. Freight is one skin over it.
>
> Below are three kinds of work with nothing in common except their shape: a decision worth
> money, made against records a person is answerable for, that an agent proposed all at once.
> Step through them and watch the same four beats.

And a labelled warning that survives being read out of context:

> **These are mockups.** The air freight console on the previous tab is real and runs the engine.
> These three are drawn, not wired.

- [ ] **Step 5: Run every test, typecheck, build**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(site): a four-beat walkthrough, and the freight sequence"
```

---

### Task 4: The catalogue and infrastructure sequences

**Files:**
- Modify: `src/ui/mock/domains.ts`
- Modify: `src/ui/pages/ElsewherePage.tsx` (a selector across the three domains)
- Test: `src/ui/__tests__/Walkthrough.test.tsx` (extend)

**Interfaces:**
- Consumes: `MockDomain`, `Walkthrough`, `FREIGHT` from Task 3. Adds `CATALOGUE` and `EDGE`, plus `export const DOMAINS: MockDomain[] = [FREIGHT, CATALOGUE, EDGE]`.

These two domains are chosen deliberately: the panel judging this includes engineers from a
commerce platform and from three edge platforms. Do not swap them for something else.

**The catalogue domain, verbatim:**

```
id: 'catalogue'
name: 'Retail repricing'
who: 'a merchandiser, the morning a promotion goes live'
toolName: 'apply_price_change'
prompt: 'Drop everything in the autumn range by 15% for the weekend.'
noun: 'products'
magnitude: '−£4,180 margin'
rows: 6 products. Each row: a SKU, a product name, a range, the old price struck and the new one,
and the margin delta. Two carry `cut: true` (the operator keeps them at full price because they
are the two best sellers). One carries `declined: 'contracted price with a partner — PRICE-CONTRACT'`.
payload: same four keys, with reasons 'under a partner price contract' and 'the merchandiser
removed these from the change'.
```

**The infrastructure domain, verbatim:**

```
id: 'edge'
name: 'Edge config rollout'
who: 'an on-call engineer, pushing a config change'
toolName: 'roll_config'
prompt: 'Roll the new cache rule to every edge region.'
noun: 'regions'
magnitude: '38% of production traffic'
rows: 6 regions. Each row: a region code, its traffic share, the config version struck and
replaced, and the share of traffic affected. Two carry `cut: true` (the engineer holds back the
two largest regions for a later window). One carries `declined: 'change freeze in effect —
FREEZE-WINDOW'`.
payload: same four keys, with reasons 'inside a change freeze window' and 'the engineer removed
these from the change'.
```

- [ ] **Step 1: Extend the failing test**

Assert every domain in `DOMAINS` renders all four steps without throwing; that each one's payload
reconciles — `applied` plus the sum of `rejected[].count` equals `requested`; and that the four
step labels are byte-identical across all three domains, which is the page's whole argument.

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Add the two domains and the selector**

The selector is three buttons above the walkthrough. Switching resets to step 1. Active state by
weight and rule, never colour alone.

- [ ] **Step 4: Run every test, typecheck, build**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(site): the same four beats over a catalogue and an edge network"
```

---

### Task 5: Why WebMCP is the right substrate, not merely an incomplete one

**Added 2026-08-27 after user review.** The problem tab as specified in Task 2 argues that WebMCP
settled how an agent acts and left what happens when it is wrong. That is true and it is not
enough. It says WebMCP is *incomplete*. It never says WebMCP is *right* — that this pattern is
only possible because the tool runs inside the page. A judge from the Chrome team will notice the
difference immediately, and the reusability claim on the third tab rests on it.

**Files:**
- Modify: `src/ui/pages/ProblemPage.tsx` (insert one section between "The half that was missing"
  and "How it works")
- Create: `src/ui/PlacementDiagram.tsx`
- Create: `docs/diagrams/ladder-placement.excalidraw` (editable source, not imported by the app)
- Modify: `src/ui/styles.css` (append)
- Test: extend `src/ui/__tests__/ProblemPage.test.tsx`

**Interfaces:**
- Consumes: `ProofMark` from `src/ui/ProofMark.tsx`. Nothing else.
- Produces: nothing other tasks depend on.

**The copy, verbatim.**

> ## Why this has to live in the page
>
> Before WebMCP, an agent that wanted to act on your records called an MCP server. The server holds
> the tools, the server holds the credentials, and the person whose records are changing is not
> in the room. They find out afterwards.
>
> WebMCP moves the tool into the page. `document.modelContext.registerTool()` puts the tool's
> `execute()` inside the tab the operator already has open, running against the state their screen
> is rendering, under the session they are already signed in with.
>
> That relocation is not a detail of packaging. It is the thing that makes this pattern possible,
> and four consequences follow from it that a tool on a server cannot have:
>
> **The human is already here.** The tool is called in a tab someone is looking at. There is no
> notification to send, no approval queue to build, no second device to reach for. The
> interruption lands where the work already was.
>
> **The page owns the state, so it can rehearse against it.** Ladder forks the application's own
> state with `structuredClone` and runs the real `execute()` against the copy. A server-side tool
> has no copy of your interface's state to rehearse against, and nowhere to show you the result
> except a channel you are not watching.
>
> **The tool's description can be rewritten at runtime.** `unregisterTool`, then `registerTool`
> with new words. When an operator ratifies a standing rule, the agent's own toolset changes and
> the agent reads what it is now allowed to do — with no redeploy, no config file, and no round
> trip to ask.
>
> **The credential is the session that was already there.** Nothing is issued to the agent. The
> operator's own signed-in session does the work, so what the agent can reach is bounded by what
> that person could already do by hand.
>
> The specification did anticipate the human. `agent.requestUserInteraction()` exists on paper.
> Measured against Chrome 151 on 26 August 2026, `execute` receives only its first argument, so
> there is no agent object to call it on. Ladder detects for the hook and renders its own surface
> until it lands.
>
> And where it does land, it can ask a question. What a question cannot express is the three
> things this actually needs: consequences instead of arguments, part of a change instead of all
> of it, and a refusal the agent can reason with.

- [ ] **Step 1: Write the failing test**

Extend `src/ui/__tests__/ProblemPage.test.tsx`: assert the new heading renders, assert all four
consequence lead-ins are present, and assert the section sits between "The half that was missing"
and "How it works" by checking `compareDocumentPosition` on the three headings. Ordering is the
argument here — the reader must learn that the page owns the state before being told how the
engine exploits that.

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Build `src/ui/PlacementDiagram.tsx`**

This is the diagram that carries the argument, and it works by contrast. Two bands, stacked.

**Upper band, labelled `Before: the tool lives on a server`.** Agent → MCP server → database.
A dashed boundary encloses the server and the database. The operator is drawn OUTSIDE that
boundary, unconnected, with the caption `finds out afterwards`.

**Lower band, labelled `WebMCP: the tool lives in the page`.** Agent → the browser's WebMCP
runtime → a dashed boundary labelled `the operator's own tab, the operator's own session` which
encloses: the page, Ladder's guard, the app state, AND the operator. Nothing crosses the boundary
to a server.

The point a reader must take in one glance: in the second band the operator is inside the box.

Constraints, same as `EngineDiagram`: Printer's Proof language — printers' rules and ProofMark
shapes, `currentColor` at one stroke weight, no rounded boxes, no library. `role="img"`, a
`<title>`, and an `aria-label` describing both bands in words. Stacks below 720px. Must be
comprehensible with all colour removed — the two boundaries are distinguished by rule form
(dashed versus solid), never by hue.

- [ ] **Step 4: Insert the section and the diagram into `ProblemPage.tsx`**

- [ ] **Step 5: Write `docs/diagrams/ladder-placement.excalidraw`**

A valid Excalidraw scene file (`{"type":"excalidraw","version":2,"source":"...","elements":[...],
"appState":{...}}`) reproducing the same two bands, so the diagram has an editable source the
author can open at excalidraw.com and redraw by hand. It is NOT imported by the application and
must not be — the app renders the hand-written SVG. Validate it parses as JSON.

- [ ] **Step 6: Run every test, typecheck, build**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(site): say why the tool belongs in the page, not on a server"
```
