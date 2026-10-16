import { type AdminConflictCode, adminConflictCodes } from "./contracts";

/**
 * Why a request failed, in the terms a screen must act on (docs/api/admin-auth.md, Konvensi):
 *
 * - `validation` 422, `bad-request` 400 or 405: fix the input or the call.
 * - `unauthenticated` 401: no session (idle, absolute limit, signed out): go to sign-in.
 * - `forbidden` 403: no permission, or the request crossed the admin origin boundary.
 * - `not-found` 404.
 * - `conflict` 409: a domain rule, see `conflictCode`.
 * - `csrf` 419: the CSRF token or the session it belongs to is gone. The client has already
 *   fetched a fresh token; whether the request is sent again is the caller's decision.
 * - `password-confirmation-required` 423: ask for the password, then retry.
 * - `rate-limited` 429: wait `retryAfterSeconds`.
 * - `unavailable` 503, `server` other 5xx, `network`, `timeout`, `aborted`: no reliable answer.
 * - `invalid-response`: the answer was not what the contract promises.
 */
export type AdminApiErrorKind =
  | "validation"
  | "bad-request"
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "csrf"
  | "password-confirmation-required"
  | "rate-limited"
  | "unavailable"
  | "server"
  | "network"
  | "timeout"
  | "aborted"
  | "invalid-response";

/**
 * What is known about a write's effect. `not-applied`: the server refused it before acting
 * (every 4xx of this API), so nothing changed. `uncertain`: the request may or may not have
 * taken effect (5xx, no response, timeout, abort, unreadable success); never resend it
 * without asking the person and checking the current state first. Reads are always
 * `not-applicable`.
 */
export type AdminWriteOutcome = "not-applied" | "uncertain" | "not-applicable";

export interface AdminApiErrorDetails {
  kind: AdminApiErrorKind;
  status: number | null;
  outcome: AdminWriteOutcome;
  serverMessage?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
  conflictCode?: AdminConflictCode | undefined;
  retryAfterSeconds?: number | undefined;
  requiresConfirmation?: boolean | undefined;
}

export class AdminApiError extends Error {
  readonly kind: AdminApiErrorKind;
  readonly status: number | null;
  readonly outcome: AdminWriteOutcome;
  /** Laravel's `message`: generic by design, safe to show; never contains a secret. */
  readonly serverMessage: string | undefined;
  readonly fieldErrors: Record<string, string[]>;
  readonly conflictCode: AdminConflictCode | undefined;
  readonly retryAfterSeconds: number | undefined;
  /**
   * True when a fresh CSRF token is ready but the client did not resend a sensitive write:
   * the screen must ask the person before submitting again (B3.2a retry rule).
   */
  readonly requiresConfirmation: boolean;

  constructor(details: AdminApiErrorDetails) {
    // The message names the kind and status only, never request data, so it is safe to show
    // or report anywhere.
    super(`Admin API ${details.kind}${details.status === null ? "" : ` (${details.status})`}`);
    this.name = "AdminApiError";
    this.kind = details.kind;
    this.status = details.status;
    this.outcome = details.outcome;
    this.serverMessage = details.serverMessage;
    this.fieldErrors = details.fieldErrors ?? {};
    this.conflictCode = details.conflictCode;
    this.retryAfterSeconds = details.retryAfterSeconds;
    this.requiresConfirmation = details.requiresConfirmation ?? false;
  }
}

export const isAdminApiError = (value: unknown): value is AdminApiError =>
  value instanceof AdminApiError;

/** HTTP status to error kind, for responses that arrived. */
export function kindForStatus(status: number): AdminApiErrorKind {
  switch (status) {
    case 400:
    case 405:
      return "bad-request";
    case 401:
      return "unauthenticated";
    case 403:
      return "forbidden";
    case 404:
      return "not-found";
    case 409:
      return "conflict";
    case 419:
      return "csrf";
    case 422:
      return "validation";
    case 423:
      return "password-confirmation-required";
    case 429:
      return "rate-limited";
    case 503:
      return "unavailable";
    default:
      return status >= 500 ? "server" : "invalid-response";
  }
}

export const isConflictCode = (value: unknown): value is AdminConflictCode =>
  typeof value === "string" && (adminConflictCodes as readonly string[]).includes(value);

/**
 * `Retry-After` in seconds (delta-seconds or an HTTP date), or undefined when absent or
 * unreadable. Never negative.
 */
export function parseRetryAfter(
  header: string | null,
  now: number = Date.now(),
): number | undefined {
  if (header === null || header.trim() === "") {
    return undefined;
  }

  const value = header.trim();

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const date = Date.parse(value);

  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - now) / 1000));
}
