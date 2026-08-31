import { useEffect, useRef, useState } from 'react';
import type { Prompt } from './prompts';

/**
 * The line to say to an agent, in a cut well, with a control that puts it on the clipboard.
 *
 * Its own module because two surfaces print it and neither owns it: the proof sheet, where it
 * heads the page and repeats under the register as step 1, and the tool inventory behind the
 * chip, which is the only place a prompt appears at all on the other two tabs. Held in the
 * sheet it would have to be imported out of a page component to reach the pill, which is how a
 * page ends up owning something that is not a page.
 *
 * It carries the words and nothing else. What comes back of a prompt is stated exactly once,
 * wherever it is stated — by the step's own "You should see" line on the sheet, out of
 * `Prompt.note`.
 */

/** How long "Copied" stands before the button goes back to offering the copy. */
const COPIED_MS = 1600;

type CopyState = 'idle' | 'copied' | 'failed';

const COPY_WORD: Record<CopyState, string> = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Select it',
};

export function PromptRow({ text }: Pick<Prompt, 'text'>) {
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
