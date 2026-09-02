// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import type { LandingHero as LandingHeroType } from '../LandingHero';

const flat = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * The runtime line in the active state: a fake `document.modelContext` installed before the
 * adapter is imported, the shape every adapter-facing suite here uses, and the domain's own
 * tools registered against it. The count on the line is read off the registry, so it is
 * asserted against the registry and never against a typed figure.
 */
describe('LandingHero with a WebMCP runtime', () => {
  let LandingHero: typeof LandingHeroType;
  let registeredCount = 0;
  const registered = new Set<string>();

  beforeAll(async () => {
    (document as any).modelContext = {
      registerTool: (spec: { name: string }) => registered.add(spec.name),
      unregisterTool: (name: string) => registered.delete(name),
    };
    const { registerDomainTools } = await import('../../domain/tools');
    const { listTools } = await import('../../webmcp/adapter');
    ({ LandingHero } = await import('../LandingHero'));
    registerDomainTools();
    registeredCount = listTools().length;
  });

  afterEach(cleanup);
  afterAll(() => { delete (document as any).modelContext; });

  it('says WebMCP is active and counts the page-owned tools off the registry', async () => {
    const { container } = render(<LandingHero />);
    await waitFor(() => expect(container.querySelector('.hero-webmcp')).toBeTruthy());
    expect(registeredCount).toBeGreaterThan(0);
    expect(registeredCount).toBe(registered.size);
    expect(flat(container.querySelector('.hero-webmcp')!))
      .toBe(`WebMCP active · ${registeredCount} page-owned tools`);
  });
});
