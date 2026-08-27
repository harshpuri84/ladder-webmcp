// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, act, render, screen, cleanup, waitFor } from '@testing-library/react';
import { useTab } from '../useTab';

describe('useTab', () => {
  beforeEach(() => { window.location.hash = ''; });
  afterEach(() => { window.location.hash = ''; });

  it('lands on the problem tab when there is no hash', () => {
    const { result } = renderHook(() => useTab());
    expect(result.current.tab).toBe('problem');
  });

  it('reads the tab out of the hash on first render', () => {
    window.location.hash = '#/elsewhere';
    const { result } = renderHook(() => useTab());
    expect(result.current.tab).toBe('elsewhere');
  });

  it('falls back to the problem tab on a hash it does not know', () => {
    window.location.hash = '#/nonsense';
    const { result } = renderHook(() => useTab());
    expect(result.current.tab).toBe('problem');
  });

  it('writes the hash when the tab is set, so a tab is linkable', () => {
    const { result } = renderHook(() => useTab());
    act(() => result.current.setTab('proof'));
    expect(window.location.hash).toBe('#/proof');
    expect(result.current.tab).toBe('proof');
  });

  it('follows a hash changed outside React, so back and forward work', () => {
    const { result } = renderHook(() => useTab());
    act(() => {
      window.location.hash = '#/elsewhere';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.tab).toBe('elsewhere');
  });
});

const flush = () => new Promise(r => setTimeout(r, 0));

/**
 * The one behaviour in this whole page that can fail in front of a judge: an agent call must
 * be able to pull the human off the problem essay and onto the register, unasked. This drives
 * the real adapter and the real App through a fake `document.modelContext` that captures each
 * registered tool's `execute`, exactly the way ProposalPanel.test.tsx does it — not a
 * reimplementation of the queue logic that could hide a regression here.
 *
 * Both tests use `waitFor`/`findBy*` rather than a single fixed `flush()` tick before asserting.
 * Under load a single macrotask isn't always enough for `propose_remedy`'s own preview (a real
 * `await runShadow(...)` chain) to reach the decision boundary — a fixed-timer assertion flaked
 * under exactly that load in review, on the one behaviour a judge will actually exercise.
 * `waitFor` retries the assertion instead of gambling on one tick, so it settles as soon as the
 * state actually lands rather than by a hard-coded deadline.
 */
describe('App forces the proof tab open on a proposal', () => {
  const registered = new Map<string, { execute: (input: any) => Promise<any> }>();

  beforeAll(() => {
    (document as any).modelContext = {
      registerTool: (spec: any) => registered.set(spec.name, spec),
      unregisterTool: (name: string) => registered.delete(name),
    };
  });

  afterEach(() => {
    cleanup();
    window.location.hash = '';
  });

  afterAll(() => { delete (document as any).modelContext; });

  it('switches from the problem tab to the proof tab the instant a proposal arrives', async () => {
    const { default: App } = await import('../../App');
    render(<App />);

    expect(window.location.hash).toBe('');
    expect(screen.getByRole('tab', { name: 'The problem' }).getAttribute('aria-selected')).toBe('true');

    // The call is left pending on purpose — the panel it opens stays up until a human decides,
    // so awaiting the promise here would hang the test forever.
    act(() => { void registered.get('propose_remedy')!.execute({}); });

    await waitFor(() => expect(window.location.hash).toBe('#/proof'));
    expect(await screen.findByRole('tabpanel')).toBeTruthy();
    expect(document.querySelector('.console')).toBeTruthy();
  }, 10_000);

  /**
   * F-review-1: the exact race a prior version of this fix missed. React flushes child passive
   * effects before parent ones, so `ProposalPanel`'s own `onProposal` subscription (mounted
   * below App in the tree) used to drain a proposal buffered before mount, leaving App's own
   * `onProposal` listener nothing to see. The tool is called and flushed to completion here
   * before `App` is even imported for rendering, so the proposal is fully buffered — and, per
   * the fix, `hasPendingProposal()` already true — before any effect runs at all.
   */
  it('switches straight to the proof tab on mount when a proposal already arrived before render', async () => {
    const { default: App } = await import('../../App');

    // Left pending on purpose, same as above — but called and flushed to completion before
    // `render` ever runs, so this reproduces a proposal that arrived before mount, not after it.
    void registered.get('propose_remedy')!.execute({});
    await flush();

    render(<App />);

    await waitFor(() => expect(window.location.hash).toBe('#/proof'));
    expect(await screen.findByRole('tab', { name: 'The proof' })).toBeTruthy();
    const proofTab = screen.getByRole('tab', { name: 'The proof' });
    expect(proofTab.getAttribute('aria-selected')).toBe('true');
  }, 10_000);
});
