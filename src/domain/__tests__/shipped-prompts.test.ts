import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { seedShipments } from '../seed';
import { PROMPTS } from '../../ui/prompts';

/**
 * The proof tab hands a judge two prompts to say to an agent, and each one carries a note
 * claiming what will come back. A prompt whose claim is wrong is worse than no prompt at all:
 * the judge says it, gets something else, and stops trusting the page. The video sends them
 * straight here, so these two are the first thing anyone types.
 *
 * So the claim is held here, against the real tools driven through the real adapter. The mapping
 * from English to arguments is the one human judgement in this file and it is written out — each
 * prompt is said in the tools' own vocabulary ("propose a remedy" is `propose_remedy`; the consol
 * id is printed on the register and is the `consol` filter's own worked example; "carrying
 * lithium-ion batteries" is the `lithiumBattery` filter's own description) — which is what makes
 * the argument the agent fills in obvious rather than inferred. Everything downstream of that
 * call is asserted.
 *
 * The first case is the money demo: one consol, no remedy named. Four of its twenty-seven rows
 * cost more than a gateway operator may authorise, so four are referred to the duty manager and
 * the panel opens at twenty-three — which is the whole product in one call, and the thing the
 * block is there to get a judge to try inside thirty seconds.
 */
interface WriteCase {
  kind: 'write';
  prompt: string;
  /** The call the prompt describes. */
  call: Record<string, unknown>;
  /** Rows the proposal previews. */
  previewed: number;
  /** Rows applied when the operator stamps everything they are allowed to. */
  applied: number;
  /** Rows above a gateway operator's authority, referred rather than applied. */
  referred: number;
}

interface ReadCase {
  kind: 'read';
  prompt: string;
  call: Record<string, unknown>;
  /** Rows returned, and the rows the register is narrowed to — the same set, by contract. */
  rows: number;
  /** What the register prints after "showing", in the operator's words rather than the agent's. */
  words: string;
}

type Case = WriteCase | ReadCase;

const CASES: Case[] = [
  {
    kind: 'write',
    prompt: 'Propose a remedy for every shipment on CONSOL-A.',
    call: { consol: 'CONSOL-A' },
    previewed: 27,
    applied: 23,
    referred: 4,
  },
  {
    kind: 'read',
    prompt: 'Show me the shipments carrying lithium-ion batteries.',
    call: { lithiumBattery: true },
    rows: 2,
    words: 'lithium-ion cargo',
  },
];

describe('the prompts the proof tab ships reach the tools and do what they say', () => {
  const registered = new Map<string, any>();
  let reset = () => {};

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (s: any) => registered.set(s.name, s),
        unregisterTool: (n: string) => registered.delete(n),
      },
    };
    const { registerDomainTools } = await import('../tools');
    const { store } = await import('../store');
    registerDomainTools();
    // Each prompt is a judge's *first* call, so each case starts from an untouched register.
    // Restored field by field rather than by swapping the object: the host binding reads the
    // store's state through a getter and the panel holds records by reference.
    reset = () => {
      const fresh = seedShipments();
      for (const id of Object.keys(fresh)) Object.assign(store.state.shipments[id], fresh[id]);
    };
  });
  beforeEach(() => reset());
  afterAll(() => { delete (globalThis as any).document; });

  it('ships exactly the prompts these cases cover', () => {
    // Editing a prompt on the page without re-checking what it does fails here rather than in
    // front of a judge.
    expect(PROMPTS.map(p => p.text)).toEqual(CASES.map(c => c.prompt));
  });

  it('every prompt is said in the tool vocabulary that carries it to a tool', () => {
    const [remedy, search] = CASES;
    // `propose_remedy` and the `consol` filter's own worked example, verbatim.
    expect(remedy.prompt.toLowerCase()).toContain('remedy');
    expect(remedy.prompt).toContain('CONSOL-A');
    // `search_shipments` is the tool that changes what the operator is looking at, and
    // `lithiumBattery` describes itself as "shipments carrying standalone lithium-ion batteries".
    expect(search.prompt.toLowerCase()).toContain('show me');
    expect(search.prompt.toLowerCase()).toContain('lithium-ion batteries');
  });

  for (const c of CASES) {
    if (c.kind === 'write') {
      it(`“${c.prompt}” previews ${c.previewed} rows and refers ${c.referred}`, async () => {
        const { onProposal } = await import('../../webmcp/adapter');
        let off = () => {};
        const arrived = new Promise<any>(res => {
          off = onProposal((p: any) => {
            if (p && p.toolName === 'propose_remedy') { off(); res(p); }
          });
        });

        const result = registered.get('propose_remedy')!.execute(c.call);
        const proposal = await arrived;
        expect(proposal.diff.groups).toHaveLength(c.previewed);

        // The four the note calls "set apart" are set apart by the engine, before the operator
        // looks — not by the operator's own hand. Asserted as the referred set rather than as a
        // list of ids, so a fixture change moves the rows without falsifying the claim.
        const referred = new Set<string>(proposal.authority.referred);
        expect(referred.size).toBe(c.referred);

        // The operator keeps everything they are allowed to keep: what is left over is the
        // boundary biting, not their edit. This is the state the panel opens in.
        const authorisable = proposal.diff.groups.filter((g: any) => !referred.has(g.group));
        expect(authorisable).toHaveLength(c.applied);
        proposal.resolve({ groups: authorisable.map((g: any) => g.group), actions: [] });

        const payload = await result;
        expect(payload.applied).toBe(c.applied);
        expect(payload.referred.count).toBe(c.referred);
        expect(payload.referred.ids).toHaveLength(c.referred);
        expect(payload.applied + payload.rejected.reduce((n: number, r: any) => n + r.count, 0))
          .toBe(payload.requested);
      });
    } else {
      it(`“${c.prompt}” returns ${c.rows} rows and narrows the register to them`, async () => {
        const { registerView } = await import('../register-view');
        const result = await registered.get('search_shipments')!.execute(c.call);

        expect(result.rows).toHaveLength(c.rows);
        expect(result.total).toBe(c.rows);

        // The claim the note makes about the register: narrowed to exactly the rows the agent
        // was handed, named in the operator's words, and attributed to the tool that did it.
        const view = registerView();
        expect(view?.toolName).toBe('search_shipments');
        expect(view?.ids).toEqual(result.rows.map((r: any) => r.id));
        expect(view?.words).toBe(c.words);

        // "No record changes": a read tool writes nothing, and the total the register prints
        // above the table is still the whole flight rather than the narrowed set.
        const { store } = await import('../store');
        const all = Object.values(store.state.shipments);
        expect(all).toHaveLength(42);
        expect(all.every(s => s.remedy === null)).toBe(true);
      });
    }
  }
});
