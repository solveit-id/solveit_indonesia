/**
 * The only values the console keeps in browser storage: two display preferences. Never a
 * session, token, access-link token, email address, or anything returned by the API; the
 * session lives in an HttpOnly cookie the console cannot read (docs/api/admin-auth.md).
 * public/theme-init.js reads the same keys before first paint.
 */
export const preferenceKeys = {
  theme: "solveit-admin-theme",
  locale: "solveit-admin-locale",
} as const;

export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode, policy): the choice holds for this page only.
  }
}
