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
 * - `automatic`: resend once with the new token. Only for writes that a person would simply
 *   repeat and that change nothing on their own: the sign-in steps and sign-out.
 *
 * A 419 is produced by the CSRF check before any controller runs, so the first attempt
 * certainly did nothing either way; the rule is about not acting twice on the person's behalf
 * without their knowledge.
 */
export type AdminReplayPolicy = "confirm" | "automatic";

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

  async function send(request: AdminRequest): Promise<Response> {
    const isWrite = request.method !== "GET";
    const headers = new Headers({ Accept: "application/json" });
    let body: string | undefined;

    if (request.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(request.body);
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

    try {
      return await fetchImpl(adminApiUrl(request.path, request.query), {
        method: request.method,
        headers,
        body,
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
  }

  async function refreshCsrfCookie(signal?: AbortSignal): Promise<void> {
    pendingCsrf ??= (async () => {
      try {
        const response = await send({ method: "GET", path: CSRF_COOKIE_PATH, signal });

        if (response.status !== 204) {
          throw await errorFrom(response, false);
        }
      } finally {
        pendingCsrf = null;
      }
    })();

    return pendingCsrf;
  }

  async function perform<T>(request: AdminRequest, isReplay = false): Promise<AdminResponse<T>> {
    const isWrite = request.method !== "GET";

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

      if ((request.replay ?? "confirm") === "automatic" && !isReplay) {
        return perform<T>(request, true);
      }

      throw await errorFrom(response, isWrite, { requiresConfirmation: true });
    }

    throw await errorFrom(response, isWrite);
  }

  return {
    request: <T = undefined>(adminRequest: AdminRequest) => perform<T>(adminRequest),
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
