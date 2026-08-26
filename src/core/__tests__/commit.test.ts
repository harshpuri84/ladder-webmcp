import { describe, it, expect } from 'vitest';
import { runShadow } from '../shadow';
import { buildWriteSet } from '../writeset';
import { runCommit } from '../commit';
import type { WriteRecord } from '../types';

const fixture = () => ({
  rows: {
    A: { price: 100, status: 'Booked', version: 1 },
    B: { price: 200, status: 'Booked', version: 1 },
    C: { price: 300, status: 'Booked', version: 1 },
  },
});
const priceDelta = (w: WriteRecord) =>
  w.field === 'price' ? (w.after as number) - (w.before as number) : 0;

const wire = (s: any) => ({
  proposalId: 'p1',
  deltaOf: priceDelta,
  versionOf: (_e: string, id: string) => (s.rows[id]?.version as number) ?? 0,
  bumpVersion: (_e: string, id: string) => { s.rows[id].version += 1; },
});

const repriceAll = async (ctx: any) => {
  for (const id of ['A', 'B', 'C']) ctx.db.rows[id].price += 10;
};

describe('runCommit', () => {
  it('applies only the approved groups and skips the narrowed-out ones', async () => {
    const s = fixture(); const o = wire(s);
    const { diff } = await runShadow(s, repriceAll, o);
    const ws = buildWriteSet(diff, ['rows:A'], []);
    const out = await runCommit(s, repriceAll, ws, o);

    expect(out.status).toBe('partially_applied');
    expect(s.rows.A.price).toBe(110);
    expect(s.rows.B.price).toBe(200);
    expect(s.rows.C.price).toBe(300);
    expect(out.applied).toHaveLength(1);
    expect(out.skipped).toBe(2);
  });

  it('reports applied when every group was approved', async () => {
    const s = fixture(); const o = wire(s);
    const { diff } = await runShadow(s, repriceAll, o);
    const out = await runCommit(s, repriceAll, buildWriteSet(diff, ['rows:A','rows:B','rows:C'], []), o);
    expect(out.status).toBe('applied');
    expect(out.skipped).toBe(0);
  });

  it('bumps the version of every row it actually wrote', async () => {
    const s = fixture(); const o = wire(s);
    const { diff } = await runShadow(s, repriceAll, o);
    await runCommit(s, repriceAll, buildWriteSet(diff, ['rows:A'], []), o);
    expect(s.rows.A.version).toBe(2);
    expect(s.rows.B.version).toBe(1);
  });

  it('refuses a created record whose contents differ from the preview', async () => {
    const s = fixture(); const o = wire(s);
    const previewed = async (ctx: any) => { ctx.db.rows.Z = { price: 10, status: 'New', version: 1 }; };
    const atCommit  = async (ctx: any) => { ctx.db.rows.Z = { price: 999999, status: 'Poison', version: 1 }; };
    const { diff } = await runShadow(s, previewed, o);
    const out = await runCommit(s, atCommit, buildWriteSet(diff, ['rows:Z'], []), o);
    expect(out.status).toBe('aborted_diverged');
    expect((s.rows as any).Z).toBeUndefined();
  });

  it('applies a created record whose contents match the preview', async () => {
    const s = fixture(); const o = wire(s);
    const create = async (ctx: any) => { ctx.db.rows.Z = { price: 10, status: 'New', version: 1 }; };
    const { diff } = await runShadow(s, create, o);
    const out = await runCommit(s, create, buildWriteSet(diff, ['rows:Z'], []), o);
    expect(out.status).toBe('applied');
    expect((s.rows as any).Z.price).toBe(10);
  });

  it('refuses a function where the human approved a deletion', async () => {
    const s = fixture(); const o = wire(s);
    const previewed = async (ctx: any) => { delete ctx.db.rows.A.status; };
    const atCommit = async (ctx: any) => { ctx.db.rows.A.status = () => 'sneaky'; };
    const { diff } = await runShadow(s, previewed, o);
    const out = await runCommit(s, atCommit, buildWriteSet(diff, ['rows:A'], []), o);
    expect(out.status).toBe('aborted_diverged');
    expect(typeof s.rows.A.status).toBe('string');
  });

  it('allows a tool to write the same field twice on its way to the approved value', async () => {
    const s = fixture(); const o = wire(s);
    const twice = async (ctx: any) => { ctx.db.rows.A.price = 150; ctx.db.rows.A.price = 160; };
    const { diff } = await runShadow(s, twice, o);
    const out = await runCommit(s, twice, buildWriteSet(diff, ['rows:A'], []), o);
    expect(out.status).toBe('applied');
    expect(s.rows.A.price).toBe(160);
  });

  it('blocks a write the preview never saw and rolls everything back', async () => {
    const s = fixture(); const o = wire(s);
    const { diff } = await runShadow(s, repriceAll, o);
    const ws = buildWriteSet(diff, ['rows:A','rows:B','rows:C'], []);

    const rogue = async (ctx: any) => {
      await repriceAll(ctx);
      ctx.db.rows.A.status = 'Cancelled';   // never previewed
    };
    const out = await runCommit(s, rogue, ws, o);

    expect(out.status).toBe('denied');
    expect(out.violation).toBe('rows:A:status');
    expect(out.error).toBeUndefined();
    expect(s.rows.A.price).toBe(100);
    expect(s.rows.A.status).toBe('Booked');
    expect(s.rows.A.version).toBe(1);
  });

  // T9: a tool that crashes mid-commit (not a ScopeViolation) used to lose its message —
  // `violation` stayed undefined because the guard never fired, so nothing carried the real
  // reason. `error` is the dedicated field for that case; it must never be set alongside a
  // genuine `violation`, since the two mean different things to whoever reads the receipt.
  it('preserves a generic thrown message on the commit outcome without touching violation', async () => {
    const s = fixture(); const o = wire(s);
    const { diff } = await runShadow(s, repriceAll, o);
    const ws = buildWriteSet(diff, ['rows:A', 'rows:B', 'rows:C'], []);

    const crash = async () => { throw new Error('divide by zero in the real run'); };
    const out = await runCommit(s, crash, ws, o);

    expect(out.status).toBe('denied');
    expect(out.error).toBe('divide by zero in the real run');
    expect(out.violation).toBeUndefined();
    expect(s.rows.A.price).toBe(100);
  });

  it('aborts without writing when a row changed since the preview', async () => {
    const s = fixture(); const o = wire(s);
    const { diff } = await runShadow(s, repriceAll, o);
    const ws = buildWriteSet(diff, ['rows:A','rows:B','rows:C'], []);

    s.rows.B.version = 7;                     // someone else edited it

    const out = await runCommit(s, repriceAll, ws, o);
    expect(out.status).toBe('aborted_stale');
    expect(s.rows.A.price).toBe(100);
  });

  it('aborts when an approved field would receive a value the human never saw', async () => {
    const s = fixture(); const o = wire(s);
    const derive = async (ctx: any) => {
      ctx.db.rows.A.price = 150;
      ctx.db.rows.B.status = ctx.db.rows.A.price > 120 ? 'Premium' : 'Budget';
    };
    const { diff } = await runShadow(s, derive, o);
    const ws = buildWriteSet(diff, ['rows:B'], []);          // approve B, narrow out A
    const out = await runCommit(s, derive, ws, o);

    expect(out.status).toBe('aborted_diverged');
    expect(s.rows.B.status).toBe('Booked');                   // nothing landed
    expect(s.rows.A.price).toBe(100);
  });

  it('refuses a version write on a record the human narrowed out', async () => {
    const s = fixture(); const o = wire(s);
    const sneaky = async (ctx: any) => { ctx.db.rows.A.price = 110; ctx.db.rows.B.version = 99; };
    const { diff } = await runShadow(s, sneaky, o);
    const out = await runCommit(s, sneaky, buildWriteSet(diff, ['rows:A'], []), o);
    expect(s.rows.B.version).toBe(1);
    expect(out.status).toBe('partially_applied');
  });

  it('rolls back a root key the run added along with everything else', async () => {
    const s = fixture(); const o = wire(s);
    const ws = {
      previewed: new Set(['rows:A:price', 'audit:*:*']),
      allowed: new Set(['rows:A:price', 'audit:*:*']),
      expected: new Map<string, unknown>([['rows:A:price', 110], ['audit:*:*', ['created']]]),
      actions: new Set<string>(),
      versions: { 'rows:A': 1 },
    };
    const rogue = async (ctx: any) => {
      ctx.db.audit = ['created'];
      ctx.db.rows.A.price = 110;
      ctx.db.rows.A.status = 'Cancelled';   // never previewed -> throws
    };
    const out = await runCommit(s, rogue, ws, o);
    expect(out.status).toBe('denied');
    expect('audit' in s).toBe(false);
    expect(s.rows.A.price).toBe(100);
  });

  it('still reports the denial when the tool swallows the error', async () => {
    const s = fixture(); const o = wire(s);
    const swallowing = async (ctx: any) => {
      ctx.db.rows.A.price = 110;
      try { ctx.db.rows.A.status = 'Cancelled'; } catch { /* tool hides it */ }
    };
    const { diff } = await runShadow(s, swallowing, o);
    const ws = buildWriteSet(diff, diff.groups.map(g => g.group), []);
    // re-preview without the status write so it is genuinely unpreviewed at commit
    const narrow = { ...ws, previewed: new Set([...ws.previewed].filter(k => !k.endsWith(':status'))),
                     allowed: new Set([...ws.allowed].filter(k => !k.endsWith(':status'))) };
    const out = await runCommit(s, swallowing, narrow, o);
    expect(out.status).toBe('denied');
    expect(out.violation).toBe('rows:A:status');
    expect(s.rows.A.price).toBe(100);
  });

  it('sends nothing when the run is rolled back', async () => {
    const s = fixture(); const o = wire(s);

    const previewed = async (ctx: any) => {
      await ctx.effects.notify('a@example.com', 'one');
    };
    const atCommit = async (ctx: any) => {
      await ctx.effects.notify('a@example.com', 'one');
      ctx.db.rows.A.status = 'Cancelled';        // genuinely absent from the preview
    };

    const { diff } = await runShadow(s, previewed, o);
    const ws = buildWriteSet(diff, [], [diff.actions[0].actionId]);

    const sent: unknown[] = [];
    const out = await runCommit(s, atCommit, ws, { ...o, send: (_k: string, p: unknown) => sent.push(p) });

    expect(out.status).toBe('denied');
    expect(out.violation).toBe('rows:A:status');
    expect(sent).toEqual([]);
    expect(out.released).toEqual([]);
  });

  it('rolls back and reports when bookkeeping fails after the run', async () => {
    const s = fixture(); const o = wire(s);
    const reprice = async (ctx: any) => { ctx.db.rows.A.price = 110; };
    const { diff } = await runShadow(s, reprice, o);
    const ws = buildWriteSet(diff, ['rows:A'], []);

    const out = await runCommit(s, reprice, ws, {
      ...o,
      bumpVersion: () => { throw new Error('bookkeeping exploded'); },
    });

    expect(out.status).toBe('denied');
    expect(s.rows.A.price).toBe(100);        // rolled back, not left applied
  });

  it('reports what really went out when the transport fails mid-flush', async () => {
    const s = fixture(); const o = wire(s);
    const two = async (ctx: any) => {
      ctx.db.rows.A.price = 110;
      await ctx.effects.notify('first@example.com', 'one');
      await ctx.effects.notify('second@example.com', 'two');
    };
    const { diff } = await runShadow(s, two, o);
    const ws = buildWriteSet(diff, ['rows:A'], diff.actions.map(a => a.actionId));

    let n = 0;
    const out = await runCommit(s, two, ws, {
      ...o,
      send: () => { if (++n === 2) throw new Error('transport down'); },
    });

    expect(s.rows.A.price).toBe(110);        // approved writes stay applied
    expect(out.released).toHaveLength(1);    // exactly what actually went out
    expect(out.status).toBe('applied');
  });

  it('releases approved actions and drops the rest', async () => {
    const s = fixture(); const o = wire(s);
    const notifyTwo = async (ctx: any) => {
      await ctx.effects.notify('a@example.com', 'one');
      await ctx.effects.notify('b@example.com', 'two');
    };
    const { diff } = await runShadow(s, notifyTwo, o);
    const keep = diff.actions[0].actionId, drop = diff.actions[1].actionId;
    const out = await runCommit(s, notifyTwo, buildWriteSet(diff, [], [keep]), o);
    expect(out.released).toEqual([keep]);
    expect(out.dropped).toEqual([drop]);
  });
});
