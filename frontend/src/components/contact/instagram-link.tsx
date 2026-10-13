import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { InstagramLogo } from "@phosphor-icons/react/dist/ssr/InstagramLogo";
import { company } from "~/data/company";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";

/**
 * The official Instagram account. A plain, safe external link: no embedded
 * feed, follower count, or post previews.
 */
export function InstagramLink({
  variant = "inline",
  className,
}: {
  /** `inline` for link lists (footer); `card` for the contact page. */
  variant?: "inline" | "card";
  className?: string;
}) {
  const { t } = useI18n();
  const label = <span className="sr-only"> {t.common.newTab}</span>;

  if (variant === "card") {
    return (
      <a
        href={company.instagram.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("contact-card group/card", className)}
      >
        <InstagramLogo aria-hidden weight="bold" className="size-5 shrink-0 text-accent-text" />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm text-ink-muted">{t.instagram.label}</span>
          <span className="font-semibold">{company.instagram.handle}</span>
        </span>
        <ArrowUpRight
          aria-hidden
          weight="bold"
          className="ml-auto size-4 shrink-0 text-ink-muted transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5"
        />
        {label}
      </a>
    );
  }

  return (
    <a
      href={company.instagram.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1.5 link-sweep", className)}
    >
      <InstagramLogo aria-hidden weight="bold" className="size-4" />
      <span>
        {t.instagram.label} {company.instagram.handle}
      </span>
      {label}
    </a>
  );
}
