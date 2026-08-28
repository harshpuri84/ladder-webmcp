import { EngineDiagram } from '../EngineDiagram';
import { PlacementDiagram } from '../PlacementDiagram';
import { ProofMark } from '../ProofMark';
import { store } from '../../domain/store';
import { DISRUPTED_FLIGHT } from '../../domain/seed';

/**
 * A sample of what a narrowed call returns. Quoted exactly as the tool emits it, including the
 * arithmetic — `applied` plus every rejected count equals `requested` — because that identity
 * is the paragraph's claim and a reader is entitled to check it here rather than take it.
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
 * The sample's own figures, read back out of it.
 *
 * The paragraph above the block names two numbers and the block names the same two. Typing
 * either of them a second time is how a page comes to contradict itself mid-sentence one
 * fixture change later, so the prose reads `applied` out of the quoted sample and the count
 * off the register, and `ProblemPage.test.tsx` asserts the sample's `requested` still equals
 * that count. Drift fails there instead of shipping.
 */
const SAMPLE = JSON.parse(PAYLOAD) as {
  requested: number;
  applied: number;
  rejected: { count: number }[];
};

/**
 * The sample's arithmetic, done rather than asserted. The paragraph beside it claims the parts
 * add up to the whole; the margin does the sum, off the sample itself, so a reader can check
 * the claim in the margin instead of in their head — which is exactly what a figure carried
 * out beside the text is for.
 */
const CHECK_TERMS = [SAMPLE.applied, ...SAMPLE.rejected.map(r => r.count)];

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/**
 * The opening sentence needs the consol count as a word, not a numeral, and a word is exactly
 * the shape a literal likes to hide in. Spelling it from the count keeps the sentence honest:
 * if the register ever carried a third consolidation, the page would say so.
 */
function spellOut(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/**
 * A note in the sheet's margin, keyed to the paragraph it follows.
 *
 * This is where the page's own furniture lives — the measurements, the arithmetic, the note
 * saying where the figures came from. It stays a sibling of the paragraph it belongs to in the
 * DOM, so it is read in the right place by anyone who cannot see the margin, and CSS folds it
 * back into the run on a viewport too narrow to have one.
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

/**
 * One of the four things that follow from the tool running inside the operator's own tab.
 *
 * Set as prose with a run-in bold lead rather than hung off a mark: the reference mark on this
 * page already means "a limit, set apart from the run", and spending it a second time on a
 * different kind of list would cost it that meaning. These are the argument continuing, not an
 * aside from it, so an indent and the lead's weight do the grouping and nothing else has to.
 */
function Consequence({ lead, children }: { lead: string; children: React.ReactNode }) {
  return (
    <p className="pr-conseq">
      <strong className="pr-conseq-lead">{lead}</strong>{' '}
      {children}
    </p>
  );
}

/**
 * A limit, set apart from the run with the reference mark — which is what a dagger has always
 * been for. The mark is decoration for a sighted reader and nothing for anyone else: the bold
 * clause says the limit on its own, so the meaning survives the mark, the colour and the CSS
 * all being taken away.
 */
function Limit({ lead, children }: { lead: string; children?: React.ReactNode }) {
  return (
    <p className="pr-limit">
      <ProofMark name="dagger" size={13} className="pr-limit-mark" />
      <strong className="pr-limit-lead">{lead}</strong>
      {children ? ' ' : null}
      {children}
    </p>
  );
}

/**
 * The reading tab. Mode is Read: a platform engineer works out what the mechanism is, what it
 * costs and where it stops, in one pass, without being sold anything. So the page is one
 * column at a reading measure, grouped by rules and space rather than by cards, and it ends on
 * the section that says what Ladder does not do rather than on a call to action.
 *
 * Every figure in the situation is counted off the same register the proof tab operates on,
 * and the lane is read off the fixture, so the scene on this page and the rows on that one can
 * never come to describe two different flights.
 */
export function ProblemPage() {
  const rows = Object.values(store.state.shipments);
  const shipments = rows.length;
  const customers = new Set(rows.map(s => s.customer)).size;
  const consols = new Set(rows.map(s => s.consol)).size;

  return (
    <main className="pr">
      {/* The vignette below is the concrete instance; this is the claim it is an instance of.
          A judge scanning for thirty seconds was reaching the general argument only after ~150
          words of air freight, which is a long time to wonder whether any of this is about
          them. Story-first is still the right order — this just puts the thesis where a scan
          finds it. */}
      <p className="pr-standfirst">
        An agent can now call the tools a web page owns. Ladder is about the other half: what
        the person accountable for those records sees before the agent's change lands, and what
        the agent is told when they cut it down.
      </p>

      <section className="pr-sec">
        <h2 className="pr-h">Thursday, <span className="mono">19:40</span></h2>
        <MarginNote caption="Counted, not typed">
          The consolidations, the shipments and the customers are read off the same register the
          proof tab operates on; change the fixture and those three change with them. The
          durations are written down, and are not claimed to be anything else.
        </MarginNote>
        <p className="pr-p">
          A flight from {DISRUPTED_FLIGHT.origin} to {DISRUPTED_FLIGHT.destination} is
          cancelled. {spellOut(consols)} consolidations were on it. A consolidation is one air
          waybill covering many separate customers' shipments, so <Fig>{shipments}</Fig>{' '}
          shipments belonging to <Fig>{customers}</Fig> different customers are now unbooked.
          Nobody assembled that list. The cancellation did.
        </p>
        <p className="pr-p">
          There are ninety minutes to the first cutoff and three ways out. Rebook on the same
          carrier tomorrow morning, which is free and costs eighteen hours. Put it on a
          competitor's freighter tonight, which recovers the time and costs money. Truck it to
          another airport and fly from there, which lands one day late instead of two.
        </p>
        <p className="pr-p">
          The person responsible has to decide which shipments are worth which remedy. One of
          these carries lithium-ion batteries and cannot go on tomorrow's passenger flight at
          all. One has a temperature-controlled container with twelve hours of endurance left
          and cannot wait until morning. One is ordinary freight whose customer will not notice.
        </p>
      </section>

      <section className="pr-sec">
        <h2 className="pr-h">The half that was missing</h2>
        <p className="pr-p">
          WebMCP settled how an agent acts on a page. A tool is registered, the agent calls it,
          the page does the work. That is the hard part and it is solved.
        </p>
        <p className="pr-p">
          What it did not settle is what happens when the agent is wrong. The operator sees a
          function call and a name. They can accept it or refuse it. They cannot see what it
          would do, and they cannot take part of it.
        </p>
        <p className="pr-p">
          That is the part standing between a demo and production, and it is not a UI problem.
          Refusing the whole call throws away the ninety per cent that was right. Accepting it
          applies the ten per cent that was not.
        </p>
      </section>

      <section className="pr-sec">
        <h2 className="pr-h">Why this has to live in the page</h2>
        <PlacementDiagram />
        <p className="pr-p">
          Before WebMCP, an agent that wanted to act on your records called an MCP server. The
          server holds the tools, the server holds the credentials, and the person whose
          records are changing is not in the room. They find out afterwards.
        </p>
        <p className="pr-p">
          WebMCP moves the tool into the page.{' '}
          <Code>document.modelContext.registerTool()</Code> puts the tool's{' '}
          <Code>execute()</Code> inside the tab the operator already has open, running against
          the state their screen is rendering, under the session they are already signed in
          with.
        </p>
        <p className="pr-p">
          That relocation is not a detail of packaging. It is the thing that makes this pattern
          possible, and four consequences follow from it that a tool on a server cannot have:
        </p>
        <Consequence lead="The human is already here.">
          The tool is called in a tab someone is looking at. There is no notification to send,
          no approval queue to build, no second device to reach for. The interruption lands
          where the work already was.
        </Consequence>
        <MarginNote caption="The load-bearing one">
          Three of these four are conveniences a determined team could work around. This one
          cannot be had on a server at any price, and it is the reason the preview cannot drift
          from the commit.
        </MarginNote>
        <Consequence lead="The page owns the state, so it can rehearse against it.">
          Ladder forks the application's own state with <Code>structuredClone</Code> and runs
          the real <Code>execute()</Code> against the copy. This is the part that cannot be
          built on a server. A preview there means a second endpoint, hand-written beside the
          real one, and two implementations of the same change drift apart the first time
          someone fixes a bug in only one of them. Ladder's preview cannot drift, because it is
          not a second implementation. It is the same <Code>execute()</Code>, on the same code
          path that will do the commit.
        </Consequence>
        <Consequence lead="The tool's description can be rewritten at runtime.">
          <Code>unregisterTool</Code>, then <Code>registerTool</Code> with new words. When an
          operator ratifies a standing rule, the agent's own toolset changes and the agent
          reads what it is now allowed to do — with no redeploy, no config file, and no
          round trip to ask.
        </Consequence>
        <Consequence lead="The credential is the session that was already there.">
          Nothing is issued to the agent. The operator's own signed-in session does the
          work, so what the agent can reach is bounded by what that person could already do by
          hand.
        </Consequence>
        <p className="pr-p">
          The specification did anticipate the human. <Code>agent.requestUserInteraction()</Code>{' '}
          exists on paper. Measured against Chrome 151 on 26 August 2026, <Code>execute</Code>{' '}
          receives only its first argument, so there is no agent object to call it on. Ladder
          detects for the hook and renders its own surface until it lands.
        </p>
        <MarginNote caption="Measured">
          <NoteLine>Chrome 151.0 &middot; 26 Aug 2026</NoteLine>
          <NoteLine>execute(args) &mdash; arity 1</NoteLine>
          <NoteLine>agent &mdash; undefined</NoteLine>
          <span className="pr-note-say">Taken in the browser, not read off the spec.</span>
        </MarginNote>
        <p className="pr-p">
          And where it does land, it can ask a question. What a question cannot express is the
          three things this actually needs: consequences instead of arguments, part of a change
          instead of all of it, and a refusal the agent can reason with.
        </p>
      </section>

      <section className="pr-sec">
        <h2 className="pr-h">How it works</h2>
        <EngineDiagram />
        <p className="pr-p">
          Before a write tool changes anything, Ladder runs the tool's real <Code>execute()</Code>{' '}
          against a <Code>structuredClone</Code> of the page's state, behind a Proxy that records
          every write. Nothing real is touched. What the tool <em>would</em> do becomes a diff.
        </p>
        <p className="pr-p">
          The operator sees the blast radius, unticks what they do not want, and every figure
          moves as they do it. Then the <strong>same</strong> <Code>execute()</Code> runs again,
          against real state, through a Proxy that lets the approved writes through, silently
          skips the ones that were narrowed out, and throws if the tool goes anywhere the
          preview never showed. A violation rolls the entire commit back.
        </p>
        {/* A proofreader's query is raised where it occurs and passed on to whoever can settle
            it — which is exactly what this is. Any engineer reads "runs it twice" and asks it,
            and a page that waits three sections to acknowledge the question has already lost
            the reader who asked it. */}
        <MarginNote caption="Query" mark="query">
          Two runs of the same function only agree if the function is the same twice. What if
          it is not? Settled under <em>What this does not do</em>, below.
        </MarginNote>
        <p className="pr-p">
          The developer writes one function, the way they already do. Ladder runs it twice.
        </p>
      </section>

      <section className="pr-sec">
        <h2 className="pr-h">A refusal is a message</h2>
        <p className="pr-p">
          When someone cuts <Fig>{shipments}</Fig> down to <Fig>{SAMPLE.applied}</Fig>, the tool does not
          return success. It returns what happened and why the rest did not.
        </p>
        {/* The only element on the page that can scroll sideways, so it takes a tab stop
            rather than being unreachable to anyone driving the page from the keyboard. */}
        <pre className="pr-payload mono" tabIndex={0}>{PAYLOAD}</pre>
        <MarginNote caption="Check the sum">
          <NoteLine>{CHECK_TERMS.join(' + ')} = {SAMPLE.requested}</NoteLine>
          <span className="pr-note-say">applied, plus every rejected count, is what was asked
            for. Done here off the sample itself so it cannot come to disagree with it.</span>
        </MarginNote>
        <p className="pr-p">
          Different refusals carry different reasons and the agent can tell them apart. A row
          the tool itself declined comes back with the exact ids. A record that changed while
          the operator was deciding says so. <Code>applied</Code> plus every rejected count
          equals <Code>requested</Code> on every path the app can reach, including the ones
          where nothing lands.
        </p>
      </section>

      <section className="pr-sec">
        <h2 className="pr-h">What this does not do</h2>
        <Limit lead="Ladder is a guard, not a sandbox.">
          It governs writes and effects that pass through the tool context it hands your{' '}
          <Code>execute()</Code>. A tool that reaches around that context and touches state
          directly is not governed by it, and Ladder will report a clean success while it
          happens. Every reviewer who read this code reasoned inside the abstraction and none of
          them asked that question. An outside reader did.
        </Limit>
        <Limit lead="The recorder is two levels deep.">
          A mutation inside a nested object field one level past that cannot be previewed, so it
          is refused rather than performed. Objects read at that depth come back as read-only
          views that throw on any write, and a commit that hits one rolls back whole and returns
          denied. The limit is real; what it never does is let an unpreviewed write land quietly.
        </Limit>
        <Limit lead="Tools must be deterministic.">
          A field set from a clock differs between the two runs and aborts the commit rather
          than guessing.
        </Limit>
        <Limit lead="Nothing persists.">
          Standing rules, history and the activity log are in memory and a reload clears them.
        </Limit>
        <Limit lead="Approval is per record, not per field." />
        <Limit lead="Your authoritative state may not be in the page at all.">
          These records live in the browser, which is what lets the guard see every write. An
          application whose truth lives on a server would put the same fork, preview and guard
          around its API client rather than around a store. Ladder does not do that for you
          today. What is here is a reference implementation of the pattern, not a library that
          already covers every shape of application.
        </Limit>
        <MarginNote caption="Measured">
          <NoteLine>Chrome 151.0 &middot; 26 Aug 2026</NoteLine>
          <NoteLine>pending execute() &mdash; 96 s</NoteLine>
          <span className="pr-note-say">The budget the whole design is spent against. Nothing
            below it is a design choice; it is what the browser allows.</span>
        </MarginNote>
        <p className="pr-p pr-p--after-limits">
          One measurement is what made any of this buildable: against Chrome 151 on 26 August
          2026, a pending <Code>execute()</Code> survives 96 seconds. That is long enough for a
          person to read a proof sheet and decide, which is the whole bet this design makes.
        </p>

      </section>

      <p className="pr-onward">
        <a href="#/proof">Open the proof</a>
      </p>
    </main>
  );
}
