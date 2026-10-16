import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";
import { preferenceKeys, writePreference } from "~/lib/preferences";
import { en } from "./messages/en";
import { id, type Messages } from "./messages/id";

export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "id";

const catalogs: Record<Locale, Messages> = { id, en };

const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);

interface I18nValue {
  locale: Locale;
  t: Messages;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

/** The language public/theme-init.js restored on <html lang>, else Indonesian. */
function initialLocale(): Locale {
  const lang = typeof document === "undefined" ? undefined : document.documentElement.lang;

  return isLocale(lang) ? lang : defaultLocale;
}

export function I18nProvider({
  children,
  locale: fixed,
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => fixed ?? initialLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    writePreference(preferenceKeys.locale, next);
  }, []);

  const value = useMemo(() => ({ locale, t: catalogs[locale], setLocale }), [locale, setLocale]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = use(I18nContext);

  if (value === null) {
    throw new Error("useI18n must be used inside <I18nProvider>.");
  }

  return value;
}
