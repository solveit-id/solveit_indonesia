import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { ArrowUp } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import type { AssistantState } from "~/components/assistant/assistant-panel";
import { BrandMark } from "~/components/brand/brand-mark";
import { CapsuleLoader } from "~/components/feedback/capsule-loader";
import { useHydrated } from "~/hooks/use-hydrated";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { motionQueries, useMotion } from "~/lib/motion";

// The panel and its knowledge base load on first intent (hover, focus, or
// open), never with the page.
const loadPanel = () => import("~/components/assistant/assistant-panel");
const AssistantPanel = lazy(loadPanel);

/** Back-to-top appears after this many viewport heights of scroll. */
const TOP_AFTER = 1.2;
/** Phones get the assistant as a bottom sheet that owns focus. */
const SHEET_QUERY = "(max-width: 639px)";

/**
 * Bottom-right controls in one row, so they never collide: back-to-top sits
 * beside the Solveit Assistant launcher, and the assistant panel opens above
 * the whole row, so back-to-top stays usable while it is open (the phone
 * bottom sheet is modal and covers both). Rendered after hydration only, so
 * neither ever shows as a dead button. Both step aside while a
 * `[data-floating-avoid]` element (the contact form's send buttons) is near
 * the bottom of the screen.
 */
export function FloatingDock({ compact = false }: { compact?: boolean }) {
  const hydrated = useHydrated();
  const { t, locale } = useI18n();
  const { pathname } = useLocation();
  const dockRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLButtonElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<AssistantState>("closed");
  const [requested, setRequested] = useState(false);
  const [sheet, setSheet] = useState(false);
  const open = state === "open";

  const close = useCallback(() => {
    setState((current) => (current === "open" ? "closing" : current));
    launcherRef.current?.focus({ preventScroll: true });
  }, []);

  const toggle = () => {
    if (open) return close();
    setSheet(matchMedia(SHEET_QUERY).matches);
    setRequested(true);
    setState("open");
  };

  // Exit fallback, for engines or settings that skip the closing animation.
  useEffect(() => {
    if (state !== "closing") return;
    const timer = window.setTimeout(() => setState("closed"), 320);
    return () => window.clearTimeout(timer);
  }, [state]);

  // A sheet is modal: the page behind it is inert and does not scroll, and
  // following a link from it closes it.
  useEffect(() => {
    if (!open || !sheet) return;
    const targets = ["main", "site-footer"]
      .map((id) => document.getElementById(id))
      .concat(document.querySelector<HTMLElement>("header.site-header"));
    document.documentElement.style.overflow = "hidden";
    targets.forEach((el) => el?.setAttribute("inert", ""));
    return () => {
      document.documentElement.style.overflow = "";
      targets.forEach((el) => el?.removeAttribute("inert"));
    };
  }, [open, sheet]);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (sheet && state === "open") setState("closed");
  }

  // "Tutup" is shorter than "Tanya Solveit": the open launcher trims the
  // difference from its left edge (clip and transform, no layout), so the
  // capsule hugs its label instead of keeping an empty tail.
  useLayoutEffect(() => {
    const dock = dockRef.current;
    const label = labelRef.current;
    if (!dock || !label) return;
    const measure = () => {
      const width = (name: string) =>
        label.querySelector<HTMLElement>(`[data-label="${name}"]`)?.offsetWidth ?? 0;
      const trim = label.offsetWidth > 0 ? Math.max(0, width("open") - width("close")) : 0;
      dock.style.setProperty("--launcher-trim", `${trim}px`);
    };
    measure();
    void document.fonts?.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(label);
    return () => observer.disconnect();
  }, [hydrated, locale, compact]);

  // Back-to-top visibility follows the scroll position through the shared
  // ScrollTrigger listener; attributes change only when the state flips.
  useMotion(
    ({ ScrollTrigger }) => {
      const button = topRef.current;
      if (!button) return;
      const update = (y: number) => {
        const show = y > window.innerHeight * TOP_AFTER;
        if ((button.dataset.visible === "true") === show) return;
        button.dataset.visible = String(show);
        button.toggleAttribute("inert", !show);
      };
      update(window.scrollY);
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => update(self.scroll()),
        onRefresh: (self) => update(self.scroll()),
      });
    },
    { dependencies: [hydrated, pathname] },
  );

  // Step aside for elements that must never be covered.
  useEffect(() => {
    const dock = dockRef.current;
    const zones = document.querySelectorAll("[data-floating-avoid]");
    if (!dock || zones.length === 0) {
      if (dock) dock.dataset.avoid = "false";
      return;
    }
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records)
          if (record.isIntersecting) visible.add(record.target);
          else visible.delete(record.target);
        dock.dataset.avoid = String(visible.size > 0);
      },
      { rootMargin: "-72% 0px 0px 0px" },
    );
    zones.forEach((zone) => observer.observe(zone));
    return () => observer.disconnect();
  }, [hydrated, pathname]);

  const toTop = () => {
    const reduce = matchMedia(motionQueries.reduce).matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    // Focus restarts at the top of the page for keyboard and screen reader users.
    document.getElementById("main")?.focus({ preventScroll: true });
  };

  if (!hydrated) return null;

  return (
    <div
      ref={dockRef}
      className="floating-dock"
      data-assistant={state}
      data-sheet={sheet && state !== "closed" ? "true" : undefined}
      data-avoid="false"
      data-compact={compact}
    >
      <button
        ref={topRef}
        type="button"
        onClick={toTop}
        data-visible="false"
        inert
        aria-label={t.backToTop}
        title={t.backToTop}
        className="dock-top"
      >
        <ArrowUp aria-hidden weight="bold" className="dock-top-icon size-[1.125rem]" />
      </button>

      <button
        ref={launcherRef}
        type="button"
        onClick={toggle}
        onPointerEnter={() => void loadPanel()}
        onFocus={() => void loadPanel()}
        aria-expanded={open}
        aria-controls={requested ? "assistant-panel" : undefined}
        title={open ? t.assistant.close : t.assistant.open}
        data-close-control={open || undefined}
        className="dock-launcher"
      >
        <span aria-hidden className="dock-launcher-icon">
          <span className="dock-launcher-glyph" data-glyph="mark">
            <BrandMark className="w-[1.05rem]" />
          </span>
          <span className="dock-launcher-glyph" data-glyph="close">
            <X weight="bold" className="size-[1.05rem]" />
          </span>
        </span>
        {/* Both labels share one cell, so the capsule keeps its width. */}
        <span ref={labelRef} aria-hidden className={cn("dock-launcher-label", compact && "hidden")}>
          <span data-label="open">{t.assistant.launcher}</span>
          <span data-label="close">{t.nav.close}</span>
        </span>
        <span className="sr-only">{open ? t.nav.close : t.assistant.launcher}</span>
      </button>

      {requested && (
        <Suspense
          fallback={
            <div role="status" className="assistant-loading">
              <CapsuleLoader className="w-5 text-accent-text" />
              <span>{t.loading.assistant}</span>
            </div>
          }
        >
          <AssistantPanel
            key={locale}
            state={state}
            modal={sheet}
            onClose={close}
            onClosed={() => setState("closed")}
          />
        </Suspense>
      )}
    </div>
  );
}
