// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The bug: `document.modelContext ?? navigator.modelContext` was read exactly once, at module
 * evaluation, and frozen into `webmcpAvailable`. A Chrome flag build injects the namespace
 * before page scripts run, so that one-time read worked there — but ChatGPT desktop's built-in
 * browser (and any host that injects a moment later, which is an entirely normal thing to do)
 * left the read seeing `undefined` forever: no retry anywhere, so the tools never registered
 * even once the runtime was sitting right there.
 *
 * These tests exercise `registerWhenReady`/`checkForWebmcp` directly against a fresh module
 * instance each time (`vi.resetModules()`), so a test that deletes/injects
 * `document.modelContext` never leaks into the next one.
 */
describe('registerWhenReady / checkForWebmcp', () => {
  beforeEach(() => {
    vi.resetModules();
    delete (document as any).modelContext;
    delete (navigator as any).modelContext;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (document as any).modelContext;
    delete (navigator as any).modelContext;
  });

  it('registers immediately, unchanged, when the namespace is already present at load', async () => {
    (document as any).modelContext = { registerTool: vi.fn(), unregisterTool: vi.fn() };
    const { registerWhenReady, isWebmcpAvailable } = await import('../adapter');

    const register = vi.fn();
    const cleanup = registerWhenReady(register);

    expect(register).toHaveBeenCalledTimes(1);
    expect(isWebmcpAvailable()).toBe(true);
    cleanup();
  });

  it('polls and registers exactly once when the namespace is injected after a delay', async () => {
    vi.useFakeTimers();
    const { registerWhenReady, isWebmcpAvailable, onAvailabilityChange } = await import('../adapter');
    expect(isWebmcpAvailable()).toBe(false);

    let notifications = 0;
    onAvailabilityChange(() => { notifications++; });

    const register = vi.fn();
    registerWhenReady(register);

    // Still nothing — the namespace hasn't been injected yet.
    vi.advanceTimersByTime(900);
    expect(register).not.toHaveBeenCalled();
    expect(isWebmcpAvailable()).toBe(false);

    // The host injects late — this is the exact failure: nothing before this fix ever looked
    // again after the first read.
    (document as any).modelContext = { registerTool: vi.fn(), unregisterTool: vi.fn() };
    vi.advanceTimersByTime(300);

    expect(register).toHaveBeenCalledTimes(1);
    expect(isWebmcpAvailable()).toBe(true);
    expect(notifications).toBe(1);

    // Further time passing must not call register again or leave the poll running.
    vi.advanceTimersByTime(5000);
    expect(register).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives up after the polling ceiling when the namespace never arrives, without polling forever', async () => {
    vi.useFakeTimers();
    const { registerWhenReady } = await import('../adapter');

    const register = vi.fn();
    registerWhenReady(register);

    vi.advanceTimersByTime(20_000); // well past any sensible ceiling

    expect(register).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0); // nothing left spinning
  });

  it('re-checks on visibilitychange, not only on the polling interval', async () => {
    vi.useFakeTimers();
    const { registerWhenReady } = await import('../adapter');

    const register = vi.fn();
    registerWhenReady(register);
    vi.advanceTimersByTime(50); // well inside one poll tick — the interval alone hasn't fired

    (document as any).modelContext = { registerTool: vi.fn(), unregisterTool: vi.fn() };
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(register).toHaveBeenCalledTimes(1);
  });

  it('logs exactly one console line when unavailable at load, and never a second time', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.useFakeTimers();
    const { registerWhenReady } = await import('../adapter');
    expect(infoSpy).toHaveBeenCalledTimes(1);

    registerWhenReady(vi.fn());
    vi.advanceTimersByTime(20_000);
    expect(infoSpy).toHaveBeenCalledTimes(1); // polling never spams the console

    infoSpy.mockRestore();
  });

  it('registers the six domain tools exactly once each, whether present at load or injected late', async () => {
    const registerTool = vi.fn();
    vi.useFakeTimers();
    const { registerWhenReady } = await import('../adapter');
    const { registerDomainTools } = await import('../../domain/tools');

    registerWhenReady(registerDomainTools);
    (document as any).modelContext = { registerTool, unregisterTool: vi.fn() };
    vi.advanceTimersByTime(POLL_INTERVAL_MS_FOR_TEST);

    const names = registerTool.mock.calls.map(c => c[0].name);
    expect(names).toHaveLength(6);
    expect(new Set(names).size).toBe(6); // no name registered twice
  });
});

// Matches adapter.ts's own POLL_INTERVAL_MS — kept local since the constant isn't exported
// (it's an implementation detail, not part of the module's public contract).
const POLL_INTERVAL_MS_FOR_TEST = 300;
