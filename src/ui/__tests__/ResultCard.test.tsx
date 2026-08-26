// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ResultCard } from '../ResultCard';
import type { ProposalOutcome } from '../../webmcp/adapter';

afterEach(() => cleanup());

function outcome(cause: ProposalOutcome['cause'], status: string, applied: number, requested: number): ProposalOutcome {
  return {
    toolName: 'update_shipments',
    cause,
    payload: {
      status: status as any, requested, applied,
      rejected: applied < requested
        ? [{ count: requested - applied, reason: 'the operator removed these from the change', ids: [] }]
        : [],
      actions_released: 0, actions_dropped: 0,
      replan_required: applied < requested, rule_offered: null,
    },
  };
}

/**
 * F4: `frame()` had no case for `cause: 'applied'`, so a clean, fully-approved run (and a
 * partial one — same cause, different `payload.status`) fell to the generic default: headline
 * "Sent back to the agent", note "Your judgement left as structured data, not as a silent
 * success." The first receipt a judge sees announced success in the language of refusal.
 */
describe('ResultCard framing for a successful run (F4)', () => {
  it('gives a clean, fully-approved run its own framing, not the refusal-shaped default', () => {
    render(<ResultCard outcome={outcome('applied', 'applied', 5, 5)} shifted={false} onDismiss={() => {}} />);
    expect(screen.queryByText('Sent back to the agent')).toBeNull();
    expect(screen.queryByText(/Your judgement left as structured data/)).toBeNull();
  });

  it('gives a partially-applied run its own framing, distinct from both the default and the full-success case', () => {
    const partial = render(<ResultCard outcome={outcome('applied', 'partially_applied', 3, 5)} shifted={false} onDismiss={() => {}} />);
    expect(screen.queryByText('Sent back to the agent')).toBeNull();
    expect(screen.queryByText(/Your judgement left as structured data/)).toBeNull();
    const partialTitle = partial.container.querySelector('.rc-title')?.textContent;
    partial.unmount();

    const full = render(<ResultCard outcome={outcome('applied', 'applied', 5, 5)} shifted={false} onDismiss={() => {}} />);
    const fullTitle = full.container.querySelector('.rc-title')?.textContent;
    full.unmount();

    expect(partialTitle).toBeTruthy();
    expect(fullTitle).toBeTruthy();
    expect(partialTitle).not.toBe(fullTitle);
  });
});
