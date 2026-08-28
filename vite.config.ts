import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const entry = (file: string) => fileURLToPath(new URL(file, import.meta.url))

// Two entries, two module graphs. src/webmcp/adapter.ts holds module-scope singletons — the tool
// registry, the standing rules, the approval history — so the two products must never share one
// document. Separate entries is how that is guaranteed rather than promised.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: entry('./index.html'),
        edge: entry('./edge.html'),
      },
    },
  },
})
