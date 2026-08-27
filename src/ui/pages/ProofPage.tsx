import { useEffect, useState } from 'react';
import { Console } from '../Console';
import { store } from '../../domain/store';
import { DISRUPTED_FLIGHT } from '../../domain/seed';
import { RungStrip } from '../RungStrip';
import { AuthorityStrip } from '../AuthorityStrip';
import { isWebmcpAvailable, onAvailabilityChange } from '../../webmcp/adapter';

// A host that's about to inject the namespace shouldn't make the banner flash on first paint —
// see useShowBanner below.
const BANNER_GRACE_MS = 1500;

// Module scope, not component state: this page unmounts and remounts on every tab round-trip
// (it's only rendered while `tab === 'proof'`), and component state resets on remount while this
// doesn't — so the grace period runs once per page load, not once per visit to the tab. Without
// this, returning to the proof tab re-hid an already-known-unavailable banner for another
// 1.5s every time, which reads as a flicker rather than a deliberate first-load grace.
let graceElapsedOnce = false;

function WebmcpBanner() {
  return (
    <div className="webmcp-banner">
      <h2 className="webmcp-banner-heading">The agent half needs WebMCP — the console below works either way</h2>
      <p>
        This browser can't reach the four tools an agent would call, but every house shipment
        is still here to browse by hand. To turn the agent half on, open this page in one of:
      </p>
      <ul className="webmcp-banner-list">
        <li><strong>ChatGPT desktop's built-in browser</strong> — supports WebMCP with no setup.</li>
        <li>
          <strong>Google Chrome 149 or newer</strong> — enable{' '}
          <code className="webmcp-banner-code">chrome://flags/#enable-webmcp-testing</code>{' '}
          and restart. Paste this into your address bar — Chrome won't let a page link to a
          chrome:// URL directly.
        </li>
      </ul>
    </div>
  );
}

/**
 * The one thing every row on this page has in common, stated once at the top: a flight was
 * cancelled and these are the house shipments that were on it. Every figure is counted off the
 * fixture rather than written down beside it, so the docket cannot drift from the register
 * underneath it.
 */
function Docket() {
  const rows = Object.values(store.state.shipments);
  const customers = new Set(rows.map(s => s.customer)).size;
  const consols = new Set(rows.map(s => s.consol)).size;

  return (
    <p className="app-docket">
      <span className="app-docket-lead">Flight cancelled</span>
      <span className="app-docket-item mono">{DISRUPTED_FLIGHT.flightNumber}</span>
      <span className="app-docket-item">
        {DISRUPTED_FLIGHT.origin} to {DISRUPTED_FLIGHT.destination},{' '}
        {DISRUPTED_FLIGHT.cancelledDeparture}
      </span>
      <span className="app-docket-item mono">{DISRUPTED_FLIGHT.mawb}</span>
      <span className="app-docket-item">
        <span className="mono">{rows.length}</span> house shipments ·{' '}
        <span className="mono">{customers}</span> customers ·{' '}
        <span className="mono">{consols}</span> consols
      </span>
    </p>
  );
}

/** Re-renders whenever registerWhenReady/checkForWebmcp finds the namespace — not a value read
 *  once at import time, which would never notice a host injecting it after this module loads. */
function useWebmcpAvailable(): boolean {
  const [, setTick] = useState(0);
  useEffect(() => onAvailabilityChange(() => setTick(t => t + 1)), []);
  return isWebmcpAvailable();
}

/** Delays the banner by BANNER_GRACE_MS so a host that's about to inject the namespace doesn't
 *  make it flash on the first frame. Resets to hidden the instant availability turns true,
 *  including mid-grace-period (the effect cleanup cancels the pending timer). Once the grace
 *  period has genuinely elapsed once (`graceElapsedOnce`, module scope — see above), a later
 *  remount of this page shows the banner immediately instead of re-running the wait. */
function useShowBanner(available: boolean): boolean {
  const [show, setShow] = useState(() => graceElapsedOnce && !available);
  useEffect(() => {
    if (available) { setShow(false); return; }
    if (graceElapsedOnce) { setShow(true); return; }
    const t = setTimeout(() => { graceElapsedOnce = true; setShow(true); }, BANNER_GRACE_MS);
    return () => clearTimeout(t);
  }, [available]);
  return show;
}

/**
 * The console half of the page — everything the operator works from during a decision. The
 * docket lives here rather than in the shared header because it names the freight demo
 * specifically; the essay and reusability tabs have nothing to do with a cancelled flight.
 */
export function ProofPage() {
  const available = useWebmcpAvailable();
  const showBanner = useShowBanner(available);

  return (
    <main>
      <Docket />
      {showBanner && <WebmcpBanner />}
      <RungStrip />
      <AuthorityStrip />
      <Console />
    </main>
  );
}
