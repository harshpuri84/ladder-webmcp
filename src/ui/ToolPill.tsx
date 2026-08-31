import { useEffect, useState } from 'react';
import { activePolicy, listTools, onToolsChange } from '../webmcp/adapter';
import type { ToolSummary } from '../webmcp/adapter';
import { currentRole, describeAuthority } from '../webmcp/authority';
// Side-effect import: `domain/store.ts` is where this product hands the adapter its host
// binding, and the binding is what carries the roles and the words this pill prints. Rendered on
// its own — in a suite, or on a page that mounts nothing else from the domain — nothing else in
// this module's graph reaches it, and the boundary would print in no product's language.
import '../domain/store';
import { NEVER_ELIGIBLE } from '../domain/policy-eligibility';
import { ProofMark } from './ProofMark';
import type { MarkName } from './ProofMark';

/**
 * The agent's side of the glass, made visible.
 *
 * Everything else on this page is the human's view of a change. This is the one surface that
 * shows the other half: which tools this page has handed the browser, and what each one's
 * description currently says it may do. It exists because Ladder's autonomy claim is otherwise
 * invisible — ratifying a standing rule rewrites the tool's own description so the agent can
 * read what it is newly allowed to do without asking, and until now nothing on screen showed
 * that sentence appearing.
 *
 * It reads the registry; it never writes to it. Nothing here is a control.
 */

interface Standing {
  mark: MarkName;
  words: string;
}

/**
 * The four states a registered tool can be in, each carried by a different *shape* rather than
 * a different colour — the operator this is built for has red-green colour vision deficiency,
 * so a legend distinguished by hue would collapse to one swatch. The marks are the proofreader's
 * own vocabulary and each already means this:
 *
 *  stet         — let it stand. The tool changes nothing, so there is nothing to correct.
 *  registration — the target printed outside the trim. It is what the press aligns the sheet
 *                 to, and it is never part of the printed work: exactly a tool that sets what
 *                 the operator is looking at without touching a record.
 *  dagger       — set apart from the main run. Never automatic, whatever rules exist.
 *  insert       — this correction goes in. A ratified rule lands it without review.
 *  query        — "Qy?", passed to whoever can settle it. Every change waits for a human.
 */
function standingOf(t: ToolSummary): Standing {
  // Before the plain read case, not after: this tool is read-only too, and the honest account
  // of it is the narrower one.
  if (t.changesTheView) {
    return { mark: 'registration', words: 'reads only — sets what your register shows' };
  }
  if (t.readOnly) return { mark: 'stet', words: 'reads only — changes nothing' };
  if (NEVER_ELIGIBLE.includes(t.name)) {
    return { mark: 'dagger', words: 'never automatic — always reviewed' };
  }
  const pol = activePolicy(t.name);
  // Deliberately does not repeat the rule's terms. They are already in the description two
  // lines below, in the words the agent itself reads; saying them twice made this line long
  // enough to overrun its column and taught the reader nothing the paragraph did not.
  if (pol?.ratified) return { mark: 'insert', words: 'standing rule in force' };
  return { mark: 'query', words: 'every change reviewed first' };
}

function ToolRow({ tool }: { tool: ToolSummary }) {
  const { mark, words } = standingOf(tool);
  return (
    <li className={`tp-tool${tool.readOnly ? ' tp-tool--read' : ''}`}>
      <p className="tp-tool-head">
        <span className="tp-tool-name mono">{tool.name}</span>
        <span className="tp-tool-standing">
          <ProofMark name={mark} size={12} />
          {words}
        </span>
      </p>
      {/* The literal registered string, not a summary of it — when a rule is ratified this
          paragraph grows a sentence, which is the whole reason the panel exists. Printed only
          for the guarded tools: a read tool's description is fixed at registration and can
          never change, so four lines of it would crowd out the two that do move. Nothing is
          being hidden — there is nothing there to watch. The one read tool that reaches into
          this page is the exception: what it tells the agent about the operator's own screen is
          the sentence the operator has the most reason to check. */}
      {(!tool.readOnly || tool.changesTheView) && <p className="tp-tool-desc">{tool.description}</p>}
    </li>
  );
}

export function ToolPill() {
  const [open, setOpen] = useState(false);
  // The registry is read fresh on every render rather than mirrored into state; the counter is
  // never read, only bumped, and one subscription covers both a tool registering and any
  // description changing (see reregister() in webmcp/adapter.ts).
  const [, setTick] = useState(0);
  useEffect(() => onToolsChange(() => setTick(t => t + 1)), []);

  const tools = listTools();
  if (tools.length === 0) return null;

  const reads = tools.filter(t => t.readOnly);
  const writes = tools.filter(t => !t.readOnly);
  const role = currentRole();

  return (
    <div className="tp">
      {open && (
        <section className="tp-panel" aria-label="Registered tools">
          <p className="tp-panel-head">
            <span>What the agent can see</span>
            <span className="tp-panel-count mono">{tools.length} registered</span>
          </p>

          {writes.length > 0 && (
            <>
              <p className="tp-group">Can change things</p>
              <ul className="tp-list">
                {writes.map(t => <ToolRow key={t.name} tool={t} />)}
              </ul>
            </>
          )}

          {reads.length > 0 && (
            <>
              <p className="tp-group">Reads only</p>
              <ul className="tp-list">
                {reads.map(t => <ToolRow key={t.name} tool={t} />)}
              </ul>
            </>
          )}

          {/* Stated once at the foot rather than on each row: the spend boundary is a property
              of whoever is on shift, not of any one tool, and repeating it four times would
              read as four separate limits. */}
          <p className="tp-foot">
            On shift: {role.label.toLowerCase()}, {describeAuthority(role)}.
          </p>
        </section>
      )}

      <button
        className="tp-chip"
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <ProofMark name="registration" size={13} />
        <span>Ladder</span>
        <span className="tp-chip-count mono">{tools.length} tools</span>
      </button>
    </div>
  );
}
