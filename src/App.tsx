import { useEffect } from 'react';
import { ProposalPanel } from './ui/ProposalPanel';
import { ActivityList } from './ui/ActivityList';
import { ToolPill } from './ui/ToolPill';
import { TabBar } from './ui/TabBar';
import { useTab } from './ui/useTab';
import { ProofPage } from './ui/pages/ProofPage';
import { ProblemPage } from './ui/pages/ProblemPage';
import { ElsewherePage } from './ui/pages/ElsewherePage';
import { onProposal, registerWhenReady } from './webmcp/adapter';
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
  useEffect(() => onProposal(p => { if (p) setTab('proof'); }), [setTab]);

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
        <div role="tabpanel">{page}</div>
      </div>
      {tab === 'proof' && <ActivityList />}
      {tab === 'proof' && <ToolPill />}
      <ProposalPanel />
    </div>
  );
}

export default App;
