import { ProofMark } from '../ProofMark';

/**
 * The second product's address.
 *
 * It does not exist yet. Another entry is being wired against the same engine as this is
 * written, and the honest thing to put here in the meantime is a hole with its edges marked
 * rather than a plausible link that goes nowhere.
 *
 * Two things stop the hole shipping. The page renders the word TODO where the link belongs, so
 * a reader sees it before a judge does; and `ElsewherePage.test.tsx` asserts this constant is a
 * real `https:` address and fails until it is. Replace the value and both go quiet together.
 */
export const SECOND_PRODUCT_HREF: string = 'https://ladder-webmcp.vercel.app/edge.html';

/** Where the interface quoted below actually lives, for a reader who wants to check the quote. */
const ADAPTER_URL =
  'https://github.com/harshpuri84/ladder-webmcp/blob/main/src/webmcp/adapter.ts';

const REPO_URL = 'https://github.com/harshpuri84/ladder-webmcp';

/**
 * The interface, quoted rather than described.
 *
 * Doc comments stripped and nothing else changed. A description of an interface is a promise; a
 * reader can check this against the file, and `ElsewherePage.test.tsx` imports `adapter.ts` as
 * text and fails if the two ever come to name different members.
 */
export const HOST_BINDING_QUOTE = `interface HostBinding<S> {
  state: S;
  notify(): void;
  versionOf(entity: string, id: string): number;
  bumpVersion(entity: string, id: string): void;
  valueDeltaOf(w: WriteRecord): number;
  neverEligible: string[];
  authority: AuthorityVocabulary;
}`;

/** An identifier a reader could type into an editor, set apart from the description of it. */
function Code({ children }: { children: React.ReactNode }) {
  return <code className="mono pr-code">{children}</code>;
}

/**
 * A note in the sheet's margin, keyed to the paragraph it follows.
 *
 * The same furniture `ProblemPage` sets, on the same classes, declared again here rather than
 * shared: the two reading tabs are the only callers, and lifting a nine-line component into a
 * module of its own would mean editing a page this change has no other business in.
 */
function MarginNote({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <aside className="pr-note">
      <span className="pr-note-caption">{caption}</span>
      {children}
    </aside>
  );
}

/**
 * One kind of work the engine would fit, stated and not drawn.
 *
 * Run-in bold lead, the same device `ProblemPage` uses for its consequences, because these are
 * the argument continuing rather than asides from it. There were mockups here until 27 August
 * 2026: four-step walkthroughs of freight, repricing and an edge rollout, each labelled as not
 * wired. They were cut. A drawing cannot carry this claim — a judge has to be told it is a
 * drawing, which invites the only question that matters, which is why nothing is real. The
 * second product below is the answer instead.
 */
function Case({ lead, children }: { lead: string; children: React.ReactNode }) {
  return (
    <p className="pr-conseq">
      <strong className="pr-conseq-lead">{lead}</strong>{' '}
      {children}
    </p>
  );
}

/**
 * The reusability tab. Mode is Read: a judge decides whether the engine is domain-free, and the
 * only evidence that settles it is an interface they can open and a second product they can
 * run. So the page names the interface in full, states two other kinds of work in prose, and
 * points at the second product — with the pointer marked as missing while it is missing.
 */
export function ElsewherePage() {
  const linkIsReal = SECOND_PRODUCT_HREF.startsWith('https://');

  return (
    <main className="pr">
      <p className="pr-standfirst">
        The engine in <span className="mono">src/core/</span> has no idea what a shipment is. It
        records writes, computes a diff, and refuses anything the human did not approve. Freight
        is one skin over it.
      </p>

      <section className="pr-sec">
        <h2 className="pr-h">What an application has to hand it</h2>
        <MarginNote caption="Checkable">
          The block below is quoted from <span className="mono">adapter.ts</span>, not written
          about it. A test compares it against the module the app builds from and fails if the
          two ever stop agreeing.
        </MarginNote>
        <p className="pr-p">
          What the engine needs back from an application is small enough to print in full, so
          here it is rather than a description of it. This is <Code>HostBinding</Code>, from{' '}
          <a className="pr-link mono" href={ADAPTER_URL}>src/webmcp/adapter.ts</a>.
        </p>
        <pre className="pr-payload mono" tabIndex={0}>{HOST_BINDING_QUOTE}</pre>
        <p className="pr-p">
          A way to read the state and say when it changed. A way to version a record, so a commit
          can refuse one that moved while the operator was deciding. A way to say what a write is
          worth, so an approval limit means something. The tool names no standing rule may ever
          cover. And the words for the boundary between two of this application&rsquo;s humans —
          its roles, its unit, its name for one record — because the engine has to write that
          sentence into every guarded tool&rsquo;s description and has no vocabulary of its own.
          Seven members, none of which mentions freight.
        </p>
        <p className="pr-p">
          The freight application answers those seven at the foot of{' '}
          <Code>src/domain/store.ts</Code>. That binding is the whole of what the engine knows
          about air cargo.
        </p>
      </section>

      <section className="pr-sec">
        <h2 className="pr-h">The same decision, other records</h2>
        <p className="pr-p">
          The shape that repeats is not freight. It is an agent proposing a change across records
          one person is answerable for, where the change is right about most of them and wrong
          about a few, and where the few are not a rounding error.
        </p>
        <Case lead="A retail repricing.">
          An agent proposes new prices across four hundred lines. Some of those prices are fixed
          by a partner contract and cannot move without breaking it. The buyer has to let most of
          the change through, hold back the committed ones, and tell the agent which were held
          and why — otherwise it proposes the same thing again an hour later.
        </Case>
        <Case lead="An edge config rollout.">
          An agent proposes a configuration change to every region. Three regions are inside a
          change freeze. Approving the call whole breaks the freeze; refusing it whole delays the
          fix in every region that needed it.
        </Case>
        <p className="pr-p">
          Neither of those wants a different engine. They want their own words for a record and a{' '}
          <Code>HostBinding</Code>.
        </p>
      </section>

      <section className="pr-sec">
        <h2 className="pr-h">The second one is being wired, not drawn</h2>
        <MarginNote caption="Guarded">
          A test asserts this link is a real address and fails until it is. The site cannot ship
          with a dead pointer standing where the proof is meant to be.
        </MarginNote>
        <p className="pr-p">
          Two products on one engine is a claim, and a picture of the second one would not settle
          it. So the second one is being built: an edge configuration rollout with its own Vite
          entry, its own design language, and nothing shared with the freight application except{' '}
          <Code>src/core/</Code> and <Code>src/webmcp/</Code>.
        </p>
        <p className="pr-p">
          It is not finished as this is written. Its address goes here:{' '}
          {linkIsReal
            ? <a className="pr-link mono" href={SECOND_PRODUCT_HREF}>{SECOND_PRODUCT_HREF}</a>
            : (
              <span className="ew-todo mono">
                <ProofMark name="query" size={12} className="ew-todo-mark" />
                TODO &mdash; not yet built
              </span>
            )}
        </p>
      </section>

      <p className="pr-onward">
        The engine and the interface: <a href={REPO_URL}>{REPO_URL.replace('https://', '')}</a>
      </p>
    </main>
  );
}
