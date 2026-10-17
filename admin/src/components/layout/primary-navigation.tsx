import { House } from "@phosphor-icons/react/dist/csr/House";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Swatches } from "@phosphor-icons/react/dist/csr/Swatches";
import { UserCircle } from "@phosphor-icons/react/dist/csr/UserCircle";
import type { ComponentType } from "react";
import { NavLink } from "react-router";
import { useI18n } from "~/i18n/i18n";
import { cn } from "~/lib/cn";
import { paths, referencePath } from "~/routes/paths";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; weight?: "regular" | "bold"; "aria-hidden"?: boolean }>;
}

/**
 * Only screens that exist are listed (docs/architecture/admin-dashboard.md section 7): no
 * greyed-out "coming soon" modules. The private screens appear only with a verified account.
 * The current item carries the cobalt 33 degree capsule.
 */
export function PrimaryNavigation({
  signedIn,
  onNavigate,
}: {
  signedIn: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const { t } = useI18n();

  const items: NavItem[] = [
    ...(signedIn
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

  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label={t.shell.navigation}>
      <ul className="grid gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
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
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-4 -rotate-[33deg] rounded-full bg-accent transition-opacity duration-[var(--dur-state)]",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
