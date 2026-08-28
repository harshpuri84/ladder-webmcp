import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/panel.css';

/**
 * The second product's entry point, and the second module graph. `webmcp/adapter.ts` holds
 * module-scope singletons — the tool registry, the standing rules, the approval history — so two
 * applications in one document is out of scope by design (see `configureHost`'s doc comment).
 * Two Vite entries is what makes that a guarantee rather than a promise: this page and the
 * freight console never share a module instance.
 *
 * `EdgeApp` is imported dynamically so the dev-only WebMCP test double can install itself before
 * the adapter reads `document.modelContext`. In a production build `import.meta.env.DEV` is
 * false, the branch is dropped, and neither the double nor its chunk is emitted.
 */
async function boot() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    await import('../dev/fake-model-context');
  }
  const { default: EdgeApp } = await import('./App');
  createRoot(document.getElementById('edge-root')!).render(
    <StrictMode>
      <EdgeApp />
    </StrictMode>,
  );
}

void boot();
