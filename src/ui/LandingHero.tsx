import { useEffect, useState } from 'react';
import { ProposalPanel } from './ProposalPanel';
import { buildSpecimen } from './specimen';
import { specimenResult } from './specimen-result';
import { store } from '../domain/store';
import { PROMPTS } from './prompts';
import { useReveal } from './useReveal';
import {
  isWebmcpAvailable, listTools, onAvailabilityChange, onToolsChange,
} from '../webmcp/adapter';
import type { PendingProposal } from '../webmcp/adapter';
import type { ToolPayload } from '../webmcp/result';

/**
 * One stage of the path from a prompt to a proof. `verb` is the stage's name, a word in the
 * body face on every row; `tool` is the registered tool name behind it, where there is one,
 * printed in mono at the head of the description so a name and a word never sit in one column.
 */
interface Stage {
  verb: string;
  tool?: string;
  what: string;
  who: 'agent' | 'ladder' | 'operator';
}

const WHO: Record<Stage['who'], string> = {
  agent: 'agent',
  ladder: 'Ladder',
  operator: 'operator',
};

/**
 * The proof page's own words for a browser with no runtime (see `WebmcpBanner` in
 * pages/ProofPage.tsx), so the two pages cannot describe the same browser two ways.
 * `LandingHero.test.tsx` holds the two strings together.
 */
export const WEBMCP_ABSENT = 'Agent half needs WebMCP';

/**
 * Whether the browser has handed this page a WebMCP runtime, and how many tools the page has
 * registered with it. Both read live off the adapter: a host that injects the namespace a
 * moment after load (ChatGPT desktop does) turns the line over the instant it lands.
 */
function useWebmcpSignal(): { available: boolean; tools: number } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const offA = onAvailabilityChange(() => setTick(t => t + 1));
    const offT = onToolsChange(() => setTick(t => t + 1));
    return () => { offA(); offT(); };
  }, []);
  return { available: isWebmcpAvailable(), tools: listTools().length };
}

/**
 * The first viewport of the landing page: the name, the claim, the path from prompt to proof,
 * and beside them a real proof sheet, rendered by the same component the proof tab uses and
 * fed by the same tool run against the same register. Read-only; the sheet is inert and the
 * caption says what it is for anyone who cannot see it.
 *
 * Every figure in the path is read off the specimen run and the register, never typed, so the
 * left column and the sheet beside it cannot describe two different runs.
 */
export function LandingHero() {
  const [specimen, setSpecimen] = useState<PendingProposal | null>(null);
  const [result, setResult] = useState<ToolPayload | null>(null);
  const { available, tools } = useWebmcpSignal();
  // The whole path runs once, the first time the hero is on screen: the prompt, then each
  // stage in turn, and beside each stage the part of the sheet it produces, then what goes
  // back to the agent. One sequence, about two seconds, never replayed. Visible at rest,
  // under reduced motion and with no script; see useReveal and `.hero.rv` in styles.css.
  const heroRef = useReveal<HTMLElement>();

  useEffect(() => {
    let live = true;
    void buildSpecimen().then(async p => {
      if (!live) return;
      setSpecimen(p);
      const r = await specimenResult(p);
      if (live) setResult(r);
    });
    return () => { live = false; };
  }, []);

  const onRegister = Object.keys(store.state.shipments).length;
  const referred = specimen?.authority.referred.length ?? 0;
  const matched = specimen?.diff.totals.records ?? 0;
  const marked = specimen ? matched - referred : 0;
  const role = specimen?.authority.role;
  const target = specimen?.authority.target;
  const caption = specimen
    ? `The proof sheet for ${specimen.toolName} on CONSOL-A, as the operator sees it: `
      + `${matched} shipments matched, ${marked} marked for the operator `
      + `to apply, ${referred} referred to a duty manager, and the stamp that applies them. `
      + 'Under it, what the tool returns to the agent once she stamps.'
    : 'The proof sheet for propose_remedy on CONSOL-A, as the operator sees it.';

  const stages: Stage[] = specimen ? [
    {
      verb: 'Search', tool: 'search_shipments', who: 'agent',
      what: `reads the register. ${onRegister} house shipments were on the cancelled flight.`,
    },
    {
      verb: 'Inspect', tool: 'get_shipment', who: 'agent',
      what: 'reads one record: cargo, tier, promised date, and which remedies a rule closes.',
    },
    {
      verb: 'Propose', tool: specimen.toolName, who: 'agent',
      what: `runs for real, against a copy of the page. ${matched} shipments matched. Nothing has landed.`,
    },
    {
      verb: 'Refer', who: 'ladder',
      what: `${referred} cost more than ${role ? `a ${role.label.toLowerCase()}` : 'the operator'} may sign`
        + ` for. They are set apart for ${target ? `the ${target.label.toLowerCase()}` : 'a second person'}`
        + ' before she reads the sheet.',
    },
    {
      verb: 'Proof', who: 'operator',
      what: `She marks ${marked}, strikes any she wants left as they are, and stamps. The stamp is what lands.`,
    },
  ] : [];

  // The sum under the payload, done off the payload: applied plus every rejected count.
  const checkTerms = result ? [result.applied, ...result.rejected.map(r => r.count)] : [];

  return (
    <section className="hero" aria-labelledby="hero-name" ref={heroRef}>
      {/*
        * The fold: four things, and the templates this was measured against put exactly four
        * there. An eyebrow that says the agent is driving this page, the claim, one sentence,
        * and two ways in, with the sheet beside them. Everything that was here before it and
        * is still worth reading (the path from prompt to proof, and what the agent is handed
        * back) moved below the fold, where a reader has agreed to care.
        */}
      <div className="hero-fold">
        <div className="hero-text">
          {/* The count is the registry's, read live; with no runtime the line says what the
              proof page says, in the same words, and claims nothing. */}
          <p className="hero-webmcp hero-seq hero-seq--prompt">
            {available
              ? <>WebMCP active <span className="hero-webmcp-sep" aria-hidden="true">·</span> {tools} page-owned {tools === 1 ? 'tool' : 'tools'}</>
              : WEBMCP_ABSENT}
          </p>
          {/* The claim is the page's heading, and now the largest thing on the page. It was
              26px under an 80px figure until 2 Sep 2026, so the first thing a stranger's eye
              landed on was a number they could not yet read. */}
          <h1 className="hero-claim-lead" id="hero-name">
            Agents can act. <span className="hero-claim-line">Humans stay in control.</span>
          </h1>
          <p className="hero-claim">Every agent write comes here as a proof before it lands.</p>
          <p className="hero-acts">
            <a className="hero-act hero-act--go" href="#/proof">Open the proof</a>
            <a className="hero-act" href="#from-prompt-to-proof">See how it works</a>
          </p>
        </div>
        {/* The figure's label carries the whole caption for a reader who cannot see the sheet;
            the sheet itself carries no "specimen" tag, because a tag that encodes nothing is a
            prop, and the line at its foot already says the rest of it is on the proof tab. */}
        <figure className="hero-specimen" aria-label={caption}>
          {specimen && <ProposalPanel specimen={specimen} />}
        </figure>
      </div>

      {specimen && (
        <div className="hero-below" id="from-prompt-to-proof">
          <div className="hero-path" aria-label="From prompt to proof">
            <h2 className="hero-path-head hero-seq hero-seq--prompt">From prompt to proof</h2>
            <p className="hero-path-prompt hero-seq hero-seq--prompt">“{PROMPTS[0].text}”</p>
            <ol className="hero-stages">
              {stages.map(st => (
                <li className="hero-stage hero-seq" key={st.verb}>
                  <span className="hero-stage-name">{st.verb}</span>
                  <span className="hero-stage-what">
                    {st.tool && <span className="mono hero-stage-tool">{st.tool}</span>}
                    {st.tool ? ' ' : ''}{st.what}
                  </span>
                  <span className={`hero-stage-who hero-stage-who--${st.who}`}>{WHO[st.who]}</span>
                </li>
              ))}
            </ol>
            <p className="hero-path-after hero-seq hero-seq--after">
              After the stamp, the agent is told by shipment id which of the {matched} landed,
              which the operator struck, and which are waiting on a duty manager; nothing moved
              before that stamp, and nothing moves after it that the sheet did not show.
            </p>
          </div>

          {/* The loop closing: the structured result the agent receives for this exact run,
              read off the same specimen stamped as it stands (see specimen-result.ts). The
              ledger, not the wire format; the whole payload is printed further down the page
              under "A refusal is a message". Every value is read off the run, never typed. */}
          {result && (
            <div className="hero-return hero-seq hero-seq--return">
              <p className="hero-return-caps">Returned to the agent after the stamp</p>
              <dl className="hero-ledger mono">
                <div><dt>status</dt><dd>{result.status}</dd></div>
                <div><dt>requested</dt><dd>{result.requested}</dd></div>
                <div><dt>applied</dt><dd>{result.applied}</dd></div>
                {result.referred && (
                  <div>
                    <dt>referred</dt>
                    <dd>{result.referred.count} to a {result.referred.awaiting}</dd>
                  </div>
                )}
                <div><dt>replan required</dt><dd>{result.replan_required ? 'yes' : 'no'}</dd></div>
              </dl>
              <p className="pr-check mono hero-check">
                {checkTerms.join(' + ')} = {result.requested}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
