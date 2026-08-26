import { describe, it, expect } from 'vitest';
import { runShadow } from '../shadow';
import type { WriteRecord } from '../types';

const fixture = () => ({
  rows: {
    A: { price: 100, status: 'Booked', held: false, version: 1 },
    B: { price: 200, status: 'Booked', held: true,  version: 3 },
  },
});

const priceDelta = (w: WriteRecord) =>
  w.field === 'price' ? (w.after as number) - (w.before as number) : 0;

const opts = (s: ReturnType<typeof fixture>) => ({
  proposalId: 'p1',
  valueOf: priceDelta,
  versionOf: (_e: string, id: string) => (s.rows as any)[id].version as number,
});

describe('runShadow', () => {
  it('leaves the real state untouched', async () => {
    const s = fixture();
    await runShadow(s, async ctx => { (ctx.db as any).rows.A.price = 500; }, opts(s));
    expect(s.rows.A.price).toBe(100);
  });

  it('groups writes per row and totals the value delta', async () => {
    const s = fixture();
    const { diff } = await runShadow(s, async ctx => {
      (ctx.db as any).rows.A.price = 150;
      (ctx.db as any).rows.A.status = 'In transit';
      (ctx.db as any).rows.B.price = 260;
    }, opts(s));

    expect(diff.groups).toHaveLength(2);
    expect(diff.groups.find(g => g.id === 'A')!.writes).toHaveLength(2);
    expect(diff.totals.records).toBe(2);
    expect(diff.totals.valueDelta).toBe(110);
  });

  it('captures the version each row had at preview time', async () => {
    const s = fixture();
    const { diff } = await runShadow(s, async ctx => { (ctx.db as any).rows.B.price = 210; }, opts(s));
    expect(diff.groups[0].version).toBe(3);
  });

  it('holds external actions instead of running them, and counts them as irreversible', async () => {
    const s = fixture();
    const { diff } = await runShadow(s, async ctx => {
      await ctx.effects.notify('someone@example.com', 'your rate changed');
    }, opts(s));
    expect(diff.actions).toHaveLength(1);
    expect(diff.actions[0].kind).toBe('notify');
    expect(diff.actions[0].payload.to).toBe('someone@example.com');
    expect(diff.totals.irreversible).toBe(1);
    expect(diff.totals.records).toBe(0);
  });

  it('reports a throwing exec as not ok and leaves real state untouched', async () => {
    const s = fixture();
    const r = await runShadow(s, async ctx => {
      (ctx.db as any).rows.A.price = 999;
      throw new Error('boom');
    }, opts(s));
    expect(r.ok).toBe(false);
    expect(r.error!.message).toBe('boom');
    expect(s.rows.A.price).toBe(100);
  });
});
