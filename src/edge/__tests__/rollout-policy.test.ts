import { describe, it, expect } from 'vitest';
import { checkMode, evaluateAllModes, exposedPct, recommendMode, RULES } from '../rollout-policy';
import { seedPops, seedReleases, CANDIDATE_RELEASE, UNSOAKED_RELEASE, totalTrafficPct } from '../seed';
import type { Pop } from '../types';

const pops = seedPops();
const releases = seedReleases();
const soaked = releases[CANDIDATE_RELEASE];
const fresh = releases[UNSOAKED_RELEASE];
const at = (id: string): Pop => pops[id];

describe('the fixture', () => {
  it('is 36 sites carrying exactly 100% of production traffic', () => {
    expect(Object.keys(pops)).toHaveLength(36);
    expect(totalTrafficPct(pops)).toBe(100);
  });
});

describe('the constraint layer names the rule that closed a site', () => {
  it('a change freeze closes both delivering modes and leaves shadow open', () => {
    const iad2 = at('iad2');
    expect(checkMode(iad2, soaked, 'staged')).toEqual({ status: 'blocked', rule: RULES.changeFreezeWindow });
    expect(checkMode(iad2, soaked, 'immediate')).toEqual({ status: 'blocked', rule: RULES.changeFreezeWindow });
    expect(checkMode(iad2, soaked, 'shadow')).toEqual({ status: 'open' });
    expect(recommendMode(iad2, soaked)?.mode).toBe('shadow');
  });

  it('an open incident closes every mode, so the site needs a person', () => {
    const cdg1 = at('cdg1');
    for (const m of ['shadow', 'staged', 'immediate'] as const) {
      expect(checkMode(cdg1, soaked, m)).toEqual({ status: 'blocked', rule: RULES.incidentInProgress });
    }
    expect(recommendMode(cdg1, soaked)).toBeNull();
  });

  it('a drained site closes every mode', () => {
    expect(recommendMode(at('fra2'), soaked)).toBeNull();
    expect(checkMode(at('fra2'), soaked, 'shadow').status).toBe('blocked');
  });

  it('a freeze plus no headroom to shadow leaves nothing at all open', () => {
    const sin1 = at('sin1');
    expect(checkMode(sin1, soaked, 'shadow')).toEqual({ status: 'blocked', rule: RULES.noHeadroomForShadow });
    expect(checkMode(sin1, soaked, 'staged')).toEqual({ status: 'blocked', rule: RULES.changeFreezeWindow });
    expect(recommendMode(sin1, soaked)).toBeNull();
  });

  it('a flagship never takes a release on every node at once', () => {
    expect(checkMode(at('ams1'), soaked, 'immediate')).toEqual({ status: 'blocked', rule: RULES.flagshipRequiresStage });
    expect(recommendMode(at('ams1'), soaked)?.mode).toBe('staged');
  });

  it('a one-node site has no tenth to hold back, so it goes all at once', () => {
    expect(checkMode(at('osl1'), soaked, 'staged')).toEqual({ status: 'blocked', rule: RULES.singleNodeNoSlice });
    expect(recommendMode(at('osl1'), soaked)?.mode).toBe('immediate');
  });

  it('a site behind the compatibility floor has to stage rather than jump', () => {
    expect(checkMode(at('bom1'), soaked, 'immediate')).toEqual({ status: 'blocked', rule: RULES.versionSkewFloor });
    expect(recommendMode(at('bom1'), soaked)?.mode).toBe('staged');
  });

  it('a release nothing has soaked cannot serve traffic outside the canary ring', () => {
    expect(checkMode(at('ams1'), fresh, 'staged')).toEqual({ status: 'blocked', rule: RULES.releaseNotSoaked });
    expect(recommendMode(at('ams1'), fresh)?.mode).toBe('shadow');
    // The canary ring is what the rule exists to except.
    expect(checkMode(at('arn1'), fresh, 'staged')).toEqual({ status: 'open' });
  });

  // bog1 is one node AND behind the floor: staged has no slice, immediate is barred by skew.
  it('a one-node site behind the floor falls all the way through to shadow', () => {
    expect(recommendMode(at('bog1'), soaked)?.mode).toBe('shadow');
  });
});

describe('exposure is a share of production traffic, not of the site', () => {
  it('scales the site share by how much of its fleet takes the release', () => {
    const ams1 = at('ams1'); // 9.1% of production traffic
    expect(exposedPct(ams1, 'immediate')).toBe(9.1);
    expect(exposedPct(ams1, 'staged')).toBe(0.91);
    expect(exposedPct(ams1, 'shadow')).toBe(0);
  });
});

describe('the read-tool landscape', () => {
  it('reports every mode with its figures and the rule closing any that are shut', () => {
    const modes = evaluateAllModes(at('iad2'), soaked);
    expect(modes.map(m => m.mode)).toEqual(['staged', 'immediate', 'shadow']);
    expect(modes.filter(m => m.open).map(m => m.mode)).toEqual(['shadow']);
    expect(modes.find(m => m.mode === 'staged')?.blockedBy?.id).toBe('change-freeze-window');
  });

  it('is pure — asking twice gives the same answer and changes nothing', () => {
    const before = JSON.stringify(at('ams1'));
    expect(evaluateAllModes(at('ams1'), soaked)).toEqual(evaluateAllModes(at('ams1'), soaked));
    expect(JSON.stringify(at('ams1'))).toBe(before);
  });
});
