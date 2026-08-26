# Ladder

Ladder turns an agent's tool call into something closer to a pull request. Before a call to a write tool changes anything, Ladder runs the tool's real code against a private copy of the app's state, shows a human exactly what would change and what it would cost, lets them cut the change down to the part they actually want, and only then applies that subset for real. The agent gets back a structured account of what happened and why the rest was refused, not a bare success or failure. Approve everything, approve twelve of forty-seven records, or reject the lot — the human's edit becomes information the agent can act on, not just a veto.

## How this relates to the WebMCP spec

The WebMCP spec defines `agent.requestUserInteraction()`, a hook that lets a tool's `execute()` pause and ask the user something mid-call. Ladder mounts on that hook. It does not replace it, and it does not reimplement platform confirmation.

Measured directly on 26 August 2026 against Chrome 151's WebMCP testing build: `execute` receives only its first argument. There is no agent object and no options object, so `requestUserInteraction` is not there to call and there is no `AbortSignal` to listen on. Ladder feature-detects for the hook and falls back to rendering its approval panel in the page itself, which costs nothing architecturally since the tool's own document is already where `execute` runs. Both code paths are spec-conformant and both exist in this repo, but only the in-page path is exercised in the runtime a judge will actually open. We are not claiming Ladder mounts on the platform primitive in practice, and we are not listing `AbortSignal` handling as something delivered — only as something written and untested against a real runtime.

What the platform hook cannot express on its own, and what Ladder adds on top of it: a consequence model instead of a raw argument dump, partial consent instead of a single yes/no, and a structured reason for every refused part that flows back into the agent's own reasoning rather than into a human-readable error string.

## Try it

Live URL: **TODO — not deployed yet**

Two ways to run it with a real WebMCP runtime:

- **ChatGPT desktop.** Open the live URL in its built-in browser. No setup, no flags.
- **Chrome 149+.** Enable `chrome://flags/#enable-webmcp-testing` and restart the browser, then open the live URL.

Without either, the console still works by hand — search and filter shipments, click into a proposal, sculpt it, approve or reject it. Only the tools are unreachable from an agent; the diff, sculpting, and commit paths are the same code either way.

## How it works

Six steps, always in this order:

1. **Fork.** `structuredClone` the app's state before the tool ever runs.
2. **Record.** Run the tool's real `execute()` against the fork behind a Proxy that traps every write.
3. **Diff.** Group the recorded writes by record, compute totals — record count, net monetary delta, count of irreversible actions.
4. **Sculpt.** Show the diff to a human. They toggle groups off; totals recompute live.
5. **Enforce.** Run the same `execute()` again, this time against the real state, through a Proxy that allows only the approved writes and throws on anything else. Any violation rolls the whole commit back.
6. **Return.** Send the agent a structured result: what was requested, what applied, what was rejected and why.

Wrapping a tool means writing one `execute()`, the same way you'd write it without Ladder. Here is one of the six tools in this repo, unmodified:

```ts
const repriceShipments: LadderToolSpec = {
  name: 'reprice_shipments',
  description: 'Apply a percentage price change to shipments matching a filter.',
  inputSchema: {
    type: 'object',
    properties: {
      ...filterProps,
      pct: { type: 'number', description: 'Percentage change to apply, e.g. 5 for +5%, -10 for -10%' },
    },
    required: ['pct'],
  },
  async exec(input: Filter & { pct: number }, ctx: Ctx<AppState>) {
    const rows = findMatches(ctx.db, input);
    for (const row of rows) {
      const s = ctx.db.shipments[row.id];
      s.price = Math.round(s.price * (1 + input.pct / 100));
    }
    return { matched: rows.length };
  },
};
```

`ctx.db` looks like a plain object. It is a recording Proxy during preview and a validating Proxy during commit. The tool author never sees either.

## Honest scope

This is a credibility statement, not boilerplate. Read it before you wrap a store in this.

- The guarantee holds for stores whose record fields are primitives or are replaced wholesale (`db.rows.A.meta = { limit: 999 }` is seen and guarded normally). It does not hold for a mutation inside a nested object field one level past that — a write like `db.rows.A.meta.limit = 999` reaches `meta` unrecorded, because nothing traps property writes past depth 2. A store that needs guarded writes below that depth is out of scope as this recorder stands, not silently supported.
- Tools must be deterministic. A field set from a clock or a random value will differ between the preview run and the commit run, and the commit will abort every time — that is the version-mismatch guard working as intended, not a bug.
- Entity names and record ids may not contain `:` or equal `*`. The engine rejects both loudly at the start of a preview rather than silently misreading a key.
- Concurrent commits against the same store are not supported. Each commit checks the version it saw at preview time and aborts on any change, but two commits racing each other is not a case this engine resolves for you.
- Irreversible actions — sending a message, notifying a customer, anything with no before/after state — are held and released or dropped as a whole. They are never previewed as a diff, because they have no diff to show, and they can never be covered by a standing rule.

## Local development

```bash
npm install
npm run dev
npm test
```

Add `?demo` to the dev server URL to drive the panel without any WebMCP runtime at all. It loads a dev-only test double that registers the same six tools and lets you call them from the browser console. It is not WebMCP and it does not talk to an agent — it exists so every panel state is reachable and testable in a browser that has no WebMCP. The double is gated behind `import.meta.env.DEV` and is not present in `npm run build` output.

## Licence

MIT. See [LICENSE](./LICENSE).
