import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const PORT = 4174;
const SITE_URL = `http://localhost:${PORT}`;

/**
 * The website inquiry channel is fixed at build time (VITE_* values are
 * inlined), so a runtime mock cannot turn it on in the default build. This
 * config makes a separate API-enabled production build in build/inquiry-api
 * and serves it on its own port; the default build and `npm run test:e2e`
 * keep proving the disabled mode.
 *
 * The API origin below is never contacted: every request to it is answered
 * by page.route in tests/e2e-api (mocked responses, no real inquiry data).
 */
export const MOCK_API_ORIGIN = "http://127.0.0.1:65530";

export default defineConfig({
  ...base,
  testDir: "./tests/e2e-api",
  use: { ...base.use, baseURL: SITE_URL },
  webServer: {
    command: "npm run build && node scripts/serve.mjs",
    url: SITE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      BUILD_DIR: "build/inquiry-api",
      PORT: String(PORT),
      VITE_SITE_URL: SITE_URL,
      VITE_INQUIRY_API_ENABLED: "true",
      VITE_API_BASE_URL: MOCK_API_ORIGIN,
    },
  },
});
