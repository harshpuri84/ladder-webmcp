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

function nothingToDecideOutcome(reason?: string): ProposalOutcome {
  return {
    toolName: 'update_shipments',
    cause: 'nothing_to_decide',
    payload: {
      status: 'denied', requested: reason ? 0 : 4, applied: 0,
      rejected: reason ? [] : [{ count: 4, reason: 'customs hold open', ids: [] }],
      actions_released: 0, actions_dropped: 0,
      replan_required: true, rule_offered: null,
      ...(reason ? { reason } : {}),
    },
  };
}

/**
 * F12: the same note — "every matching row was already accounted for" — ran for both the
 * zero-match case (nothing at all matched the filter) and the everything-held case (rows
 * matched but every one was skipped for a domain reason). The agent-side `reason` field
 * already distinguishes them; the human-facing line didn't.
 */
describe('ResultCard framing distinguishes zero-match from everything-held (F12)', () => {
  it('says nothing matched, not "already accounted for", when the filter matched no records at all', () => {
    render(<ResultCard outcome={nothingToDecideOutcome('no records or actions matched this request; nothing was found to change')} shifted={false} onDismiss={() => {}} />);
    expect(screen.queryByText(/already accounted for/)).toBeNull();
  });

  it('keeps the "already accounted for" note when rows matched but all were held', () => {
    render(<ResultCard outcome={nothingToDecideOutcome()} shifted={false} onDismiss={() => {}} />);
    expect(screen.getByText(/already accounted for/)).toBeTruthy();
  });
});

/**
 * The two ends of the authority boundary, on the receipt. A referred run is not a refusal and
 * not a plain partial: the operator did everything they were allowed to, and a colleague has
 * the rest. `REFER` is the stamped word for that, against `OK TO RUN` for what they could
 * authorise — and the words, not an edge colour, are what tell the two apart.
 */
describe('ResultCard framing for a referred run', () => {
  function referred(applied: number, requested: number, count: number): ProposalOutcome {
    return {
      toolName: 'propose_remedy',
      cause: 'referred',
      payload: {
        status: 'partially_applied' as any, requested, applied,
        rejected: [{
          count,
          reason: "above the gateway operator's EUR 250 spend authority — referred to a duty manager, not refused",
          ids: ['HAWB-70001'],
          pending: 'duty manager',
        }],
        actions_released: 0, actions_dropped: 0,
        replan_required: false, rule_offered: null,
        referred: { count, ids: ['HAWB-70001'], awaiting: 'duty manager' },
      },
    };
  }

  it('stamps REFER, names who has it, and says plainly that it was not refused', () => {
    render(<ResultCard outcome={referred(23, 27, 4)} shifted={false} onDismiss={() => {}} />);
    expect(screen.getByText('Refer')).toBeTruthy();
    expect(screen.getByText('Applied what you can authorise')).toBeTruthy();
    expect(screen.getByText(/now with the duty manager/)).toBeTruthy();
    expect(screen.getByText(/not refused, not yet decided/)).toBeTruthy();
  });

  it('says nothing landed when nothing did, rather than claiming a partial success', () => {
    render(<ResultCard outcome={referred(0, 4, 4)} shifted={false} onDismiss={() => {}} />);
    expect(screen.getByText('Referred, nothing applied')).toBeTruthy();
  });

  it('carries a rule form of its own, not one it shares with a blocked or refused receipt', () => {
    const { container } = render(<ResultCard outcome={referred(23, 27, 4)} shifted={false} onDismiss={() => {}} />);
    expect(container.querySelector('.rc')!.className).toContain('rc--referred');
  });
});
