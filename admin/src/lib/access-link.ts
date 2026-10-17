/**
 * Access links (activation, credential reset) look like `ADMIN_URL/access#token=<43 chars>`
 * (docs/api/admin-auth.md, Pra-aktivasi). The token lives in the fragment so it never reaches a
 * server, a proxy log, or a Referer header. This helper is the only place the console reads it:
 *
 * - from the fragment only, never from the path or query string;
 * - the fragment is removed from the address bar and history at once, valid or not, so a
 *   screenshot, a shared URL, or the Back button cannot carry it;
 * - the token is returned to the caller's memory and never stored, logged, or sent anywhere
 *   except in the body of the access-link request itself (B3.2b).
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export type AccessLinkWindow = Pick<Window, "location" | "history">;

export function takeAccessLinkToken(win: AccessLinkWindow = window): string | null {
  const fragment = win.location.hash.startsWith("#") ? win.location.hash.slice(1) : "";

  if (fragment === "") {
    return null;
  }

  const token = new URLSearchParams(fragment).get("token");

  win.history.replaceState(win.history.state, "", `${win.location.pathname}${win.location.search}`);

  return token !== null && TOKEN_SHAPE.test(token) ? token : null;
}

/**
 * The token read at start-up, before the router exists. main.tsx calls `holdAccessLinkToken()`
 * first thing, so the fragment is gone before React Router copies the address into its own
 * state; the access screen then takes the token into its component memory with
 * `peekHeldAccessLinkToken()` and calls `releaseHeldAccessLinkToken()`, after which only that
 * component holds it. A reload finds no fragment and no token: links are not reusable.
 */
let held: string | null = null;

export function holdAccessLinkToken(win: AccessLinkWindow = window, accessPath = "/access"): void {
  if (!/(^#|&)token=/.test(win.location.hash)) {
    return;
  }

  const token = takeAccessLinkToken(win);

  // A token fragment on any other page is removed too, but never used.
  held = win.location.pathname === accessPath ? token : null;
}

export const peekHeldAccessLinkToken = (): string | null => held;

export function releaseHeldAccessLinkToken(): void {
  held = null;
}
