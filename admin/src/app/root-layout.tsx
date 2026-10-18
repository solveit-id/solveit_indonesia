import { useEffect, useRef } from "react";
import { Outlet, useLocation, useMatches } from "react-router";
import { AuthFrame } from "~/components/layout/auth-frame";
import { useI18n } from "~/i18n/i18n";
import { isRouteHandle } from "./route-handle";

/**
 * Root of every screen: the document title from the deepest route's `handle`, and focus on the
 * content after a client navigation (so keyboard and screen-reader users land on the new page,
 * not on the link they used). The frame itself belongs to the layouts below: the auth frame
 * without an account (PublicLayout), the console shell with one (private-layout.tsx).
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

  return <Outlet />;
}

/** Screens without an account: sign-in, access links, the 404. */
export function PublicLayout() {
  return (
    <AuthFrame>
      <Outlet />
    </AuthFrame>
  );
}
