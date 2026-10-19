import { defineConfig, devices } from "@playwright/test";
import { demoTarget } from "./tests/demo/support/stack";

// Throws while the configuration loads, before anything runs, unless a rehearsal demo project
// and its state folder are named. The global setup then runs the demo guard.
const target = demoTarget();
const host = new URL(target.origin).hostname;
// Local mode: the TLS listener itself. Tunnel mode: the edge stand-in (tests/demo/support/edge.ts)
// on loopback, so the browser speaks to the tunnel host as it would through Cloudflare.
const resolverRule =
  target.mode === "tunnel" ? `MAP ${host} 127.0.0.1:${target.edgePort}` : `MAP ${host} 127.0.0.1`;

/**
 * Real-browser rehearsal of the team demo (B5a, docs/development/cloudflare-demo.md) on the
 * stack manage-demo.sh started: production admin image, admin listener, Laravel in the
 * production backend image, MySQL with the seeded synthetic data. Nothing is mocked. TLS is a
 * throwaway self-signed certificate (hence ignoreHTTPSErrors). Never against the owner's demo
 * project or a real deployment (support/stack.ts).
 *
 * No traces, screenshots, or videos: they would record the access link, setup key, recovery
 * codes, and password. One worker; the owner bootstrap works once per database.
 */
export default defineConfig({
  testDir: "tests/demo",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: "test-results/demo",
  globalSetup: "./tests/demo/support/global-setup.ts",
  use: {
    baseURL: target.origin,
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
        launchOptions: { args: [`--host-resolver-rules=${resolverRule}`] },
      },
    },
  ],
});
