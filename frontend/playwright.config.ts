import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
export const SITE_URL = `http://localhost:${PORT}`;

/**
 * E2E runs against the production build served statically, the same way it
 * will be hosted. VITE_SITE_URL is set so canonical URLs and the sitemap exist.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: SITE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && node scripts/serve.mjs",
    url: SITE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_SITE_URL: SITE_URL, PORT: String(PORT) },
  },
});
