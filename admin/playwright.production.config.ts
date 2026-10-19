import { defineConfig, devices } from "@playwright/test";
import { productionTarget } from "./tests/production/support/stack";

// Throws while the configuration loads, before anything runs, without an explicit throwaway
// project and a .test admin origin. The global setup then runs the synthetic-stack guard.
const { origin } = productionTarget();

/**
 * Real-browser test of the production admin image behind the private admin listener (B3.2d),
 * on a running production Docker stack with synthetic data: compose.prod.yaml plus
 * compose.prod.admin-tls.yaml, profiles bundled-db and admin (infra/docker/scripts/verify-admin.sh
 * runs first). Nothing is mocked: nginx serves the built console with the production headers,
 * TLS is real (a throwaway self-signed certificate per run, hence ignoreHTTPSErrors), and
 * Laravel runs in the production backend image on its MySQL. The admin host resolves to the
 * loopback address the listener is published on; no DNS or real domain is involved.
 *
 * No traces, screenshots, or videos: they would record the access link, setup key, recovery
 * codes, and password. One worker. Never point this at a real deployment: the global setup
 * refuses anything but a throwaway stack (infra/docker/scripts/check-synthetic-stack.sh).
 */
export default defineConfig({
  testDir: "tests/production",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: "test-results/production",
  globalSetup: "./tests/production/support/global-setup.ts",
  use: {
    baseURL: origin,
    ignoreHTTPSErrors: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [
            `--host-resolver-rules=MAP ${new URL(origin).hostname} ${process.env.SOLVEIT_ADMIN_TLS_IP ?? "127.0.0.1"}`,
          ],
        },
      },
    },
  ],
});
