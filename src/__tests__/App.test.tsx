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
  });

  afterEach(() => {
    cleanup();
    delete (document as any).modelContext;
    delete (navigator as any).modelContext;
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
