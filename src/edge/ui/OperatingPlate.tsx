import { useEffect, useRef, useState } from 'react';
import { isWebmcpAvailable, onAvailabilityChange } from '../../webmcp/adapter';
import { edgeStore } from '../store';
import { CANDIDATE_RELEASE } from '../seed';
import { PROMPTS, type Prompt } from './prompts';

/**
 * The engraved instruction plate, riveted under the head of the rack.
 *
 * A rack panel that needs explaining carries the explanation on its own face. This is not an
 * overlay, not a tour and not dismissible: a plate is as permanent as the instrument it is bolted
 * to, and a judge who arrives at minute ten needs it as much as one who arrives at minute zero.
 * It answers the three things the first thirty seconds have to answer — what the estate is, what
 * to say to an agent, and whether this browser can carry one — in the panel's own grammar of cut
 * windows, silkscreen legends and readout type.
 */

/**
 * A host that is about to inject the namespace should not make the plate say "absent" on the
 * first frame and take it back a moment later. Same grace the freight console keeps, for the same
 * host: ChatGPT desktop's built-in browser installs `document.modelContext` shortly after load.
 */
const RUNTIME_GRACE_MS = 1500;

/**
 * Module scope, not component state. StrictMode mounts this twice in development and a host that
 * is already known to have no runtime should not buy a second grace period for it.
 */
let graceElapsedOnce = false;

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
    <li className="pl-prompt">
      <span className="pl-prompt-body">
        <span className="pl-prompt-text rd">{text}</span>
        <span className="pl-prompt-note">{note}</span>
      </span>
      <button
        className="au-btn pl-copy"
        type="button"
        onClick={() => { void copy(); }}
        aria-label={`Copy the prompt: ${text}`}
      >
        {/* The word changes, not a colour — the confirmation has to survive greyscale like
            everything else on this panel. */}
        <span aria-live="polite">{COPY_WORD[state]}</span>
      </button>
    </li>
  );
}

/** Re-reads on every availability change rather than caching a value from import time, which
 *  would never notice a host injecting the namespace after this module loaded. */
function useRuntime(): 'present' | 'checking' | 'absent' {
  const [, setTick] = useState(0);
  useEffect(() => onAvailabilityChange(() => setTick(t => t + 1)), []);
  const available = isWebmcpAvailable();

  const [settled, setSettled] = useState(() => graceElapsedOnce);
  useEffect(() => {
    if (available || graceElapsedOnce) return;
    const t = setTimeout(() => { graceElapsedOnce = true; setSettled(true); }, RUNTIME_GRACE_MS);
    return () => clearTimeout(t);
  }, [available]);

  if (available) return 'present';
  return settled ? 'absent' : 'checking';
}

/**
 * The runtime row. The head panel's lamp says present or absent at a glance; this says what to do
 * about it. A judge without the flag would otherwise meet a panel that never moves and never
 * learns why, which is the whole product hidden behind a door they did not know was shut.
 *
 * The state is carried by the legend's *form* first — hollow for ready, hatched for closed by a
 * rule — exactly as every other state on this instrument is. The hue only agrees.
 */
function RuntimeRow() {
  const runtime = useRuntime();

  return (
    <div className="pl-rt">
      <span className={runtime === 'absent' ? 'st st--closed' : 'st'}>
        {runtime === 'present' ? 'Runtime present' : runtime === 'absent' ? 'Runtime absent' : 'Runtime · checking'}
      </span>

      <div className="pl-rt-body">
        {runtime === 'present' && (
          <p className="pl-rt-text">
            The four tools are registered with this browser. Say either prompt above to an agent
            driving this page and the bench drawer opens on what it proposed.
          </p>
        )}

        {runtime === 'checking' && (
          <p className="pl-rt-text">Looking for a WebMCP runtime in this browser.</p>
        )}

        {runtime === 'absent' && (
          <>
            <p className="pl-rt-text">
              This browser cannot reach the four tools, so nothing on this page will move on its
              own. The rack below still reads. Two ways to get a runtime:
            </p>
            {/*
              * Both routes are stated to their real limit. This plate carried the freight
              * console's wording verbatim, including its two overstatements: ChatGPT's browser
              * "supports WebMCP with no setup" is the announcement's claim and not one anyone
              * here has run, and the Chrome flag registers the tools without bringing anything
              * that can call them. A judge who does the flag dance and finds a rack that still
              * will not move reads that as a broken build.
              */}
            <ul className="pl-routes">
              <li className="pl-route">
                <b>ChatGPT desktop’s built-in browser</b> — announced as supporting WebMCP with no
                setup; announced, not verified here. It is the only route we know of to a browser
                that ships an agent able to call these tools. Open this page inside it.
              </li>
              <li className="pl-route">
                <b>Google Chrome 149 or newer</b> — enable{' '}
                <span className="pl-flag rd">chrome://flags/#enable-webmcp-testing</span> and
                restart. Paste that into the address bar; Chrome will not let a page link to a
                chrome:// URL. The flag registers the four tools and nothing more: no shipping
                Chrome carries an agent to call them, so the rack reads and the drawer stays shut.
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export function OperatingPlate() {
  const sites = Object.keys(edgeStore.state.pops).length;

  return (
    <section className="pl" aria-label="What this instrument is and how to drive it">
      <div className="pl-row">
        <div className="pl-cell pl-what">
          <span className="lg">This instrument</span>
          <p className="pl-text">
            One candidate release, <span className="rd">{CANDIDATE_RELEASE}</span>, and{' '}
            <span className="rd">{sites}</span> points of presence answering production traffic.
            An agent proposes the whole rollout in a single call; the bench drawer opens over the
            rack and nothing leaves this page until you unlatch the sites you will not take and
            commit the rest.
          </p>
        </div>

        <div className="pl-cell pl-ask">
          <span className="lg">Ask the agent</span>
          <ul className="pl-prompts">
            {PROMPTS.map(p => <PromptRow key={p.text} text={p.text} note={p.note} />)}
          </ul>
        </div>
      </div>

      <RuntimeRow />
    </section>
  );
}
