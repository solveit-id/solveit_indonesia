import { useMemo } from "react";
import { useI18n } from "./i18n";
import { inquiryEn } from "./inquiry/en";
import { type InquiryMessages, inquiryId } from "./inquiry/id";
import type { Messages } from "./messages/id";

export type InquiryCopy = Messages & InquiryMessages;

const catalogs = { id: inquiryId, en: inquiryEn } as const;

/**
 * The core copy plus the inquiry console copy, in the current language. Only inquiry screens
 * and their components import this module (and the audit screen, for status names), so the
 * inquiry copy ships in lazy chunks and never in the initial JavaScript.
 */
export function useInquiryI18n() {
  const { t, locale, setLocale } = useI18n();
  const merged = useMemo<InquiryCopy>(() => ({ ...t, ...catalogs[locale] }), [t, locale]);

  return { t: merged, locale, setLocale };
}
