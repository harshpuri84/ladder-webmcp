// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { registerLadderTool as RegisterLadderTool, listReferrals as ListReferrals } from '../../webmcp/adapter';
import type { ROLES as Roles, setRole as SetRole } from '../../webmcp/authority';
import type { ProposalPanel as ProposalPanelType } from '../ProposalPanel';
import type { AuthorityStrip as AuthorityStripType } from '../AuthorityStrip';

const flush = () => new Promise(r => setTimeout(r, 0));

/**
 * The boundary as the operator meets it: a panel where some rows are theirs and some are not.
 * Driven through the real adapter and the real components, with a fake `document.modelContext`
 * installed before either is imported — the shape every adapter-facing suite here uses.
 *
 * The test tool writes `remedyCost` directly, because that is the field the adapter's own
 * `deltaOf` reads to get a record's money figure, and the money figure is the whole boundary.
 */
describe('ProposalPanel under a spend authority boundary', () => {
  let registerLadderTool: typeof RegisterLadderTool;
  let listReferrals: typeof ListReferrals;
  let ProposalPanel: typeof ProposalPanelType;
  let AuthorityStrip: typeof AuthorityStripType;
  let ROLES: typeof Roles;
  let setRole: typeof SetRole;
  const registered = new Map<string, { execute: (input: any) => Promise<any> }>();

  const CHEAP = 'HAWB-70003';
  const DEAR = 'HAWB-70004';

  beforeAll(async () => {
    (document as any).modelContext = {
      registerTool: (spec: any) => registered.set(spec.name, spec),
      unregisterTool: (name: string) => registered.delete(name),
    };
    ({ registerLadderTool, listReferrals } = await import('../../webmcp/adapter'));
    ({ ROLES, setRole } = await import('../../webmcp/authority'));
    ({ ProposalPanel } = await import('../ProposalPanel'));
    ({ AuthorityStrip } = await import('../AuthorityStrip'));

    registerLadderTool({
      name: 'authority_test_tool',
      description: 'Test-only: one row inside the limit, one row well over it.',
      inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } },
      async exec(_input: any, ctx: any) {
        ctx.db.shipments[CHEAP].remedy = 'rebook';
        ctx.db.shipments[DEAR].remedy = 'competitor';
        ctx.db.shipments[DEAR].remedyCost = ROLES[0].limit * 4;
        return { matched: 2 };
      },
    });
  });

  afterEach(() => cleanup());
  afterAll(() => {
    setRole(ROLES[0].id);
    delete (document as any).modelContext;
  });

  it('starts the costly row unticked and unmarkable, and counts the stamp against what is left', async () => {
    render(<ProposalPanel />);
    const result = registered.get('authority_test_tool')!.execute({});
    await act(async () => { await flush(); });

    // The costly row carries no control at all: it was never this operator's to mark.
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes).toHaveLength(1);
    expect(boxes[0].getAttribute('aria-label')).toBe(`Include ${CHEAP}`);
    // Everything the operator *can* decide still starts marked — narrowing stays their act.
    expect(boxes[0].checked).toBe(true);
    const referredRow = document.querySelector('.pp-refer .dg')!;
    expect(referredRow.textContent).toContain(DEAR);
    expect(referredRow.querySelector('input')).toBeNull();
    expect(referredRow.className).not.toContain('dg--struck');

    // "Apply 1" and "Refer 1", not "Apply 1 of 2": the second row was never theirs to strike out.
    const stamp = screen.getByRole('button', { name: /Apply/ });
    expect(stamp.textContent).toContain('Apply 1');
    expect(stamp.textContent).toContain('Refer 1 to duty manager');

    // One line at the top of the referred group says why, and whose decision it now is.
    const line = document.querySelector('.pp-refer-line')!.textContent!.replace(/\s+/g, ' ');
    expect(line).toBe(`1 shipment over your €${ROLES[0].limit} limit. The duty manager decides it.`);
    // Above the rows, not only forty lines down: the referred group precedes the operator's own.
    const rows = [...document.querySelectorAll('.pp-list .dg')];
    expect(rows[0].className).toContain('dg--referred');

    await act(async () => {
      fireEvent.click(stamp);
      await flush();
    });
    const payload = await result;
    expect(payload.applied).toBe(1);
    expect(payload.referred.count).toBe(1);
    expect(payload.referred.ids).toEqual([DEAR]);
  });

  it('offers the referred set to the second approver, and to nobody else', async () => {
    render(<AuthorityStrip />);
    expect(listReferrals()).toHaveLength(1);

    // As the gateway operator: visible, named, and inert.
    const waiting = screen.getByRole('button', { name: /Waiting on the duty manager/ }) as HTMLButtonElement;
    expect(waiting.disabled).toBe(true);

    // The roles sit behind the toolbar's own control; the switch comes out when it is opened.
    fireEvent.click(screen.getByRole('button', { name: /^Acting as/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Duty manager/ }));
      await flush();
    });

    const review = screen.getByRole('button', { name: /Review as duty manager/ }) as HTMLButtonElement;
    expect(review.disabled).toBe(false);
  });

  it('says plainly that the role switch is a demonstration, not a second signed-in person', () => {
    render(<AuthorityStrip />);
    fireEvent.click(screen.getByRole('button', { name: /^Acting as/ }));
    expect(screen.getByText(/switches the labelled role in this one browser/)).toBeTruthy();
    expect(screen.getByText(/nobody is signed in/)).toBeTruthy();
  });
});
