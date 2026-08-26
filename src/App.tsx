import { Console } from './ui/Console';
import { ProposalPanel } from './ui/ProposalPanel';
import { RungStrip } from './ui/RungStrip';
import { webmcpAvailable } from './webmcp/adapter';
import { registerDomainTools } from './domain/tools';

registerDomainTools();

function WebmcpBanner() {
  return (
    <div className="webmcp-banner">
      <h2 className="webmcp-banner-heading">The agent half needs WebMCP — the console below works either way</h2>
      <p>
        This browser can't reach the six shipment tools an agent would call, but every row is
        still here to browse by hand. To turn the agent half on, open this page in one of:
      </p>
      <ul className="webmcp-banner-list">
        <li><strong>ChatGPT desktop's built-in browser</strong> — supports WebMCP with no setup.</li>
        <li>
          <strong>Google Chrome 149 or newer</strong> — enable{' '}
          <code className="webmcp-banner-code">chrome://flags/#enable-webmcp-testing</code>{' '}
          and restart. Paste this into your address bar — Chrome won't let a page link to a
          chrome:// URL directly.
        </li>
      </ul>
    </div>
  );
}

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Ladder</h1>
        <p className="app-subtitle">Shipment console</p>
      </header>
      <main>
        {!webmcpAvailable && <WebmcpBanner />}
        <RungStrip />
        <Console />
      </main>
      <ProposalPanel />
    </div>
  );
}

export default App;
