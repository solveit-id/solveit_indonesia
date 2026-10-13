import type { ReactNode } from "react";
import { Link } from "react-router";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { useI18n } from "~/i18n";

interface PageIntroProps {
  title: ReactNode;
  /** Answer-first summary: what this page is about, in one or two sentences. */
  lede: ReactNode;
  breadcrumbs: { name: string; path?: string }[];
  children?: ReactNode;
}

/** Opening block for inner pages: breadcrumb, H1, and an answer-first lede. */
export function PageIntro({ title, lede, breadcrumbs, children }: PageIntroProps) {
  const { t, path } = useI18n();
  return (
    <header className="shell pt-[calc(var(--header-h)+clamp(3rem,8vw,6rem))] pb-[clamp(3rem,7vw,5.5rem)]">
      <nav aria-label={t.common.breadcrumb} className="enter [--enter-index:0]">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
          <li>
            <Link to={path("home")} className="link-sweep">
              {t.nav.labels.home}
            </Link>
          </li>
          {breadcrumbs.map((crumb) => (
            <li key={crumb.name} className="flex items-center gap-1.5">
              <CaretRight aria-hidden className="size-3.5" />
              {crumb.path ? (
                <Link to={crumb.path} className="link-sweep">
                  {crumb.name}
                </Link>
              ) : (
                <span aria-current="page" className="text-ink">
                  {crumb.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <h1 className="enter enter-solid mt-8 max-w-[18ch] text-display font-wide">{title}</h1>
      <div className="enter mt-8 max-w-[62ch] text-lede text-ink-muted [--enter-index:2]">
        {lede}
      </div>
      {children}
    </header>
  );
}
