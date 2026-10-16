import { useSyncExternalStore } from "react";
import { preferenceKeys, writePreference } from "./preferences";

export type Theme = "light" | "dark";

/** Browser UI colour per theme: the rail's ground (navy, or the night's sunken ground). */
const themeColors: Record<Theme, string> = { light: "#082a56", dark: "#030a18" };

const root = () => document.documentElement;

export const getTheme = (): Theme => (root().dataset.theme === "dark" ? "dark" : "light");

/**
 * Light is the default for everyone (owner decision 2026-10-16, the website's rule); dark
 * applies only when chosen and is restored before first paint by public/theme-init.js.
 */
export function setTheme(theme: Theme): void {
  if (theme === "dark") {
    root().dataset.theme = "dark";
  } else {
    delete root().dataset.theme;
  }

  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[theme]);
  writePreference(preferenceKeys.theme, theme);
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(root(), { attributes: true, attributeFilter: ["data-theme"] });

  return () => observer.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "light");
}
