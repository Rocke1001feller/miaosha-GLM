import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [WxtVitest(), svelte()],
  resolve: {
    /**
     * 'browser' condition is required for Svelte 5 to use the client-side
     * runtime (svelte/internal/client) instead of SSR (svelte/internal/server).
     */
    conditions: ['browser'],
  },
  test: {
    /**
     * happy-dom is faster than jsdom and sufficient for our needs.
     * Component tests that require real browser rendering use Playwright (tests/e2e/).
     */
    environment: 'happy-dom',

    /**
     * Global test setup: imports @testing-library/jest-dom matchers and resets
     * fakeBrowser state between tests.
     */
    setupFiles: ['./tests/setup.ts'],

    /**
     * Test file patterns:
     *  - tests/**\/*.test.ts / .test.js  — unit & integration tests
     *  - tests/**\/*.svelte.test.ts      — Svelte component tests (runes-aware)
     *
     * bm-main vanilla-JS tests live under tests/unit/bm-main/ and are imported
     * via the harness pattern defined in tests/unit/bm-main/_harness.ts.
     */
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.js',
      'tests/**/*.svelte.test.ts',
    ],

    /**
     * Exclude Playwright E2E scripts — they run inside npm run build pipeline,
     * not through vitest.
     */
    exclude: [
      'scripts/**',
      'node_modules/**',
      'output/**',
      'public/**',
    ],

    globals: true,

    /**
     * Disable dependency pre-bundling in test mode. The project depends on
     * WXT's fakeBrowser and happy-dom, whose transitive imports touch
     * Node built-ins (e.g. node:module). Vite 6 + rolldown try to pre-bundle
     * them and fail on 'node:module' resolution. Disabling optimization keeps
     * tests running without impacting the production build.
     */
    deps: {
      optimizer: {
        web: { enabled: false },
        ssr: { enabled: false },
      },
    },
  },
});
