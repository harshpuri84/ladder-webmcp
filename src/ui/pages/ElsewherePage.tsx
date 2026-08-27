import { useState } from 'react';
import { ProofMark } from '../ProofMark';
import { Walkthrough } from '../mock/Walkthrough';
import { DOMAINS } from '../mock/domains';
import '../mock/mock.css';

/**
 * The reusability tab: the same four beats over kinds of work that have nothing else in common.
 *
 * One sheet is open at a time, chosen from a selector built off `DOMAINS`, so a new kind of work
 * is a data change and never a page change. One at a time rather than stacked because the claim
 * is that the beats are *identical*, and a reader can only check that by watching the same four
 * words survive a change of subject in the same place on the sheet — three sheets scrolling past
 * each other invite skimming instead.
 *
 * Switching remounts the sheet (`key`), which returns it to the first beat. A reader who left
 * freight on beat four and then picks the edge network is asking to see that sequence, not to
 * land in the middle of it.
 *
 * Every sheet below is drawn — the warning above them says so, and each sheet repeats it at its
 * own head and foot, because a screenshot of one sheet has to carry the disclaimer with it.
 */
export function ElsewherePage() {
  const [openId, setOpenId] = useState(DOMAINS[0].id);
  const open = DOMAINS.find(d => d.id === openId) ?? DOMAINS[0];

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
        once. Take one at a time and watch the same four beats, in the same four words.
      </p>

      <p className="ew-warning">
        <ProofMark name="dagger" size={14} />
        <span>
          <strong className="ew-warning-lead">These are mockups.</strong> The air freight console
          on the previous tab is real and runs the engine. These three are drawn, not wired.
        </span>
      </p>

      {/*
        Which kind of work is open is said by the weight, by the rule under the name and by
        `aria-pressed` — the same "in effect" motif the tab bar and the step strip use. The tint
        agrees with all three and says nothing on its own.
      */}
      <div className="ew-pick">
        <p className="ew-pick-label" id="ew-pick-label">The kind of work</p>
        <div className="ew-pick-row" role="group" aria-labelledby="ew-pick-label">
          {DOMAINS.map(domain => (
            <button
              key={domain.id}
              type="button"
              className={domain.id === open.id ? 'ew-pick-btn ew-pick-btn--now' : 'ew-pick-btn'}
              aria-pressed={domain.id === open.id}
              onClick={() => setOpenId(domain.id)}
            >
              {domain.name}
            </button>
          ))}
        </div>
      </div>

      <div className="ew-list">
        <Walkthrough key={open.id} domain={open} />
      </div>
    </main>
  );
}
