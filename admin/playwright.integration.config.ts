import { defineConfig, devices } from "@playwright/test";
import {
  ADMIN_ORIGIN,
  LARAVEL_ORIGIN,
  harnessEnvironment,
} from "./tests/integration/support/env.mjs";

/**
 * Real-browser tests against Laravel and MySQL (B3.2b), nothing mocked on the critical paths.
 *
 * - Laravel: tests/integration/support/start-laravel.mjs runs the safety gate, migrate:fresh
 *   on the MySQL testing database, then the PHP built-in server on 127.0.0.1:8100 with the
 *   gated router (backend/tests/E2E/server.php). Synthetic accounts only (@example.test).
 * - The console: the production build (`npm run build`, dist/) served by `vite preview` on
 *   127.0.0.1:4176 with the production CSP header and the same-origin proxy to Laravel, so
 *   ADMIN_URL is http://127.0.0.1:4176 and cookies, Origin, and CSRF are the real ones.
 *
 * No traces, screenshots, or videos: they would record access-link URLs, setup keys, recovery
 * codes, and passwords. One worker (shared database, limited memory, AGENTS.md). Every test
 * empties the testing database first (tests/integration/support/backend.ts).
 */
export default defineConfig({
  testDir: "tests/integration",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: "test-results/integration",
  use: {
    baseURL: ADMIN_ORIGIN,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      // Layout and accessibility of the real screens only; the flows run on desktop.
      name: "tablet",
      testMatch: /responsive\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 } },
    },
    { name: "mobile", testMatch: /responsive\.spec\.ts$/, use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node tests/integration/support/start-laravel.mjs",
      url: `${LARAVEL_ORIGIN}/up`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe",
      env: harnessEnvironment() as Record<string, string>,
    },
    {
      command: "npx vite preview --port 4176 --strictPort",
      url: `${ADMIN_ORIGIN}/masuk`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { SOLVEIT_ADMIN_API_TARGET: LARAVEL_ORIGIN },
    },
  ],
});
