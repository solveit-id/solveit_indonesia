/**
 * CSRF for the admin API (docs/api/admin-auth.md, CSRF). `GET auth/csrf-cookie` starts an
 * anonymous session and sets the `XSRF-TOKEN` cookie; every write echoes its value in the
 * `X-XSRF-TOKEN` header, and the browser sends the session cookie itself (same origin). The
 * token is read from the cookie when needed and never copied into storage or state.
 */
export const XSRF_COOKIE = "XSRF-TOKEN";
export const XSRF_HEADER = "X-XSRF-TOKEN";
export const CSRF_COOKIE_PATH = "auth/csrf-cookie";

/** The current XSRF token from `document.cookie`, URL-decoded, or null. */
export function readXsrfToken(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");

    if (separator === -1 || part.slice(0, separator).trim() !== XSRF_COOKIE) {
      continue;
    }

    const raw = part.slice(separator + 1).trim();

    try {
      return raw === "" ? null : decodeURIComponent(raw);
    } catch {
      return null;
    }
  }

  return null;
}
