import { Link } from "react-router";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { categoryLabel } from "~/services/content";
import type { Project } from "~/types/content";
import { DemoLabel } from "./demo-label";
import { ProjectCover } from "./project-cover";

interface ProjectCardProps {
  project: Project;
  className?: string;
  /** Larger title for showcase contexts. */
  size?: "default" | "large";
  headingLevel?: "h2" | "h3";
  /** Full-width lead entry: a wider, shorter cover. */
  lead?: boolean;
  /** Let the cover drift inside its frame on scroll (needs `useParallax` on a parent). */
  parallax?: boolean;
}

export function ProjectCard({
  project,
  className,
  size = "default",
  headingLevel: Heading = "h3",
  lead = false,
  parallax = false,
}: ProjectCardProps) {
  const { locale, path } = useI18n();
  return (
    <article className={cn("group relative flex flex-col", className)} data-project-card>
      <div
        data-tilt
        className={cn(
          "relative aspect-[4/3] overflow-hidden rounded-[var(--radius-panel)] [transform-style:preserve-3d]",
          lead && "md:aspect-[16/7]",
        )}
      >
        <div
          data-parallax={parallax ? "6" : undefined}
          className={parallax ? "absolute inset-x-0 -inset-y-[9%]" : "absolute inset-0"}
        >
          <ProjectCover
            cover={project.cover}
            className="transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.04] [&_.cover-drift]:transition-transform [&_.cover-drift]:duration-[1.2s] [&_.cover-drift]:ease-[var(--ease-out-expo)] group-hover:[&_.cover-drift]:translate-x-[18px] group-hover:[&_.cover-drift]:-translate-y-[12px]"
          />
        </div>
      </div>
      <div className="mt-5 flex items-start justify-between gap-6">
        <div>
          <Heading
            className={cn(
              "mt-2 font-bold tracking-[-0.025em] font-wide",
              size === "large" ? "text-heading" : "text-xl leading-snug",
            )}
          >
            <Link
              to={`${path("portfolio")}/${project.slug}`}
              className="no-underline after:absolute after:inset-0 after:rounded-[var(--radius-panel)] after:content-['']"
            >
              {project.title}
            </Link>
          </Heading>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span>{categoryLabel(locale, project.category)}</span>
            <span aria-hidden className="h-3 w-px bg-line-strong" />
            <span>{project.sector}</span>
          </p>
          {project.isDemo && <DemoLabel className="mt-3" />}
        </div>
        <span
          aria-hidden
          className="mt-1 grid size-11 shrink-0 place-items-center rounded-full border border-line-strong transition-[background-color,color,border-color,transform] duration-500 ease-[var(--ease-out-expo)] group-hover:rotate-45 group-hover:border-accent group-hover:bg-accent group-hover:text-accent-ink"
        >
          <ArrowUpRight className="size-4" weight="bold" />
        </span>
      </div>
    </article>
  );
}
