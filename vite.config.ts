/// <reference types="vitest/config" />
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
  // Vitest stubs every stylesheet import to an empty string by default — including a `?raw`
  // read of one. A suite that asserts against the shipped sheet would therefore pass against
  // nothing at all, silently, forever. Turning this on makes such a read return the real file.
  // It costs nothing elsewhere: `src/main.tsx` is the only module that imports the sheet, and
  // no test imports it.
  test: { css: true },
  build: {
    rollupOptions: {
      input: {
        main: entry('./index.html'),
        edge: entry('./edge.html'),
      },
    },
  },
})
