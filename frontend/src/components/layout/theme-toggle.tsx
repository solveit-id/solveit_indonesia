import { Moon } from "@phosphor-icons/react/dist/ssr/Moon";
import { Sun } from "@phosphor-icons/react/dist/ssr/Sun";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { setTheme, useTheme } from "~/lib/theme";

/**
 * Light/dark switch: a capsule toggle button. Sun and moon sit on one dial
 * that turns half a revolution around a pivot below the button, so the sun
 * sets as the moon rises and the reverse switch plays the same path back.
 * The dial's position is decided by CSS from <html data-theme>, so the
 * prerendered button is already right before hydration; `aria-pressed`
 * follows once React takes over. The button never changes size.
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
      <span aria-hidden className="theme-dial">
        <Sun weight="bold" className="theme-icon theme-icon-sun" />
        <Moon weight="bold" className="theme-icon theme-icon-moon" />
      </span>
    </button>
  );
}
