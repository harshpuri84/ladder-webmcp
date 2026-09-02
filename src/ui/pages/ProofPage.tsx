import { useEffect, useRef, useState } from 'react';
import { BuggyToolToggle, Console } from '../Console';
import { store } from '../../domain/store';
import { DISRUPTED_FLIGHT } from '../../domain/seed';
import { RungStrip } from '../RungStrip';
import { AuthorityStrip } from '../AuthorityStrip';
import { PROMPTS, type Prompt } from '../prompts';
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
function PromptRow({ text, children }: Pick<Prompt, 'text'> & { children?: React.ReactNode }) {
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

  // One object: the words, and the controls on them, sharing one rule. A well with a button
  // beside it and a link beside that was three kinds of thing in one row.
  return (
    <div className="ag-prompt">
      <span className="mono ag-prompt-text">{text}</span>
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
      {children}
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
 * as the figures everywhere else on this sheet.
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
      {step.control === 'buggy-tool' && <BuggyToolToggle />}
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

/** The walkthrough's own anchor, so the line at the head of the sheet can send a judge to it. */
const RUN_ID = 'run-it-yourself';

/**
 * Deliberately not an `href="#run-it-yourself"`. The tab lives in the hash (`useTab`), so an
 * in-page anchor would rewrite it to something no tab answers to and drop the judge on the
 * problem page mid-jump.
 */
function jumpToWalkthrough() {
  const el = document.getElementById(RUN_ID);
  if (el === null) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  // The section carries tabIndex={-1} so focus follows the view. Without this the next Tab
  // would carry on from up here, three thousand pixels above what the judge is now looking at.
  el.focus({ preventScroll: true });
}

/**
 * The one line at the head of the sheet: what to say, and where the rest of it is printed.
 *
 * The walkthrough itself sits under the register, because the register is the instrument and an
 * instrument leads — a judge who opens this page should be looking at the thing the video just
 * showed them, not at the top of a seven-step tutorial. But the free-prompt session is the
 * highest-variance surface here, and a judge who never finds a prompt never sees anything. So
 * the first prompt, and only the first prompt, is lifted out of the sequence and printed where
 * they land.
 *
 * It makes no claim of its own. The words are `PROMPTS[0]` itself, not a copy of them, and what
 * comes back of them is still stated exactly once — by step 1, below the register, out of the
 * prompt's own `note`.
 *
 * One row and a pointer. A judge who already knows what they want reads neither.
 */
function StartLine() {
  return (
    <section className="ag-start" aria-labelledby="ag-start-caps">
      <div className="ag-start-head">
        <span className="ag-start-caps" id="ag-start-caps">Say this to an agent</span>
        <PromptRow text={PROMPTS[0].text} />
        <button className="ag-start-jump" type="button" onClick={jumpToWalkthrough}>
          then the {STEPS.length} steps under the register
        </button>
      </div>
    </section>
  );
}

/**
 * The sequence, printed under the register.
 *
 * The video sends a judge straight to this tab, and until 29 August 2026 the only thing here was
 * two prompts to copy. Two prompts get a judge one call in and then leave them: the referral, the
 * second signer, the narrowed follow-up, the stale abort and the guard rolling a commit back all
 * sit *downstream* of that first call and none of them happen by themselves. So the walk is
 * printed out, one list, seven steps.
 *
 * **It sits under the register on purpose.** It spent 30 August 2026 above it, fourth in the
 * page and first in the eye, which put a tutorial where the instrument belonged. Everything from
 * the proposal onward is read here, after the thing it is about; the one move that comes before
 * any of it — the prompt that raises the first proposal — is lifted to `StartLine` at the head
 * of the sheet. That split is also the panel's: this section stays visible and readable while a
 * proposal is open, because the shell reserves the panel's width rather than covering the page,
 * and steps 2 and 3 are exactly the mid-decision ones.
 *
 * The fold the first version used is gone with the move. It existed to stop seven steps shouting
 * from the top of an instrument, and nothing under the register shouts at anybody.
 */
function RunItYourself() {
  return (
    <section className="ag" id={RUN_ID} tabIndex={-1} aria-labelledby="ag-heading">
      <h2 className="ag-heading" id="ag-heading">Run it yourself</h2>
      <p className="ag-lead">
        {STEPS.length} steps against an agent driving this page. Each says what to do and what
        should be on screen if it worked. The first is the prompt at the head of the sheet.
      </p>
      <ol className="ag-steps">
        {STEPS.map((step, i) => <StepRow key={step.title} step={step} n={i + 1} />)}
      </ol>
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

  // A title line, then the flight's particulars, then the counts as a row of their own. Not a
  // run of items divided by pipes: that wrapped at the panel's width and orphaned two counts
  // on a second line behind a leading pipe.
  return (
    <div className="app-docket">
      <div className="app-docket-head">
        <p className="app-docket-title">
          Flight <span className="mono">{DISRUPTED_FLIGHT.flightNumber}</span> cancelled
        </p>
        <p className="app-docket-route">
          {DISRUPTED_FLIGHT.origin} to {DISRUPTED_FLIGHT.destination},{' '}
          {DISRUPTED_FLIGHT.cancelledDeparture}
          <span className="app-docket-sep" aria-hidden="true">·</span>
          <span className="mono">{DISRUPTED_FLIGHT.mawb}</span>
        </p>
      </div>
      {/* Figures inside a run of words are set in the serif's own figures. Three counts of the
          freight and nothing else: the tool count is printed with the walkthrough, under the
          register, where the agent is driven from. */}
      <p className="app-docket-counts">
        <span className="app-docket-count">{rows.length} house shipments</span>
        <span className="app-docket-count">{customers} customers</span>
        <span className="app-docket-count">{consols} consols</span>
      </p>
    </div>
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
      <StartLine />
      <Console imprint={<><RungStrip /><AuthorityStrip /></>} />
      <RunItYourself />
    </main>
  );
}
