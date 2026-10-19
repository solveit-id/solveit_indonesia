import { ClockCounterClockwise } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Swatches } from "@phosphor-icons/react/dist/csr/Swatches";
import { Tray } from "@phosphor-icons/react/dist/csr/Tray";
import { UserCircle } from "@phosphor-icons/react/dist/csr/UserCircle";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { type ComponentType, useEffect, useId, useRef } from "react";
import { NavLink, useLocation } from "react-router";
import { useI18n } from "~/i18n/i18n";
import { cn } from "~/lib/cn";
import { useMotion } from "~/lib/motion";
import { paths, referencePath } from "~/routes/paths";
import type { AdminPermission } from "~/services/admin-api";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; weight?: "regular" | "bold"; "aria-hidden"?: boolean }>;
  /** Active on nested screens too (an account's detail, the invite form). */
  nested?: boolean;
}

/**
 * Only screens that exist are listed (docs/architecture/admin-dashboard.md section 7): no
 * greyed-out "coming soon" modules. The private screens appear only with a verified account;
 * the "Operasional" group (inquiries, B4b) and the owner screens only when Laravel's `GET me`
 * reports their permission (Laravel still authorizes every request). The current item carries the cobalt 33 degree capsule, which
 * travels from the previous item when the screen changes.
 */
export function PrimaryNavigation({
  permissions,
  onNavigate,
}: {
  /** `null` without a verified account. */
  permissions: AdminPermission[] | null;
  onNavigate?: (() => void) | undefined;
}) {
  const { t } = useI18n();
  const nav = useRef<HTMLElement>(null);
  const operationsId = useId();
  const groupId = useId();
  const { pathname } = useLocation();
  const lastMarkerTop = useRef<number | null>(null);

  const personal: NavItem[] = [
    ...(permissions
      ? [
          { to: paths.home, label: t.nav.home, icon: House },
          { to: paths.account, label: t.nav.account, icon: UserCircle },
          { to: paths.security, label: t.nav.security, icon: ShieldCheck },
        ]
      : []),
    ...(__ADMIN_COMPONENT_REFERENCE__
      ? [{ to: referencePath, label: t.nav.reference, icon: Swatches }]
      : []),
  ];

  const operations: NavItem[] = permissions?.includes("inquiries.view")
    ? [{ to: paths.inquiries, label: t.nav.inquiries, icon: Tray, nested: true }]
    : [];

  const administration: NavItem[] = [
    ...(permissions?.includes("users.view")
      ? [
          { to: paths.users, label: t.nav.users, icon: UsersThree, nested: true },
          { to: paths.invitations, label: t.nav.invitations, icon: EnvelopeSimple, nested: true },
        ]
      : []),
    ...(permissions?.includes("audit.view-all")
      ? [{ to: paths.audit, label: t.nav.audit, icon: ClockCounterClockwise }]
      : []),
  ];

  const markerTop = () =>
    nav.current
      ?.querySelector<HTMLElement>('[aria-current="page"] [data-nav-marker]')
      ?.getBoundingClientRect().top ?? null;

  // FLIP: the new item's capsule starts where the previous one was and slides into place.
  useMotion(
    ({ gsap }) => {
      const marker = nav.current?.querySelector<HTMLElement>(
        '[aria-current="page"] [data-nav-marker]',
      );
      const top = markerTop();
      const from = lastMarkerTop.current;

      // A hidden navigation (the closed phone menu) measures 0: nothing to animate there.
      if (marker && top !== null && from !== null && top !== 0 && from !== 0 && from !== top) {
        gsap.fromTo(marker, { y: from - top }, { y: 0, duration: 0.42, ease: "expo.out" });
      }
    },
    { scope: nav, dependencies: [pathname] },
  );

  // Remember where the capsule sits now, for the next screen change (also without GSAP).
  useEffect(() => {
    lastMarkerTop.current = markerTop();
  }, [pathname]);

  if (personal.length === 0 && operations.length === 0 && administration.length === 0) {
    return null;
  }

  return (
    <nav ref={nav} aria-label={t.shell.navigation} className="grid gap-5">
      <NavList items={personal} onNavigate={onNavigate} />
      {operations.length > 0 ? (
        <div className="grid gap-2">
          <p id={operationsId} className="px-4 text-meta text-ink-muted">
            {t.home.operationsTitle}
          </p>
          <NavList items={operations} onNavigate={onNavigate} labelledBy={operationsId} />
        </div>
      ) : null}
      {administration.length > 0 ? (
        <div className="grid gap-2">
          <p id={groupId} className="px-4 text-meta text-ink-muted">
            {t.home.administrationTitle}
          </p>
          <NavList items={administration} onNavigate={onNavigate} labelledBy={groupId} />
        </div>
      ) : null}
    </nav>
  );
}

function NavList({
  items,
  onNavigate,
  labelledBy,
}: {
  items: NavItem[];
  onNavigate: (() => void) | undefined;
  labelledBy?: string;
}) {
  return (
    <ul aria-labelledby={labelledBy} className="grid gap-1">
      {items.map(({ to, label, icon: Icon, nested = false }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={!nested}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex min-h-11 items-center gap-3 rounded-full px-4 text-[0.9375rem] font-medium transition-colors duration-[var(--dur-state)]",
                isActive
                  ? "bg-paper-raised text-ink"
                  : "text-ink-muted hover:bg-paper-raised hover:text-ink",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon aria-hidden size={18} weight={isActive ? "bold" : "regular"} />
                <span className="flex-1">{label}</span>
                {/* The wrapper moves (FLIP), the capsule inside keeps its 33 degree tilt. */}
                <span aria-hidden data-nav-marker className="inline-flex">
                  <span
                    className={cn(
                      "h-1.5 w-4 -rotate-[33deg] rounded-full bg-accent transition-opacity duration-[var(--dur-state)]",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                </span>
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
