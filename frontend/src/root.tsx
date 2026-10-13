import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import archivo from "./assets/fonts/archivo-solveit.woff2?url";
import { BootLoader } from "./components/brand/boot-loader";
import { LogoSprite } from "./components/brand/logo-sprite";
import { getMessages, localeFromPath, localeMeta, pathFor, storageKeys, useLocale } from "./i18n";
import { bootLoaderScript } from "./lib/boot";
import { themeColors } from "./lib/theme";
import type { Route } from "./+types/root";
import "./styles/app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preload", href: archivo, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
];

/*
 * Runs before first paint, so nothing flashes:
 * - Theme: light is the default for everyone (the OS setting is not followed);
 *   a dark choice saved by the visitor is restored on <html data-theme>.
 * - Language: the URL decides. Only a returning visitor who chose English and
 *   lands on the bare Indonesian home page from outside the site is sent to
 *   /en. Crawlers keep no storage, so they are never redirected.
 * - Motion: marks motion-capable visitors so the hero mark can wait for its
 *   entrance instead of flashing. Never set under reduced motion.
 * - Load sequence: arms the branded overlay on <html data-boot> (see
 *   src/lib/boot.ts). Never armed without JavaScript.
 */
const bootScript = `(function(d){try{if(localStorage.getItem("${storageKeys.theme}")==="dark"){d.dataset.theme="dark";var m=document.querySelector('meta[name="theme-color"]');if(m)m.content="${themeColors.dark}"}var r=document.referrer;if(location.pathname==="/"&&localStorage.getItem("${storageKeys.locale}")==="en"&&!(r&&new URL(r).origin===location.origin))location.replace("${pathFor("home", "en")}"+location.search+location.hash)}catch(e){}if(matchMedia("(prefers-reduced-motion: no-preference)").matches)d.classList.add("motion");${bootLoaderScript}})(document.documentElement)`;

export function Layout({ children }: { children: ReactNode }) {
  const locale = localeFromPath(useLocation().pathname);
  return (
    // `data-theme`, `data-boot`, and the `motion` class are set before paint;
    // React never renders them, so hydration and re-renders leave them alone.
    <html lang={localeMeta[locale].htmlLang} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content={themeColors.light} suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        <LogoSprite />
        <BootLoader />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function HydrateFallback() {
  return <div className="min-h-dvh bg-paper" aria-busy="true" />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const locale = useLocale();
  const t = getMessages(locale).error;
  const isHttp = isRouteErrorResponse(error);
  const title = isHttp ? t.httpTitle(error.status) : t.title;
  const detail = isHttp ? error.statusText || t.httpDetail : t.detail;

  return (
    <main className="shell flex min-h-dvh flex-col justify-center gap-6 py-24">
      <title>{`${title} | Solveit Indonesia`}</title>
      <h1 className="text-title">{title}</h1>
      <p className="measure text-lede text-ink-muted">{detail}</p>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="overflow-x-auto rounded-[var(--radius-field)] bg-paper-sunken p-4 text-sm">
          {error.stack}
        </pre>
      )}
      <div>
        <Link to={pathFor("home", locale)} className="btn btn-primary">
          {t.home}
        </Link>
      </div>
    </main>
  );
}
