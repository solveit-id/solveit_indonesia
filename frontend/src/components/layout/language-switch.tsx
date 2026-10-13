import { Link, useLocation, useNavigation } from "react-router";
import { type Locale, localeFromPath, localeMeta, locales, storageKeys, useI18n } from "~/i18n";
import { alternatePath } from "~/i18n/paths";
import { cn } from "~/lib/cn";

export const rememberLocale = (locale: Locale) => {
  try {
    localStorage.setItem(storageKeys.locale, locale);
  } catch {
    // Storage unavailable: the URL still carries the language.
  }
};

/**
 * The language the visitor is heading to. While a switch is loading, the
 * control already shows the target (the thumb slides on click, not when the
 * new route has finished loading), and `busy` marks it as in progress.
 */
function useTargetLocale(): { target: Locale; busy: boolean } {
  const { locale } = useI18n();
  const navigation = useNavigation();
  const pending = navigation.location ? localeFromPath(navigation.location.pathname) : null;
  return { target: pending ?? locale, busy: pending !== null && pending !== locale };
}

/**
 * A label in a one-line mask. Its copy waits below the mask, so hover rolls
 * the word up and out while the copy rolls in, and a switch rolls the labels
 * in opposite directions, like two gears. Decorative: the link's name comes
 * from screen-reader text beside it.
 */
function RollLabel({ text }: { text: string }) {
  return (
    <span aria-hidden className="lang-roll">
      <span className="lang-roll-track" data-text={text}>
        {text}
      </span>
    </span>
  );
}

/**
 * ID / EN segmented capsule. Each option links to the same page in that
 * language (case studies map slug to slug) and keeps the scroll position,
 * since both versions share one structure. The choice is remembered only to
 * greet the visitor in that language next time (see root.tsx).
 */
export function LanguageSwitch({
  variant = "compact",
  className,
}: {
  /**
   * `compact`: ID / EN capsule for the header. `full`: language names, for
   * the menu panel. `toggle`: one capsule naming the other language, for
   * narrow phone headers.
   */
  variant?: "compact" | "full" | "toggle";
  className?: string;
}) {
  const { pathname } = useLocation();
  const { locale, t } = useI18n();
  const { target, busy } = useTargetLocale();

  if (variant === "toggle") {
    const other = locales.find((option) => option !== locale)!;
    const meta = localeMeta[other];
    // Both labels are stacked in one cell; the one naming the language you
    // would switch to rolls up into view as the other rolls up and out.
    return (
      <Link
        to={alternatePath(pathname, other)}
        hrefLang={meta.htmlLang}
        lang={meta.htmlLang}
        preventScrollReset
        onClick={(event) => {
          rememberLocale(other);
          // Arms the roll only for real switches, never on load.
          event.currentTarget.dataset.moved = "true";
        }}
        data-shows={locales.find((option) => option !== target)}
        aria-busy={busy || undefined}
        className={cn("lang-toggle", className)}
      >
        {locales.map((option) => (
          <span key={option} data-label={option} className="lang-toggle-label">
            <RollLabel text={localeMeta[option].short} />
          </span>
        ))}
        <span className="sr-only">{meta.name}</span>
      </Link>
    );
  }

  return (
    <nav
      aria-label={t.preferences.language}
      data-active={target}
      aria-busy={busy || undefined}
      className={cn("lang-switch", variant === "full" && "lang-switch-full", className)}
    >
      <span aria-hidden className="lang-thumb">
        <span className="lang-thumb-fill" />
      </span>
      {locales.map((option) => {
        const meta = localeMeta[option];
        const current = option === locale;
        return (
          <Link
            key={option}
            to={alternatePath(pathname, option)}
            hrefLang={meta.htmlLang}
            lang={meta.htmlLang}
            aria-current={current ? "true" : undefined}
            data-target={option === target || undefined}
            preventScrollReset
            onClick={(event) => {
              rememberLocale(option);
              // Arms the thumb's stretch only for real switches, never on load.
              const nav = event.currentTarget.parentElement;
              if (nav && !current) nav.dataset.moved = "true";
            }}
            className="lang-option"
          >
            <RollLabel text={variant === "full" ? meta.name : meta.short} />
            <span className="sr-only">{meta.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
