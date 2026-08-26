import { describe, it, expect } from 'vitest';
import { runShadow } from '../shadow';
import { collectingEffects, releasingEffects } from '../effects';
import type { WriteRecord, ActionRecord } from '../types';

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
  deltaOf: priceDelta,
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

  it('treats a missing delta function as zero rather than throwing', async () => {
    const s = fixture();
    const { ok, diff } = await runShadow(
      s,
      async ctx => { (ctx.db as any).rows.A.price = 150; },
      { proposalId: 'p1', versionOf: (_e, id) => (s.rows as any)[id].version },
    );
    expect(ok).toBe(true);
    expect(diff.totals.valueDelta).toBe(0);
  });
});

describe('action identity', () => {
  const idFor = (actions: ActionRecord[], to: string) =>
    actions.find(a => (a.payload as any).to === to)!.actionId;

  it('gives one action the same id no matter when it is called', async () => {
    const a = collectingEffects();
    await a.effects.notify('one@example.com', 'first');
    await a.effects.notify('two@example.com', 'second');

    const b = collectingEffects();
    await b.effects.notify('two@example.com', 'second');   // reversed
    await b.effects.notify('one@example.com', 'first');

    expect(idFor(a.actions, 'one@example.com')).toBe(idFor(b.actions, 'one@example.com'));
    expect(idFor(a.actions, 'two@example.com')).toBe(idFor(b.actions, 'two@example.com'));
  });

  it('sends the message the human approved, not the one called first', async () => {
    const preview = collectingEffects();
    await preview.effects.notify('keep@example.com', 'keep me');
    await preview.effects.notify('drop@example.com', 'drop me');
    const approved = new Set([idFor(preview.actions, 'keep@example.com')]);

    const sent: Record<string, unknown>[] = [];
    const commit = releasingEffects(approved, (_kind, payload) => sent.push(payload));
    await commit.effects.notify('drop@example.com', 'drop me');   // reversed
    await commit.effects.notify('keep@example.com', 'keep me');
    // sends are held until the run is proven clean — nothing actually goes out until flush()
    commit.flush();

    expect(sent).toEqual([{ to: 'keep@example.com', message: 'keep me' }]);
  });

  it('keeps two genuinely identical actions distinguishable', async () => {
    const a = collectingEffects();
    await a.effects.notify('same@example.com', 'twice');
    await a.effects.notify('same@example.com', 'twice');
    expect(new Set(a.actions.map(x => x.actionId)).size).toBe(2);
  });
});
