// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RunRecord } from '../ui/RunRecord';
import type { ProposalOutcome } from '../../webmcp/adapter';

/** The roll_config {} run as measured on the shipped build, 1 September 2026. */
const outcome: ProposalOutcome = {
  toolName: 'roll_config',
  cause: 'referred',
  payload: {
    status: 'partially_applied',
    requested: 36,
    applied: 23,
    rejected: [
      { reason: 'every rollout mode is closed here by change-freeze-window', ids: ['sin1'], count: 1 },
      { reason: 'every rollout mode is closed here by incident-in-progress', ids: ['cdg1', 'sea1'], count: 2 },
      { reason: 'every rollout mode is closed here by drained-for-maintenance', ids: ['fra2', 'sjc2'], count: 2 },
      { reason: 'already serving 2026.08.27-1; there is nothing to roll here', ids: ['dub1'], count: 1 },
      { count: 7, reason: 'above the limit', ids: ['ams1', 'sjc1', 'lhr1', 'fra1', 'osl1', 'hel1', 'eze1'], pending: 'traffic lead' },
    ],
    actions_released: 0,
    actions_dropped: 0,
    replan_required: true,
    referred: { count: 7, ids: ['ams1', 'sjc1', 'lhr1', 'fra1', 'osl1', 'hel1', 'eze1'], awaiting: 'traffic lead' },
    rule_offered: null,
  },
};

describe('RunRecord (D1)', () => {
  afterEach(cleanup);

  it('sums the buckets the agent got into a ledger that reconciles', () => {
    render(<RunRecord outcome={outcome} shifted={false} onDismiss={() => {}} />);
    const rows = [...document.querySelectorAll('.rr-sum')].map(r => r.textContent);
    expect(rows).toEqual(['36requested', '23applied', '6closed by a rule', '7referred to a traffic lead']);
  });

  it('keeps the returned payload behind a disclosure that starts shut', () => {
    render(<RunRecord outcome={outcome} shifted={false} onDismiss={() => {}} />);
    const wire = document.querySelector('details.rr-wire') as HTMLDetailsElement;
    expect(wire.open).toBe(false);
    expect(screen.getByText('Returned to the agent').textContent).toMatch(/Show$/);
    expect(wire.querySelector('pre')!.textContent).toContain('"requested": 36');
  });

  it('names a removal by the operator apart from a rule', () => {
    const cut: ProposalOutcome = {
      ...outcome, cause: 'applied',
      payload: {
        ...outcome.payload, applied: 20, referred: undefined, replan_required: false,
        rejected: [
          { reason: 'the operator removed these from the change', ids: ['a', 'b', 'c'], count: 3 },
          ...outcome.payload.rejected.slice(0, 4),
        ],
      },
    };
    render(<RunRecord outcome={cut} shifted={false} onDismiss={() => {}} />);
    const rows = [...document.querySelectorAll('.rr-sum')].map(r => r.textContent);
    expect(rows).toEqual(['36requested', '20applied', '3removed by you', '6closed by a rule']);
  });
});
