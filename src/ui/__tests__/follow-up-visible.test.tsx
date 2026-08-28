// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import type { registerLadderTool as RegisterLadderTool } from '../../webmcp/adapter';
import type { ProposalPanel as ProposalPanelType } from '../ProposalPanel';
import type { ActivityList as ActivityListType } from '../ActivityList';

const flush = () => new Promise(r => setTimeout(r, 0));

/**
 * The gap this closes: the payload already tells an agent which ids were refused and to come
 * back narrowed to them, and until now the page showed none of it — a judge watching the screen
 * saw a change land and a receipt, and had to read a terminal to see the loop close.
 *
 * So this suite watches the two surfaces a judge actually watches, driven through the real
 * adapter: the panel as it opens, and the run log across several calls. It asserts the sentence
 * appears where the relationship is real, and — the case that matters more — that neither
 * surface says anything at all where it is not.
 */
describe('the loop closing, on the page', () => {
  let registerLadderTool: typeof RegisterLadderTool;
  let ProposalPanel: typeof ProposalPanelType;
  let ActivityList: typeof ActivityListType;
  const registered = new Map<string, { execute: (input: any) => Promise<any> }>();

  const A = 'HAWB-70001';
  const B = 'HAWB-70002';
  const C = 'HAWB-70005';

  beforeAll(async () => {
    (document as any).modelContext = {
      registerTool: (spec: any) => registered.set(spec.name, spec),
      unregisterTool: (name: string) => registered.delete(name),
    };
    ({ registerLadderTool } = await import('../../webmcp/adapter'));
    ({ ProposalPanel } = await import('../ProposalPanel'));
    ({ ActivityList } = await import('../ActivityList'));

    registerLadderTool({
      name: 'followup_test_tool',
      description: 'Test-only: sets a remedy on exactly the shipments named by id.',
      inputSchema: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'string' } } },
        required: ['ids'],
      },
      async exec(input: { ids: string[] }, ctx: any) {
        for (const id of input.ids) ctx.db.shipments[id].remedy = 'truck';
        return { matched: input.ids.length };
      },
    });
  });

  afterEach(() => cleanup());
  afterAll(() => { delete (document as any).modelContext; });

  const call = (ids: string[]) => registered.get('followup_test_tool')!.execute({ ids });
  const flat = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('says nothing extra about a call that answers nothing', async () => {
    render(<ProposalPanel />);
    void call([C]);
    await act(async () => { await flush(); });

    expect(screen.getByText('followup_test_tool')).toBeTruthy();
    expect(document.querySelector('.pp-followup'), 'the panel invented a relationship').toBeNull();
    expect(flat(document.querySelector('.pp'))).not.toContain('Follows');

    // Leave nothing pending for the next case.
    await act(async () => {
      screen.getByRole('button', { name: /Refuse all/ }).click();
      await flush();
    });
  });

  it('states, on the panel and in the run log, which run a narrowed call answers', async () => {
    render(
      <>
        <ProposalPanel />
        <ActivityList />
      </>,
    );

    // The operator refuses both rows outright. That is the refusal the next call answers.
    void call([A, B]);
    await act(async () => { await flush(); });
    await act(async () => {
      screen.getByRole('button', { name: /Refuse all/ }).click();
      await flush();
    });

    // The same two rows, asked about again and nothing else.
    void call([A, B]);
    await act(async () => { await flush(); });

    const line = flat(document.querySelector('.pp-followup'));
    expect(line, 'the panel did not state the link').toMatch(
      /^Follows the \d{2}:\d{2} run — asks only about 2 rows the operator struck out\.$/,
    );

    // The run log carries it too, because the log is the surface a run of calls is read on.
    await act(async () => {
      screen.getByRole('button', { name: /Refuse all/ }).click();
      await flush();
    });
    const logged = [...document.querySelectorAll('.al-followup')].map(flat);
    expect(logged[0]).toMatch(
      /^Follows \d{2}:\d{2} — asks only about 2 rows the operator struck out$/,
    );
    // Exactly one line has it: the first of the two runs answered nothing.
    expect(logged.length).toBe(1);
  });
});
