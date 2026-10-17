/**
 * The admin console's only way to reach Laravel. Screens import from here; nothing else calls
 * `fetch` for the admin API. Contract documents: docs/api/admin-auth.md, docs/api/admin-users.md.
 */
import { createAccountApi } from "./account";
import { createAdminApiClient } from "./client";

export {
  createAccountApi,
  isExpiredSignIn,
  serverClockOffset,
  type AccountApi,
  type VerifiedAccount,
} from "./account";
export {
  adminApiUrl,
  automaticReplayAllowlist,
  createAdminApiClient,
  mayReplayAutomatically,
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

const responseListeners = new Set<(status: number) => void>();

/**
 * Be told the status of every admin API response this tab receives (no body, no request data).
 * Returns the unsubscribe function.
 */
export function onAdminApiResponse(listener: (status: number) => void): () => void {
  responseListeners.add(listener);

  return () => responseListeners.delete(listener);
}

/** The client the application uses (same origin, document cookies, browser fetch). */
export const adminApi = createAdminApiClient({
  onResponse: (status) => responseListeners.forEach((listener) => listener(status)),
});

/** The B3.2b endpoints on that client (docs/api/admin-auth.md). */
export const accountApi = createAccountApi(adminApi);
