import { useEffect } from 'react';
import { Console } from './ui/Console';
import { onProposal } from './webmcp/adapter';
import { registerDomainTools } from './domain/tools';

registerDomainTools();

function App() {
  useEffect(() => onProposal(p => {
    if (p) console.log('[ladder] pending proposal', p);
  }), []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Ladder</h1>
        <p className="app-subtitle">Shipment console</p>
      </header>
      <main>
        <Console />
      </main>
    </div>
  );
}

export default App;
