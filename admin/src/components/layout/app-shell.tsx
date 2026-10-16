import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigation } from "react-router";
import { BrandLockup, BrandMark } from "~/components/brand/brand-logo";
import { PhaseGlyph } from "~/components/ui/status-capsule";
import { useI18n } from "~/i18n/i18n";
import { cn } from "~/lib/cn";
import { paths } from "~/routes/paths";
import { MenuIcon } from "./menu-icon";
import { PreferenceControls } from "./preference-controls";
import { PrimaryNavigation } from "./primary-navigation";

/**
 * The console frame (docs/architecture/admin-dashboard.md section 7): a navy rail beside the
 * work area from 1024px; below it a navy top bar whose menu discloses the same content. Only
 * one of the two is ever displayed, so assistive technology meets one navigation landmark.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const navigation = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <>
      <a
        href="#main"
        className="fixed top-3 left-3 z-[var(--z-skip)] -translate-y-24 rounded-full bg-accent px-5 py-3 font-semibold text-accent-ink focus-visible:translate-y-0"
      >
        {t.shell.skipToContent}
      </a>

      {navigation.state === "loading" ? (
        <div className="route-runner" role="status" aria-label={t.shell.loadingRoute} />
      ) : null}

      <aside className="fixed inset-y-0 left-0 z-[var(--z-bar)] hidden w-rail rail-scope flex-col overflow-y-auto border-r px-5 py-6 lg:flex">
        <RailContent />
      </aside>

      <header className="sticky top-0 z-[var(--z-bar)] rail-scope lg:hidden">
        <div className="flex h-16 items-center gap-3 px-4">
          <Link to={paths.foundation} className="flex items-center gap-3 rounded-full pr-2">
            <BrandMark className="h-8 w-auto" />
            <span className="text-[0.9375rem] font-semibold font-wide">{t.shell.consoleName}</span>
          </Link>
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
            className="ml-auto btn min-h-11 btn-secondary px-4"
          >
            <MenuIcon open={menuOpen} />
            {/* One stable name; aria-expanded carries the state, the icon shows it. */}
            <span>{t.shell.openMenu}</span>
          </button>
        </div>
        <div
          id={menuId}
          hidden={!menuOpen}
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line px-4 pt-4 pb-6"
        >
          <RailContent compact onNavigate={() => setMenuOpen(false)} />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none lg:pl-rail">
        <div className="mx-auto max-w-[76rem] px-work py-9 lg:py-14">{children}</div>
      </main>
    </>
  );
}

function RailContent({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className={cn("flex min-h-full flex-1 flex-col gap-7", compact && "gap-6")}>
      {compact ? null : (
        <Link
          to={paths.foundation}
          className="block rounded-[0.75rem] p-1"
          aria-label={t.shell.consoleName}
        >
          <BrandLockup className="h-11 w-auto" />
          <span className="mt-3 block text-[0.9375rem] font-semibold font-wide">
            {t.shell.consoleName}
          </span>
        </Link>
      )}

      <p className="inline-flex items-center gap-2.5 self-start rounded-full border border-dashed border-line-strong px-3.5 py-1.5 text-meta">
        <PhaseGlyph status="current" className="scale-75" />
        <span>
          <span className="font-semibold text-ink">{t.shell.environmentLead}</span>
          <span className="text-ink-muted">, {t.shell.environmentDetail}</span>
        </span>
      </p>

      <PrimaryNavigation onNavigate={onNavigate} />

      <div className={cn("grid gap-3", compact ? "pt-2" : "mt-auto pt-6")}>
        <PreferenceControls />
      </div>
    </div>
  );
}
