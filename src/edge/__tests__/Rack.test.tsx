// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Rack } from '../ui/Rack';
import { edgeStore } from '../store';
import { clearRackView, setRackView } from '../rack-view';
import { REGIONS } from '../seed';

afterEach(() => cleanup());
// The view outlives a mount on purpose, so it also outlives an `it` in the same registry.
beforeEach(clearRackView);

const sites = () => Object.values(edgeStore.state.pops);
const estate = () => sites().length;
const setAgentView = (ids: string[], words: string) => {
  act(() => setRackView({ toolName: 'list_pops', ids, words }));
};

/**
 * Driven through `setRackView` — the seam `Rack` reads — rather than through a registered tool
 * call. That `list_pops` writes this seam, with these ids and these words, is
 * `rack-view.test.ts`'s subject; running the fake `modelContext` here too would test that wiring
 * twice and this component's half not at all.
 */
describe('Rack draws a view an agent set, and gives it back', () => {
  it('draws only the sites the agent listed', () => {
    const { container } = render(<Rack />);
    const canaries = sites().filter(p => p.canary);
    expect(canaries.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.grid tbody tr').length).toBe(estate());

    setAgentView(canaries.map(p => p.id), 'canary sites');

    expect(container.querySelectorAll('.grid tbody tr').length).toBe(canaries.length);
  });

  /**
   * The honesty boundary, on the figure that could break it. Each band's traffic share is what
   * an engineer sizes a blast radius against; a narrowing that quietly recomputed it against the
   * drawn rows would let four sites read as the whole of a region.
   */
  it('goes on counting each band against its whole region', () => {
    const { container } = render(<Rack />);
    const sharesBefore = [...container.querySelectorAll('.band-meta')].map(
      el => el.textContent!.split('·')[1].trim(),
    );
    const canaries = sites().filter(p => p.canary);

    setAgentView(canaries.map(p => p.id), 'canary sites');

    const sharesAfter = [...container.querySelectorAll('.band-meta')].map(
      el => el.textContent!.split('·')[1].trim(),
    );
    expect(sharesAfter).toEqual(sharesBefore);
    // And the site count says both figures out loud rather than replacing one with the other.
    const region = REGIONS.find(r => canaries.some(p => p.region === r))!;
    const inRegion = sites().filter(p => p.region === region);
    const drawn = canaries.filter(p => p.region === region);
    expect(
      [...container.querySelectorAll('.band-meta')]
        .map(el => el.textContent!),
    ).toContainEqual(expect.stringContaining(`${drawn.length} of ${inRegion.length} sites`));
  });

  it('keeps every region band even when the view empties one', () => {
    const { container } = render(<Rack />);
    const one = sites().find(p => p.canary)!;

    setAgentView([one.id], one.id);

    expect(container.querySelectorAll('.band-name').length).toBe(REGIONS.length);
    expect(container.querySelectorAll('.grid tbody tr').length).toBe(1);
  });

  it('names the agent, the tool and what it matched, and says nothing changed', () => {
    render(<Rack />);
    const canaries = sites().filter(p => p.canary);

    setAgentView(canaries.map(p => p.id), 'canary sites');

    const band = screen.getByRole('status');
    expect(band.textContent).toContain('View set by the agent');
    expect(band.textContent).toContain('list_pops');
    expect(band.textContent).toContain('canary sites');
    expect(band.textContent).toContain(`${canaries.length} of ${estate()} sites`);
    expect(band.textContent).toContain('Nothing was changed and nothing left the estate');
  });

  it('returns to the whole estate in one click', () => {
    const { container } = render(<Rack />);
    setAgentView(sites().filter(p => p.canary).map(p => p.id), 'canary sites');

    fireEvent.click(screen.getByRole('button', { name: `Show all ${estate()}` }));

    expect(container.querySelectorAll('.grid tbody tr').length).toBe(estate());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('leaves every site in the estate', () => {
    render(<Rack />);
    const before = sites().map(p => JSON.stringify(p));

    setAgentView([sites()[0].id], 'one site');

    expect(sites().map(p => JSON.stringify(p))).toEqual(before);
  });
});
