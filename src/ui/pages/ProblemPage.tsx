import { PlacementDiagram } from '../PlacementDiagram';
import { ProofMark } from '../ProofMark';
import { useReveal } from '../useReveal';
import { store } from '../../domain/store';
import { DISRUPTED_FLIGHT } from '../../domain/seed';

const IMG = `${import.meta.env.BASE_URL}img/`;

/**
 * A sample of what a narrowed call returns. Quoted exactly as the tool emits it, including the
 * arithmetic: `applied` plus every rejected count equals `requested`.
 */
const PAYLOAD = `{
  "status": "partially_applied",
  "requested": 42,
  "applied": 27,
  "rejected": [
    { "reason": "not screened to passenger standard", "count": 1, "ids": ["HAWB-70041"] },
    { "reason": "the operator removed these from the change", "count": 14, "ids": [] }
  ],
  "replan_required": true
}`;

/**
 * The sample's own figures, read back out of it, so the prose and the check line beneath the
 * block can never disagree with the block. `ProblemPage.test.tsx` asserts the sample's
 * `requested` still equals the register's count.
 */
const SAMPLE = JSON.parse(PAYLOAD) as {
  requested: number;
  applied: number;
  rejected: { count: number }[];
};

const CHECK_TERMS = [SAMPLE.applied, ...SAMPLE.rejected.map(r => r.count)];

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/** The consol count as a word, spelt from the register rather than typed. */
function spellOut(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/**
 * A note in the sheet's margin, keyed to one paragraph.
 *
 * Rendered inside `Keyed` beside the paragraph it annotates, so it sits level with that
 * paragraph's first line on a wide sheet and folds back into the run under it on a narrow one.
 * A sibling of its paragraph in the DOM, so it is read in the right place by anyone who cannot
 * see the margin.
 */
function MarginNote(
  { caption, mark, children }:
  { caption: string; mark?: 'query'; children: React.ReactNode },
) {
  return (
    <aside className="pr-note">
      <span className="pr-note-caption">
        {mark ? <ProofMark name={mark} size={12} className="pr-note-mark" /> : null}
        {caption}
      </span>
      {children}
    </aside>
  );
}

/** A paragraph and the one margin note that belongs to it, positioned against each other. */
function Keyed({ note, children }: { note: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pr-keyed">
      {children}
      {note}
    </div>
  );
}

/** One line of a measurement record. Mono, because every one of them is a reading. */
function NoteLine({ children }: { children: React.ReactNode }) {
  return <span className="pr-note-line mono">{children}</span>;
}

/** A figure that came off the register, set in mono so a reader can tell it from a word. */
function Fig({ children }: { children: React.ReactNode }) {
  return <span className="mono">{children}</span>;
}

/** An identifier a reader could type into an editor, set apart from the description of it. */
function Code({ children }: { children: React.ReactNode }) {
  return <code className="mono pr-code">{children}</code>;
}

/** A section heading that rises into place the first time it is scrolled to. */
function Heading({ children }: { children: React.ReactNode }) {
  const ref = useReveal<HTMLHeadingElement>();
  return <h2 className="pr-h" ref={ref}>{children}</h2>;
}

/**
 * A drawn figure, set the house way: a hairline above, the picture on the sheet's own ground,
 * a caption below. Wider than the prose, because a figure is read across and prose is read
 * down. `width` and `height` are the file's own pixels so the sheet does not reflow as the
 * picture arrives. The alt says what is in the picture, for a reader who cannot see it.
 * `fullSize` adds a plain link to the file for a picture that carries small text.
 */
function Figure({
  src, width, height, alt, caption, fullSize,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: React.ReactNode;
  fullSize?: boolean;
}) {
  const ref = useReveal<HTMLElement>();
  const url = IMG + src;
  return (
    <figure className="pr-fig" ref={ref}>
      <img
        className="pr-fig-img"
        src={url}
        width={width}
        height={height}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
      <figcaption className="pr-fig-cap">
        {caption}
        {fullSize ? (
          <>
            {' '}
            <a className="pr-link" href={url} target="_blank" rel="noopener">Open at full size.</a>
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}

/**
 * One of the four things that follow from the tool running inside the operator's own tab.
 * Prose with a run-in bold lead: the argument continuing, not an aside from it.
 */
function Consequence({ n, lead, children }: { n: string; lead: string; children: React.ReactNode }) {
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
 * A limit, set apart from the run with the reference mark, which is what a dagger has always
 * been for. The bold clause says the limit on its own; the mark is for a sighted reader.
 */
function Limit({ n, lead, children }: { n?: string; lead: string; children?: React.ReactNode }) {
  return (
    <div className="pr-limit">
      {n
        ? <p className="pr-conseq-n mono" aria-hidden="true">{n}</p>
        : <ProofMark name="dagger" size={13} className="pr-limit-mark" />}
      <p className="pr-limit-body">
        <strong className="pr-limit-lead">{lead}</strong>
        {children ? ' ' : null}
        {children}
      </p>
    </div>
  );
}

/**
 * The reading tab. Mode is Read: a platform engineer works out what the mechanism is, what it
 * costs and where it stops, in one pass. One column at a reading measure, grouped by rules and
 * space, ending on what Ladder does not do rather than on a call to action.
 *
 * Every figure in the situation is counted off the same register the proof tab operates on,
 * and the lane is read off the fixture, so this page and that one describe one flight.
 */
export function ProblemPage() {
  const rows = Object.values(store.state.shipments);
  const shipments = rows.length;
  const customers = new Set(rows.map(s => s.customer)).size;
  const consols = new Set(rows.map(s => s.consol)).size;

  return (
    <main className="pr">
      <p className="pr-standfirst">
        An agent can now call the tools a web page owns. Ladder is the other half: what the
        person accountable for those records sees before the change lands, and what the agent is
        told when they cut it down.
      </p>

      <section className="pr-sec">
        <Heading>Thursday, <span className="mono">19:40</span></Heading>
        <p className="pr-p">
          A flight from {DISRUPTED_FLIGHT.origin} to {DISRUPTED_FLIGHT.destination} is
          cancelled. {spellOut(consols)} consolidations were on it. A consolidation is one air
          waybill covering many separate customers' shipments, so <Fig>{shipments}</Fig>{' '}
          shipments belonging to <Fig>{customers}</Fig> different customers are now unbooked.
          Nobody assembled that list. The cancellation did.
        </p>
        {/* Picture and argument side by side above 1240px, stacked below it. The figure takes
            the larger half because it is the thing that cannot be said in a sentence; the
            paragraphs keep their measure and simply stop where they stop. */}
        <div className="pr-band">
        <Figure
          src="network.jpg"
          width={1674}
          height={940}
          alt={
            'An ink drawing of an air-freight operation: a warehouse with trucks backed up to '
            + 'its loading doors, a forklift carrying pallets, a container on a flatbed, a cargo '
            + 'aircraft being loaded on the apron, and dotted route lines running from it to '
            + 'depots across a map of Europe and to a container port.'
          }
          caption={
            <>
              Each row is cargo, a truck, an aircraft and a promise to a customer.
            </>
          }
        />
          <div className="pr-band-text">
            <p className="pr-p">
              Ninety minutes to the first cutoff, and three ways out of each one at three
              different costs. One carries lithium-ion batteries and cannot go on tomorrow's
              passenger flight at all. One has twelve hours of container endurance left. One is
              ordinary freight whose customer will not notice.
            </p>
            <p className="pr-p">
              The person responsible has to decide which is which, before the cutoff.
            </p>
          </div>
        </div>
      </section>
      <section className="pr-sec">
        {/* "The half that was missing" was a section of its own until 2 Sep 2026. It said what
            WebMCP left unsettled; this one says where that gets settled. Two headings for one
            argument, and a reader met the second having been given no reason to want it. */}
        <Heading>Why this has to live in the page</Heading>
        {/* The drawn rooms come first and the ruled diagram second. The rooms carry the one
            thing a reader has to get before anything else on this page makes sense: in the
            first room the operator is outside the wall, in the second he is inside it. That is
            read in a glance with every caption covered. The diagram below carries the stations
            inside the second room (fork, proof, guard, result, the rolled-back return), which
            are detail, and detail reads better once the reader knows which room it is detail
            of. Reversed, the diagram's ticks are a puzzle with no picture to hang on. */}
        <p className="pr-lead">The agent and the operator have to be in the same room.</p>
        <p className="pr-p">
          WebMCP settled how an agent acts on a page. A tool is registered, the agent calls it,
          the page does the work. That is the hard part and it is solved.
        </p>
        <p className="pr-p">
          What it did not settle is what happens when the agent is wrong. The operator sees a
          function call and a name. A call that is ninety per cent right can only be taken whole
          or thrown away whole.
        </p>
        {/* Flipped against the freight band above it: prose on the left, rooms on the right,
            so the page alternates rather than running a column of pictures down one edge. */}
        <div className="pr-band pr-band--flip">
        <Figure
          src="boundary.jpg"
          width={1692}
          height={930}
          alt={
            'Two drawn rooms. On the left, before WebMCP, a small room holds the remote tool '
            + 'with its tools and credentials; the agent reaches in from outside and the '
            + 'operator stands further out still, outside the wall. On the right, with WebMCP, '
            + 'the operator stands inside a wide room, and the page, the proof, the human '
            + 'decision and the application state run along the wall in front of him.'
          }
          caption="Before WebMCP the operator stands outside the room that holds the tools. With WebMCP he is in the room, at the proof, before the change lands."
        />
          <div className="pr-band-text">
            <p className="pr-p">
              Before WebMCP the tool lived somewhere else. It could reach the records; the
              person answerable for them could not see the change until it had landed.
            </p>
            <p className="pr-p">
              WebMCP moves it in. <Code>document.modelContext.registerTool()</Code> runs the
              tool's <Code>execute()</Code> in the tab the operator already has open, against
              the state on their screen, under the session they are already signed in with.
            </p>
            <p className="pr-p">
              The relocation that matters is not where the tool runs. It is where the decision
              happens.
            </p>
          </div>
        </div>
        <PlacementDiagram />
        <p className="pr-h pr-h--sub">What changes when the tool moves into the page</p>
        <div className="pr-grid">
        <Consequence n="01" lead="The human is already here.">
          The tool is called in a tab someone is looking at, so there is no notification to
          send and no approval queue to build. The interruption lands where the work already
          was.
        </Consequence>
        <Consequence n="02" lead="The page owns the state.">
          Ladder rehearses the real <Code>execute()</Code> against a <Code>structuredClone</Code>{' '}
          of the page's state. The proof comes from the operation that will commit, not from a
          second one written beside it that drifts the first time someone fixes a bug in one.
        </Consequence>
        <Consequence n="03" lead="The rules can change live.">
          <Code>unregisterTool</Code>, then <Code>registerTool</Code> with new words. Ratify a
          standing rule and the agent reads its new boundary in the same session, with no
          redeploy.
        </Consequence>
        <Consequence n="04" lead="The credential is already here.">
          Nothing is issued to the agent. The operator's own signed-in session does the work, so
          the agent is bounded by what that person could already reach.
        </Consequence>
        </div>
      </section>

      <section className="pr-sec">
        <Heading>How it works</Heading>
        <p className="pr-p">
          Before a write tool changes anything, Ladder runs its real <Code>execute()</Code>{' '}
          against a <Code>structuredClone</Code> of the page's state, behind a Proxy that records
          every write. What the tool would do becomes a diff.
        </p>
        <Keyed
          note={
            <MarginNote caption="Query" mark="query">
              Two runs of the same function only agree if the function is the same twice. What
              if it is not? Settled under <em>What this does not do</em>, below.
            </MarginNote>
          }
        >
          <p className="pr-p">
            The operator sees the blast radius, unticks what they do not want, and every figure
            moves as they do it. Then the <strong>same</strong> <Code>execute()</Code> runs again
            against real state, through a Proxy that passes the approved writes, skips the ones
            narrowed out, and throws if the tool reaches anywhere the preview never showed. A
            violation rolls the entire commit back.
          </p>
        </Keyed>
        <p className="pr-p">
          The developer writes one function, the way they already do. Ladder runs it twice.
        </p>
      </section>

      <section className="pr-sec">
        <Heading>One implementation note</Heading>
        <Keyed
          note={
            <MarginNote caption="Measured">
              <NoteLine>Chrome 151.0 &middot; 26 Aug 2026</NoteLine>
              <NoteLine>execute(args), arity 1</NoteLine>
              <NoteLine>agent, undefined</NoteLine>
              <NoteLine>pending execute(), 96 s</NoteLine>
            </MarginNote>
          }
        >
          <p className="pr-p">
            The specification did anticipate the human. <Code>agent.requestUserInteraction()</Code>{' '}
            exists on paper. Measured against Chrome 151 on 26 August 2026, <Code>execute</Code>{' '}
            receives only its first argument, so there is no agent object to call it on. Ladder
            detects for the hook and renders its own surface until it lands.
          </p>
        </Keyed>
        <p className="pr-p">
          When it lands it can ask a question, and a question cannot carry the three things this
          needs: consequences rather than arguments, part of a change, and a refusal the agent
          can reason with.
        </p>
      </section>

      <section className="pr-sec">
        <Heading>A refusal is a message</Heading>
        <p className="pr-p">
          When someone cuts <Fig>{shipments}</Fig> down to <Fig>{SAMPLE.applied}</Fig>, the tool
          returns what happened and why the rest did not.
        </p>
        {/* The only element on the page that can scroll sideways, so it takes a tab stop
            rather than being unreachable to anyone driving the page from the keyboard. */}
        <pre className="pr-payload mono" tabIndex={0}>{PAYLOAD}</pre>
        <p className="pr-check mono">
          {CHECK_TERMS.join(' + ')} = {SAMPLE.requested}
        </p>
        <p className="pr-p">
          Each kind of refusal carries its own reason and its own ids, so the agent can tell a
          row the tool declined from a record that moved while the operator was deciding.{' '}
          <Code>applied</Code> plus every rejected count equals <Code>requested</Code> on every
          path the app can reach, including the ones where nothing lands.
        </p>
      </section>

      {/*
        * Three levels, not six bullets of one weight: the principle, five compact constraints in
        * a grid, and the one that a technical reader has to see, at full width with the
        * measurement beside it. It was "What this does not do" and six equal paragraphs until
        * 2 Sep 2026, and the reader had to work out which of the six mattered.
        */}
      <section className="pr-sec">
        <Heading>Where the guard stops</Heading>
        <p className="pr-lead">The guard is deliberately narrow.</p>

        <div className="pr-grid pr-grid--limits">
          <Limit n="01" lead="Not a sandbox.">
            Ladder governs writes and effects that pass through the tool context it hands your{' '}
            <Code>execute()</Code>. A tool that reaches around that context and touches state
            directly is outside the guard; Ladder cannot claim to have governed that write.
          </Limit>
          <Limit n="02" lead="Two levels deep.">
            The recorder tracks mutations two levels into an object. A write past that cannot be
            previewed, so it is refused rather than performed, and a commit that crosses the
            boundary rolls back whole.
          </Limit>
          <Limit n="03" lead="Preview and commit must agree.">
            A field set from a clock differs between the two runs, and Ladder aborts the commit
            rather than guessing which value was meant.
          </Limit>
          <Limit n="04" lead="Nothing persists.">
            Standing rules, history and the activity log live in memory. Reload the page and they
            are gone.
          </Limit>
          <Limit n="05" lead="Approval is per record.">
            The operator approves a record. One field inside a record cannot be approved on its
            own.
          </Limit>
        </div>

        {/* The one a technical reader has to see, so it gets the width. No margin note: the
            Chrome measurement is already in one, under "One implementation note", and printing
            it twice would be the page quoting itself. */}
        {/* 01 to 05 are constraints of the mechanism. This one is the boundary of the
            implementation, which is a different kind of thing, so it is set as one. */}
        <div className="pr-limit-major">
          <p className="pr-major-head">
            <span className="pr-major-n mono" aria-hidden="true">06</span>
            <span className="pr-major-title">The page must own the state</span>
          </p>
          <p className="pr-p">
            This reference implementation works because the authoritative records live in the
            browser. Ladder can fork that state, preview the real tool against the fork, and
            replay the same execution against the real thing.
          </p>
          <p className="pr-p">
            If the application's truth lives on a server, the same guard belongs around its API
            client. Ladder does not cover that deployment model today.
          </p>
          {/* The one place the implementation is evidence rather than assertion, so it is set
              as a reading off an instrument rather than as another sentence. */}
          <div className="pr-measured">
            <p className="pr-measured-cap">Measured</p>
            <p className="pr-measured-line mono">Chrome 151 &middot; 26 Aug 2026</p>
            <p className="pr-measured-line mono">pending execute() &middot; 96 s</p>
            <p className="pr-measured-say">Long enough for a person to read a proof and decide.</p>
          </div>
        </div>
      </section>

      <p className="pr-onward">
        <a href="#/proof">Open the proof</a>
      </p>
    </main>
  );
}
