import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests of the admin console against the reference build (`npm run build:reference`,
 * the production build plus the component reference) served by `vite preview`, which sends
 * the production CSP and security headers (security-policy.ts).
 *
 * No Laravel runs here: the preview proxy points at a closed local port, so the connection
 * check meets a real "Laravel not answering" path; other API answers are mocked per test
 * (tests/e2e/support/mock-api.ts) and labelled as such. The real flows against Laravel and
 * MySQL are playwright.integration.config.ts (tests/integration). One worker: the owner
 * machine has limited memory (AGENTS.md).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run preview:reference",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { SOLVEIT_ADMIN_API_TARGET: "http://127.0.0.1:9" },
  },
});
