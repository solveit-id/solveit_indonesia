import { useSyncExternalStore } from "react";
import { storageKeys } from "~/i18n/config";

export type Theme = "light" | "dark";

/** Browser UI colour per theme; matches `--paper` in app.css. */
export const themeColors: Record<Theme, string> = { light: "#f1f4f9", dark: "#050f22" };

const root = () => document.documentElement;

export const getTheme = (): Theme => (root().dataset.theme === "dark" ? "dark" : "light");

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(root(), { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
};

/**
 * Current theme. Prerendered HTML always says "light"; after hydration the
 * real value (possibly restored to "dark" before paint) takes over without a
 * hydration mismatch. Visual state is CSS-driven, so nothing flashes meanwhile.
 */
export const useTheme = (): Theme => useSyncExternalStore(subscribe, getTheme, () => "light");

const apply = (theme: Theme) => {
  if (theme === "dark") root().dataset.theme = "dark";
  else delete root().dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[theme]);
  try {
    localStorage.setItem(storageKeys.theme, theme);
  } catch {
    // Private mode or blocked storage: the choice still applies to this visit.
  }
};

const AXIS = (33 * Math.PI) / 180;
const WIPE_MS = 600;

let running: ViewTransition | null = null;

/**
 * The new theme sweeps across the page along the logo's 33 degree axis, using
 * a View Transition (one composited snapshot, not hundreds of per-element
 * colour transitions). Night falls from the top-left corner; daylight returns
 * from the bottom-right, so the two directions mirror each other.
 *
 * Toggling again mid-sweep finishes the running sweep at once and starts the
 * next one from the current state, so rapid switching never stacks or
 * flickers. Browsers without View Transitions, and visitors who prefer
 * reduced motion, get an instant switch.
 */
export function setTheme(theme: Theme) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || typeof document.startViewTransition !== "function") {
    apply(theme);
    return;
  }
  running?.skipTransition();
  const transition = document.startViewTransition(() => apply(theme));
  running = transition;
  void transition.finished
    .catch(() => {})
    .finally(() => {
      if (running === transition) running = null;
    });
  transition.ready
    .then(() => {
      const w = innerWidth;
      const h = innerHeight;
      // The wipe edge runs along the 33deg axis; it travels along its normal
      // until the opposite corner is covered.
      const u = { x: Math.cos(AXIS), y: -Math.sin(AXIS) };
      const n = { x: Math.sin(AXIS), y: Math.cos(AXIS) };
      const reach = w * n.x + h * n.y;
      const k = w + h;
      // `side` 1 keeps the half-plane behind the edge (top-left origin);
      // -1 keeps the half-plane ahead of it (bottom-right origin).
      const edge = (s: number, side: 1 | -1) => {
        const a = { x: s * n.x + k * u.x, y: s * n.y + k * u.y };
        const b = { x: s * n.x - k * u.x, y: s * n.y - k * u.y };
        const back = { x: -side * k * n.x, y: -side * k * n.y };
        return `polygon(${a.x}px ${a.y}px, ${b.x}px ${b.y}px, ${b.x + back.x}px ${b.y + back.y}px, ${a.x + back.x}px ${a.y + back.y}px)`;
      };
      const frames =
        theme === "dark" ? [edge(0, 1), edge(reach, 1)] : [edge(reach, -1), edge(0, -1)];
      root().animate(
        { clipPath: frames },
        {
          duration: WIPE_MS,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      // Transition skipped (e.g. tab hidden or toggled again): the theme is already applied.
    });
}
