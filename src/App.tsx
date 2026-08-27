import { useEffect, useState } from 'react';
import { Console } from './ui/Console';
import { store } from './domain/store';
import { DISRUPTED_FLIGHT } from './domain/seed';
import { ProposalPanel } from './ui/ProposalPanel';
import { RungStrip } from './ui/RungStrip';
import { ActivityList } from './ui/ActivityList';
import { isWebmcpAvailable, onAvailabilityChange, registerWhenReady } from './webmcp/adapter';
import { registerDomainTools } from './domain/tools';

// Registers immediately if the namespace is already there (a Chrome flag build injects it
// before this runs), otherwise waits for a host that injects it a moment later — ChatGPT
// desktop's built-in browser does exactly that — and registers the instant it appears. See
// registerWhenReady's own doc comment in webmcp/adapter.ts.
registerWhenReady(registerDomainTools);

// A host that's about to inject the namespace shouldn't make the banner flash on first paint —
// see useShowBanner below.
const BANNER_GRACE_MS = 1500;

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
 *  including mid-grace-period (the effect cleanup cancels the pending timer). */
function useShowBanner(available: boolean): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (available) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), BANNER_GRACE_MS);
    return () => clearTimeout(t);
  }, [available]);
  return show;
}

function App() {
  const available = useWebmcpAvailable();
  const showBanner = useShowBanner(available);

  return (
    <div className="app-shell">
      <div className="app">
        <header className="app-header">
          <h1>Ladder</h1>
          <p className="app-subtitle">
            Every agent write comes here as a proof before it lands
          </p>
          <Docket />
          <hr className="rule" />
        </header>
        <main>
          {showBanner && <WebmcpBanner />}
          <RungStrip />
          <Console />
        </main>
      </div>
      <ActivityList />
      <ProposalPanel />
    </div>
  );
}

export default App;
