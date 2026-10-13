import { useRef, useState } from "react";
import { ProjectCard } from "~/components/portfolio/project-card";
import { PageIntro } from "~/components/ui/page-intro";
import { projectCategories } from "~/data/projects";
import { useParallax } from "~/hooks/use-parallax";
import { useTilt } from "~/hooks/use-tilt";
import { getMessages, localeFromPath, pathFor, useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { getGsap, motionQueries, useMotion } from "~/lib/motion";
import { buildMeta } from "~/lib/seo";
import { categoryLabel } from "~/services/content";
import { getProjects } from "~/services/projects";
import type { ProjectCategory } from "~/types/content";
import type { Route } from "./+types/portfolio";

export const meta: Route.MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const t = getMessages(locale);
  return buildMeta({
    locale,
    title: t.meta.portfolioTitle,
    description: t.meta.portfolioDescription,
    path: pathFor("portfolio", locale),
    breadcrumbs: [{ name: t.nav.labels.portfolio, path: pathFor("portfolio", locale) }],
  });
};

type Filter = ProjectCategory | "all";

export default function Portfolio() {
  const { t, locale } = useI18n();
  const copy = t.portfolio;
  const scope = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const all = getProjects(locale);
  const visible = filter === "all" ? all : getProjects(locale, filter);

  useTilt(scope);
  // Covers drift inside their frames as the grid scrolls; re-measured per filter.
  useParallax(scope, [filter]);

  // Reflow the grid smoothly when the filter changes.
  useMotion(
    ({ gsap, Flip, ScrollTrigger }) => {
      const state = flipState.current;
      flipState.current = null;
      if (!state) return;
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        Flip.from(state, {
          targets: "[data-flip-item]",
          duration: 0.7,
          ease: "expo.out",
          absolute: true,
          // Parallax and reveal triggers measured mid-flight; re-measure at rest.
          onComplete: () => ScrollTrigger.refresh(),
          onEnter: (elements) =>
            gsap.fromTo(elements, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6 }),
          onLeave: (elements) => gsap.to(elements, { autoAlpha: 0, duration: 0.3 }),
        });
      });
    },
    { scope: grid, dependencies: [filter] },
  );

  const choose = (next: Filter) => {
    if (next === filter) return;
    if (grid.current)
      flipState.current =
        getGsap()?.Flip.getState(grid.current.querySelectorAll("[data-flip-item]")) ?? null;
    setFilter(next);
  };

  const options: { id: Filter; label: string }[] = [
    { id: "all", label: copy.all },
    ...projectCategories.map((id) => ({ id, label: categoryLabel(locale, id) })),
  ];

  return (
    <div ref={scope}>
      <PageIntro
        breadcrumbs={[{ name: t.nav.labels.portfolio }]}
        title={copy.title}
        lede={<p>{copy.lede}</p>}
      />

      <section aria-labelledby="portfolio-list" className="shell pb-[var(--spacing-section)]">
        <h2 id="portfolio-list" className="sr-only">
          {copy.listTitle}
        </h2>
        <div role="group" aria-label={copy.filterLabel} className="flex flex-wrap gap-2">
          {options.map((option) => {
            const count = option.id === "all" ? all.length : getProjects(locale, option.id).length;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => choose(option.id)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[0.95rem] font-medium transition-colors duration-300",
                  filter === option.id
                    ? "border-ink bg-ink text-paper"
                    : "border-line-strong hover:border-ink",
                )}
              >
                {option.label}
                <span className="text-sm opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="sr-only" aria-live="polite">
          {copy.showing(visible.length)}
        </p>

        {visible.length === 0 ? (
          <div className="mt-14 rounded-[var(--radius-panel)] border border-dashed border-line-strong p-10 text-center">
            <p className="text-lede">{copy.empty}</p>
            <button type="button" className="btn btn-secondary mt-6" onClick={() => choose("all")}>
              {copy.showAll}
            </button>
          </div>
        ) : (
          <ul ref={grid} className="mt-12 grid gap-x-8 gap-y-16 md:grid-cols-2 lg:mt-16">
            {visible.map((project, index) => (
              <li
                key={project.key}
                data-flip-item
                data-flip-id={project.key}
                className={cn(
                  index === 0 && "md:col-span-2",
                  index > 0 && index % 2 === 0 && "md:translate-y-24",
                )}
              >
                <ProjectCard
                  project={project}
                  size="large"
                  headingLevel="h3"
                  lead={index === 0}
                  parallax
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
