import { useEffect } from 'react';
import { ProposalPanel } from './ui/ProposalPanel';
import { ActivityList } from './ui/ActivityList';
import { ToolPill } from './ui/ToolPill';
import { TabBar, TABPANEL_ID, tabButtonId } from './ui/TabBar';
import { RegistrationCorners } from './ui/ProofMark';
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
        <header className="app-header">
          <h1>Ladder</h1>
          <p className="app-subtitle">
            Every agent write comes here as a proof before it lands
          </p>
        </header>
        <TabBar tab={tab} setTab={setTab} />
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
          <RegistrationCorners />
          {page}
        </div>
      </div>
      {/*
       * Always mounted, regardless of tab — ActivityList's run log and ToolPill's standing-rule
       * state both live in local component state, so unmounting either on a tab change would
       * wipe them, and a result with no proposal (a standing rule firing automatically, or a
       * call with nothing to decide) never touches the tab at all and would go unlogged forever
       * if the list wasn't there to catch it. Hidden with CSS instead of being left unmounted,
       * so their subscriptions and state ride out a tab change untouched.
       */}
      <div className={tab === 'proof' ? undefined : 'app-tab-offstage'} aria-hidden={tab !== 'proof'}>
        <ActivityList />
      </div>
      <div className={tab === 'proof' ? undefined : 'app-tab-offstage'} aria-hidden={tab !== 'proof'}>
        <ToolPill />
      </div>
      <ProposalPanel />
    </div>
  );
}

export default App;
