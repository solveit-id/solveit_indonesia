/**
 * The admin console's only way to reach Laravel. Screens import from here; nothing else calls
 * `fetch` for the admin API. Contract documents: docs/api/admin-auth.md, docs/api/admin-users.md.
 */
import { createAdminApiClient } from "./client";

export {
  adminApiUrl,
  createAdminApiClient,
  type AdminApiClient,
  type AdminHttpMethod,
  type AdminReplayPolicy,
  type AdminRequest,
  type AdminResponse,
} from "./client";
export { checkAdminApiConnection, type ConnectionCheck } from "./connection";
export * from "./contracts";
export { readXsrfToken, XSRF_COOKIE, XSRF_HEADER } from "./csrf";
export {
  AdminApiError,
  isAdminApiError,
  type AdminApiErrorKind,
  type AdminWriteOutcome,
} from "./errors";

/** The client the application uses (same origin, document cookies, browser fetch). */
export const adminApi = createAdminApiClient();
