const trimSlash = (value: string) => value.replace(/\/+$/, "");

const rawSiteUrl = (import.meta.env.VITE_SITE_URL ?? "").trim();
const rawApiUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

export const siteConfig = {
  /** Absolute origin once the domain is confirmed; `null` until then. */
  siteUrl: rawSiteUrl ? trimSlash(rawSiteUrl) : null,
  /** Laravel API origin for the integration phase; `null` until it exists. */
  apiBaseUrl: rawApiUrl ? trimSlash(rawApiUrl) : null,
  googleSiteVerification: (import.meta.env.VITE_GOOGLE_SITE_VERIFICATION ?? "").trim() || null,
  defaultOgImage: "/og/solveit-og.png",
} as const;

export const absoluteUrl = (path: string): string | null =>
  siteConfig.siteUrl ? `${siteConfig.siteUrl}${path === "/" ? "/" : path}` : null;
