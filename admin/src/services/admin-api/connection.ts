import type { AdminApiClient } from "./client";
import { CSRF_COOKIE_PATH } from "./csrf";
import { isAdminApiError } from "./errors";

/**
 * One real round trip to the admin API through the same-origin proxy: `GET auth/csrf-cookie`.
 * It starts an anonymous session and signs nobody in (docs/api/admin-auth.md). Each state names
 * a cause a developer can act on; nothing is guessed.
 */
export type ConnectionCheck =
  /** 204: Laravel answered on the admin origin, the boundary accepted host and origin. */
  | { state: "reachable" }
  /** 403/404 from the boundary: ADMIN_URL does not match this origin, or the request crossed it. */
  | { state: "refused"; status: number }
  /** 503: the admin API refuses to run (for example a session driver other than database). */
  | { state: "unavailable" }
  /** 429: too many checks; the limiter allows 30 per minute per address. */
  | { state: "rate-limited"; retryAfterSeconds: number | undefined }
  /** No answer from Laravel: not running, or the dev proxy cannot reach it. */
  | { state: "unreachable"; status: number | null }
  /** Any other answer. */
  | { state: "unexpected"; status: number | null };

export async function checkAdminApiConnection(
  client: AdminApiClient,
  signal?: AbortSignal,
): Promise<ConnectionCheck> {
  try {
    const response = await client.request({ method: "GET", path: CSRF_COOKIE_PATH, signal });

    return response.status === 204
      ? { state: "reachable" }
      : { state: "unexpected", status: response.status };
  } catch (error) {
    if (!isAdminApiError(error)) {
      return { state: "unexpected", status: null };
    }

    switch (error.kind) {
      case "forbidden":
      case "not-found":
        return { state: "refused", status: error.status ?? 0 };
      case "unavailable":
        return { state: "unavailable" };
      case "rate-limited":
        return { state: "rate-limited", retryAfterSeconds: error.retryAfterSeconds };
      case "network":
      case "timeout":
        return { state: "unreachable", status: null };
      case "server":
        // Laravel's own 5xx is JSON with a message; a bodiless 5xx comes from the dev proxy
        // when Laravel is not listening.
        return error.serverMessage === undefined
          ? { state: "unreachable", status: error.status }
          : { state: "unexpected", status: error.status };
      default:
        return { state: "unexpected", status: error.status };
    }
  }
}
