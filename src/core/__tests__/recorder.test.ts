import { describe, it, expect } from 'vitest';
import { recordingProxy } from '../recorder';
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
});
