import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { store as StoreModule } from '../store';
import type { registerDomainTools as RegisterDomainTools } from '../tools';
import type {
  clearRegisterView as ClearRegisterView, registerView as RegisterViewFn,
} from '../register-view';
import type { listTools as ListTools } from '../../webmcp/adapter';

/**
 * The one thing an agent may do to the operator's screen: a read that also sets what the
 * register draws. Exercised through the real registration path — the fake `modelContext` below
 * captures exactly what `registerLadderTool` hands the browser, annotations included, because
 * the annotations are half of what is being claimed here.
 *
 * The other half is the honesty boundary, and it is checked as hard as the feature: a narrowed
 * view must leave every record where it was, with the version the commit guard reads untouched.
 */
describe('search_shipments sets the register view', () => {
  let store: typeof StoreModule;
  let registerDomainTools: typeof RegisterDomainTools;
  let registerView: typeof RegisterViewFn;
  let clearRegisterView: typeof ClearRegisterView;
  let listTools: typeof ListTools;
  const registered = new Map<string, any>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (spec: any) => registered.set(spec.name, spec),
        unregisterTool: (name: string) => registered.delete(name),
      },
    };
    ({ store } = await import('../store'));
    ({ registerDomainTools } = await import('../tools'));
    ({ registerView, clearRegisterView } = await import('../register-view'));
    ({ listTools } = await import('../../webmcp/adapter'));
    registerDomainTools();
  });

  afterAll(() => {
    delete (globalThis as any).document;
  });

  // The view is module state and outlives an `it` the way it outlives a mount.
  beforeEach(() => clearRegisterView());

  const call = (name: string, input: any) => registered.get(name)!.execute(input);
  const rows = () => Object.values(store.state.shipments);

  it('narrows the view to exactly the ids it handed back', async () => {
    const out = await call('search_shipments', { lithiumBattery: true });
    const expected = rows().filter(s => s.lithiumBattery).map(s => s.id);
    expect(expected.length).toBeGreaterThan(0);

    expect(out.rows.map((r: any) => r.id)).toEqual(expected);
    expect(registerView()!.ids).toEqual(expected);
    expect(registerView()!.toolName).toBe('search_shipments');
  });

  it('says what it narrowed to in the register\'s own words, not in arguments', () => {
    expect(registerView()).toBeNull();
    return call('search_shipments', { lithiumBattery: true, slaTier: 'premium' }).then(() => {
      expect(registerView()!.words).toBe('premium SLA, lithium-ion cargo');
    });
  });

  it('describes a search with no filter as the whole register', async () => {
    await call('search_shipments', {});
    expect(registerView()!.words).toBe('every house shipment');
    expect(registerView()!.ids.length).toBe(rows().length);
  });

  it('distinguishes a flag set false from the same flag set true', async () => {
    await call('search_shipments', { lithiumBattery: false });
    expect(registerView()!.words).toBe('no lithium-ion cargo');
  });

  it('replaces the previous view rather than accumulating one', async () => {
    await call('search_shipments', { consol: 'CONSOL-A' });
    const first = registerView()!.ids;
    await call('search_shipments', { consol: 'CONSOL-B' });

    expect(registerView()!.words).toBe('CONSOL-B');
    expect(registerView()!.ids).not.toEqual(first);
  });

  /** The honesty boundary. A view is what is drawn; the record is what is. */
  it('changes no record and no version', async () => {
    const before = rows().map(s => ({ ...s }));
    const storeVersion = store.version;

    await call('search_shipments', { lithiumBattery: true });

    expect(rows().map(s => ({ ...s }))).toEqual(before);
    expect(store.version).toBe(storeVersion);
    // Every shipment is still on the register, including the ones the view no longer draws.
    expect(rows().length).toBe(before.length);
  });

  /**
   * MCP's `readOnlyHint` says the tool does not modify its environment, and in WebMCP the page
   * is the environment. Dropping it is not enough on its own: `destructiveHint` and
   * `idempotentHint` are only read when `readOnlyHint` is false, and their spec defaults —
   * destructive true, idempotent false — would describe a search as a destructive call whose
   * repeats accumulate. All three go out, or the honest hint is a worse lie than the false one.
   */
  it('declares the effect in its annotations', () => {
    expect(registered.get('search_shipments')!.annotations).toEqual({
      readOnlyHint: false, destructiveHint: false, idempotentHint: true,
    });
  });

  it('leaves the read tool that touches nothing claiming readOnlyHint', () => {
    expect(registered.get('get_shipment')!.annotations).toEqual({ readOnlyHint: true });
  });

  /** An agent has to know, before it calls, that this reaches the human's screen. */
  it('declares the effect in the description the agent reads', () => {
    const desc: string = registered.get('search_shipments')!.description;
    expect(desc).toContain('changes what the operator is looking at');
    expect(desc).toContain('changes no record');
  });

  /**
   * The tool inventory is this product's own account of what the agent can do. A view-setting
   * read listed there as "changes nothing" would be the one place the account is wrong.
   */
  it('is still a read tool in the inventory, and still marked as moving the view', () => {
    const summary = listTools().find(t => t.name === 'search_shipments')!;
    expect(summary.readOnly).toBe(true);
    expect(summary.changesTheView).toBe(true);
    expect(listTools().find(t => t.name === 'get_shipment')!.changesTheView).toBe(false);
    expect(listTools().find(t => t.name === 'propose_remedy')!.changesTheView).toBe(false);
  });
});
