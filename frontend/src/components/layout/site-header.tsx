import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { Logo } from "~/components/brand/logo";
import { contactNav, primaryNav } from "~/data/navigation";
import { cn } from "~/lib/cn";
import { motionQueries, useMotion } from "~/lib/motion";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close the menu whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Header gains a surface once the page scrolls; hides while reading down.
  useMotion(
    ({ ScrollTrigger }) => {
      const header = headerRef.current;
      if (!header) return;
      ScrollTrigger.create({
        start: 8,
        end: "max",
        onUpdate: (self) => {
          header.dataset.scrolled = self.scroll() > 8 ? "true" : "false";
          const hide = self.direction === 1 && self.scroll() > 480;
          header.dataset.hidden = hide ? "true" : "false";
        },
        onLeaveBack: () => {
          header.dataset.scrolled = "false";
          header.dataset.hidden = "false";
        },
      });
    },
    { scope: headerRef },
  );

  // Menu panel: lock scroll, trap focus inside header, close on Escape.
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
  }, [open]);

  useMotion(
    ({ gsap }) => {
      if (!open) return;
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        gsap.from("[data-menu-item]", { yPercent: 60, autoAlpha: 0, stagger: 0.05, duration: 0.7 });
        gsap.from("[data-menu-foot]", { autoAlpha: 0, delay: 0.25, duration: 0.6 });
      });
    },
    { scope: panelRef, dependencies: [open] },
  );

  return (
    <header
      ref={headerRef}
      data-scrolled="false"
      data-hidden="false"
      className={cn(
        "group/header fixed inset-x-0 top-0 z-[var(--z-header)] transition-[transform,background-color,border-color] duration-500 ease-[var(--ease-out-expo)]",
        "border-b border-transparent data-[scrolled=true]:border-line data-[scrolled=true]:bg-paper/85 data-[scrolled=true]:backdrop-blur-md",
        "data-[hidden=true]:-translate-y-full",
        open && "!translate-y-0 border-line bg-paper",
      )}
    >
      <div className="shell flex h-[4.5rem] items-center justify-between gap-6">
        <Link to="/" className="shrink-0 rounded-md" aria-label="Solveit Indonesia, ke beranda">
          <Logo className="w-[6.75rem] sm:w-[7.5rem]" title="Solveit Indonesia" />
        </Link>

        <nav aria-label="Navigasi utama" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {primaryNav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "relative inline-flex h-11 items-center px-4 text-[0.97rem] font-medium no-underline transition-colors",
                      "after:absolute after:inset-x-4 after:bottom-2 after:h-[3px] after:origin-left after:scale-x-0 after:rounded-full after:bg-accent after:transition-transform after:duration-500 after:ease-[var(--ease-out-expo)]",
                      "hover:after:scale-x-100",
                      isActive ? "text-ink after:scale-x-100" : "text-ink-muted hover:text-ink",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link to={contactNav.to} className="btn btn-primary hidden min-h-11 sm:inline-flex">
            {contactNav.label}
            <ArrowRight aria-hidden className="btn-icon size-4" weight="bold" />
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className="btn btn-secondary min-h-11 px-4 lg:hidden"
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
            {open ? "Tutup" : "Menu"}
          </button>
        </div>
      </div>

      <div
        ref={panelRef}
        id="mobile-menu"
        hidden={!open}
        className="h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-line bg-paper lg:hidden"
      >
        <nav
          aria-label="Navigasi seluler"
          className="shell flex min-h-full flex-col justify-between gap-12 py-10"
        >
          <ul className="flex flex-col">
            {[{ label: "Beranda", to: "/" }, ...primaryNav].map((item) => (
              <li key={item.to} className="overflow-hidden border-b border-line">
                <NavLink
                  to={item.to}
                  data-menu-item
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-between py-4 text-[clamp(1.75rem,8vw,2.75rem)] font-bold tracking-[-0.03em] font-wide no-underline",
                      isActive ? "text-accent-text" : "text-ink",
                    )
                  }
                >
                  {item.label}
                  <ArrowRight aria-hidden className="size-6 opacity-60" />
                </NavLink>
              </li>
            ))}
          </ul>
          <div data-menu-foot className="flex flex-col gap-4">
            <Link to={contactNav.to} className="btn btn-primary w-full">
              {contactNav.label}
              <ArrowRight aria-hidden className="btn-icon size-4" weight="bold" />
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
