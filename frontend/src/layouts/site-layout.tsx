import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { RouteProgress } from "~/components/layout/route-progress";
import { SiteFooter } from "~/components/layout/site-footer";
import { SiteHeader } from "~/components/layout/site-header";
import { getGsap, motionQueries, useMotion } from "~/lib/motion";

export default function SiteLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Client-side navigation: move focus to the new page for screen readers and
  // keyboard users, and let ScrollTrigger re-measure the new layout.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    const id = requestAnimationFrame(() => getGsap()?.ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  // Page entrance on navigation (not on first load, which is already painted).
  useMotion(
    ({ gsap }) => {
      if (!mainRef.current || mainRef.current.dataset.entered !== "true") {
        if (mainRef.current) mainRef.current.dataset.entered = "true";
        return;
      }
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        gsap.from(mainRef.current, { autoAlpha: 0, y: 18, duration: 0.7, clearProps: "all" });
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
        Lewati ke konten utama
      </a>
      <RouteProgress />
      <SiteHeader />
      <main id="main" ref={mainRef} tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <SiteFooter showCta={pathname !== "/kontak"} />
    </>
  );
}
