import { Console } from './ui/Console';

function App() {
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
