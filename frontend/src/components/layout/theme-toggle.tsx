import { Moon } from "@phosphor-icons/react/dist/ssr/Moon";
import { Sun } from "@phosphor-icons/react/dist/ssr/Sun";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { setTheme, useTheme } from "~/lib/theme";

/**
 * Light/dark switch: a capsule toggle button. Sun and moon share one masked
 * cell and roll through it like a drum: going dark, the sun sinks out of the
 * bottom as the moon drops in from the top, turning as it lands; going
 * light plays the same path back. Which icon rests is decided by CSS from
 * <html data-theme>, so the prerendered button is right before hydration;
 * `aria-pressed` follows once React takes over. The button never changes
 * size, and it has its own view-transition name, so it answers at once while
 * the page sweeps behind it (see app.css and src/lib/theme.ts).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const dark = useTheme() === "dark";
  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label={t.preferences.darkTheme}
      title={t.preferences.themeHint}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn("theme-toggle", className)}
    >
      <Sun aria-hidden weight="bold" className="theme-icon theme-icon-sun" />
      <Moon aria-hidden weight="bold" className="theme-icon theme-icon-moon" />
    </button>
  );
}
