/**
 * Browser security policy of the admin console, one definition for the Vite dev server, the
 * preview server, and the production HTML (and, in B3.2d, the admin gateway listener, which
 * must send the same values as HTTP headers).
 *
 * Production: scripts, styles, fonts, and API calls only from the admin origin itself; no
 * inline script, no eval, no framing, no plugins, no external assets. `data:` images are
 * allowed for the TOTP QR code the API returns as SVG (B3.2b), shown as <img src="data:...">.
 * The development server needs inline scripts and websockets for hot reload, so it gets no
 * CSP at all rather than a weakened one that could be mistaken for the production policy.
 */
export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

/** `frame-ancestors` is ignored in a <meta> CSP, so it travels as a header only. */
export const contentSecurityPolicyHeader = `${contentSecurityPolicy}; frame-ancestors 'none'`;

/** Headers for every admin response that is not the API (the API sets its own). */
export const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  // Not no-referrer: with it browsers send `Origin: null` on same-origin POSTs, which the admin
  // API refuses (docs/architecture/admin-dashboard.md section 2).
  "Referrer-Policy": "same-origin",
  "X-Robots-Tag": "noindex, nofollow",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cache-Control": "no-store",
};
