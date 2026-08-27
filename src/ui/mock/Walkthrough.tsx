import { useState } from 'react';
import { ProofMark } from '../ProofMark';
import { STEPS } from './types';
import type { MockDomain, MockRow } from './types';
import './mock.css';

/**
 * A drawn sequence of the four beats, for one kind of work.
 *
 * This is a picture. It imports nothing from `src/core/`, `src/webmcp/` or `src/domain/`, no
 * engine runs behind it, and it says so on its face at every step — once at the head of the
 * sheet and once at its foot, in words rather than in a tint, so it survives a screenshot, a
 * greyscale print and being read out of context. A judge who cannot tell a mockup from the
 * running console has been misled, and that is worse than not making the argument at all.
 *
 * The step labels come from the shared `STEPS` constant rather than from the domain, because
 * the sameness of those four words across every domain *is* the argument the page makes. A
 * domain that could name its own beats could quietly differ from the others.
 */

const AMOUNT = /-?\d[\d,]*(?:\.\d+)?/;

/** The number out of an authored cost string: "+€480" is 480, "−4.2 pt" is -4.2. */
function amount(text: string): number {
  const found = text.replace(/−/g, '-').match(AMOUNT);
  return found ? Number(found[0].replace(/,/g, '')) : 0;
}

/**
 * Rewrites the figure inside an authored magnitude line, keeping its symbol and its unit words.
 * The remaining magnitude is then derived from the rows still on the sheet and cannot disagree
 * with the costs printed beside them — the same discipline the real console holds itself to,
 * where every figure is counted off the register rather than written down next to it.
 */
function restate(magnitude: string, value: number): string {
  return magnitude.replace(AMOUNT, new Intl.NumberFormat('en-GB').format(value));
}

/**
 * One line of the drawn proof, marked up the way the real one is: a mark in the gutter, the
 * change in words, and — where something was taken out — a rule through the line and a stamped
 * sentence saying why. Three signals, none of them a colour. Take the hue out and a cut row is
 * still struck and still says "Struck out"; a declined row still carries the dagger and still
 * prints the rule that declined it.
 */
function Row({ row, sculpted }: { row: MockRow; sculpted: boolean }) {
  const struck = sculpted && Boolean(row.cut);
  const held = Boolean(row.declined);
  const mark = held ? 'dagger' : struck ? 'dele' : 'insert';

  return (
    <li className={`mk-row${struck ? ' mk-row--cut' : ''}${held ? ' mk-row--held' : ''}`}>
      <span className="mk-row-mark">
        <ProofMark name={mark} size={14} />
      </span>
      <div className="mk-row-body">
        <div className="mk-row-head">
          <span className="mk-row-id mono">{row.id}</span>
          <span className="mk-row-cost mono">{row.cost}</span>
        </div>
        <div className="mk-row-sub">{row.label} · {row.detail}</div>
        <div className="mk-row-change">{row.change}</div>
        {struck && <span className="mk-row-note">Struck out — stands as it is</span>}
        {row.declined && (
          <span className="mk-row-note mk-row-note--held">{row.declined}</span>
        )}
      </div>
    </li>
  );
}

export interface WalkthroughProps {
  domain: MockDomain;
}

export function Walkthrough({ domain }: WalkthroughProps) {
  const [step, setStep] = useState(0);

  // A declined row is the tool's own refusal, not a change anyone can mark, so it is set apart
  // from the run and counted in neither figure — the same treatment the real panel gives held
  // matter.
  const declined = domain.rows.filter(r => r.declined);
  const live = domain.rows.filter(r => !r.declined);
  const kept = live.filter(r => !r.cut);
  const cutCount = live.length - kept.length;

  const sculpted = step >= 2;
  const records = sculpted ? kept.length : live.length;
  const magnitude = sculpted
    ? restate(domain.magnitude, kept.reduce((n, r) => n + amount(r.cost), 0))
    : domain.magnitude;
  const narrowed = sculpted && cutCount > 0;

  const headingId = `mk-${domain.id}-name`;

  return (
    <section className="mk" aria-labelledby={headingId}>
      {/* Said first, before anything that could be mistaken for a reading. */}
      <p className="mk-stamp">
        <ProofMark name="dagger" size={13} />
        <span className="mk-stamp-word">Mockup</span>
        <span className="mk-stamp-tail">
          Drawn, not wired. No engine runs behind this sheet and no record here exists.
        </span>
      </p>

      <header className="mk-head">
        <h3 className="mk-name" id={headingId}>{domain.name}</h3>
        <p className="mk-who">
          For {domain.who}. The write tool is <span className="mono">{domain.toolName}</span>.
        </p>
      </header>

      {/*
        Which beat is open is said by the weight and the double rule under it — the same "in
        effect" motif the tab bar and the printed rule use — never by the tint alone. The
        ordinals are earned here: the sequence is the information.
      */}
      <ol className="mk-steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={i === step ? 'mk-step mk-step--now' : 'mk-step'}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="mk-step-n mono">{i + 1}</span>
            <span className="mk-step-label">{label}</span>
          </li>
        ))}
      </ol>

      <div className="mk-nav">
        <button
          type="button"
          className="mk-nav-btn"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Back
        </button>
        <button
          type="button"
          className="mk-nav-btn"
          onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
          disabled={step === STEPS.length - 1}
        >
          Forward
        </button>
        <p className="mk-nav-now" aria-live="polite">
          Step <span className="mono">{step + 1}</span> of{' '}
          <span className="mono">{STEPS.length}</span> — {STEPS[step]}
        </p>
      </div>

      {/* Keyed on the step so the entrance replays; the entrance never says anything the words
          below it do not already say. */}
      <div className="mk-body" key={step}>
        {step === 0 && (
          <div className="mk-call">
            <p className="mk-field">What the agent was asked</p>
            <p className="mk-prompt">{domain.prompt}</p>
            <p className="mk-call-tail">
              It reached for <span className="mono">{domain.toolName}</span> and called it once,
              for every record at once. Nothing has been written yet.
            </p>
          </div>
        )}

        {step > 0 && (
          <>
            <div className="mk-figures">
              <div className="mk-figure">
                <span className="mk-figure-line">
                  <span className="mk-figure-count mono">{records}</span>
                  {/* The figure it came down from, struck. Hidden from assistive tech because
                      the caption below says the same thing in words. */}
                  {narrowed && (
                    <span className="mk-figure-was mono" aria-hidden="true">{live.length}</span>
                  )}
                </span>
                <span className="mk-figure-label">{domain.noun} marked</span>
              </div>
              <div className="mk-figure mk-figure--money">
                <span className="mk-figure-line">
                  <span className="mk-figure-money mono">{magnitude}</span>
                  {narrowed && (
                    <span className="mk-figure-was mono" aria-hidden="true">{domain.magnitude}</span>
                  )}
                </span>
              </div>
            </div>

            <p className="mk-figure-caption">
              {narrowed ? (
                <>
                  Struck down from <span className="mono">{live.length}</span> {domain.noun} and{' '}
                  <span className="mono">{domain.magnitude}</span>. The operator cut{' '}
                  <span className="mono">{cutCount}</span> and every figure moved with them.
                </>
              ) : (
                <>Everything the tool would write, before the operator has marked anything.</>
              )}
            </p>

            {declined.length > 0 && (
              <p className="mk-held-line">
                <ProofMark name="dagger" size={13} />
                <span>
                  <span className="mono">{declined.length}</span>{' '}
                  {declined.length === 1 ? 'record was' : 'records were'} declined by the tool
                  itself, counted in neither figure above
                </span>
              </p>
            )}
          </>
        )}

        {(step === 1 || step === 2) && (
          <>
            <ul className="mk-rows" aria-label={`The ${domain.noun} in this change`}>
              {live.map(row => (
                <Row key={row.id} row={row} sculpted={sculpted} />
              ))}
            </ul>

            {declined.length > 0 && (
              <>
                <p className="mk-field mk-field--held">Declined by the tool, with the rule</p>
                <ul className="mk-rows mk-held" aria-label="Records the tool declined">
                  {declined.map(row => (
                    <Row key={row.id} row={row} sculpted={sculpted} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <div className="mk-return">
            <p className="mk-return-lead">
              The operator cut it down, so the tool did not return success. It returned what
              happened and why the rest did not.
            </p>
            <pre className="mk-payload mono">{JSON.stringify(domain.payload, null, 2)}</pre>
            <p className="mk-return-tail">
              <span className="mono">applied</span> plus every rejected count equals{' '}
              <span className="mono">requested</span>. The agent can tell the tool's own refusal
              apart from the operator's, and replan against the difference rather than starting
              the whole call again.
            </p>
          </div>
        )}
      </div>

      <p className="mk-foot">
        Mockup — nothing on this sheet is connected to the engine, and no click here writes
        anything.
      </p>
    </section>
  );
}
