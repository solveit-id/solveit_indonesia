import { useSyncExternalStore } from "react";

/** The table layout starts here; below it every list is a stack of cards (admin-dashboard.md 7). */
export const TABLE_QUERY = "(min-width: 48rem)";

/** Lists with many columns (invitations) become tables only from 1024px. */
export const WIDE_TABLE_QUERY = "(min-width: 64rem)";

/**
 * Whether a media query matches now, kept current as the window changes. Without matchMedia
 * (tests, very old browsers) the answer is `fallback`.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") {
        return () => undefined;
      }

      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);

      return () => list.removeEventListener("change", onChange);
    },
    () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}
