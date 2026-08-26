import { describe, it, expect } from 'vitest';
import { toolResult } from '../../webmcp/result';

describe('toolResult', () => {
  it('carries the payload at the top level and as JSON text', () => {
    const r = toolResult({
      status: 'partially_applied', requested: 47, applied: 12,
      rejected: [{ count: 35, reason: 'customs hold open', ids: ['SHP-10001'] }],
      actions_released: 0, actions_dropped: 1,
      replan_required: true, rule_offered: null,
    });
    expect(r.applied).toBe(12);
    expect(r.content[0].type).toBe('text');
    expect(JSON.parse(r.content[0].text).rejected[0].reason).toBe('customs hold open');
  });

  it('always demands a replan when anything was refused', () => {
    const r = toolResult({
      status: 'partially_applied', requested: 2, applied: 1, rejected: [],
      actions_released: 0, actions_dropped: 0, replan_required: true, rule_offered: null,
    });
    expect(r.replan_required).toBe(true);
  });
});
