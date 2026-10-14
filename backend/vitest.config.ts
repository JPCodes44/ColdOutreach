import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Test against shared source so no separate common build is needed.
      '@emailstrat/common': fileURLToPath(
        new URL('../common/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'edge-runtime',
    include: ['tests/**/*.test.ts'],
    server: { deps: { inline: ['convex-test'] } },
  },
});
