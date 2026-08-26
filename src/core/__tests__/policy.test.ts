import { describe, it, expect } from 'vitest';
import { draftPolicy, policyMatches } from '../policy';
import type { Diff } from '../diff';

const NOW = new Date('2026-09-01T10:00:00Z');
const NEVER = ['cancel_shipments', 'notify_customers'];   // supplied by the domain, never by core
const d = (n: number, approved: number, v: number, i: number) =>
  ({ tool: 'reprice_shipments', proposalId: `p${i}`, proposed: n, approved, valueDelta: v });

const diff = (records: number, valueDelta: number, irreversible = 0): Diff => ({
  proposalId: 'x',
  groups: Array.from({ length: records }, (_, i) => ({
    group: `rows:${i}`, entity: 'rows', id: String(i), writes: [], valueDelta: 0, version: 1,
  })),
  actions: [], totals: { records, valueDelta, irreversible },
});

describe('draftPolicy', () => {
  it('drafts nothing before three clean approvals', () => {
    expect(draftPolicy('reprice_shipments', [d(5,5,100,1), d(4,4,80,2)], NOW, NEVER)).toBeNull();
  });

  it('drafts nothing when the human narrowed any of them', () => {
    expect(draftPolicy('reprice_shipments', [d(5,5,100,1), d(6,3,90,2), d(4,4,80,3)], NOW, NEVER)).toBeNull();
  });

  it('drafts caps at the largest run it has seen after three clean approvals', () => {
    const p = draftPolicy('reprice_shipments', [d(5,5,100,1), d(9,9,340,2), d(4,4,80,3)], NOW, NEVER)!;
    expect(p.maxRecords).toBe(9);
    expect(p.maxValue).toBe(340);
    expect(p.ratified).toBe(false);
    expect(p.draftedFrom).toBe('p3');
  });

  it('never drafts for a destructive or external tool', () => {
    for (const tool of NEVER) {
      const h = [1,2,3].map(i => ({ ...d(5,5,100,i), tool }));
      expect(draftPolicy(tool, h, NOW, NEVER)).toBeNull();
    }
  });
});

describe('policyMatches', () => {
  const p = { id: 'pol-1', tool: 'reprice_shipments', maxRecords: 9, maxValue: 340,
              expiresAt: '2026-09-08T10:00:00Z', draftedFrom: 'p3', ratified: true };

  it('matches inside every cap', () => expect(policyMatches(p, diff(5, 200), NOW)).toBe(true));
  it('refuses too many records', () => expect(policyMatches(p, diff(50, 200), NOW)).toBe(false));
  it('refuses too much value', () => expect(policyMatches(p, diff(5, 5000), NOW)).toBe(false));
  it('refuses anything irreversible', () => expect(policyMatches(p, diff(5, 200, 1), NOW)).toBe(false));
  it('refuses an unratified policy', () =>
    expect(policyMatches({ ...p, ratified: false }, diff(5, 200), NOW)).toBe(false));
  it('refuses an expired policy', () =>
    expect(policyMatches(p, diff(5, 200), new Date('2026-09-20T10:00:00Z'))).toBe(false));
});
