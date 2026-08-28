import type { Pop } from '../types';
import { edgeStore } from '../store';
import { REGIONS } from '../seed';
import { modeWord, pct, pct1, rps } from './words';

/** The traffic graticule runs 0–10% of production traffic, which covers every site in the estate
 *  with the heaviest (9.1%) just inside the last division. Ticks every 2.5%. */
const SCALE_MAX_PCT = 10;
const TICKS = [25, 50, 75];

function Graticule({ trafficPct }: { trafficPct: number }) {
  return (
    <span className="gr" aria-hidden="true">
      {TICKS.map(t => <span className="gr-tick" key={t} style={{ left: `${t}%` }} />)}
      <span
        className="gr-bar"
        style={{ width: `${Math.min(100, (trafficPct / SCALE_MAX_PCT) * 100)}%` }}
      />
    </span>
  );
}

/**
 * The site's standing condition, as a legend whose FORM carries the meaning: hollow for a site
 * nothing is wrong with, hatched for one a rule has closed, struck through for one out of
 * rotation. The words are the same words the rules use. Remove every colour from this interface
 * and each of the four is still distinct.
 */
function Condition({ p }: { p: Pop }) {
  if (p.drained) {
    return <span className="st st--out">Drained</span>;
  }
  if (p.incidentId !== null) {
    return (
      <>
        <span className="st st--closed">Incident</span>{' '}
        <span className="rd rule-id">sev{p.incidentSeverity} {p.incidentId}</span>
      </>
    );
  }
  if (p.freezeUntil !== null) {
    return (
      <>
        <span className="st st--closed">Freeze</span>{' '}
        <span className="rd rule-id">{p.freezeLabel} to {p.freezeUntil}</span>
      </>
    );
  }
  if (p.canary) return <span className="st">Canary</span>;
  return <span className="st">Ready</span>;
}

function Rollout({ p }: { p: Pop }) {
  if (p.pendingVersion === null || p.rolloutMode === null) {
    return <span className="rd" style={{ color: 'var(--legend-dim)' }}>—</span>;
  }
  return (
    <>
      <span className="st st--staged">{modeWord[p.rolloutMode]}</span>
      <span className="rd pending-v">&nbsp; {p.pendingVersion}</span>
      <span className="rd" style={{ color: 'var(--legend-dim)' }}>
        &nbsp;·&nbsp; {pct(p.exposedPct)} exposed
      </span>
    </>
  );
}

function Row({ p }: { p: Pop }) {
  return (
    <tr>
      <td><span className="rd site-id">{p.id}</span></td>
      <td className="col-city site-city">{p.city}</td>
      <td className="col-graticule">
        <span className="tr-cell">
          <Graticule trafficPct={p.trafficPct} />
          <span className="rd tr-num">{pct1(p.trafficPct)}</span>
        </span>
      </td>
      <td className="col-rps num rd">{rps(p.rps)}</td>
      <td className="col-nodes num rd">{p.nodes}</td>
      <td className="col-util num rd">{p.utilisationPct}%</td>
      <td className="rd">{p.configVersion}</td>
      <td><Rollout p={p} /></td>
      <td><Condition p={p} /></td>
    </tr>
  );
}

/**
 * The rack. Six engraved bands, one dense row per site, and no card anywhere: the grouping is a
 * ruled band and a scored line, which is how a panel groups things.
 */
export function Rack() {
  const pops = Object.values(edgeStore.state.pops);

  return (
    <div className="rack">
      {REGIONS.map(region => {
        const rows = pops
          .filter(p => p.region === region)
          .sort((a, b) => b.trafficPct - a.trafficPct || a.id.localeCompare(b.id));
        const share = Math.round(rows.reduce((n, p) => n + p.trafficPct, 0) * 10) / 10;
        return (
          <section key={region}>
            <div className="band-head">
              <span className="band-name">{region}</span>
              <span className="band-meta rd">
                {rows.length} sites · {pct1(share)} of production traffic
              </span>
            </div>
            <table className="grid">
              <caption className="lg" style={{ position: 'absolute', left: '-9999px' }}>
                Points of presence in {region}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="c-site">Site</th>
                  <th scope="col" className="col-city c-city">City</th>
                  <th scope="col" className="col-graticule c-traffic">Traffic</th>
                  <th scope="col" className="col-rps c-rps num">Req / sec</th>
                  <th scope="col" className="col-nodes c-nodes num">Nodes</th>
                  <th scope="col" className="col-util c-util num">Util</th>
                  <th scope="col" className="c-running">Running</th>
                  <th scope="col" className="c-rollout">Rollout</th>
                  <th scope="col">Condition</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(p => <Row key={p.id} p={p} />)}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
