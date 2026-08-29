import { useEffect, useRef, useState } from 'react';
import { Console } from '../Console';
import { store } from '../../domain/store';
import { DISRUPTED_FLIGHT } from '../../domain/seed';
import { RungStrip } from '../RungStrip';
import { AuthorityStrip } from '../AuthorityStrip';
import { PROMPTS, type Prompt } from '../prompts';
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
        {/*
          * Both bullets used to promise more than either route delivers. The first said ChatGPT's
          * browser "supports WebMCP with no setup", which is the announcement's wording and not
          * something anyone here has run. The second sent a judge through a flag dance that ends
          * in a page which still cannot be driven — the likeliest unprompted move on this page,
          * and the one that made it look broken. Each now says what is known and where it stops.
          */}
        <li>
          <strong>ChatGPT desktop's built-in browser</strong> — announced as supporting WebMCP
          with no setup. Announced, not verified here. It's the only route we know of to a browser
          that ships an agent able to call these tools.
        </li>
        <li>
          <strong>Google Chrome 149 or newer</strong> — enable{' '}
          <code className="webmcp-banner-code">chrome://flags/#enable-webmcp-testing</code>{' '}
          and restart. Paste this into your address bar — Chrome won't let a page link to a
          chrome:// URL directly. The flag registers this page's four tools; it does not bring an
          agent, and no shipping Chrome has one yet. So it gets you the toolset to inspect — the
          chip at the bottom left — and nothing that can call it.
        </li>
      </ul>
    </div>
  );
}

/** How long "Copied" stands before the button goes back to offering the copy. */
const COPIED_MS = 1600;

type CopyState = 'idle' | 'copied' | 'failed';

const COPY_WORD: Record<CopyState, string> = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Select it',
};

function PromptRow({ text, note }: Prompt) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);

  async function copy() {
    // A page served over plain http, or a browser with the clipboard permission denied, throws
    // here. The prompt is selectable text either way, so the button says so rather than failing
    // silently — a control that does nothing and reports nothing is the worse of the two.
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), COPIED_MS);
  }

  return (
    <li className="ag-prompt">
      <div className="ag-prompt-body">
        <span className="mono ag-prompt-text">{text}</span>
        <span className="ag-prompt-note">{note}</span>
      </div>
      <button
        className="ag-copy"
        type="button"
        onClick={() => { void copy(); }}
        aria-label={`Copy the prompt: ${text}`}
      >
        {/* The word changes, not a colour — the confirmation has to survive greyscale like
            everything else on this sheet. */}
        <span aria-live="polite">{COPY_WORD[state]}</span>
      </button>
    </li>
  );
}

/**
 * The two things to say to an agent, printed on the sheet itself.
 *
 * The video sends a judge straight to this tab, and until 29 August 2026 it gave them nothing to
 * say when they got here — they had to reconstruct a call from memory. The edge console has
 * carried its own version of this since it shipped; this is that idea in the freight console's
 * own grammar rather than the rack's, and the wording is held against the real tools by
 * `domain/__tests__/shipped-prompts.test.ts` so a prompt cannot drift from what it does.
 *
 * Set as a third imprint block on the same stock as the standing rules and the authority
 * boundary, and placed above both, because it is the thing to do first.
 */
function AskTheAgent() {
  return (
    <section className="ag" aria-labelledby="ag-heading">
      <h2 className="ag-heading" id="ag-heading">Ask the agent</h2>
      <p className="ag-lead">
        Say either of these to an agent driving this page. What it proposes arrives here as a
        proof you mark up before anything lands.
      </p>
      <ul className="ag-prompts">
        {PROMPTS.map(p => <PromptRow key={p.text} text={p.text} note={p.note} />)}
      </ul>
    </section>
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
      <AskTheAgent />
      <RungStrip />
      <AuthorityStrip />
      <Console />
    </main>
  );
}
