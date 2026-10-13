import { Link, useLocation } from "react-router";
import { type Locale, localeMeta, locales, storageKeys, useI18n } from "~/i18n";
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

  if (variant === "toggle") {
    const other = locales.find((option) => option !== locale)!;
    const meta = localeMeta[other];
    return (
      <Link
        to={alternatePath(pathname, other)}
        hrefLang={meta.htmlLang}
        lang={meta.htmlLang}
        preventScrollReset
        onClick={() => rememberLocale(other)}
        className={cn("lang-toggle", className)}
      >
        <span aria-hidden>{meta.short}</span>
        <span className="sr-only">{meta.name}</span>
      </Link>
    );
  }

  return (
    <nav
      aria-label={t.preferences.language}
      data-active={locale}
      className={cn("lang-switch", variant === "full" && "lang-switch-full", className)}
    >
      <span aria-hidden className="lang-thumb" />
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
            preventScrollReset
            onClick={() => rememberLocale(option)}
            className="lang-option"
          >
            {variant === "full" ? (
              meta.name
            ) : (
              <>
                <span aria-hidden>{meta.short}</span>
                <span className="sr-only">{meta.name}</span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
