import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { HeaderLogo } from "~/components/brand/header-logo";
import { WhatsAppMenu } from "~/components/contact/whatsapp-contacts";
import { primaryNav } from "~/data/navigation";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { motionQueries, useMotion } from "~/lib/motion";
import { LanguageSwitch } from "./language-switch";
import { ThemeToggle } from "./theme-toggle";

// Inline padding of a desktop nav link; the indicator spans the text only.
const LINK_PAD = 14;

/*
 * Adaptive header thresholds, in px of scroll. The surface appears as soon as
 * content passes under the header; the bar condenses into a floating capsule
 * further down and only expands again near the top. The gap between the two
 * compact thresholds (hysteresis) keeps small scroll jitters from toggling it.
 */
const SURFACE_AT = 8;
const COMPACT_AT = 96;
const EXPAND_AT = 40;

type MenuState = "closed" | "open" | "closing";

export function SiteHeader() {
  const [menu, setMenu] = useState<MenuState>("closed");
  const open = menu === "open";
  const setOpen = useCallback((next: boolean | ((value: boolean) => boolean)) => {
    setMenu((state) => {
      const value = typeof next === "function" ? next(state === "open") : next;
      if (value) return "open";
      return state === "open" ? "closing" : state;
    });
  }, []);
  const { pathname } = useLocation();
  const { t, path } = useI18n();
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  // Close the menu whenever the route changes: instantly, the new page is the feedback.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenu("closed");
  }

  // The closing panel plays a short exit, then leaves the layout. A timer
  // backs up animationend for engines or settings that skip the animation.
  useEffect(() => {
    if (menu !== "closing") return;
    const timer = window.setTimeout(() => setMenu("closed"), 320);
    return () => window.clearTimeout(timer);
  }, [menu]);

  /*
   * Active indicator: one cobalt capsule that slides to the current page and
   * follows hover and keyboard focus, then settles back. It moves with
   * transform only. Before hydration a static underline under the
   * aria-current link stands in at the same spot, so nothing shifts.
   */
  const place = useCallback((target?: HTMLElement | null) => {
    const list = listRef.current;
    const bar = indicatorRef.current;
    if (!list || !bar) return;
    const link = target ?? list.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!link || link.offsetWidth === 0) {
      bar.dataset.visible = "false";
      return;
    }
    bar.style.setProperty("--x", `${link.offsetLeft + LINK_PAD}px`);
    bar.style.setProperty("--s", String((link.offsetWidth - LINK_PAD * 2) / 100));
    bar.dataset.visible = "true";
  }, []);

  useLayoutEffect(() => {
    place();
  }, [pathname, place]);

  useEffect(() => {
    const list = listRef.current;
    const bar = indicatorRef.current;
    if (!list || !bar) return;
    list.closest("nav")?.setAttribute("data-enhanced", "true");
    // Enable the slide only after the first placement, so it never sweeps in from 0.
    const frame = requestAnimationFrame(() => (bar.dataset.ready = "true"));
    const observer = new ResizeObserver(() => place());
    observer.observe(list);
    void document.fonts?.ready.then(() => place());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [place]);

  // Adaptive header: open over the hero, a surface once content passes
  // under it, a floating capsule further down. Attributes are written only
  // when a state flips, so scrolling never restyles the header per frame.
  useMotion(
    ({ ScrollTrigger }) => {
      const header = headerRef.current;
      if (!header) return;
      const update = (y: number) => {
        const scrolled = y > SURFACE_AT ? "true" : "false";
        const wasCompact = header.dataset.compact === "true";
        const compact = (wasCompact ? y > EXPAND_AT : y > COMPACT_AT) ? "true" : "false";
        if (header.dataset.scrolled !== scrolled) header.dataset.scrolled = scrolled;
        if (header.dataset.compact !== compact) header.dataset.compact = compact;
      };
      update(window.scrollY);
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => update(self.scroll()),
        onRefresh: (self) => update(self.scroll()),
      });
      return () => {
        header.dataset.scrolled = "false";
        header.dataset.compact = "false";
      };
    },
    { scope: headerRef },
  );

  // Menu panel: lock scroll, make the page inert, close on Escape.
  useEffect(() => {
    const main = document.getElementById("main");
    const footer = document.getElementById("site-footer");
    if (!open) return;
    document.documentElement.style.overflow = "hidden";
    main?.setAttribute("inert", "");
    footer?.setAttribute("inert", "");
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      main?.removeAttribute("inert");
      footer?.removeAttribute("inert");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  useMotion(
    ({ gsap }) => {
      if (!open) return;
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        gsap.from("[data-menu-item]", {
          yPercent: 60,
          autoAlpha: 0,
          stagger: 0.045,
          duration: 0.65,
        });
        gsap.from("[data-menu-foot]", { autoAlpha: 0, y: 12, delay: 0.2, duration: 0.6 });
      });
    },
    { scope: panelRef, dependencies: [open] },
  );

  return (
    <header
      ref={headerRef}
      data-scrolled="false"
      data-compact="false"
      data-menu={menu}
      className="site-header fixed inset-x-0 top-0 z-[var(--z-header)]"
    >
      {/* The surface behind the bar: full-bleed once scrolled, then clipped
          into a floating capsule (clip-path and opacity only, no layout). */}
      <div aria-hidden className="header-plate" />
      <div aria-hidden className="header-edge" />
      <div className="header-bar relative shell flex h-[var(--header-h)] items-center justify-between gap-4 lg:gap-6">
        <Link to={path("home")} className="header-logo shrink-0" aria-label={t.common.homeLink}>
          <HeaderLogo />
        </Link>

        <nav aria-label={t.nav.main} className="main-nav hidden lg:block">
          <ul
            ref={listRef}
            className="relative flex items-center"
            onPointerLeave={() => place()}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) place();
            }}
          >
            {primaryNav.map((key) => (
              <li key={key} className={key === "home" ? "hidden xl:block" : undefined}>
                <NavLink
                  to={path(key)}
                  end={key === "home"}
                  onPointerEnter={(event) => place(event.currentTarget)}
                  onFocus={(event) => place(event.currentTarget)}
                  className="nav-link"
                  style={{ paddingInline: LINK_PAD }}
                >
                  {t.nav.labels[key]}
                </NavLink>
              </li>
            ))}
            <span aria-hidden ref={indicatorRef} className="nav-indicator" data-visible="false" />
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitch variant="toggle" className="sm:hidden" />
          <LanguageSwitch className="hidden sm:inline-flex" />
          <ThemeToggle />
          <NavLink
            to={path("contact")}
            className="btn btn-primary btn-nav hidden min-h-11 md:inline-flex"
          >
            {t.common.consult}
            <ArrowRight aria-hidden className="btn-icon size-4" weight="bold" />
          </NavLink>
          <button
            ref={toggleRef}
            type="button"
            className="btn btn-secondary min-h-11 px-4 lg:hidden"
            data-close-control={open || undefined}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="relative block h-3 w-5" aria-hidden>
              <span
                className={cn(
                  "absolute left-0 block h-[2px] w-5 rounded-full bg-current transition-transform duration-300",
                  open ? "top-[5px] rotate-[33deg]" : "top-[2px] -rotate-[33deg]",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 block h-[2px] w-5 rounded-full bg-current transition-transform duration-300",
                  open ? "top-[5px] -rotate-[33deg]" : "top-[8px] left-[3px] -rotate-[33deg]",
                )}
              />
            </span>
            {open ? t.nav.close : t.nav.menu}
          </button>
        </div>
      </div>

      <div
        ref={panelRef}
        id="mobile-menu"
        hidden={menu === "closed"}
        data-state={menu}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && menu === "closing") setMenu("closed");
        }}
        className="mobile-menu relative h-[calc(100dvh-var(--header-h))] overflow-y-auto overscroll-contain border-t border-line bg-paper lg:hidden"
      >
        <nav
          aria-label={t.nav.mobile}
          className="shell flex min-h-full flex-col justify-between gap-10 py-8"
        >
          <ul className="flex flex-col">
            {primaryNav.map((key) => (
              <li key={key} className="overflow-hidden border-b border-line">
                <NavLink
                  to={path(key)}
                  data-menu-item
                  end={key === "home"}
                  className="mobile-nav-link group/item"
                >
                  <span className="flex items-center gap-3">
                    <span aria-hidden className="mobile-nav-marker" />
                    {t.nav.labels[key]}
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="size-6 opacity-60 transition-transform duration-300 group-hover/item:translate-x-1"
                  />
                </NavLink>
              </li>
            ))}
          </ul>
          <div data-menu-foot className="grid gap-5">
            <LanguageSwitch variant="full" className="sm:hidden" />
            <div className="grid gap-3 sm:grid-cols-2">
              <NavLink to={path("contact")} className="btn btn-primary btn-nav w-full">
                {t.common.consult}
                <ArrowRight aria-hidden className="btn-icon size-4" weight="bold" />
              </NavLink>
              <WhatsAppMenu placement="top" className="[&>summary]:w-full" />
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
