/**
 * A test double for WebMCP, loaded only by `npm run dev` with `?demo` in the URL, and only
 * ever to drive the panel by hand. It is NOT WebMCP and it does not pretend to be: nothing
 * here talks to an agent. It registers the same tools the real runtime would and exposes a
 * way to invoke one from the console, so every panel state can be reached and measured in a
 * browser that has no WebMCP.
 *
 * `import.meta.env.DEV` gates the import in main.tsx, so this module is not in the build.
 */
interface FakeSpec { name: string; description: string; execute(input: unknown): Promise<unknown>; }
const registered = new Map<string, FakeSpec>();

(document as unknown as Record<string, unknown>).modelContext = {
  registerTool: (spec: FakeSpec) => registered.set(spec.name, spec),
  unregisterTool: (name: string) => registered.delete(name),
};

(window as unknown as Record<string, unknown>).__ladderDemo = {
  tools: () => [...registered.keys()],
  // Task 8's whole point is that ratifying a policy changes the registered tool's
  // *description*, live — so the double has to be able to show that back, not just the name.
  describe: (name: string) => registered.get(name)?.description,
  call: (name: string, input: unknown) => registered.get(name)!.execute(input),
};
