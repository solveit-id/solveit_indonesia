import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import archivo from "./assets/fonts/archivo-solveit.woff2?url";
import type { Route } from "./+types/root";
import "./styles/app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preload", href: archivo, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    // `motion` class is added before paint by the inline script below.
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#f1f4f9" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#050f22" media="(prefers-color-scheme: dark)" />
        <script
          // Marks motion-capable visitors before first paint so the hero mark can
          // wait for its entrance instead of flashing. Never set under reduced motion.
          dangerouslySetInnerHTML={{
            __html:
              'if(matchMedia("(prefers-reduced-motion: no-preference)").matches)document.documentElement.classList.add("motion")',
          }}
        />
        <Meta />
        <Links />
      </head>
      <body>
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
  const isHttp = isRouteErrorResponse(error);
  const title = isHttp ? `Kesalahan ${error.status}` : "Terjadi kesalahan";
  const detail = isHttp
    ? error.statusText || "Permintaan tidak dapat diproses."
    : "Halaman gagal dimuat. Muat ulang halaman, atau kembali ke beranda.";

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
        <Link to="/" className="btn btn-primary">
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
