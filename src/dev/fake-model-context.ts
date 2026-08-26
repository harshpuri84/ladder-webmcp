/**
 * A test double for WebMCP, loaded only by `npm run dev` with `?demo` in the URL, and only
 * ever to drive the panel by hand. It is NOT WebMCP and it does not pretend to be: nothing
 * here talks to an agent. It registers the same tools the real runtime would and exposes a
 * way to invoke one from the console, so every panel state can be reached and measured in a
 * browser that has no WebMCP.
 *
 * `import.meta.env.DEV` gates the import in main.tsx, so this module is not in the build.
 */
const registered = new Map<string, { execute(input: unknown): Promise<unknown> }>();

(document as unknown as Record<string, unknown>).modelContext = {
  registerTool: (spec: { name: string; execute(input: unknown): Promise<unknown> }) =>
    registered.set(spec.name, spec),
  unregisterTool: (name: string) => registered.delete(name),
};

(window as unknown as Record<string, unknown>).__ladderDemo = {
  tools: () => [...registered.keys()],
  call: (name: string, input: unknown) => registered.get(name)!.execute(input),
};
