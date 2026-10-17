import type { Messages } from "~/i18n/messages/id";
import { type AdminApiError, isAdminApiError } from "~/services/admin-api";

/** True when the request may have had an effect and nobody knows: never resend it blindly. */
export const isUncertain = (error: unknown): boolean =>
  !isAdminApiError(error) || error.outcome === "uncertain";

/**
 * The general message for an error a screen has no more specific words for. 401 is not here:
 * the session store sends the person to sign-in (src/auth/session.ts, private-layout.tsx).
 */
export function generalErrorCopy(error: unknown, t: Messages): string {
  if (!isAdminApiError(error)) {
    return t.errors.unexpected;
  }

  switch ((error as AdminApiError).kind) {
    case "csrf":
      return t.errors.resendNeeded;
    case "forbidden":
      return t.errors.forbidden;
    case "unavailable":
      return t.errors.unavailable;
    case "network":
    case "timeout":
    case "server":
      return t.errors.unreachable;
    default:
      return t.errors.unexpected;
  }
}
