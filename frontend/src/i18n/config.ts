/**
 * Locales and the localized route map. The URL is the single source of truth
 * for the language of a page: Indonesian lives at the root, English under
 * `/en`. Prerendering, hydration, `<html lang>`, and hreflang all derive from
 * the pathname, so a page can never render in a language its URL does not say.
 *
 * Relative imports only: this module is also loaded by react-router.config.ts.
 */
export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "id";

export const localeMeta: Record<
  Locale,
  { name: string; short: string; htmlLang: string; ogLocale: string; schemaLang: string }
> = {
  id: {
    name: "Bahasa Indonesia",
    short: "ID",
    htmlLang: "id",
    ogLocale: "id_ID",
    schemaLang: "id-ID",
  },
  en: { name: "English", short: "EN", htmlLang: "en", ogLocale: "en_US", schemaLang: "en" },
};

export type PageKey = "home" | "services" | "portfolio" | "process" | "about" | "contact";

/** Every public page in both languages. Indonesian URLs predate i18n and stay as they are. */
export const pagePaths: Record<PageKey, Record<Locale, string>> = {
  home: { id: "/", en: "/en" },
  services: { id: "/layanan", en: "/en/services" },
  portfolio: { id: "/portofolio", en: "/en/portfolio" },
  process: { id: "/proses", en: "/en/process" },
  about: { id: "/tentang", en: "/en/about" },
  contact: { id: "/kontak", en: "/en/contact" },
};

export const pageKeys = Object.keys(pagePaths) as PageKey[];

/** Query parameter that preselects a service on the contact page. */
export const serviceParam: Record<Locale, string> = { id: "layanan", en: "service" };

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);

export const normalizePath = (pathname: string): string => pathname.replace(/\/+$/, "") || "/";

export const localeFromPath = (pathname: string): Locale => {
  const path = normalizePath(pathname);
  return path === "/en" || path.startsWith("/en/") ? "en" : "id";
};

export const pathFor = (key: PageKey, locale: Locale): string => pagePaths[key][locale];

/** Storage keys for visitor preferences (read before first paint in root.tsx). */
export const storageKeys = { locale: "solveit-locale", theme: "solveit-theme" } as const;
