import { ProofMark } from '../ProofMark';
import { Walkthrough } from '../mock/Walkthrough';
import { DOMAINS } from '../mock/domains';
import '../mock/mock.css';

/**
 * The reusability tab: the same four beats over kinds of work that have nothing else in common.
 *
 * It maps over `DOMAINS` rather than naming a sequence, so a new kind of work is a data change
 * and never a page change. Every sheet below is drawn — the warning above them says so, and each
 * sheet repeats it at its own head and foot, because a screenshot of one sheet has to carry the
 * disclaimer with it.
 */
export function ElsewherePage() {
  return (
    <main>
      <h2 className="ew-heading">The nouns change. Nothing else does.</h2>

      <p className="ew-lead">
        The engine in <span className="mono">src/core/</span> has no idea what a shipment is. It
        records writes, computes a diff, and refuses anything the human did not approve. Freight
        is one skin over it.
      </p>
      <p className="ew-lead">
        Below are three kinds of work with nothing in common except their shape: a decision worth
        money, made against records a person is answerable for, that an agent proposed all at
        once. Step through them and watch the same four beats.
      </p>

      <p className="ew-warning">
        <ProofMark name="dagger" size={14} />
        <span>
          <strong className="ew-warning-lead">These are mockups.</strong> The air freight console
          on the previous tab is real and runs the engine. These three are drawn, not wired.
        </span>
      </p>

      <div className="ew-list">
        {DOMAINS.map(domain => (
          <Walkthrough key={domain.id} domain={domain} />
        ))}
      </div>
    </main>
  );
}
