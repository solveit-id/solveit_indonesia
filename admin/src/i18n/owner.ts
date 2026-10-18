import { useMemo } from "react";
import { useI18n } from "./i18n";
import type { Messages } from "./messages/id";
import { ownerEn } from "./owner/en";
import { type OwnerMessages, ownerId } from "./owner/id";

export type OwnerCopy = Messages & OwnerMessages;

const catalogs = { id: ownerId, en: ownerEn } as const;

/**
 * The core copy plus the owner workspace copy, in the current language. Only owner screens and
 * their components import this module, so the owner copy ships in their lazy chunks and never
 * in the initial JavaScript (budget: docs/architecture/admin-dashboard.md section 8).
 */
export function useOwnerI18n() {
  const { t, locale, setLocale } = useI18n();
  const merged = useMemo<OwnerCopy>(() => ({ ...t, ...catalogs[locale] }), [t, locale]);

  return { t: merged, locale, setLocale };
}
