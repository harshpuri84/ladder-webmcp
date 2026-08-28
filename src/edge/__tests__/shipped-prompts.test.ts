import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { seedPops } from '../seed';
import { PROMPTS } from '../ui/prompts';

/**
 * The plate hands a judge two prompts to say to an agent, and each one carries a note claiming
 * what will come back. A prompt whose claim is wrong is worse than no prompt at all: the judge
 * says it, gets something else, and stops trusting the panel.
 *
 * So the claim is held here, against the real tool driven through the real adapter. The mapping
 * from English to arguments is the one human judgement in this file and it is written out — the
 * prompts use the tool's own vocabulary (stage, release, site, region) and each names either the
 * whole estate or one of the seven `region` enum values, which is what makes the argument the
 * agent fills in obvious rather than inferred. Everything downstream of that call is asserted.
 *
 * The first case is the money demo: no filter, no mode. Seven of the thirty-six sites expose more
 * production traffic than a release engineer may authorise, so seven are referred to the traffic
 * lead — which is the whole product in one call, and the thing the plate is there to get a judge
 * to try inside thirty seconds.
 */
interface Case {
  prompt: string;
  /** The call the prompt describes. */
  call: Record<string, unknown>;
  /** Sites the drawer previews. */
  previewed: number;
  /** Sites applied when the operator latches everything they are allowed to. */
  applied: number;
  /** Sites above the release engineer's authority, referred rather than applied. */
  referred: string[];
}

const CASES: Case[] = [
  {
    prompt: 'Stage the candidate release at every site.',
    call: {},
    previewed: 30,
    applied: 23,
    // ams1 0.91, sjc1 0.76, lhr1 0.59, fra1 0.54 staged; osl1 1.00, hel1 0.80, eze1 0.60 have one
    // node each and no tenth to hold back, so they go all at once and expose their whole share.
    // Every one of the seven is above 0.50% of production traffic.
    referred: ['ams1', 'eze1', 'fra1', 'hel1', 'lhr1', 'osl1', 'sjc1'],
  },
  {
    prompt: 'Stage the candidate release in eu-north only.',
    call: { region: 'eu-north' },
    previewed: 4,
    applied: 2,
    referred: ['osl1', 'hel1'],
  },
];

describe('the prompts the plate ships reach the tool and do what they say', () => {
  const registered = new Map<string, any>();
  let reset = () => {};

  beforeAll(async () => {
    (globalThis as any).document = {
      modelContext: {
        registerTool: (s: any) => registered.set(s.name, s),
        unregisterTool: (n: string) => registered.delete(n),
      },
    };
    const { registerEdgeTools } = await import('../tools');
    const { edgeStore } = await import('../store');
    registerEdgeTools();
    // Each prompt is a judge's *first* call, so each case starts from an untouched estate.
    // Restored field by field rather than by swapping the object: the host binding reads the
    // store's state through a getter and the drawer holds records by reference.
    reset = () => {
      const fresh = seedPops();
      for (const id of Object.keys(fresh)) Object.assign(edgeStore.state.pops[id], fresh[id]);
    };
  });
  beforeEach(() => reset());
  afterAll(() => { delete (globalThis as any).document; });

  it('ships exactly the prompts these cases cover', () => {
    // Editing a prompt on the plate without re-checking what it does fails here rather than in
    // front of a judge.
    expect(PROMPTS.map(p => p.text)).toEqual(CASES.map(c => c.prompt));
  });

  it('every prompt names the tool this product is judged on', () => {
    for (const c of CASES) {
      expect(c.prompt.toLowerCase()).toContain('stage');
      expect(c.prompt.toLowerCase()).toContain('release');
    }
  });

  for (const c of CASES) {
    it(`“${c.prompt}” previews ${c.previewed} sites and refers ${c.referred.length}`, async () => {
      const { onProposal } = await import('../../webmcp/adapter');
      let off = () => {};
      const arrived = new Promise<any>(res => {
        off = onProposal((p: any) => { if (p && p.toolName === 'roll_config') { off(); res(p); } });
      });

      const result = registered.get('roll_config')!.execute(c.call);
      const proposal = await arrived;
      expect(proposal.diff.groups).toHaveLength(c.previewed);
      // The operator keeps everything: what is left over is the boundary biting, not their edit.
      proposal.resolve({ groups: proposal.diff.groups.map((g: any) => g.group), actions: [] });

      const payload = JSON.parse((await result).content[0].text);
      expect(payload.applied).toBe(c.applied);
      // Sorted on both sides: the on-page claim is that these sites are referred, not the order
      // the payload happens to list them in.
      expect([...(payload.referred?.ids ?? [])].sort()).toEqual([...c.referred].sort());
      expect(payload.referred?.awaiting).toBe(c.referred.length > 0 ? 'traffic lead' : undefined);
    });
  }
});
