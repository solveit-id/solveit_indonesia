import type { ReactNode } from "react";
import { Link } from "react-router";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";

interface PageIntroProps {
  title: ReactNode;
  /** Answer-first summary: what this page is about, in one or two sentences. */
  lede: ReactNode;
  breadcrumbs: { name: string; path?: string }[];
  children?: ReactNode;
}

/** Opening block for inner pages: breadcrumb, H1, and an answer-first lede. */
export function PageIntro({ title, lede, breadcrumbs, children }: PageIntroProps) {
  return (
    <header className="shell pt-[calc(4.5rem+clamp(3rem,8vw,6rem))] pb-[clamp(3rem,7vw,5.5rem)]">
      <nav aria-label="Breadcrumb" className="enter [--enter-index:0]">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
          <li>
            <Link to="/" className="link-sweep">
              Beranda
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
      <h1 className="enter mt-8 max-w-[18ch] text-display font-wide [--enter-index:1]">{title}</h1>
      <div className="enter mt-8 max-w-[62ch] text-lede text-ink-muted [--enter-index:2]">
        {lede}
      </div>
      {children}
    </header>
  );
}
