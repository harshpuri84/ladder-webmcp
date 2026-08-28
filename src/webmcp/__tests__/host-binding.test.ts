import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type {
  configureHost as ConfigureHost, registerLadderTool as RegisterLadderTool, HostBinding,
} from '../adapter';

/**
 * The adapter is bound to one application by `configureHost`, and nothing else tells it what a
 * record's version is or what a write costs. This file is deliberately the one suite that never
 * imports `domain/store` — importing it is what configures the freight app — so the module here
 * starts genuinely unbound, which is the state a second product would hit if it forgot the call.
 *
 * Its own file for the same reason `adapter.test.ts` is: `mc` is read once at module load, so a
 * fake `document.modelContext` has to be installed before the import.
 */
describe('adapter with no host configured', () => {
  let configureHost: typeof ConfigureHost;
  let registerLadderTool: typeof RegisterLadderTool;
  const registered = new Map<string, { execute: (input: any) => Promise<any> }>();

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (spec: any) => registered.set(spec.name, spec),
        unregisterTool: (name: string) => registered.delete(name),
      },
    };
    ({ configureHost, registerLadderTool } = await import('../adapter'));

    registerLadderTool({
      name: 'unbound_read_tool', description: 'test-only', readOnly: true,
      inputSchema: { type: 'object', properties: {} },
      async exec(_input: any, ctx: any) { return { rows: Object.keys(ctx.db.rows ?? {}) }; },
    });
    registerLadderTool({
      name: 'unbound_write_tool', description: 'test-only',
      inputSchema: { type: 'object', properties: {} },
      async exec(_input: any, ctx: any) {
        const [first] = Object.keys(ctx.db.rows);
        ctx.db.rows[first].cost = 1;
        return { matched: 1 };
      },
    });
  });

  afterAll(() => { delete (globalThis as any).document; });

  it('fails a write tool loudly, naming the setup it is missing', async () => {
    await expect(registered.get('unbound_write_tool')!.execute({}))
      .rejects.toThrow(/configureHost/);
  });

  it('fails a read tool loudly too, rather than reading state off undefined', async () => {
    await expect(registered.get('unbound_read_tool')!.execute({}))
      .rejects.toThrow(/no host configured/);
  });

  it('runs once a host is configured, and a second call rebinds without dropping registrations', async () => {
    const bind = (rows: Record<string, { version: number; cost: number }>): HostBinding<{ rows: typeof rows }> => ({
      state: { rows },
      notify() {},
      versionOf: (_e, id) => rows[id]?.version ?? -1,
      bumpVersion: (_e, id) => { if (rows[id]) rows[id].version += 1; },
      valueDeltaOf: w => (w.field === 'cost' ? (w.after as number) - (w.before as number) : 0),
      neverEligible: [],
      targetedIds: (input: unknown) => {
        const ids = (input as { ids?: unknown } | null | undefined)?.ids;
        return Array.isArray(ids) ? (ids as string[]) : null;
      },
      // The sixth question a host answers: its own roles, its own unit, its own word for one
      // record. Neither product's words — this suite never imports either.
      authority: {
        roles: [{ id: 'keeper', label: 'Keeper', limit: 5 }],
        record: 'row',
        bound: 'authority',
        carries: 'carries value',
        amount: (n: number) => `${n} units`,
      },
    });

    configureHost(bind({ 'row-1': { version: 0, cost: 10 } }));
    const first = await registered.get('unbound_read_tool')!.execute({});
    expect(first.rows).toEqual(['row-1']);

    // Last call wins: the tool registered under the first binding keeps working and now reads
    // the second one's state.
    configureHost(bind({ 'row-2': { version: 0, cost: 10 }, 'row-3': { version: 0, cost: 10 } }));
    const second = await registered.get('unbound_read_tool')!.execute({});
    expect(second.rows).toEqual(['row-2', 'row-3']);
  });
});
