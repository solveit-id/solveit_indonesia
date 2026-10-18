// Shared by playwright.integration.config.ts, start-laravel.mjs, and the specs. Test-only
// loopback addresses: never the development ports (8000, 5174) or anything public.
import { fileURLToPath } from "node:url";

export const ADMIN_ORIGIN = "http://127.0.0.1:4176";
export const LARAVEL_HOST = "127.0.0.1";
export const LARAVEL_PORT = 8100;
export const LARAVEL_ORIGIN = `http://${LARAVEL_HOST}:${LARAVEL_PORT}`;

export const BACKEND_DIR = fileURLToPath(new URL("../../../../backend/", import.meta.url));
export const HARNESS = fileURLToPath(
  new URL("../../../../backend/tests/E2E/harness.php", import.meta.url),
);
export const ROUTER = fileURLToPath(
  new URL("../../../../backend/tests/E2E/server.php", import.meta.url),
);
/** The test clock (offset in seconds) both Laravel processes read; under test-results/. */
export const CLOCK_FILE = fileURLToPath(
  new URL("../../../test-results/integration-clock.json", import.meta.url),
);

/** Environment for every PHP process of the harness. */
export function harnessEnvironment() {
  const env = {
    ...process.env,
    SOLVEIT_E2E_ADMIN_URL: ADMIN_ORIGIN,
    SOLVEIT_E2E_CLOCK_FILE: CLOCK_FILE,
  };
  // The harness refuses any APP_ENV but testing; it pins that itself.
  delete env.APP_ENV;

  return env;
}
