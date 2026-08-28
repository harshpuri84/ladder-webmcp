import { useEffect, useState } from 'react';
import { isWebmcpAvailable, onAvailabilityChange } from '../../webmcp/adapter';
import { edgeStore } from '../store';
import { CANDIDATE_RELEASE, totalTrafficPct } from '../seed';
import { pct1, rps } from './words';

/**
 * The head of the rack: what this instrument is on the left, what the estate reads on the right.
 * The readouts sit in cut windows divided by scored lines — no cards, because a card would make
 * four related measurements look like four unrelated ones.
 */
export function HeadPanel() {
  const [live, setLive] = useState(isWebmcpAvailable());
  useEffect(() => onAvailabilityChange(() => setLive(isWebmcpAvailable())), []);

  const pops = Object.values(edgeStore.state.pops);
  const traffic = totalTrafficPct(edgeStore.state.pops);
  const totalRps = pops.reduce((n, p) => n + p.rps, 0);

  return (
    <header className="hd">
      <div className="hd-id">
        <h1 className="hd-title">Edge Control</h1>
        <p className="hd-sub">Config rollout across the estate</p>
        <span className="hd-plate">Ladder engine · src/core</span>
      </div>

      <div className="hd-readouts">
        <div className="ro">
          <span className="lg">Sites</span>
          <span className="ro-val rd">{pops.length}</span>
        </div>
        <div className="ro">
          <span className="lg">Production traffic</span>
          <span className="ro-val rd">{pct1(traffic)}</span>
        </div>
        <div className="ro">
          <span className="lg">Requests / sec</span>
          <span className="ro-val rd">{rps(totalRps)}</span>
        </div>
        <div className="ro">
          <span className="lg">Candidate release</span>
          <span className="ro-val ro-val--sm rd">{CANDIDATE_RELEASE}</span>
        </div>
        <div className="ro">
          <span className="lg">WebMCP</span>
          <span className="hd-lamp">
            {/* The lamp never states this on its own: the word beside it says the same thing. */}
            <span className={live ? 'lamp lamp--lit' : 'lamp'} aria-hidden="true" />
            <span className="ro-val ro-val--sm rd">{live ? 'present' : 'absent'}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
