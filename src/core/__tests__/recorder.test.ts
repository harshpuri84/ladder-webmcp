import { describe, it, expect } from 'vitest';
import { recordingProxy } from '../recorder';
import { runShadow } from '../shadow';
import { buildWriteSet } from '../writeset';
import { runCommit } from '../commit';
import type { WriteRecord } from '../types';

const fixture = () => ({ rows: { A: { price: 100, status: 'x', version: 1 } } });

describe('recordingProxy', () => {
  it('records a write with before and after', () => {
    const writes: WriteRecord[] = [];
    const s = fixture();
    const p = recordingProxy(s, { onWrite: w => writes.push(w) });
    p.rows.A.price = 150;
    expect(writes).toEqual([
      { entity: 'rows', id: 'A', field: 'price', before: 100, after: 150, group: 'rows:A' },
    ]);
    expect(s.rows.A.price).toBe(150);
  });

  it('ignores a write that changes nothing', () => {
    const writes: WriteRecord[] = [];
    const p = recordingProxy(fixture(), { onWrite: w => writes.push(w) });
    p.rows.A.price = 100;
    expect(writes).toHaveLength(0);
  });

  it('records several fields on the same row under one group', () => {
    const writes: WriteRecord[] = [];
    const p = recordingProxy(fixture(), { onWrite: w => writes.push(w) });
    p.rows.A.price = 120;
    p.rows.A.status = 'y';
    expect(writes.map(w => w.group)).toEqual(['rows:A', 'rows:A']);
  });

  it('skips a write the guard refuses, without touching the target', () => {
    const writes: WriteRecord[] = [];
    const s = fixture();
    const p = recordingProxy(s, {
      onWrite: w => writes.push(w),
      guard: k => (k.field === 'price' ? 'skip' : 'allow'),
    });
    p.rows.A.price = 999;
    p.rows.A.status = 'y';
    expect(s.rows.A.price).toBe(100);
    expect(s.rows.A.status).toBe('y');
    expect(writes.map(w => w.field)).toEqual(['status']);
  });

  it('lets a throwing guard propagate', () => {
    const p = recordingProxy(fixture(), {
      onWrite: () => {},
      guard: () => { throw new Error('nope'); },
    });
    expect(() => { p.rows.A.price = 1; }).toThrow('nope');
  });

  it('records a delete as a write to undefined', () => {
    const writes: WriteRecord[] = [];
    const s = fixture();
    const p = recordingProxy(s, { onWrite: w => writes.push(w) });
    delete (p.rows.A as any).status;
    expect(writes).toEqual([
      { entity: 'rows', id: 'A', field: 'status', before: 'x', after: undefined, group: 'rows:A' },
    ]);
    expect('status' in s.rows.A).toBe(false);
  });

  it('records nothing when deleting a field that is not there', () => {
    const writes: WriteRecord[] = [];
    const p = recordingProxy(fixture(), { onWrite: w => writes.push(w) });
    delete (p.rows.A as any).missing;
    expect(writes).toHaveLength(0);
  });

  it('leaves the field in place when the guard refuses a delete', () => {
    const writes: WriteRecord[] = [];
    const s = fixture();
    const p = recordingProxy(s, { onWrite: w => writes.push(w), guard: () => 'skip' });
    delete (p.rows.A as any).status;
    expect(s.rows.A.status).toBe('x');
    expect(writes).toHaveLength(0);
  });

  it('lets a throwing guard propagate out of a delete', () => {
    const p = recordingProxy(fixture(), {
      onWrite: () => {},
      guard: () => { throw new Error('nope'); },
    });
    expect(() => { delete (p.rows.A as any).status; }).toThrow('nope');
  });

  it('records and guards a whole new record', () => {
    const writes: WriteRecord[] = [];
    const s = fixture();
    const p = recordingProxy(s, { onWrite: w => writes.push(w) });
    (p.rows as any).Z = { price: 10, status: 'new', version: 1 };
    expect(writes).toEqual([
      { entity: 'rows', id: 'Z', field: '*', before: undefined,
        after: { price: 10, status: 'new', version: 1 }, group: 'rows:Z' },
    ]);
  });

  it('records and guards a brand-new root key', () => {
    const writes: WriteRecord[] = [];
    const p = recordingProxy(fixture(), { onWrite: w => writes.push(w) });
    (p as any).audit = ['something'];
    expect(writes).toEqual([
      { entity: 'audit', id: '*', field: '*', before: undefined, after: ['something'], group: 'audit:*' },
    ]);
  });

  it('lets the guard refuse a structural write', () => {
    const s = fixture();
    const p = recordingProxy(s, { onWrite: () => {}, guard: () => 'skip' });
    (p.rows as any).Z = { price: 10 };
    expect('Z' in s.rows).toBe(false);
  });

  it('never writes a proxy back into the target', () => {
    const writes: WriteRecord[] = [];
    const s = fixture();
    const p = recordingProxy(s, { onWrite: w => writes.push(w) });
    const row = (p.rows as any).A;
    (p.rows as any).A = row;                 // read it out, put it straight back
    expect(writes).toHaveLength(0);          // nothing actually changed
    expect(() => structuredClone(s)).not.toThrow();
  });
});

/**
 * Depth. The recorder traps writes at depth 2 (entity.id.field). What it must never do is let
 * a write *below* that depth land quietly on real state: that is a mutation nobody previewed,
 * nobody approved and nothing rolls back. These cover the refusal, and the reads and wholesale
 * replacements that must keep working exactly as before.
 */
const nested = () => ({
  rows: { A: { price: 100, version: 1, meta: { limit: 1, tags: [{ code: 'a' }] } } },
});

describe('recordingProxy below depth 2', () => {
  it('refuses a write below depth 2, naming the full path', () => {
    const s = nested();
    const p = recordingProxy(s, { onWrite: () => {} });
    expect(() => { (p.rows.A as any).meta.limit = 999; }).toThrow(/rows\.A\.meta\.limit/);
    expect(s.rows.A.meta.limit).toBe(1);
  });

  it('refuses a write further down still', () => {
    const s = nested();
    const p = recordingProxy(s, { onWrite: () => {} });
    expect(() => { (p.rows.A as any).meta.tags[0].code = 'z'; }).toThrow(/rows\.A\.meta\.tags\.0\.code/);
    expect(s.rows.A.meta.tags[0].code).toBe('a');
  });

  it('refuses a push onto a nested array', () => {
    const s = nested();
    const p = recordingProxy(s, { onWrite: () => {} });
    expect(() => { (p.rows.A as any).meta.tags.push({ code: 'b' }); }).toThrow(/rows\.A\.meta\.tags/);
    expect(s.rows.A.meta.tags).toHaveLength(1);
  });

  it('refuses a delete below depth 2', () => {
    const s = nested();
    const p = recordingProxy(s, { onWrite: () => {} });
    expect(() => { delete (p.rows.A as any).meta.limit; }).toThrow(/rows\.A\.meta\.limit/);
    expect(s.rows.A.meta.limit).toBe(1);
  });

  it('refuses a defineProperty below depth 2', () => {
    const s = nested();
    const p = recordingProxy(s, { onWrite: () => {} });
    expect(() => Object.defineProperty((p.rows.A as any).meta, 'limit', { value: 999 }))
      .toThrow(/rows\.A\.meta\.limit/);
    expect(s.rows.A.meta.limit).toBe(1);
  });

  it('reads below depth 2 pass through untouched', () => {
    const p = recordingProxy(nested(), { onWrite: () => {} });
    expect((p.rows.A as any).meta.limit).toBe(1);
    expect((p.rows.A as any).meta.tags).toHaveLength(1);
    expect((p.rows.A as any).meta.tags[0].code).toBe('a');
    expect(Object.keys((p.rows.A as any).meta)).toEqual(['limit', 'tags']);
    expect(JSON.stringify((p.rows.A as any).meta)).toBe('{"limit":1,"tags":[{"code":"a"}]}');
    expect(Array.isArray((p.rows.A as any).meta.tags)).toBe(true);
    expect((p.rows.A as any).meta.tags.map((t: any) => t.code)).toEqual(['a']);
  });

  it('still records and guards a wholesale replacement of a nested field', () => {
    const writes: WriteRecord[] = [];
    const s = nested();
    const p = recordingProxy(s, { onWrite: w => writes.push(w) });
    (p.rows.A as any).meta = { limit: 999, tags: [] };
    expect(writes).toEqual([
      { entity: 'rows', id: 'A', field: 'meta',
        before: { limit: 1, tags: [{ code: 'a' }] }, after: { limit: 999, tags: [] },
        group: 'rows:A' },
    ]);
    expect(s.rows.A.meta).toEqual({ limit: 999, tags: [] });
  });

  it('never writes a nested view back into the target', () => {
    const s = nested();
    const p = recordingProxy(s, { onWrite: () => {} });
    const m = (p.rows.A as any).meta;
    // A wholesale replacement built out of values read back through the proxy: every piece of
    // it is a live view, and none of it may reach the store as one.
    (p.rows.A as any).meta = { ...m, tags: m.tags.map((t: any) => t) };
    expect(() => structuredClone(s)).not.toThrow();
    expect(s.rows.A.meta).toEqual({ limit: 1, tags: [{ code: 'a' }] });
  });

  it('keeps a nested object returned in a tool result serialisable', () => {
    const p = recordingProxy(nested(), { onWrite: () => {} });
    const out = { row: p.rows.A, meta: (p.rows.A as any).meta };
    // Chrome clones a tool result with structuredClone, which throws DataCloneError on any
    // Proxy — which is why the read-only path in webmcp/adapter.ts round-trips through JSON
    // before returning. That round-trip has to still produce inert, complete data.
    expect(() => structuredClone(out)).toThrow();
    const inert = JSON.parse(JSON.stringify(out));
    expect(() => structuredClone(inert)).not.toThrow();
    expect(inert.meta).toEqual({ limit: 1, tags: [{ code: 'a' }] });
    expect(inert.row.price).toBe(100);
  });
});

describe('runCommit against a tool that writes below depth 2', () => {
  const wire = (s: any) => ({
    proposalId: 'p1',
    versionOf: (_e: string, id: string) => s.rows[id].version as number,
    bumpVersion: (_e: string, id: string) => { s.rows[id].version += 1; },
  });
  const onScript = async (ctx: any) => { ctx.db.rows.A.price = 150; };
  const offScript = async (ctx: any) => {
    ctx.db.rows.A.price = 150;
    ctx.db.rows.A.meta.limit = 999;   // never previewed, never approved
  };

  it('refuses the off-script nested write and rolls the whole commit back', async () => {
    const s = nested();
    const o = wire(s);
    const { diff } = await runShadow(s, onScript, o);
    const out = await runCommit(s, offScript, buildWriteSet(diff, ['rows:A'], []), o);

    expect(out.status).toBe('denied');
    expect(out.error).toMatch(/rows\.A\.meta\.limit/);
    expect(s.rows.A.meta.limit).toBe(1);
    expect(s.rows.A.price).toBe(100);
    expect(s.rows.A.version).toBe(1);
  });
});
