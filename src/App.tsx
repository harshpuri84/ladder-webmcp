import { useEffect } from 'react';
import { ProposalPanel } from './ui/ProposalPanel';
import { LandingHero } from './ui/LandingHero';
import { ActivityList } from './ui/ActivityList';
import { TABPANEL_ID, tabButtonId } from './ui/TabBar';
import { SiteNav } from './ui/SiteNav';
import { ToolPill } from './ui/ToolPill';
import { useTab } from './ui/useTab';
import { ProofPage } from './ui/pages/ProofPage';
import { ProblemPage } from './ui/pages/ProblemPage';
import { ElsewherePage } from './ui/pages/ElsewherePage';
import { hasPendingProposal, onProposalArrival, registerWhenReady } from './webmcp/adapter';
import { registerDomainTools } from './domain/tools';

// Registers immediately if the namespace is already there (a Chrome flag build injects it
// before this runs), otherwise waits for a host that injects it a moment later — ChatGPT
// desktop's built-in browser does exactly that — and registers the instant it appears. See
// registerWhenReady's own doc comment in webmcp/adapter.ts.
registerWhenReady(registerDomainTools);

function App() {
  const { tab, setTab } = useTab();

  // Tools register with the browser on mount, not per tab, so an agent can call one while a
  // judge is reading the problem page. If the panel opened over prose with no register behind
  // it, the agent would wait out its 96 seconds against a diagram. Any arriving proposal moves
  // the tab first.
  //
  // Deliberately not an `onProposal` subscription: `ProposalPanel` (mounted below this component)
  // is one too, and React flushes a child's passive effects before its parent's — so by the time
  // this effect ran, `ProposalPanel` would already have drained a proposal buffered before mount
  // and this listener would see nothing. `hasPendingProposal`/`onProposalArrival` read a plain
  // counter instead of the buffer itself, so this catches a proposal that arrived before mount
  // (checked once, here) exactly the same way it catches one that arrives after.
  useEffect(() => {
    if (hasPendingProposal()) setTab('proof');
    return onProposalArrival(() => setTab('proof'));
  }, [setTab]);

  const page =
    tab === 'proof' ? <ProofPage /> :
    tab === 'elsewhere' ? <ElsewherePage /> :
    <ProblemPage />;

  return (
    <>
    <SiteNav tab={tab} setTab={setTab} />
    <div className="app-shell">
      {/*
        * One width for all three tabs. The register genuinely needs the full 1100px, and the
        * two reading tabs used to stop at 724px — which is what left every rule on the problem
        * page ending short of the tab bar's own rule, and left two thirds of a wide screen
        * empty beside a column of prose. Both are the same defect: a measure was standing in
        * for a composition.
        *
        * So the shell keeps one width and the reading sheet spends it properly — the prose
        * still sits at its measure, and the space beside it is the sheet's margin, where the
        * figures, the measurements and the notes go. `app--reading` no longer moves the right
        * edge; it says which mode the sheet inside is set for.
        */}
      <div className={tab === 'proof' ? 'app' : 'app app--reading'}>
        {/* The landing page opens on the product itself: the name, the claim and a specimen
            proof sheet, above the tab strip. The two working tabs start on the instrument; the
            name is in the document title and on the first tab, and nowhere on the tab row. */}
        {tab === 'problem' && <LandingHero />}
        {/*
          * The sheet the index tabs are cut into. It is stock on the desk, not a card: one
          * ground, the head rule the tab bar used to draw for itself, and the shadow recipe of
          * a slip lying on a surface. Making it a real surface is what lets the active tab be
          * continuous with it, which is the whole reason a tab reads as a tab.
          */}
        <div
          id={TABPANEL_ID}
          className="app-sheet"
          role="tabpanel"
          aria-labelledby={tabButtonId(tab)}
          tabIndex={0}
        >
          {page}
        </div>
      </div>
      {/*
       * Always mounted, regardless of tab — ActivityList's run log lives in local component
       * state, so unmounting it on a tab change would wipe it, and a result with no proposal (a standing rule firing automatically, or a
       * call with nothing to decide) never touches the tab at all and would go unlogged forever
       * if the list wasn't there to catch it. Hidden with CSS instead of being left unmounted,
       * so its subscription and state ride out a tab change untouched. The tool inventory sits
       * in the proof page's own flight header, where the register's counts are.
       */}
      {/* `app-rail` is only a name for the shell to reach: this wrapper, not the rail inside it,
          is the box the shell lays out, so it is the box that has to run the full height of the
          sheet for the rail to have anywhere to stick to. See `.app-rail` in styles.css. */}
      <div
        className={tab === 'proof' ? 'app-rail' : 'app-rail app-tab-offstage'}
        aria-hidden={tab !== 'proof'}
      >
        <ActivityList />
      </div>
      <ProposalPanel />
      {/* The agent's permission surface, docked at the foot of the working page. Only on the
          proof route: the reading tabs have no register for it to be about. */}
      {tab === 'proof' && <ToolPill />}
    </div>
    </>
  );
}

export default App;
