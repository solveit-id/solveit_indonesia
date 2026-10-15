const trimSlash = (value: string) => value.replace(/\/+$/, "");

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The Laravel API origin from `VITE_API_BASE_URL`, or `null` when it is
 * missing or unusable. Only a bare origin is accepted (scheme, host, optional
 * port): no path, query, fragment, or embedded credentials. HTTPS is required
 * except for an explicit loopback host during development.
 */
export function parseApiOrigin(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  // Scheme and authority only; a trailing slash is tolerated.
  if (!/^https?:\/\/[^/?#\\]+\/?$/i.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const secure =
    url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname));
  if (!secure || url.username || url.password) return null;
  return url.origin;
}

/**
 * Endpoint of the website submission channel (docs/api/inquiries.md), or
 * `null` when the channel is off. It is on only when the flag is exactly
 * `true` and the API origin is valid, so a default build never calls the API.
 */
export function resolveInquiryApiUrl(
  enabled: string | undefined,
  apiBaseUrl: string | undefined,
): string | null {
  if ((enabled ?? "").trim() !== "true") return null;
  const origin = parseApiOrigin(apiBaseUrl);
  return origin ? `${origin}/api/v1/inquiries` : null;
}

const rawSiteUrl = (import.meta.env.VITE_SITE_URL ?? "").trim();

export const siteConfig = {
  /** Absolute origin once the domain is confirmed; `null` until then. */
  siteUrl: rawSiteUrl ? trimSlash(rawSiteUrl) : null,
  /** Validated Laravel API origin; `null` until one is configured. */
  apiBaseUrl: parseApiOrigin(import.meta.env.VITE_API_BASE_URL),
  /** `POST /api/v1/inquiries` when the website channel is enabled; otherwise `null`. */
  inquiryApiUrl: resolveInquiryApiUrl(
    import.meta.env.VITE_INQUIRY_API_ENABLED,
    import.meta.env.VITE_API_BASE_URL,
  ),
  googleSiteVerification: (import.meta.env.VITE_GOOGLE_SITE_VERIFICATION ?? "").trim() || null,
  defaultOgImage: "/og/solveit-og.png",
} as const;

export const absoluteUrl = (path: string): string | null =>
  siteConfig.siteUrl ? `${siteConfig.siteUrl}${path === "/" ? "/" : path}` : null;
