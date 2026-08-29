import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { edgeStore as EdgeStore } from '../store';
import type { registerEdgeTools as RegisterEdgeTools } from '../tools';
import type { clearRackView as ClearRackView, rackView as RackViewFn } from '../rack-view';
import type { listTools as ListTools } from '../../webmcp/adapter';

/**
 * The edge product's half of the same idea the freight console has: a read that also sets what
 * the human is looking at. Driven through the real registration path, because the annotations
 * `registerLadderTool` hands the browser are half of what is being claimed.
 *
 * The honesty boundary is checked as hard as the feature. A narrowed rack must leave every site
 * where it was, and — the thing this product could get wrong that the freight one could not —
 * must leave every region band still counting against the whole region.
 */
describe('list_pops sets the rack view', () => {
  let edgeStore: typeof EdgeStore;
  let registerEdgeTools: typeof RegisterEdgeTools;
  let rackView: typeof RackViewFn;
  let clearRackView: typeof ClearRackView;
  let listTools: typeof ListTools;
  const registered = new Map<string, any>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (spec: any) => registered.set(spec.name, spec),
        unregisterTool: (name: string) => registered.delete(name),
      },
    };
    ({ edgeStore } = await import('../store'));
    ({ registerEdgeTools } = await import('../tools'));
    ({ rackView, clearRackView } = await import('../rack-view'));
    ({ listTools } = await import('../../webmcp/adapter'));
    registerEdgeTools();
  });

  afterAll(() => {
    delete (globalThis as any).document;
  });

  beforeEach(() => clearRackView());

  const call = (name: string, input: any) => registered.get(name)!.execute(input);
  const sites = () => Object.values(edgeStore.state.pops);

  it('narrows the view to exactly the sites it handed back', async () => {
    const out = await call('list_pops', { canary: true });
    expect(out.rows.length).toBeGreaterThan(0);
    expect(out.rows.length).toBeLessThan(sites().length);

    expect(rackView()!.ids).toEqual(out.rows.map((p: any) => p.id));
    expect(rackView()!.toolName).toBe('list_pops');
  });

  it('says what it narrowed to in the trade\'s own words, not in arguments', async () => {
    await call('list_pops', { canary: true, incident: false });
    expect(rackView()!.words).toBe('canary sites, no open incident');
  });

  it('describes a call with no filter as the whole estate', async () => {
    await call('list_pops', {});
    expect(rackView()!.words).toBe('the whole estate');
    expect(rackView()!.ids.length).toBe(sites().length);
  });

  it('replaces the previous view rather than accumulating one', async () => {
    await call('list_pops', { canary: true });
    const first = rackView()!.ids;
    await call('list_pops', { canary: false });

    expect(rackView()!.words).toBe('production sites');
    expect(rackView()!.ids).not.toEqual(first);
  });

  /** The honesty boundary. A view is what is drawn; the estate is what is. */
  it('changes no site and no version', async () => {
    const before = sites().map(p => JSON.stringify(p));
    const storeVersion = edgeStore.version;

    await call('list_pops', { canary: true });

    expect(sites().map(p => JSON.stringify(p))).toEqual(before);
    expect(edgeStore.version).toBe(storeVersion);
    expect(sites().length).toBe(before.length);
  });

  /**
   * `readOnlyHint` says the tool does not modify its environment, and in WebMCP the page is the
   * environment. Dropping it alone would be worse than keeping it: the other two hints fall back
   * to their spec defaults — destructive true, idempotent false — and a listing would go out
   * described as a destructive call whose repeats accumulate. All three are stated.
   */
  it('declares the effect in its annotations', () => {
    expect(registered.get('list_pops')!.annotations).toEqual({
      readOnlyHint: false, destructiveHint: false, idempotentHint: true,
    });
  });

  it('leaves the read tool that touches nothing claiming readOnlyHint', () => {
    expect(registered.get('inspect_pop')!.annotations).toEqual({ readOnlyHint: true });
  });

  it('declares the effect in the description the agent reads', () => {
    const desc: string = registered.get('list_pops')!.description;
    expect(desc).toContain('changes what the on-call engineer is looking at');
    expect(desc).toContain('changes no site');
  });

  it('is still a read tool in the inventory, and still marked as moving the view', () => {
    expect(listTools().find(t => t.name === 'list_pops')!.changesTheView).toBe(true);
    expect(listTools().find(t => t.name === 'inspect_pop')!.changesTheView).toBe(false);
    expect(listTools().find(t => t.name === 'roll_config')!.changesTheView).toBe(false);
  });
});
