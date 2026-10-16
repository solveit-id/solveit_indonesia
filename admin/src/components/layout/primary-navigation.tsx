import { Stack } from "@phosphor-icons/react/dist/csr/Stack";
import { Swatches } from "@phosphor-icons/react/dist/csr/Swatches";
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
 * greyed-out "coming soon" modules. The current item carries the cobalt 33 degree capsule.
 */
export function PrimaryNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();

  const items: NavItem[] = [
    { to: paths.foundation, label: t.nav.foundation, icon: Stack },
    ...(__ADMIN_COMPONENT_REFERENCE__
      ? [{ to: referencePath, label: t.nav.reference, icon: Swatches }]
      : []),
  ];

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
