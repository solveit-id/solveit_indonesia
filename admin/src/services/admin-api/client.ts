import { ADMIN_API_BASE, type AdminConflictBody, type AdminValidationErrorBody } from "./contracts";
import { CSRF_COOKIE_PATH, XSRF_HEADER, readXsrfToken } from "./csrf";
import {
  AdminApiError,
  type AdminWriteOutcome,
  isConflictCode,
  kindForStatus,
  parseRetryAfter,
} from "./errors";

export type AdminHttpMethod = "GET" | "POST" | "PUT" | "DELETE";

/**
 * What the client may do after a 419 on a write, once it has fetched a fresh CSRF token:
 *
 * - `confirm` (default for every write): nothing more. It throws a `csrf` error with
 *   `requiresConfirmation`, and the screen asks the person before submitting again. Required
 *   for sensitive writes: invitations, invitation revocation, role changes, suspension and
 *   reactivation, credential resets, password and recovery-code changes.
 * - `automatic`: resend once with the new token, sending exactly the method, URL, and body of
 *   the first attempt (fixed when the request is made, see `prepare`). Allowed only for the
 *   method and path pairs in `automaticReplayAllowlist`; asking for it anywhere else is a
 *   programming error and the request is refused before anything is sent.
 *
 * Why a 419 and only a 419: Laravel's CSRF check (`AdminPreventRequestForgery`, admin
 * middleware group in backend/bootstrap/app.php) runs before the route's throttle, guards, and
 * controller, so a 419 proves the first attempt was rejected before it did anything. Nothing
 * else proves that: a network failure, timeout, abort, 5xx, or unreadable response leaves the
 * outcome `uncertain`, and none of them is ever resent, whatever the policy.
 */
export type AdminReplayPolicy = "confirm" | "automatic";

/**
 * The only writes that may be resent automatically after a 419, exact method and path
 * (docs/api/admin-auth.md). These are not side-effect free (login starts a pending sign-in,
 * the challenge completes it, confirm-password stamps the session, logout ends it); they are
 * listed because a resend after a 419 does at most what the person just asked for, once, and
 * needs no second decision from them. Everything else, including every administrative
 * operation (invitations, roles, suspension, credential resets), every change to the
 * account's own security (password, recovery codes, sessions), redeeming or confirming an
 * access link, and any route added later, stays `confirm` until it is reviewed and listed
 * here on purpose.
 */
export const automaticReplayAllowlist: ReadonlySet<string> = new Set([
  "POST auth/login",
  "POST auth/two-factor-challenge",
  "POST auth/confirm-password",
  "POST auth/logout",
  "POST access-links/inspect",
]);

export const mayReplayAutomatically = (method: AdminHttpMethod, path: string): boolean =>
  automaticReplayAllowlist.has(`${method} ${path}`);

export interface AdminRequest {
  method: AdminHttpMethod;
  /** Relative to /api/v1/admin, for example `auth/csrf-cookie` or `users/7/role`. */
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  replay?: AdminReplayPolicy;
  signal?: AbortSignal;
}

export interface AdminResponse<T> {
  status: number;
  /** Parsed JSON body, or undefined for 204. */
  data: T;
  headers: Headers;
}

export interface AdminApiClientOptions {
  fetch?: typeof fetch;
  /** Reads `document.cookie`; injectable for tests. */
  cookies?: () => string;
  timeoutMs?: number;
  /**
   * Told the status of every response that arrived (never its body, headers, or the request).
   * The console uses it to know when this tab last reached Laravel, for the idle-expiry warning
   * (src/auth/session.ts). An observer that throws changes nothing about the request.
   */
  onResponse?: (status: number) => void;
}

const DEFAULT_TIMEOUT_MS = 20_000;

/** Path segments the API uses; anything else (schemes, `..`, query, fragment) is refused. */
const SAFE_PATH = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i;

export function adminApiUrl(path: string, query?: AdminRequest["query"]): string {
  if (!SAFE_PATH.test(path)) {
    throw new TypeError("Admin API paths are relative, for example `users/7`.");
  }

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }

  const queryString = search.toString();

  return `${ADMIN_API_BASE}/${path}${queryString === "" ? "" : `?${queryString}`}`;
}

/** A request as it goes on the wire, fixed once: the first attempt and any replay send these. */
interface PreparedRequest {
  readonly method: AdminHttpMethod;
  readonly path: string;
  readonly url: string;
  /** Serialised JSON, or undefined when there is no body. */
  readonly body: string | undefined;
  readonly isWrite: boolean;
  readonly automaticReplay: boolean;
  readonly signal: AbortSignal | undefined;
}

/**
 * Reads each field of the caller's request once, checks the replay allowlist, builds the URL
 * (query included) and serialises the body. Strings are immutable, so a caller that changes
 * its object, its nested body, or its query while the request is in flight changes nothing
 * that is sent or resent. Throws (TypeError) before anything is sent.
 */
function prepare(request: AdminRequest): PreparedRequest {
  const { method, path, query, body, replay, signal } = request;

  if (replay === "automatic" && !mayReplayAutomatically(method, path)) {
    throw new TypeError(
      `replay: "automatic" is not allowed for ${method} ${path}; ` +
        "only the authentication steps in automaticReplayAllowlist may be resent.",
    );
  }

  return Object.freeze({
    method,
    path,
    url: adminApiUrl(path, query),
    body: body === undefined ? undefined : (JSON.stringify(body) as string | undefined),
    isWrite: method !== "GET",
    automaticReplay: replay === "automatic",
    signal,
  });
}

export interface AdminApiClient {
  request<T = undefined>(request: AdminRequest): Promise<AdminResponse<T>>;
  /** Fetch a CSRF cookie now (anonymous session). Called automatically before writes. */
  refreshCsrfCookie(signal?: AbortSignal): Promise<void>;
}

export function createAdminApiClient(options: AdminApiClientOptions = {}): AdminApiClient {
  const fetchImpl = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const cookies = options.cookies ?? (() => document.cookie);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // One CSRF cookie request at a time, however many writes are waiting for it.
  let pendingCsrf: Promise<void> | null = null;

  async function send(request: PreparedRequest): Promise<Response> {
    const { isWrite } = request;
    // Built per attempt: a replay carries the refreshed CSRF token, nothing else differs.
    const headers = new Headers({ Accept: "application/json" });

    if (request.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (isWrite) {
      const token = readXsrfToken(cookies());

      if (token !== null) {
        headers.set(XSRF_HEADER, token);
      }
    }

    const signals = [AbortSignal.timeout(timeoutMs), request.signal].filter(
      (signal): signal is AbortSignal => signal !== undefined,
    );

    let response: Response;

    try {
      response = await fetchImpl(request.url, {
        method: request.method,
        headers,
        body: request.body,
        // The session cookie is host-only and same-origin; never sent anywhere else.
        credentials: "same-origin",
        cache: "no-store",
        // The API never redirects; following one could leave the admin origin.
        redirect: "error",
        signal: AbortSignal.any(signals),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      const aborted = error instanceof DOMException && error.name === "AbortError";

      throw new AdminApiError({
        kind: timedOut ? "timeout" : aborted ? "aborted" : "network",
        status: null,
        outcome: isWrite ? "uncertain" : "not-applicable",
      });
    }

    try {
      options.onResponse?.(response.status);
    } catch {
      // An observer never decides what happens to a request.
    }

    return response;
  }

  async function refreshCsrfCookie(signal?: AbortSignal): Promise<void> {
    pendingCsrf ??= (async () => {
      try {
        const response = await send(prepare({ method: "GET", path: CSRF_COOKIE_PATH, signal }));

        if (response.status !== 204) {
          throw await errorFrom(response, false);
        }
      } finally {
        pendingCsrf = null;
      }
    })();

    return pendingCsrf;
  }

  async function perform<T>(request: PreparedRequest, isReplay = false): Promise<AdminResponse<T>> {
    const { isWrite } = request;

    if (isWrite && readXsrfToken(cookies()) === null) {
      await refreshCsrfCookie(request.signal);
    }

    const response = await send(request);

    if (response.ok) {
      return {
        status: response.status,
        data: await successBody<T>(response, isWrite),
        headers: response.headers,
      };
    }

    if (response.status === 419 && isWrite) {
      await refreshCsrfCookie(request.signal);

      // Checked again here, not only in prepare(), so no path into perform() can bypass it.
      // The same frozen request is resent: same method, URL, and body string.
      if (
        request.automaticReplay &&
        mayReplayAutomatically(request.method, request.path) &&
        !isReplay
      ) {
        return perform<T>(request, true);
      }

      throw await errorFrom(response, isWrite, { requiresConfirmation: true });
    }

    throw await errorFrom(response, isWrite);
  }

  return {
    // async: a refusal in prepare() becomes a rejected promise, still before anything is sent.
    request: async <T = undefined>(adminRequest: AdminRequest) => perform<T>(prepare(adminRequest)),
    refreshCsrfCookie,
  };
}

async function successBody<T>(response: Response, isWrite: boolean): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  try {
    if (!isJson(response)) {
      throw new TypeError("not JSON");
    }

    return (await response.json()) as T;
  } catch {
    // A success whose body cannot be read: for a write the outcome is not known.
    throw new AdminApiError({
      kind: "invalid-response",
      status: response.status,
      outcome: isWrite ? "uncertain" : "not-applicable",
    });
  }
}

async function errorFrom(
  response: Response,
  isWrite: boolean,
  extra: { requiresConfirmation?: boolean } = {},
): Promise<AdminApiError> {
  const kind = kindForStatus(response.status);
  const body = await readErrorBody(response);
  // Every 4xx of this API is a refusal before anything changed; a 5xx may have done anything.
  const outcome: AdminWriteOutcome = !isWrite
    ? "not-applicable"
    : response.status < 500
      ? "not-applied"
      : "uncertain";

  return new AdminApiError({
    kind,
    status: response.status,
    outcome,
    serverMessage: typeof body?.message === "string" ? body.message : undefined,
    fieldErrors: kind === "validation" ? validationErrors(body) : undefined,
    conflictCode: kind === "conflict" && isConflictCode(body?.code) ? body.code : undefined,
    retryAfterSeconds:
      kind === "rate-limited" ? parseRetryAfter(response.headers.get("Retry-After")) : undefined,
    requiresConfirmation: extra.requiresConfirmation,
  });
}

type ErrorBody = Partial<AdminValidationErrorBody & AdminConflictBody> & Record<string, unknown>;

async function readErrorBody(response: Response): Promise<ErrorBody | null> {
  if (!isJson(response)) {
    return null;
  }

  try {
    const body: unknown = await response.json();

    return typeof body === "object" && body !== null ? (body as ErrorBody) : null;
  } catch {
    return null;
  }
}

function validationErrors(body: ErrorBody | null): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  if (body?.errors === undefined || typeof body.errors !== "object") {
    return errors;
  }

  for (const [field, messages] of Object.entries(body.errors)) {
    if (Array.isArray(messages)) {
      errors[field] = messages.filter((message): message is string => typeof message === "string");
    }
  }

  return errors;
}

function isJson(response: Response): boolean {
  return (response.headers.get("Content-Type") ?? "").includes("application/json");
}
