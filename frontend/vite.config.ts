import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The only chunk over Vite's 500 kB default is Handsontable (~1.38 MB
    // minified, ~345 kB gzip), which is lazy-loaded with the Recipients
    // screen (email-table/EmailTable.tsx) and never part of the initial
    // bundle (~310 kB). Raise the limit just above it so new growth elsewhere
    // still warns.
    chunkSizeWarningLimit: 1400,
  },
  resolve: {
    alias: {
      // Resolve the shared workspace to its source so dev/test work without a
      // separate `bun run --cwd common build` step.
      '@emailstrat/common': fileURLToPath(
        new URL('../common/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
});
