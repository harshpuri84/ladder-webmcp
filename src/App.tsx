import { useEffect } from 'react';
import { ProposalPanel } from './ui/ProposalPanel';
import { ActivityList } from './ui/ActivityList';
import { ToolPill } from './ui/ToolPill';
import { TabBar, TABPANEL_ID, tabButtonId } from './ui/TabBar';
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
      <div className="app">
        <header className="app-header">
          <h1>Ladder</h1>
          <p className="app-subtitle">
            Every agent write comes here as a proof before it lands
          </p>
        </header>
        <TabBar tab={tab} setTab={setTab} />
        <div id={TABPANEL_ID} role="tabpanel" aria-labelledby={tabButtonId(tab)} tabIndex={0}>
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
