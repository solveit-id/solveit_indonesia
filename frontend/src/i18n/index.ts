import { useLocation } from "react-router";
import { type Locale, localeFromPath, type PageKey, pathFor } from "./config";
import { en } from "./messages/en";
import { id, type Messages } from "./messages/id";

export * from "./config";
export type { Messages };

export const messages: Record<Locale, Messages> = { id, en };

export const getMessages = (locale: Locale): Messages => messages[locale];

/** Language of the current page, read from the URL (the single source of truth). */
export const useLocale = (): Locale => localeFromPath(useLocation().pathname);

/** Interface copy, localized paths, and the locale for the current page. */
export function useI18n() {
  const locale = useLocale();
  return {
    locale,
    t: messages[locale],
    path: (key: PageKey) => pathFor(key, locale),
  };
}
