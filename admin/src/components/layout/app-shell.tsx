import { SignOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigation } from "react-router";
import { BrandLockup, BrandMark } from "~/components/brand/brand-logo";
import { Button } from "~/components/ui/button";
import { useI18n } from "~/i18n/i18n";
import { cn } from "~/lib/cn";
import { paths } from "~/routes/paths";
import type { AdminAccount } from "~/services/admin-api";
import { EnvironmentCapsule } from "./auth-frame";
import { MenuIcon } from "./menu-icon";
import { PreferenceControls } from "./preference-controls";
import { PrimaryNavigation } from "./primary-navigation";

export interface ShellAccount {
  account: AdminAccount;
  signOut: () => void;
  signingOut: boolean;
  /** Shown under the sign-out button when signing out could not be confirmed. */
  signOutError: string | null;
}

/**
 * The console frame (docs/architecture/admin-dashboard.md section 7): a navy rail beside the
 * work area from 1024px; below it a navy top bar whose menu discloses the same content. Only
 * one of the two is ever displayed, so assistive technology meets one navigation landmark.
 * Rendered with an account only after Laravel verified it (src/app/private-layout.tsx); the
 * development component reference uses it without one.
 */
export function AppShell({
  children,
  session = null,
}: {
  children: ReactNode;
  session?: ShellAccount | null;
}) {
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
        <RailContent session={session} />
      </aside>

      <header className="sticky top-0 z-[var(--z-bar)] rail-scope lg:hidden">
        <div className="flex h-16 items-center gap-3 px-4">
          <Link to={paths.home} className="flex items-center gap-3 rounded-full pr-2">
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
          <RailContent compact session={session} onNavigate={() => setMenuOpen(false)} />
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
  session,
  onNavigate,
}: {
  compact?: boolean;
  session: ShellAccount | null;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className={cn("flex min-h-full flex-1 flex-col gap-7", compact && "gap-6")}>
      {compact ? null : (
        <Link
          to={paths.home}
          className="block rounded-[0.75rem] p-1"
          aria-label={t.shell.consoleName}
        >
          <BrandLockup className="h-11 w-auto" />
          <span className="mt-3 block text-[0.9375rem] font-semibold font-wide">
            {t.shell.consoleName}
          </span>
        </Link>
      )}

      <EnvironmentCapsule />

      <PrimaryNavigation
        permissions={session ? session.account.permissions : null}
        onNavigate={onNavigate}
      />

      <div className={cn("grid gap-5", compact ? "pt-2" : "mt-auto pt-6")}>
        {session ? <AccountFoot session={session} /> : null}
        <PreferenceControls />
      </div>
    </div>
  );
}

/** Who is signed in, and the way out. Name and role come from the verified `GET me`. */
function AccountFoot({ session }: { session: ShellAccount }) {
  const { t } = useI18n();
  const { account } = session;
  const role = account.role === null ? t.roles.none : t.roles[account.role];

  return (
    <div className="grid gap-3 border-t border-line pt-5">
      <p className="min-w-0 text-meta">
        <span className="block text-ink-muted">{t.shell.signedInAs}</span>
        <span className="block truncate font-semibold text-ink" title={account.name}>
          {account.name}
        </span>
        <span className="block text-ink-muted">{role}</span>
      </p>
      <Button
        className="justify-self-start"
        busy={session.signingOut}
        busyLabel={t.shell.signingOut}
        icon={<SignOut aria-hidden size={18} weight="bold" />}
        onClick={session.signOut}
      >
        {t.shell.signOut}
      </Button>
      {session.signOutError ? (
        <p role="alert" className="text-meta font-medium text-danger">
          {session.signOutError}
        </p>
      ) : null}
    </div>
  );
}
