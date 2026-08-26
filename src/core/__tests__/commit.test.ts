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
  versionOf: (_e: string, id: string) => s.rows[id].version as number,
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
    expect(s.rows.A.price).toBe(100);
    expect(s.rows.A.status).toBe('Booked');
    expect(s.rows.A.version).toBe(1);
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
