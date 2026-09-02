// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { BuggyToolToggle, Console, resetConsoleSession } from '../Console';
import { store } from '../../domain/store';
import { setRegisterView } from '../../domain/register-view';
import { setProofView } from '../proof-view';

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

  it('prints no remedy column until one has landed, then shows it with what it costs', () => {
    const target = rows()[5];
    render(<Console />);
    setFilter(target.id);
    // A column that would be empty on every row is not printed until it carries information.
    expect(screen.queryByRole('columnheader', { name: 'Remedy' })).toBeNull();
    expect(screen.queryByLabelText('no remedy proposed yet')).toBeNull();

    act(() => {
      target.remedy = 'truck';
      target.remedyCost = 326;
      store.notify();
    });

    expect(screen.getByRole('columnheader', { name: 'Remedy' })).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: `Marta edits this: ${target.id}` }));

    expect(target.version).toBe(before.version + 1);
    expect(target.revenueEur).toBe(before.revenue + 25);
    expect(screen.getByText(`v${before.version + 1}`)).toBeTruthy();
  });
});

/**
 * Forty-two rows, forty-two of the same control, and the same four visible words on each. A
 * screen-reader user tabbing the register hears the button's accessible name and nothing else,
 * so if that name is the visible text it is the same four words forty-two times over with no
 * way to tell which row is about to be edited.
 */
describe('Console external-edit controls are told apart by name', () => {
  it('names every one of them by its own shipment', () => {
    render(<Console />);
    const buttons = screen.getAllByRole('button', { name: /^Marta edits this: / });
    expect(buttons).toHaveLength(rows().length);

    const names = buttons.map(b => b.getAttribute('aria-label'));
    expect(new Set(names).size).toBe(names.length);
    for (const s of rows()) expect(names).toContain(`Marta edits this: ${s.id}`);
  });

  /**
   * WCAG 2.5.3: the accessible name has to start with what is written on the control, or a
   * voice-control user saying the words they can see reaches nothing.
   */
  it('keeps the visible words at the head of the name', () => {
    render(<Console />);
    for (const b of screen.getAllByRole('button', { name: /^Marta edits this: / })) {
      expect(b.getAttribute('aria-label')?.startsWith(b.textContent ?? '')).toBe(true);
    }
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
    // The switch prints at the walkthrough step that uses it, not in the register; both read
    // the same page-load cell, so they are mounted together here the way the page mounts them.
    const { unmount } = render(<><Console /><BuggyToolToggle /></>);

    setFilter(target.id);
    fireEvent.click(screen.getByLabelText(/Simulate a buggy tool/i));
    expect(screen.getByText(`1 of ${totalShipments} house shipments`)).toBeTruthy();

    unmount();
    render(<><Console /><BuggyToolToggle /></>);

    expect((screen.getByPlaceholderText(/Filter by/i) as HTMLInputElement).value).toBe(target.id);
    expect(screen.getByText(`1 of ${totalShipments} house shipments`)).toBeTruthy();
    expect((screen.getByLabelText(/Simulate a buggy tool/i) as HTMLInputElement).checked).toBe(true);
  });

  it('starts a fresh page load clean', () => {
    render(<><Console /><BuggyToolToggle /></>);
    expect((screen.getByPlaceholderText(/Filter by/i) as HTMLInputElement).value).toBe('');
    expect(screen.getByText(`All ${totalShipments} house shipments`)).toBeTruthy();
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

    expect(screen.getByText(`All ${totalShipments} house shipments`)).toBeTruthy();
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

/**
 * The register knows a proposal is open. The panel publishes what its sheet says about each
 * row (see `proof-view.ts`) and the register draws it on the row: a mark, a word behind the
 * mark, and a class the row's left-edge rule hangs off. None of it is a colour alone, and none
 * of it subscribes to the adapter, so it cannot race the panel for a buffered proposal.
 */
describe('Console marks the rows the open proof touches', () => {
  afterEach(() => setProofView(null));

  it('draws marked, struck and referred rows, and clears them when the sheet closes', () => {
    const { container } = render(<Console />);
    const [a, b, c] = rows();
    act(() => setProofView({
      proposalId: 'p1',
      rows: new Map([
        [a.id, { state: 'marked', remedy: 'rebook', cost: 0 }],
        [b.id, { state: 'struck', remedy: 'rebook', cost: 0 }],
        [c.id, { state: 'referred', remedy: 'truck', cost: 326 }],
      ]),
    }));

    const rowOf = (id: string) =>
      [...container.querySelectorAll('tbody tr')].find(tr => tr.textContent!.includes(id))!;
    expect(rowOf(a.id).classList.contains('console-row--marked')).toBe(true);
    expect(rowOf(b.id).classList.contains('console-row--struck')).toBe(true);
    expect(rowOf(c.id).classList.contains('console-row--referred')).toBe(true);
    expect(rowOf(a.id).textContent).toContain('marked on the open proof');
    expect(rowOf(b.id).textContent).toContain('struck out on the open proof');
    expect(rowOf(c.id).textContent).toContain('referred on the open proof');
    expect(container.querySelectorAll('.console-row-mark')).toHaveLength(3);

    act(() => setProofView(null));
    expect(container.querySelectorAll('.console-row-mark')).toHaveLength(0);
  });
});
