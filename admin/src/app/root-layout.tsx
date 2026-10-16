import { useEffect, useRef } from "react";
import { Outlet, useLocation, useMatches } from "react-router";
import { AppShell } from "~/components/layout/app-shell";
import { useI18n } from "~/i18n/i18n";
import { isRouteHandle } from "./route-handle";

/**
 * Frame of every screen: the shell, the document title from the deepest route's `handle`,
 * and focus on the content after a client navigation (so keyboard and screen-reader users
 * land on the new page, not on the link they used).
 */
export function RootLayout() {
  const { t } = useI18n();
  const matches = useMatches();
  const { pathname } = useLocation();
  const firstRender = useRef(true);

  const handle = [...matches].reverse().find((match) => isRouteHandle(match.handle))?.handle;
  const pageTitle = isRouteHandle(handle) ? handle.title(t) : null;

  useEffect(() => {
    document.title = pageTitle
      ? `${pageTitle} · ${t.meta.owner}`
      : `${t.meta.product} · ${t.meta.owner}`;
  }, [pageTitle, t]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;

      return;
    }

    document.getElementById("main")?.focus({ preventScroll: false });
  }, [pathname]);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
