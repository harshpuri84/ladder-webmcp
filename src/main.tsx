import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles.css';

/**
 * App is imported dynamically so the dev-only WebMCP test double can install itself before
 * the adapter module reads `document.modelContext`. In a production build `import.meta.env.DEV`
 * is `false`, the branch is dropped, and neither the double nor its chunk is emitted.
 */
async function boot() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    await import('./dev/fake-model-context');
  }
  const { default: App } = await import('./App');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
