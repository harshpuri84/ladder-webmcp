// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

/**
 * The urgent fix: tools register at module evaluation via a namespace read exactly once
 * (`document.modelContext ?? navigator.modelContext`), frozen into a boolean. A Chrome flag
 * build injects the namespace before page scripts run, so that worked there — but ChatGPT
 * desktop's built-in browser (an entirely normal host to inject a moment later) left the
 * read seeing nothing, registering nothing, with the "needs WebMCP" banner showing forever
 * even once the runtime was sitting right there. This drives the real `App` component end to
 * end: banner visible while genuinely unavailable, then a late injection registers all four
 * tools exactly once, the banner disappears without a reload, and a call actually works.
 */
describe('App: WebMCP namespace injected after mount', () => {
  beforeEach(() => {
    vi.resetModules();
    delete (document as any).modelContext;
    delete (navigator as any).modelContext;
    // The banner and the register now live on the proof tab, not on App directly — send the
    // page there so the rest of this test still exercises the same registration lifecycle.
    window.location.hash = '#/proof';
  });

  afterEach(() => {
    cleanup();
    delete (document as any).modelContext;
    delete (navigator as any).modelContext;
    window.location.hash = '';
  });

  it('shows the banner while unavailable, then registers and hides it once WebMCP is injected late', async () => {
    const registered = new Map<string, { execute: (input: unknown) => Promise<unknown> }>();

    const { default: App } = await import('../App');
    render(<App />);

    // Must not flash on the very first frame — the grace period exists precisely so a host
    // that's about to inject doesn't make this appear and then immediately vanish.
    expect(screen.queryByText(/needs WebMCP/i)).toBeNull();

    // Bounds the grace period rather than leaving it unverified: it does show once genuinely
    // unavailable for a while.
    await waitFor(
      () => expect(screen.getByText(/needs WebMCP/i)).toBeTruthy(),
      { timeout: 3000 },
    );

    // The host injects late — the exact failure this fixes. Nothing before this retried.
    (document as any).modelContext = {
      registerTool: (spec: any) => registered.set(spec.name, spec),
      unregisterTool: (name: string) => registered.delete(name),
    };

    await waitFor(() => expect(registered.size).toBe(4), { timeout: 2000 });
    // No tool registered more than once.
    expect(new Set(registered.keys()).size).toBe(4);

    await waitFor(
      () => expect(screen.queryByText(/needs WebMCP/i)).toBeNull(),
      { timeout: 2000 },
    );

    // And the runtime is actually usable now, not just visually "ready".
    const result: any = await registered.get('search_shipments')!.execute({});
    expect(Array.isArray(result.rows)).toBe(true);
  }, 10_000);

  it('never shows the banner when WebMCP is already present at load (unchanged behaviour)', async () => {
    (document as any).modelContext = { registerTool: vi.fn(), unregisterTool: vi.fn() };

    const { default: App } = await import('../App');
    render(<App />);

    expect(screen.queryByText(/needs WebMCP/i)).toBeNull();
    // Give the (never-armed) grace timer a chance to fire if it were wrongly started.
    await new Promise(r => setTimeout(r, 100));
    expect(screen.queryByText(/needs WebMCP/i)).toBeNull();
  });
});

/**
 * The shell's width follows the tab, and it has to keep doing so. Widening the prose tabs to
 * meet the header rule would have fixed a ragged edge by breaking a reading measure, so the
 * rule was made to move instead — which means the class that moves it is now load-bearing for
 * the look of the most-read page on the site, and silent if it regresses.
 */
describe('App: the shell is as wide as the tab under it needs', () => {
  beforeEach(() => {
    vi.resetModules();
    (document as any).modelContext = { registerTool: vi.fn(), unregisterTool: vi.fn() };
  });

  afterEach(() => {
    cleanup();
    delete (document as any).modelContext;
    window.location.hash = '';
  });

  it('takes the reading measure on the prose tabs and the full width on the register', async () => {
    const { default: App } = await import('../App');

    for (const [hash, reading] of [
      ['#/problem', true],
      ['#/elsewhere', true],
      ['#/proof', false],
    ] as const) {
      window.location.hash = hash;
      const { container, unmount } = render(<App />);
      const app = container.querySelector('.app');
      expect(app).toBeTruthy();
      expect(app!.classList.contains('app--reading')).toBe(reading);
      unmount();
    }
  });
});
