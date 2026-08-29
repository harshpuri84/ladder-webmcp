// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Console, resetConsoleSession } from '../Console';
import { store } from '../../domain/store';
import { setRegisterView } from '../../domain/register-view';

afterEach(() => cleanup());
// The filter and the buggy-tool box outlive a mount on purpose (they have to survive a tab
// round trip), so they also outlive an `it` in the same module registry. Put them back.
beforeEach(resetConsoleSession);

const totalShipments = Object.keys(store.state.shipments).length;
const setFilter = (value: string) => {
  fireEvent.change(screen.getByPlaceholderText(/Filter by/i), { target: { value } });
};
const rows = () => Object.values(store.state.shipments);

/**
 * F8: receipts and panel notes hand the operator ids ("HAWB-70019 skipped, every remedy
 * blocked"), consol ids, tiers and cargo words — and the filter has to find the row when any
 * of them is pasted back in, exactly as the register renders it.
 */
describe('Console filter matches every column as rendered (F8)', () => {
  it('finds a shipment by pasting its id', () => {
    const { container } = render(<Console />);
    const target = rows()[3];

    setFilter(target.id);

    expect(container.textContent).toContain(target.id);
    expect(screen.getByText(`1 of ${totalShipments} house shipments`)).toBeTruthy();
  });

  it('finds the shipments on one consol', () => {
    render(<Console />);
    const expected = rows().filter(s => s.consol === 'CONSOL-B');
    expect(expected.length).toBeGreaterThan(0);

    setFilter('CONSOL-B');

    expect(screen.getByText(`${expected.length} of ${totalShipments} house shipments`)).toBeTruthy();
  });

  it('finds the shipments on one SLA tier', () => {
    render(<Console />);
    const expected = rows().filter(s => s.slaTier === 'premium');
    expect(expected.length).toBeGreaterThan(0);

    setFilter('premium');

    expect(screen.getByText(`${expected.length} of ${totalShipments} house shipments`)).toBeTruthy();
  });

  it('finds the constrained handful by the cargo word the register shows', () => {
    const { container } = render(<Console />);
    const expected = rows().filter(s => s.lithiumBattery);
    expect(expected.length).toBeGreaterThan(0);
    // The point of the fixture: constrained rows are a handful, not the bulk.
    expect(expected.length).toBeLessThan(totalShipments / 4);

    setFilter('lithium');

    expect(screen.getByText(`${expected.length} of ${totalShipments} house shipments`)).toBeTruthy();
    expect(container.textContent).toContain(expected[0].id);
  });

  it('stays case-insensitive and trimmed', () => {
    const { container } = render(<Console />);
    const target = rows()[3];

    setFilter(`  ${target.id.toLowerCase()}  `);

    expect(container.textContent).toContain(target.id);
    expect(screen.getByText(`1 of ${totalShipments} house shipments`)).toBeTruthy();
  });

  it('still matches by customer (unchanged behaviour)', () => {
    render(<Console />);
    const target = rows()[0];
    const expected = rows().filter(s => s.customer === target.customer);

    setFilter(target.customer);

    expect(screen.getByText(`${expected.length} of ${totalShipments} house shipments`)).toBeTruthy();
  });
});

/**
 * The register has to show the cargo facts a remedy can founder on before any agent has
 * proposed anything — that is what makes the constrained handful visible at rest, and what a
 * blocked alternative in the panel later refers back to.
 */
describe('Console shows cargo constraints and proposed remedies', () => {
  it('names the constraint on a flagged row and shows a dash on an unflagged one', () => {
    render(<Console />);
    const flagged = rows().find(s => s.lithiumBattery)!;
    setFilter(flagged.id);
    expect(screen.getByText('Lithium-ion')).toBeTruthy();

    const plain = rows().find(
      s => !s.lithiumBattery && !s.oversizeMainDeckOnly && !s.pharmaQualifiedLane
        && !s.activeTempControl && s.screeningStatus === 'cleared' && s.customsStatus === 'released',
    )!;
    setFilter(plain.id);
    expect(screen.queryByText('Lithium-ion')).toBeNull();
    expect(screen.getByLabelText('no cargo constraints')).toBeTruthy();
  });

  it('shows no remedy until one is proposed, then shows it with what it costs', () => {
    const target = rows()[5];
    render(<Console />);
    setFilter(target.id);
    expect(screen.getByLabelText('no remedy proposed yet')).toBeTruthy();

    act(() => {
      target.remedy = 'truck';
      target.remedyCost = 326;
      store.notify();
    });

    expect(screen.getByText('truck-and-fly')).toBeTruthy();
    expect(screen.getByText('€326')).toBeTruthy();

    // Leave the fixture as this suite found it — the store is a module singleton.
    act(() => {
      target.remedy = null;
      target.remedyCost = 0;
      store.notify();
    });
  });
});

/**
 * The "Edit a row" beat: a write straight to the live store, outside any tool and outside
 * Ladder, that bumps the same `version` the commit-time guard checks. Without the bump, a
 * proposal opened before it would apply against a record that has already moved.
 */
describe('Console external edit bumps the version the guard reads', () => {
  it('raises the version and changes a rendered field', () => {
    render(<Console />);
    const target = rows()[9];
    setFilter(target.id);

    const before = { version: target.version, revenue: target.revenueEur };
    fireEvent.click(screen.getByRole('button', { name: 'Marta edits this' }));

    expect(target.version).toBe(before.version + 1);
    expect(target.revenueEur).toBe(before.revenue + 25);
    expect(screen.getByText(`v${before.version + 1}`)).toBeTruthy();
  });
});

/**
 * The unit under the App-level round-trip test in `src/__tests__/App.test.tsx`. `ProofPage` is
 * only rendered while the proof tab is open, so `Console` is genuinely unmounted and remounted
 * every time a judge reads the problem tab and comes back — and both working controls have to
 * come back with it.
 *
 * The checkbox is the one that could fail on camera. `setBuggyToolEnabled` writes module state
 * in `domain/tools.ts` that no unmount clears, so a box seeded from `false` used to read "off"
 * while `propose_remedy` was still armed to rewrite an SLA tier at commit time.
 */
describe('Console keeps its working state across an unmount', () => {
  it('brings the filter and the buggy-tool box back on remount', () => {
    const target = rows()[3];
    const { unmount } = render(<Console />);

    setFilter(target.id);
    fireEvent.click(screen.getByLabelText(/Simulate a buggy tool/i));
    expect(screen.getByText(`1 of ${totalShipments} house shipments`)).toBeTruthy();

    unmount();
    render(<Console />);

    expect((screen.getByPlaceholderText(/Filter by/i) as HTMLInputElement).value).toBe(target.id);
    expect(screen.getByText(`1 of ${totalShipments} house shipments`)).toBeTruthy();
    expect((screen.getByLabelText(/Simulate a buggy tool/i) as HTMLInputElement).checked).toBe(true);
  });

  it('starts a fresh page load clean', () => {
    render(<Console />);
    expect((screen.getByPlaceholderText(/Filter by/i) as HTMLInputElement).value).toBe('');
    expect(screen.getByText(`${totalShipments} of ${totalShipments} house shipments`)).toBeTruthy();
    expect((screen.getByLabelText(/Simulate a buggy tool/i) as HTMLInputElement).checked).toBe(false);
  });
});

/**
 * The agent narrowing the register. This is the one change to this page that happens while the
 * operator's hands are still, so what is checked here is as much the disclosure as the filter:
 * who did it, that the record is untouched, and that one control gives the view back.
 *
 * Driven through `setRegisterView` — the seam `Console` actually reads — rather than through a
 * registered tool call. That the real `search_shipments` writes this seam, with these ids and
 * these words, is `domain/__tests__/register-view.test.ts`'s subject, and duplicating the fake
 * `modelContext` here would test that same wiring twice and this component's half not at all.
 */
describe('Console shows a view an agent set, and gives it back', () => {
  const lithium = () => rows().filter(s => s.lithiumBattery);
  const setAgentView = (ids: string[], words: string) => {
    act(() => setRegisterView({ toolName: 'search_shipments', ids, words }));
  };

  it('draws only the rows the agent searched, and still counts the whole register', () => {
    const { container } = render(<Console />);
    const shown = lithium();
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(totalShipments);

    setAgentView(shown.map(s => s.id), 'lithium-ion cargo');

    expect(screen.getByText(`${shown.length} of ${totalShipments} house shipments`)).toBeTruthy();
    expect(container.textContent).toContain(shown[0].id);
    const hidden = rows().find(s => !s.lithiumBattery)!;
    expect(container.textContent).not.toContain(hidden.id);
  });

  it('names who set the view, the tool, and what it matched', () => {
    render(<Console />);
    const shown = lithium();

    setAgentView(shown.map(s => s.id), 'lithium-ion cargo');

    const line = screen.getByRole('status');
    expect(line.textContent).toContain('The agent set this view');
    expect(line.textContent).toContain('search_shipments');
    expect(line.textContent).toContain('lithium-ion cargo');
    expect(line.textContent).toContain(`${shown.length} of ${totalShipments} rows`);
  });

  /** The honesty boundary, on the surface that could break it: the words next to a narrowed
   *  register must never read as rows having been altered or taken off it. */
  it('says the record is untouched and the rest are still on the register', () => {
    render(<Console />);
    const shown = lithium();
    const before = rows().map(s => ({ ...s }));

    setAgentView(shown.map(s => s.id), 'lithium-ion cargo');

    expect(screen.getByRole('status').textContent).toContain('Nothing was changed');
    expect(screen.getByRole('status').textContent).toContain('the rest are still on it');
    expect(rows().map(s => ({ ...s }))).toEqual(before);
  });

  it('returns to the whole register in one click', () => {
    render(<Console />);
    setAgentView(lithium().map(s => s.id), 'lithium-ion cargo');

    fireEvent.click(screen.getByRole('button', { name: `Show all ${totalShipments}` }));

    expect(screen.getByText(`${totalShipments} of ${totalShipments} house shipments`)).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  /** Two narrowings of one register, not two controls fighting over it. */
  it('lets the operator filter within the agent\'s view without clearing it', () => {
    render(<Console />);
    const shown = lithium();
    setAgentView(shown.map(s => s.id), 'lithium-ion cargo');

    setFilter(shown[0].id);

    expect(screen.getByText(`1 of ${totalShipments} house shipments`)).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('survives the round trip through the problem tab, as the filter box does', () => {
    const shown = lithium();
    const { unmount } = render(<Console />);
    setAgentView(shown.map(s => s.id), 'lithium-ion cargo');

    unmount();
    render(<Console />);

    expect(screen.getByText(`${shown.length} of ${totalShipments} house shipments`)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('search_shipments');
  });
});
