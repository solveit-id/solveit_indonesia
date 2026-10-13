import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { FloatingDock } from "~/components/layout/floating-dock";
import { RouteProgress } from "~/components/layout/route-progress";
import { SiteFooter } from "~/components/layout/site-footer";
import { SiteHeader } from "~/components/layout/site-header";
import { useI18n } from "~/i18n";
import { resolvePath } from "~/i18n/paths";
import { getGsap, motionQueries, useMotion } from "~/lib/motion";

/** Same page, other language: the content keeps its place and its focus. */
const isLanguageSwitch = (from: string, to: string): boolean => {
  const a = resolvePath(from);
  const b = resolvePath(to);
  return Boolean(a && b && a.kind === b.kind && a.key === b.key && a.locale !== b.locale);
};

export default function SiteLayout() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const resolved = resolvePath(pathname);
  const isContact = resolved?.kind === "page" && resolved.key === "contact";
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  // Marks the document once React has taken over (CSS hooks and e2e tests).
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);

  // Client-side navigation: move focus to the new page for screen readers and
  // keyboard users, and let ScrollTrigger re-measure the new layout. A
  // language switch keeps focus on the switch, so it can be used again.
  useEffect(() => {
    const from = previousPath.current;
    if (from === pathname) return;
    previousPath.current = pathname;
    if (!isLanguageSwitch(from, pathname)) mainRef.current?.focus({ preventScroll: true });
    const id = requestAnimationFrame(() => getGsap()?.ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  /*
   * Route entrance on client navigation (never on first load, which is
   * already painted). A new page rises a short distance into place; a
   * language switch only dips and restores opacity, because the structure
   * and scroll position stay the same and a full entrance would read as a
   * reload. Exits are not staged: holding the old page back to animate it out
   * would delay navigation for the sake of the effect.
   */
  const entered = useRef<string | null>(null);
  useMotion(
    ({ gsap }) => {
      const main = mainRef.current;
      const from = entered.current;
      entered.current = pathname;
      if (!main || from === null || from === pathname) return;
      const languageOnly = isLanguageSwitch(from, pathname);
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        if (languageOnly) {
          gsap.from(main, {
            opacity: 0.55,
            duration: 0.35,
            ease: "power2.out",
            clearProps: "opacity",
          });
          return;
        }
        gsap.from(main, { opacity: 0, y: 14, duration: 0.5, clearProps: "opacity,transform" });
      });
    },
    { dependencies: [pathname] },
  );

  return (
    <>
      <a
        href="#main"
        className="btn btn-primary fixed top-3 left-3 z-[var(--z-skip)] -translate-y-24 focus:translate-y-0"
      >
        {t.common.skipLink}
      </a>
      <RouteProgress />
      <SiteHeader />
      <main id="main" ref={mainRef} tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <SiteFooter showCta={!isContact} />
      <FloatingDock compact={isContact} />
    </>
  );
}
