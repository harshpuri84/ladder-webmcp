import { describe, it, expect } from 'vitest';
import { runShadow } from '../shadow';
import { collectingEffects, releasingEffects } from '../effects';
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

describe('action identity', () => {
  it('derives the same id for the same action regardless of call order', async () => {
    const a = collectingEffects();
    await a.effects.notify('one@example.com', 'first');
    await a.effects.notify('two@example.com', 'second');

    const b = collectingEffects();
    await b.effects.notify('two@example.com', 'second');   // reversed
    await b.effects.notify('one@example.com', 'first');

    expect(new Set(a.actions.map(x => x.actionId)))
      .toEqual(new Set(b.actions.map(x => x.actionId)));
  });

  it('distinguishes two genuinely identical actions', async () => {
    const a = collectingEffects();
    await a.effects.notify('same@example.com', 'twice');
    await a.effects.notify('same@example.com', 'twice');
    const ids = a.actions.map(x => x.actionId);
    expect(ids[0]).not.toBe(ids[1]);
    expect(new Set(ids).size).toBe(2);
  });

  it('releases the approved action even when commit calls them in a different order', async () => {
    const preview = collectingEffects();
    await preview.effects.notify('keep@example.com', 'keep me');
    await preview.effects.notify('drop@example.com', 'drop me');
    const approved = new Set([preview.actions[0].actionId]);

    const commit = releasingEffects(approved);
    await commit.effects.notify('drop@example.com', 'drop me');   // reversed order
    await commit.effects.notify('keep@example.com', 'keep me');

    expect(commit.released).toEqual([preview.actions[0].actionId]);
    expect(commit.dropped).toEqual([preview.actions[1].actionId]);
  });
});
