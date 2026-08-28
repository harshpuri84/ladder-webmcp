import { describe, it, expect } from 'vitest';

/**
 * The two products share `src/core/` and `src/webmcp/` and nothing else. That is the entire claim
 * this repository makes about the engine, and it is exactly the kind of claim that decays under
 * one convenient import six weeks later — so it is checked mechanically rather than remembered.
 *
 * The check walks the import graph in both directions: nothing under `src/edge/` may reach into
 * the freight product's domain or its interface, and nothing anywhere may reach into `src/edge/`.
 * Product tests are included in both of those — a test that borrowed a fixture across the line
 * would be evidence the two are entangled, not an exemption from it.
 *
 * The one carve-out is the engine's and the adapter's own suites, which drive their subject
 * through the freight product as a live fixture (`webmcp/__tests__/adapter-buffer` and
 * `register-when-ready` both do). That is what those suites are for. Their *source* is held to
 * the full rule, which is the half that matters: a domain import in `src/core/` or `src/webmcp/`
 * would break the claim; an import inside a test of them does not.
 *
 * The sources are read through `import.meta.glob` rather than through `node:fs` on purpose: this
 * project's `tsconfig.app.json` carries only `vite/client` types, and reaching for the node
 * builtins here would mean widening the whole project's global scope to satisfy one test.
 *
 * The pattern is root-absolute rather than relative for a reason worth knowing: a relative glob
 * from inside `src/edge/__tests__/` silently omits the whole `src/edge/` subtree it is climbing
 * out of, which would have left the edge half of this check passing over nothing at all. The
 * last case below is what catches that.
 */
const MODULES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw', eager: true, import: 'default',
}) as Record<string, string>;

/** Glob keys arrive as `/src/core/commit.ts`; normalise to `core/commit.ts`. */
const paths = Object.keys(MODULES).map(k => k.replace(/^\/src\//, ''));
const sourceOf = (path: string) => MODULES[`/src/${path}`];

/** Every module specifier in a file: static imports, `export … from`, and dynamic `import()`. */
function specifiersIn(path: string): string[] {
  const text = sourceOf(path);
  const out: string[] = [];
  const patterns = [
    /(?:^|\n)\s*import\s+[^'"\n]*from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s+[^'"\n]*from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) out.push(m[1]);
  }
  return out;
}

/** Resolve a relative specifier against its importer, as a path relative to `src/`. */
function resolveFrom(path: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const stack = path.split('/').slice(0, -1);
  for (const p of spec.split('/')) {
    if (p === '.' || p === '') continue;
    if (p === '..') stack.pop();
    else stack.push(p);
  }
  return stack.join('/');
}

const isTest = (path: string) => path.includes('/__tests__/');

const crossings = (from: string, forbidden: string[], opts: { sourceOnly?: boolean } = {}) =>
  paths
    .filter(path => path.startsWith(`${from}/`))
    .filter(path => !(opts.sourceOnly && isTest(path)))
    .flatMap(path =>
      specifiersIn(path)
        .map(spec => ({ spec, target: resolveFrom(path, spec) }))
        .filter(({ target }) => target !== null && forbidden.some(f => target!.startsWith(f)))
        .map(({ spec }) => `${path} imports ${spec}`),
    );

describe('the two products share the engine and nothing else', () => {
  it('src/edge never imports the freight product', () => {
    expect(crossings('edge', ['domain/', 'ui/'])).toEqual([]);
  });

  it('the freight product never imports src/edge', () => {
    expect(crossings('domain', ['edge/'])).toEqual([]);
    expect(crossings('ui', ['edge/'])).toEqual([]);
  });

  it('the engine and the adapter, in source, reach neither product', () => {
    expect(crossings('core', ['domain/', 'ui/', 'edge/'], { sourceOnly: true })).toEqual([]);
    expect(crossings('webmcp', ['domain/', 'ui/', 'edge/'], { sourceOnly: true })).toEqual([]);
  });

  it('nothing outside src/edge reaches into it, tests included', () => {
    expect(crossings('core', ['edge/'])).toEqual([]);
    expect(crossings('webmcp', ['edge/'])).toEqual([]);
    expect(crossings('dev', ['edge/'])).toEqual([]);
  });

  // Guards the guard: a resolver that silently returned null for everything, or a glob that
  // matched nothing, would make every assertion above pass while checking nothing at all.
  it('the walk actually sees the files it is checking', () => {
    const edgeFiles = paths.filter(p => p.startsWith('edge/'));
    expect(edgeFiles.length).toBeGreaterThan(10);
    expect(paths.filter(p => p.startsWith('domain/')).length).toBeGreaterThan(5);
    const specs = edgeFiles.flatMap(f => specifiersIn(f).map(s => resolveFrom(f, s)));
    expect(specs.filter(s => s?.startsWith('core/')).length).toBeGreaterThan(0);
    expect(specs.filter(s => s?.startsWith('webmcp/')).length).toBeGreaterThan(0);
  });
});
