import { EngineDiagram } from '../EngineDiagram';
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

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/**
 * The opening sentence needs the consol count as a word, not a numeral, and a word is exactly
 * the shape a literal likes to hide in. Spelling it from the count keeps the sentence honest:
 * if the register ever carried a third consolidation, the page would say so.
 */
function spellOut(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
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
      <section className="pr-sec">
        <h2 className="pr-h">Thursday, <span className="mono">19:40</span></h2>
        <p className="pr-p">
          A flight from {DISRUPTED_FLIGHT.origin} to {DISRUPTED_FLIGHT.destination} is
          cancelled. {spellOut(consols)} consolidations were on it, so <Fig>{shipments}</Fig>{' '}
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
        <p className="pr-p">
          The developer writes one function, the way they already do. Ladder runs it twice.
        </p>
      </section>

      <section className="pr-sec">
        <h2 className="pr-h">A refusal is a message</h2>
        <p className="pr-p">
          When someone cuts <Fig>{shipments}</Fig> down to <Fig>27</Fig>, the tool does not
          return success. It returns what happened and why the rest did not.
        </p>
        {/* The only element on the page that can scroll sideways, so it takes a tab stop
            rather than being unreachable to anyone driving the page from the keyboard. */}
        <pre className="pr-payload mono" tabIndex={0}>{PAYLOAD}</pre>
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
          A mutation inside a nested object field is not seen.
        </Limit>
        <Limit lead="Tools must be deterministic.">
          A field set from a clock differs between the two runs and aborts the commit rather
          than guessing.
        </Limit>
        <Limit lead="Nothing persists.">
          Standing rules, history and the activity log are in memory and a reload clears them.
        </Limit>
        <Limit lead="Approval is per record, not per field." />
        <p className="pr-p pr-p--after-limits">
          The spec has a hook for asking the user mid-call. No shipping browser implements it
          yet, so Ladder renders its own surface and detects for the hook. Measured against
          Chrome 151 on 26 August 2026: <Code>execute</Code> receives only its first argument,
          and a pending call survives 96 seconds.
        </p>
      </section>

      <p className="pr-onward">
        <a href="#/proof">Open the proof</a>
      </p>
    </main>
  );
}
