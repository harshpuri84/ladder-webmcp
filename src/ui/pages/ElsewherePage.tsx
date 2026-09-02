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
  targetedIds(input: unknown): string[] | null;
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
function Case({ n, lead, children }: { n: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="pr-conseq">
      <p className="pr-conseq-n mono" aria-hidden="true">{n}</p>
      <p className="pr-conseq-body">
        <strong className="pr-conseq-lead">{lead}</strong>{' '}
        {children}
      </p>
    </div>
  );
}

/**
 * One member of the interface quoted above it, with what an application has to answer for it.
 *
 * Eight of these replaced a hundred and ten words of running prose on 2 Sep 2026. The prose
 * named the same eight things in one paragraph, so a reader counting them had to do the
 * counting; a reader who wanted one of them had to find it inside a sentence.
 */
function Member({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="pr-conseq">
      <p className="pr-conseq-n mono">{name}</p>
      <p className="pr-conseq-body">{children}</p>
    </div>
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
        <p className="pr-lead">Eight members, and not one of them mentions freight.</p>
        <div className="pr-keyed">
          <p className="pr-p">
            It is small enough to print in full, so here it is rather than a description of it.
            This is <Code>HostBinding</Code>, from{' '}
            <a className="pr-link mono" href={ADAPTER_URL}>src/webmcp/adapter.ts</a>.
          </p>
          <MarginNote caption="Checkable">
            Quoted from <span className="mono">adapter.ts</span>, not written about it. A test
            compares the two and fails if they ever stop agreeing.
          </MarginNote>
        </div>
        <pre className="pr-payload mono" tabIndex={0}>{HOST_BINDING_QUOTE}</pre>
        <div className="pr-grid pr-grid--members">
          <Member name="state">
            The records themselves, read fresh on every call.
          </Member>
          <Member name="notify()">
            Called once after a commit lands, so the application&rsquo;s own subscribers redraw.
          </Member>
          <Member name="versionOf">
            What version a record is on, so a commit can refuse one that moved while the
            operator was deciding.
          </Member>
          <Member name="bumpVersion">
            Raised when a record changes, by the application or by anyone else.
          </Member>
          <Member name="valueDeltaOf">
            What a write is worth, in the application&rsquo;s own units, so an approval limit
            means something.
          </Member>
          <Member name="neverEligible">
            The tool names no standing rule may ever cover.
          </Member>
          <Member name="targetedIds">
            Which records a call names outright, which is what lets a later call be recognised as
            a narrowing of an earlier refusal rather than merely resembling one.
          </Member>
          <Member name="authority">
            This product&rsquo;s words for the boundary between two of its humans: its roles, its
            unit, its name for one record. The engine has no vocabulary of its own.
          </Member>
        </div>
        <p className="pr-p">
          The freight application answers those eight at the foot of{' '}
          <Code>src/domain/store.ts</Code>. That binding is the whole of what the engine knows
          about air cargo.
        </p>
      </section>

      <section className="pr-sec">
        <h2 className="pr-h">The same decision, other records</h2>
        <p className="pr-lead">The shape that repeats is not freight.</p>
        <p className="pr-p">
          It is an agent proposing a change across records one person is answerable for, where
          the change is right about most of them and wrong about a few, and where the few are
          not a rounding error.
        </p>
        <div className="pr-grid">
        <Case n="01" lead="A retail repricing.">
          An agent proposes new prices across four hundred lines. Some are fixed by a partner
          contract and cannot move. The buyer has to let most of the change through, hold back
          the committed ones, and tell the agent which were held and why.
        </Case>
        <Case n="02" lead="An edge config rollout.">
          An agent proposes a configuration change to every region. Three regions are inside a
          change freeze. Approving the call whole breaks the freeze; refusing it whole delays the
          fix in every region that needed it.
        </Case>
        </div>
        <p className="pr-p">
          Neither of those wants a different engine. They want their own words for a record and a{' '}
          <Code>HostBinding</Code>.
        </p>
      </section>

      <section className="pr-sec">
        <h2 className="pr-h">The second one is wired, not drawn</h2>
        <p className="pr-lead">Two products on one engine is a claim, so the second one was built.</p>
        <MarginNote caption="Guarded">
          A test asserts this link is a real address and fails until it is. The site cannot ship
          with a dead pointer standing where the proof is meant to be.
        </MarginNote>
        <p className="pr-p">
          An edge configuration rollout with its own Vite entry, its own design language, and
          nothing shared with the freight application except <Code>src/core/</Code> and{' '}
          <Code>src/webmcp/</Code>. A test walks the import graph in both directions on every
          run, because that is the kind of claim one convenient import quietly undoes.
        </p>
        <p className="pr-p">
          Open it and put a proposal through it:{' '}
          {linkIsReal
            ? <a className="pr-link mono" href={SECOND_PRODUCT_HREF}>{SECOND_PRODUCT_HREF}</a>
            : (
              <span className="ew-todo mono">
                <ProofMark name="query" size={12} className="ew-todo-mark" />
                TODO &mdash; not yet built
              </span>
            )}
        </p>

        {/*
          A bare link asked a reader to take on trust that the thing on the other end looks
          nothing like this page. Showing it settles that before they click, and the contrast is
          the argument: cream proof sheet against dark instrument rack, and the same four beats
          underneath both. The figure links through, so the picture is a door rather than a
          substitute for one.
        */}
        {linkIsReal && (
          <figure className="ew-shot">
            <a href={SECOND_PRODUCT_HREF} className="ew-shot-frame">
              <img
                src="shots/edge-control.jpg"
                width={1400}
                height={875}
                loading="lazy"
                decoding="async"
                alt={
                  'Edge Control: a dark instrument rack listing points of presence with their ' +
                  'traffic share and running config version, and an open drawer proposing a ' +
                  'release rollout of 23 of 23 sites, 2.66% of production traffic, 7 referred to ' +
                  'a traffic lead.'
                }
              />
            </a>
            <figcaption className="ew-shot-cap">
              <ProofMark name="dagger" size={12} />
              The same engine, in a product that shares none of this one&rsquo;s vocabulary.
              A live screenshot &mdash; press it to open the real thing.
            </figcaption>
          </figure>
        )}
      </section>

      <p className="pr-onward">
        The engine and the interface: <a href={REPO_URL}>{REPO_URL.replace('https://', '')}</a>
      </p>
    </main>
  );
}
