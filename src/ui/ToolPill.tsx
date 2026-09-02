import { useEffect, useState } from 'react';
import { activePolicy, listTools, onToolsChange } from '../webmcp/adapter';
import type { ToolSummary } from '../webmcp/adapter';
import { authorityVocabulary, currentRole } from '../webmcp/authority';
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
  /** The short tag, for scanning: what kind of access this is. */
  tag: string;
  /** The same fact in a clause, for the metadata row and for a screen reader. */
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
    return { mark: 'registration', tag: 'Read only', words: 'sets what your register shows' };
  }
  if (t.readOnly) return { mark: 'stet', tag: 'Read only', words: 'changes nothing' };
  if (NEVER_ELIGIBLE.includes(t.name)) {
    return { mark: 'dagger', tag: 'Always reviewed', words: 'never automatic, whatever rules exist' };
  }
  const pol = activePolicy(t.name);
  // Deliberately does not repeat the rule's terms. They are already in the description two
  // lines below, in the words the agent itself reads; saying them twice made this line long
  // enough to overrun its column and taught the reader nothing the paragraph did not.
  if (pol?.ratified) return { mark: 'insert', tag: 'Standing rule', words: 'a ratified rule lands it without review' };
  return { mark: 'query', tag: 'Reviewed', words: 'every change waits for you' };
}

function ToolRow({ tool }: { tool: ToolSummary }) {
  const { mark, tag, words } = standingOf(tool);
  const [shown, setShown] = useState(false);
  // The literal registered string, not a summary of it: when a rule is ratified this paragraph
  // grows a sentence, which is the whole reason this surface exists. Behind a disclosure per
  // tool because the two write tools carry the same paragraph, and four copies of it buried the
  // one line per tool that differs.
  const hasDesc = !tool.readOnly || tool.changesTheView;
  const role = currentRole();
  const vocab = authorityVocabulary();
  // A limit is printed only where it bites: a read tool has none, and a tool no rule may ever
  // cover is stopped by the rule, not by the amount.
  const bound = !tool.readOnly && !NEVER_ELIGIBLE.includes(tool.name)
    ? `${vocab.amount(role.limit)} per ${vocab.record}`
    : null;

  return (
    <li className={`tp-tool${tool.readOnly ? ' tp-tool--read' : ''}`}>
      <p className="tp-tool-head">
        <span className="tp-tool-name mono">{tool.name}</span>
        <span className="tp-tool-tag">
          <ProofMark name={mark} size={11} />
          {tag}
        </span>
      </p>

      {/* A read tool gets one clause, not a metadata block: for three of them "reads only" is
          the whole story, and for the fourth it is not. `search_shipments` changes what the
          operator is looking at, and a surface that filed it under "changes nothing" would be
          the one place in this product where the honest account of a tool is wrong. */}
      {tool.readOnly && <p className="tp-tool-read">{words}</p>}

      {!tool.readOnly && (
        <dl className="tp-meta">
          <div><dt>Approval</dt><dd>{words}</dd></div>
          {bound && <div><dt>Limit</dt><dd className="mono">{bound}</dd></div>}
        </dl>
      )}

      {hasDesc && (
        <>
          <button
            className="tp-tool-more"
            type="button"
            aria-expanded={shown}
            aria-label={`What the agent reads for ${tool.name}`}
            onClick={() => setShown(v => !v)}
          >
            {shown ? 'Hide what the agent reads' : 'What the agent reads'}
          </button>
          {shown && <p className="tp-tool-desc">{tool.description}</p>}
        </>
      )}
    </li>
  );
}

/**
 * The agent's own permission surface, docked at the foot of the page.
 *
 * It reads like a browser's security inspector rather than an API reference: what can the agent
 * do here, not the whole implementation contract. Each tool gives a name, one tag, and where it
 * bites, an approval and a limit; the registered description is behind a disclosure, because it
 * is the one thing on this surface that changes when a rule is ratified and the one thing a
 * reader has to ask for.
 *
 * Docked bottom left rather than folded into the flight header. It was in the header from 2 Sep
 * 2026, where the count read as a developer's figure in a row of business ones. Down here it is
 * what it is: a thing you open to check what the page handed the browser.
 *
 * It reads the registry; it never writes to it. Nothing here is a control on the records.
 */
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
    <div className={`tp-dock${open ? ' tp-dock--open' : ''}`}>
      {open && (
        <section className="tp-panel" aria-label="Agent tools">
          <p className="tp-panel-head">
            <span className="tp-panel-title">Agent tools</span>
            <span className="tp-panel-count mono">{tools.length} registered</span>
          </p>
          {/* The promise, at the head where it frames everything under it. */}
          <p className="tp-panel-promise">
            <ProofMark name="query" size={12} />
            Every change is reviewed first.
          </p>

          <div className="tp-scroll">
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
                <ul className="tp-list tp-list--reads">
                  {reads.map(t => <ToolRow key={t.name} tool={t} />)}
                </ul>
              </>
            )}
          </div>

          {/* Stated once at the foot: the boundary belongs to whoever is on shift, not to any
              one tool, and repeating it per row would read as four separate limits. */}
          <p className="tp-foot">On shift: {role.label.toLowerCase()}.</p>
        </section>
      )}

      <button
        className="tp-chip"
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <ProofMark name="registration" size={12} />
        <span className="tp-chip-count">{tools.length} agent tools</span>
      </button>
    </div>
  );
}
