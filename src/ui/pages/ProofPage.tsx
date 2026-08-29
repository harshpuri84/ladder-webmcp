import { useEffect, useRef, useState } from 'react';
import { Console } from '../Console';
import { store } from '../../domain/store';
import { DISRUPTED_FLIGHT } from '../../domain/seed';
import { RungStrip } from '../RungStrip';
import { AuthorityStrip } from '../AuthorityStrip';
import { type Prompt } from '../prompts';
import { STEPS, type Step } from '../walkthrough';
import { ProofMark } from '../ProofMark';
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

/**
 * The line to say, and a control that puts it on the clipboard. What comes back of it is the
 * step's own "You should see" line — `Prompt.note`, rendered once by `StepRow` — so this row
 * carries the words to reproduce and nothing else.
 */
function PromptRow({ text }: Pick<Prompt, 'text'>) {
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
    <div className="ag-prompt">
      <div className="ag-prompt-body">
        <span className="mono ag-prompt-text">{text}</span>
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
    </div>
  );
}

/**
 * One numbered step: what to do, and what should be on screen if it worked.
 *
 * The second half is the part that earns its room. A judge who is not sure whether something
 * happened assumes it did not — so every step states its own outcome and is checkable without
 * anybody standing next to them.
 *
 * The number is set in a ruled box rather than as a list marker so it reads at the same weight
 * as the figures everywhere else on this sheet, and so the two lists (the first step, and the
 * six behind the fold) can carry on one sequence across the boundary between them.
 */
function StepRow({ step, n }: { step: Step; n: number }) {
  return (
    <li className="ag-step">
      <p className="ag-step-head">
        <span className="ag-step-n mono">{n}</span>
        <span className="ag-step-title">{step.title}</span>
      </p>
      <p className="ag-step-do">{step.action}</p>
      {step.prompt && <PromptRow text={step.prompt.text} />}
      {/* Every step ends the same way, prompt or no prompt. A prompt-carrying step's outcome is
          the prompt's own note — walkthrough.ts sets `seen` to exactly that string, so the claim
          about a call lives in one place and is held by one test. */}
      <p className="ag-step-seen">
        <span className="ag-step-seen-caps">You should see</span> {step.seen}
      </p>
      {step.demonstration && (
        // The dagger is the reference mark — set apart from the main run — which is what a
        // deliberate demonstration is. The word "demonstration" says it before the mark does
        // and the mark says it before the wash does; none of the three is a colour alone.
        <p className="ag-step-demo">
          <ProofMark name="dagger" size={12} />
          <span>
            <span className="ag-step-demo-caps">Deliberate demonstration</span>{' '}
            {step.demonstration}
          </span>
        </p>
      )}
    </li>
  );
}

/**
 * The sequence, printed on the sheet.
 *
 * The video sends a judge straight to this tab, and until 29 August 2026 the only thing here was
 * two prompts to copy. Two prompts get a judge one call in and then leave them: the referral, the
 * second signer, the narrowed follow-up, the stale abort and the guard rolling a commit back all
 * sit *downstream* of that first call and none of them happen by themselves. This is the same
 * block, grown into the walk — one list, not two, which is why the prompts moved inside it rather
 * than sitting above it repeating themselves.
 *
 * **It opens nearly shut on purpose.** The first step is the whole of the old block and stays in
 * the open; the other six are behind a fold. A judge who already knows what they want reads one
 * prompt and goes, exactly as before, and never has a seven-step tutorial shouting at them from
 * the top of an instrument. `<details>` rather than a toggle of our own: it is keyboard-operable,
 * findable by the browser's own in-page search, and needs no state.
 */
function RunItYourself() {
  const [first, ...rest] = STEPS;
  return (
    <section className="ag" aria-labelledby="ag-heading">
      <h2 className="ag-heading" id="ag-heading">Run it yourself</h2>
      <p className="ag-lead">
        {STEPS.length} steps against an agent driving this page. Each says what to do and what
        should be on screen if it worked. Nothing a tool asks for lands until you stamp it.
      </p>
      <ol className="ag-steps">
        <StepRow step={first} n={1} />
      </ol>
      <details className="ag-more">
        <summary className="ag-more-summary">
          The other {rest.length} steps — cut it down, apply it, refer what is over your limit to a
          second signer, and make the guard stop two things it should stop
        </summary>
        <ol className="ag-steps" start={2}>
          {rest.map((step, i) => <StepRow key={step.title} step={step} n={i + 2} />)}
        </ol>
      </details>
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
      <RunItYourself />
      <RungStrip />
      <AuthorityStrip />
      <Console />
    </main>
  );
}
