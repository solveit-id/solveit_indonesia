import type { ReactNode } from "react";
import { BrandLockup, BrandMark } from "~/components/brand/brand-logo";
import { PhaseGlyph } from "~/components/ui/status-capsule";
import { useI18n } from "~/i18n/i18n";
import { PreferenceControls } from "./preference-controls";

/**
 * The frame of every screen without a verified account: sign-in, access links, the session
 * check, and the 404. The same navy rail as the console, but it holds no navigation and no
 * account, because nothing behind sign-in exists for this visitor yet (docs/architecture/
 * admin-dashboard.md section 7). Below 1024px: a navy bar with the mark, and the display
 * preferences at the foot of the page.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  return (
    <>
      <a
        href="#main"
        className="fixed top-3 left-3 z-[var(--z-skip)] -translate-y-24 rounded-full bg-accent px-5 py-3 font-semibold text-accent-ink focus-visible:translate-y-0"
      >
        {t.shell.skipToContent}
      </a>

      <aside className="fixed inset-y-0 left-0 z-[var(--z-bar)] hidden w-rail rail-scope flex-col gap-7 overflow-y-auto border-r px-5 py-6 lg:flex">
        <div className="p-1">
          <BrandLockup className="h-11 w-auto" title={t.meta.owner} />
          <span className="mt-3 block text-[0.9375rem] font-semibold font-wide">
            {t.shell.consoleName}
          </span>
        </div>
        <EnvironmentCapsule />
        <p className="max-w-[28ch] text-meta text-ink-muted">{t.shell.restrictedNote}</p>
        <div className="mt-auto pt-6">
          <PreferenceControls />
        </div>
      </aside>

      <header className="sticky top-0 z-[var(--z-bar)] rail-scope lg:hidden">
        <div className="flex h-16 items-center gap-3 px-4">
          <BrandMark className="h-8 w-auto" title={t.meta.owner} />
          <span className="text-[0.9375rem] font-semibold font-wide">{t.shell.consoleName}</span>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none lg:pl-rail">
        <div className="mx-auto max-w-[76rem] px-work py-9 lg:py-14">
          {children}
          <section
            aria-label={t.shell.preferences}
            className="mt-14 max-w-sm border-t border-line pt-6 lg:hidden"
          >
            <PreferenceControls />
          </section>
        </div>
      </main>
    </>
  );
}

/** The honest environment marker: which phase this console build belongs to. */
export function EnvironmentCapsule() {
  const { t } = useI18n();

  return (
    <p className="inline-flex items-center gap-2.5 self-start rounded-full border border-dashed border-line-strong px-3.5 py-1.5 text-meta">
      <PhaseGlyph status="current" className="scale-75" />
      <span>
        <span className="font-semibold text-ink">{t.shell.environmentLead}</span>
        <span className="text-ink-muted">, {t.shell.environmentDetail}</span>
      </span>
    </p>
  );
}
