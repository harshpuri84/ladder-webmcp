import type { Pop, Release } from './types';

/**
 * The fixture is a manifest, not a random draw. Every figure below is written out so a reviewer
 * can read it rather than run it — the same discipline the freight fixture keeps, for the same
 * reason: a flag that landed somewhere implausible is the first thing a reader from this trade
 * notices, and it makes every other figure suspect.
 *
 * No real company appears anywhere. The site codes are the airport-code convention every network
 * uses for a point of presence; the operator names, incident ids, rotations and releases are
 * invented.
 */

/** The release the on-call engineer is trying to get out tonight. */
export const CANDIDATE_RELEASE = '2026.08.27-1';

/** A second release, cut this morning and not yet carried by any canary — the one that makes
 *  `release-not-soaked` reachable from a real call rather than only from a unit test. */
export const UNSOAKED_RELEASE = '2026.08.28-1';

export const REGIONS = ['eu-west', 'eu-north', 'na-east', 'na-west', 'apac', 'latam'] as const;

/** Which rotation carries the pager for each region. */
const ONCALL: Record<string, string> = {
  'eu-west': 'edge-eu-primary',
  'eu-north': 'edge-eu-primary',
  'na-east': 'edge-na-primary',
  'na-west': 'edge-na-primary',
  apac: 'edge-apac-primary',
  latam: 'edge-latam-primary',
};

/**
 * One row per site. `traffic` is a share of all production traffic and the 36 rows sum to 100.0
 * exactly, which is what lets the exposure meter read as a share of the whole rather than as an
 * arbitrary index.
 */
interface SeedRow {
  id: string; city: string; region: string;
  traffic: number; nodes: number; util: number; running: string;
  canary?: true;
  drained?: true;
  freeze?: [label: string, until: string];
  incident?: [id: string, severity: number];
}

const ROWS: SeedRow[] = [
  // eu-west — 31.0% of production traffic. ams1, lhr1 and fra1 are flagships.
  { id: 'ams1', city: 'Amsterdam', region: 'eu-west', traffic: 9.1, nodes: 48, util: 71, running: '2026.08.19-3' },
  { id: 'ams2', city: 'Amsterdam', region: 'eu-west', traffic: 2.0, nodes: 12, util: 58, running: '2026.08.19-3' },
  { id: 'lhr1', city: 'London', region: 'eu-west', traffic: 5.9, nodes: 34, util: 64, running: '2026.08.19-3' },
  { id: 'lhr2', city: 'London', region: 'eu-west', traffic: 1.7, nodes: 10, util: 49, running: '2026.08.12-1' },
  { id: 'cdg1', city: 'Paris', region: 'eu-west', traffic: 3.4, nodes: 20, util: 77, running: '2026.08.19-3', incident: ['INC-4471', 2] },
  { id: 'dub1', city: 'Dublin', region: 'eu-west', traffic: 1.1, nodes: 6, util: 41, running: CANDIDATE_RELEASE, canary: true },
  { id: 'fra1', city: 'Frankfurt', region: 'eu-west', traffic: 5.4, nodes: 30, util: 69, running: '2026.08.19-3' },
  { id: 'fra2', city: 'Frankfurt', region: 'eu-west', traffic: 2.4, nodes: 14, util: 0, running: '2026.08.12-1', drained: true },

  // eu-north — 4.6%. hel1 and osl1 are single-node sites; arn1 is the second canary.
  { id: 'arn1', city: 'Stockholm', region: 'eu-north', traffic: 1.3, nodes: 8, util: 44, running: '2026.08.19-3', canary: true },
  { id: 'hel1', city: 'Helsinki', region: 'eu-north', traffic: 0.8, nodes: 1, util: 52, running: '2026.08.19-3' },
  { id: 'osl1', city: 'Oslo', region: 'eu-north', traffic: 1.0, nodes: 1, util: 47, running: '2026.08.19-3' },
  { id: 'cph1', city: 'Copenhagen', region: 'eu-north', traffic: 1.5, nodes: 8, util: 55, running: '2026.08.19-3' },

  // na-east — 21.3%, and the whole region is inside a quarter-close change freeze. iad1 is a
  // flagship; mia1 and yyz1 are behind the compatibility floor.
  { id: 'iad1', city: 'Ashburn', region: 'na-east', traffic: 8.4, nodes: 44, util: 82, running: '2026.08.19-3', freeze: ['quarter-close freeze', '2026-09-02'] },
  { id: 'iad2', city: 'Ashburn', region: 'na-east', traffic: 3.0, nodes: 18, util: 66, running: '2026.08.19-3', freeze: ['quarter-close freeze', '2026-09-02'] },
  { id: 'ewr1', city: 'Newark', region: 'na-east', traffic: 3.9, nodes: 22, util: 73, running: '2026.08.19-3', freeze: ['quarter-close freeze', '2026-09-02'] },
  { id: 'atl1', city: 'Atlanta', region: 'na-east', traffic: 2.6, nodes: 16, util: 61, running: '2026.08.19-3', freeze: ['quarter-close freeze', '2026-09-02'] },
  { id: 'yyz1', city: 'Toronto', region: 'na-east', traffic: 1.8, nodes: 10, util: 57, running: '2026.05.28-2', freeze: ['quarter-close freeze', '2026-09-02'] },
  { id: 'mia1', city: 'Miami', region: 'na-east', traffic: 1.6, nodes: 9, util: 60, running: '2026.06.11-1', freeze: ['quarter-close freeze', '2026-09-02'] },

  // na-west — 20.0%. sjc1 is a flagship, sjc2 is drained, sea1 has an incident open.
  { id: 'sjc1', city: 'San Jose', region: 'na-west', traffic: 7.6, nodes: 40, util: 74, running: '2026.08.19-3' },
  { id: 'sjc2', city: 'San Jose', region: 'na-west', traffic: 2.2, nodes: 12, util: 0, running: '2026.08.12-1', drained: true },
  { id: 'sea1', city: 'Seattle', region: 'na-west', traffic: 2.9, nodes: 18, util: 68, running: '2026.08.19-3', incident: ['INC-4468', 3] },
  { id: 'lax1', city: 'Los Angeles', region: 'na-west', traffic: 4.0, nodes: 24, util: 86, running: '2026.08.19-3' },
  { id: 'dfw1', city: 'Dallas', region: 'na-west', traffic: 2.1, nodes: 12, util: 63, running: '2026.08.19-3' },
  { id: 'den1', city: 'Denver', region: 'na-west', traffic: 1.2, nodes: 6, util: 51, running: '2026.08.19-3' },

  // apac — 17.4%. sin1 is inside a peak freeze *and* at 91% utilisation, which is the one
  // combination that closes every mode: nothing may serve during the freeze and there is no
  // headroom to shadow either. That site needs a person, and the tool says so by name.
  { id: 'sin1', city: 'Singapore', region: 'apac', traffic: 4.8, nodes: 28, util: 91, running: '2026.08.19-3', freeze: ['apac peak freeze', '2026-08-31'] },
  { id: 'sin2', city: 'Singapore', region: 'apac', traffic: 1.8, nodes: 10, util: 62, running: '2026.08.19-3', freeze: ['apac peak freeze', '2026-08-31'] },
  { id: 'nrt1', city: 'Tokyo', region: 'apac', traffic: 3.4, nodes: 20, util: 70, running: '2026.08.19-3' },
  { id: 'hkg1', city: 'Hong Kong', region: 'apac', traffic: 2.5, nodes: 14, util: 65, running: '2026.08.19-3', freeze: ['apac peak freeze', '2026-08-31'] },
  { id: 'syd1', city: 'Sydney', region: 'apac', traffic: 2.2, nodes: 12, util: 59, running: '2026.08.19-3' },
  { id: 'bom1', city: 'Mumbai', region: 'apac', traffic: 1.4, nodes: 8, util: 72, running: '2026.06.11-1' },
  { id: 'icn1', city: 'Seoul', region: 'apac', traffic: 1.3, nodes: 8, util: 56, running: '2026.08.19-3' },

  // latam — 5.7%. eze1 and bog1 are single-node sites.
  { id: 'gru1', city: 'São Paulo', region: 'latam', traffic: 2.8, nodes: 16, util: 67, running: '2026.08.19-3' },
  { id: 'gru2', city: 'São Paulo', region: 'latam', traffic: 0.8, nodes: 4, util: 43, running: '2026.08.12-1' },
  { id: 'scl1', city: 'Santiago', region: 'latam', traffic: 0.9, nodes: 4, util: 48, running: '2026.08.19-3' },
  { id: 'eze1', city: 'Buenos Aires', region: 'latam', traffic: 0.6, nodes: 1, util: 39, running: '2026.08.19-3' },
  { id: 'bog1', city: 'Bogotá', region: 'latam', traffic: 0.6, nodes: 1, util: 45, running: '2026.06.11-1' },
];

/**
 * Requests per second, derived from the traffic share rather than invented separately, so the
 * two figures on a site's row can never disagree with each other. 1.4 million requests a second
 * across the estate is the round number this fixture is scaled to; it is illustrative, and the
 * interface says so.
 */
export const ESTATE_RPS = 1_400_000;
const rpsFor = (trafficPct: number) => Math.round((ESTATE_RPS * trafficPct) / 100);

export function seedPops(): Record<string, Pop> {
  const out: Record<string, Pop> = {};
  for (const r of ROWS) {
    out[r.id] = {
      id: r.id,
      city: r.city,
      region: r.region,
      trafficPct: r.traffic,
      rps: rpsFor(r.traffic),
      nodes: r.nodes,
      utilisationPct: r.util,
      configVersion: r.running,
      canary: r.canary === true,
      drained: r.drained === true,
      freezeLabel: r.freeze?.[0] ?? null,
      freezeUntil: r.freeze?.[1] ?? null,
      incidentId: r.incident?.[0] ?? null,
      incidentSeverity: r.incident?.[1] ?? 0,
      oncall: ONCALL[r.region],
      pendingVersion: null,
      rolloutMode: null,
      exposedPct: 0,
      convergeMinutes: 0,
      blockedModes: [],
      version: 1,
    };
  }
  return out;
}

export function seedReleases(): Record<string, Release> {
  return {
    [CANDIDATE_RELEASE]: {
      id: CANDIDATE_RELEASE,
      summary: 'Raise the origin-shield connect timeout and drop the legacy TLS session cache.',
      // dub1 is the canary and is already serving it, which is what makes it eligible to go
      // anywhere else at all.
      soakedOn: 'dub1',
      cut: '2026-08-27',
    },
    [UNSOAKED_RELEASE]: {
      id: UNSOAKED_RELEASE,
      summary: 'Revert the TLS session cache removal and add a per-route override.',
      soakedOn: null,
      cut: '2026-08-28',
    },
  };
}

/** Total production traffic the estate answers, as a percentage. 100.0 by construction, read
 *  back off the fixture rather than asserted, so a row edited later cannot make the meter lie. */
export const totalTrafficPct = (pops: Record<string, Pop>) =>
  Math.round(Object.values(pops).reduce((n, p) => n + p.trafficPct, 0) * 10) / 10;
