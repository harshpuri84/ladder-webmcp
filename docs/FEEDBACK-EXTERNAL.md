# External review, 1 September 2026

Source: ChatGPT, given the live site. Passed to the overnight session by the author with the note
that the strongest points are the wording, the animation guidance, and showing the agent workflow.

Ranked BELOW `DESIGN.md` and `docs/REDESIGN-TASKS.md`. Where they disagree, DESIGN.md wins and the
disagreement gets written up for the author rather than resolved silently.

---

## Core messaging

    LADDER
    Agents can act. Humans stay in control.
    Every agent write comes here as a proof before it lands.

Keep the existing tagline. The first line makes the concept legible to someone who has never seen
Ladder. Avoid: AI-powered, intelligent, next-generation, autonomous, AI copilot. Ladder is about
agent action, visibility, proof, human governance.

## Hero

Keep the restrained typography. Illustration to the right or subtly behind, never dominating.
Add an operational status indicator, not a marketing badge:

    WEBMCP ACTIVE
    4 TOOLS AVAILABLE

## The proof specimen is the hero interaction

Make the agent/human distinction explicit in the hierarchy:

    AGENT PROPOSAL
    Proof for approval · propose_remedy
    "Find the cheapest remedy still open to everything on CONSOL-A."

Simplify the metric labels. Prefer

    23 AGENT PROPOSALS      €0 NO EXTRA COST      4 NEED YOUR DECISION

over

    23 RECORDS MARKED       €0 YOU CAN AUTHORISE  +€1,331 REFERRED

## Three action states, used throughout

- AGENT: performs automatically. search, inspect, compare, check, calculate.
- AGENT then PROOF: proposes, and the proposed state is recorded before it becomes application
  state. propose remedy, change carrier, change route, reschedule.
- HUMAN APPROVAL: consequential, needs explicit authorisation. book, cancel, spend, commit
  delivery change, apply remedies.

Say it with typography and rules. No colourful badges.

## Agent activity panel

Compact, observable tool calls and state transitions only. Never chain of thought.

    AGENT ACTIVITY
    Reading 42 shipments
    Checking cargo constraints
    Comparing available remedies
    Checking SLA commitments
    23 viable remedies found
    4 exceptions referred
                                    1.8s

## Demonstrate the WebMCP path

    Human intent -> Agent -> WebMCP tool -> page state -> proof -> human approval -> application state

Start from the prompt "Propose a remedy for every shipment on CONSOL-A." then animate
42 shipments, constraints checked, remedies evaluated, 23 proposals, 4 exceptions, proof generated,
then show the proof. This is the moment a judge understands why WebMCP matters.

## Say this to an agent

Keep it, make it prominent, add a copy control, and put the tool path underneath:

    SEARCH 42 shipments · INSPECT cargo + SLA + rules · PROPOSE 23 remedies
    REFER 4 exceptions · PROOF human review

## Tools drawer

"4 tools" becomes interactive. Name, one line of standing, per tool. Use the real registered tool
names from the codebase, never invented ones.

## Shipment table

Keep the table. Do not turn it into cards. Add an "agent inspected" row state showing the remedy,
the reason, the alternative, and three controls: apply, reject, and ask the agent for another.
The third one is the point: it is collaboration, not just approval.

## Human intent

    HUMAN INTENT
    "Deliver these shipments by Friday without spending more than EUR 1,500 extra."
    DELIVERY <= Friday · BUDGET <= EUR 1,500 · OBJECTIVE minimise cost

The agent does not invent the objective. The human sets intent, the agent works inside it.

## Why this has to live in the page

Keep the section. Lead with the plain version, keep the detailed one below for technical readers.

    Before WebMCP, an agent that wanted to act on application records typically called tools hosted
    elsewhere. The server held the tools and credentials. The person whose records were changing was
    outside the boundary.

    With WebMCP, the tool can live in the page itself. The agent acts against the application the
    operator is already using. Ladder turns that action into a proof, lets the human review it, and
    only then commits the resulting state.

Diagrams stay HTML/SVG. They carry technical information and need pixel accuracy.

## Physical consequence

    Software changes records. Logistics changes the world.
    A shipment is not just a row in a table. It is cargo, a truck, an aircraft, a warehouse slot and
    a promise to a customer.

    AGENT DECISION -> SHIPMENT -> CARRIER -> PHYSICAL WORLD

## Closing outcome

    THIS RUN
    42 shipments inspected · 23 remedies proposed · 4 referred to a human · EUR 1,331 cost referred
    The agent did the coordination. The human kept the authority.

## Animation

Good: agent activity appearing in sequence, tool execution indicator, progress through shipments,
proof being generated, proof becoming available, subtle route lines, diagram arrows activating,
the transition from proposal to approval to application state.

Avoid: parallax, bouncing, gradients, glowing effects, flashy transitions, heavy hover states.
A precision instrument, not a consumer AI app.

## Image rules

Generated images allowed only for a hero illustration, a physical logistics illustration, and
optionally a conceptual before/after layer. Never for maps, tables, UI controls, diagrams carrying
text, tool schemas, buttons, charts, shipment data or application states.

Style for any generated asset: warm ivory ground, near-black ink, restrained blue and ochre only,
Swiss editorial and archival technical illustration, generous negative space, no readable text, no
logos, no robots, no glowing AI, no 3D render.

## Responsive

Desktop is the demo. Hero illustration collapses below the text on mobile. The proof card stays
usable. The table scrolls horizontally rather than becoming unreadable. Diagrams stack. Agent
activity becomes an expandable section. The tool drawer becomes a full-width sheet. Do not thin out
desktop density to look like a mobile SaaS template.

## Do not

Replace the typography with Inter or Roboto. Make the background white. Add purple AI gradients.
Add a conventional SaaS navbar. Round every card. Add a chatbot UI. Replace the ledger aesthetic.
Remove the proof metaphor. Flatten it into a generic dashboard. Turn WebMCP into a buzzword.

## Done means a judge can answer in 30 seconds

What is Ladder. Why WebMCP. What the agent actually does. What the human does. What the interesting
interaction is. Why anyone should care.

    Do not make Ladder look more futuristic. Make it look more inevitable.
