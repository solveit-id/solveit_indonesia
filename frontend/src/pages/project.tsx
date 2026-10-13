import { type MouseEvent, type ReactNode, useRef } from "react";
import { Link, type MetaFunction, useLocation } from "react-router";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { DemoLabel } from "~/components/portfolio/demo-label";
import { ProjectCover } from "~/components/portfolio/project-cover";
import { SystemMap } from "~/components/portfolio/system-map";
import {
  TechnologyList,
  TechnologySprite,
  TechnologyStack,
} from "~/components/portfolio/technology-stack";
import { NotFoundContent } from "~/components/ui/not-found-content";
import { PageIntro } from "~/components/ui/page-intro";
import { useParallax } from "~/hooks/use-parallax";
import { useReveal } from "~/hooks/use-reveal";
import { getMessages, localeFromPath, pathFor, useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { motionQueries, useMotion } from "~/lib/motion";
import { buildMeta, creativeWorkSchema } from "~/lib/seo";
import { categoryLabel } from "~/services/content";
import { getAdjacentProjects, getProjectByPath } from "~/services/projects";
import type { Project as ProjectData } from "~/types/content";

export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const t = getMessages(locale);
  const project = getProjectByPath(location.pathname);
  if (!project) {
    return buildMeta({
      locale,
      title: t.meta.projectMissingTitle,
      description: t.meta.projectMissingDescription,
      path: location.pathname,
      noindex: true,
    });
  }
  const path = `${pathFor("portfolio", locale)}/${project.slug}`;
  const schema = creativeWorkSchema(project, locale);
  return buildMeta({
    locale,
    title: `${project.title}${project.isDemo ? t.meta.conceptSuffix : ""}`,
    description: project.summary,
    path,
    ogType: "article",
    breadcrumbs: [
      { name: t.nav.labels.portfolio, path: pathFor("portfolio", locale) },
      { name: project.title, path },
    ],
    jsonLd: schema ? [schema] : [],
  });
};

export default function Project() {
  const project = getProjectByPath(useLocation().pathname);
  if (!project) return <NotFoundContent />;
  return <CaseStudy key={`${project.key}-${project.slug}`} project={project} />;
}

type ChapterId =
  "context" | "problem" | "solution" | "system" | "flow" | "features" | "technology" | "measure";

const chapterIds: ChapterId[] = [
  "context",
  "problem",
  "solution",
  "system",
  "flow",
  "features",
  "technology",
  "measure",
];

const chapterNumber = (id: ChapterId) => String(chapterIds.indexOf(id) + 1).padStart(2, "0");

/** Numbered chapter heading: the index sits on the logo's axis beside the title. */
function ChapterHead({ id, children }: { id: ChapterId; children: ReactNode }) {
  return (
    <div className="case-chapter-head">
      <span aria-hidden className="case-chapter-index">
        {chapterNumber(id)}
      </span>
      <h2 id={`${id}-title`} className="text-title">
        {children}
      </h2>
    </div>
  );
}

/*
 * Case study as an editorial sequence: context and problem side by side,
 * then the solution on the cobalt field, how its parts connect, how a user
 * moves through it, what it can do, what it would be built with, and what
 * would prove it works. Wide screens keep a chapter rail in view that
 * follows the reader. Everything is readable without JavaScript; motion
 * only stages what is already there.
 */
function CaseStudy({ project }: { project: ProjectData }) {
  const { t, locale, path } = useI18n();
  const copy = t.project;
  const scope = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLOListElement>(null);
  const adjacent = getAdjacentProjects(locale, project.key);
  const projectHref = (slug: string) => `${path("portfolio")}/${slug}`;
  const hasResults = project.results.length > 0;
  const chapterLabel = (id: ChapterId) =>
    id === "measure" && hasResults ? copy.chapters.impact : copy.chapters[id];
  useReveal(scope);
  // The cover drifts slower than the page: depth without moving layout.
  useParallax(scope);

  useMotion(
    ({ gsap, ScrollTrigger }) => {
      // Chapter rail follows the reader (any motion setting: it is state, not motion).
      const rail = railRef.current;
      if (rail) {
        const mark = (id: string) =>
          rail.querySelectorAll<HTMLAnchorElement>("a[data-chapter-link]").forEach((link) => {
            const on = link.dataset.chapterLink === id;
            if (on) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
          });
        gsap.utils.toArray<HTMLElement>("[data-chapter]").forEach((chapter) => {
          ScrollTrigger.create({
            trigger: chapter,
            start: "top 45%",
            end: "bottom 45%",
            onToggle: (self) => {
              if (self.isActive) mark(chapter.dataset.chapter ?? "");
            },
          });
        });
      }

      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        const once = (trigger: string, start = "top 80%") => ({ trigger, start, once: true });
        // The solution arrives on the cobalt field, uncovered along the 33deg axis.
        gsap
          .timeline({ scrollTrigger: once("[data-solution]") })
          .fromTo(
            "[data-solution]",
            { clipPath: "polygon(0% 0%, 0% 0%, -60% 100%, -60% 100%)" },
            {
              clipPath: "polygon(0% 0%, 160% 0%, 100% 100%, -60% 100%)",
              duration: 1.2,
              ease: "expo.out",
              clearProps: "clipPath",
            },
          )
          .from("[data-solution] > *", { opacity: 0, y: 18, stagger: 0.1, duration: 0.8 }, 0.25);
        // System map: the parts step up the staircase, their links drawing on.
        gsap
          .timeline({ scrollTrigger: once("[data-system-map]", "top 82%") })
          .from("[data-system-node]", { opacity: 0, x: -16, stagger: 0.12, duration: 0.8 })
          .from(
            "[data-system-link]",
            { scaleX: 0, stagger: 0.12, duration: 0.6, ease: "power2.inOut" },
            0.25,
          );
        // The flow reads in order: the rail draws through each step.
        gsap
          .timeline({ scrollTrigger: once("[data-flow]") })
          .fromTo(
            "[data-flow-line]",
            { scaleX: 0, scaleY: 0 },
            { scaleX: 1, scaleY: 1, duration: 1.4, ease: "power2.inOut" },
          )
          .from("[data-flow-step]", { opacity: 0, y: 12, stagger: 0.22, duration: 0.6 }, 0.1);
        // Technology layers settle one after another, badges popping in.
        gsap.from("[data-tech-layer] [data-tech-badge]", {
          opacity: 0,
          scale: 0.9,
          y: 8,
          stagger: 0.06,
          duration: 0.6,
          scrollTrigger: once("[data-tech-stack]"),
        });
        // Empty measurement slots tilt onto the logo axis: open, not missing.
        gsap.from("[data-metric-slot]", {
          rotate: 0,
          scaleX: 0.4,
          opacity: 0,
          stagger: 0.1,
          duration: 0.9,
          scrollTrigger: once("[data-metrics]"),
        });
      });
    },
    { scope },
  );

  // Rail links scroll smoothly (instantly under reduced motion) and move
  // focus to the chapter, so keyboard and screen reader users land there too.
  const jump = (event: MouseEvent<HTMLAnchorElement>, id: ChapterId) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduce = matchMedia(motionQueries.reduce).matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
    history.replaceState(history.state, "", `#${id}`);
  };

  const chapter = (id: ChapterId) => ({
    id,
    "data-chapter": id,
    "aria-labelledby": `${id}-title`,
    tabIndex: -1,
  });

  return (
    <article ref={scope}>
      <TechnologySprite technologies={project.technologies} />
      <PageIntro
        breadcrumbs={[
          { name: t.nav.labels.portfolio, path: path("portfolio") },
          { name: project.title },
        ]}
        title={project.title}
        lede={<p>{project.summary}</p>}
      >
        <div className="enter mt-10 grid gap-8 [--enter-index:3]">
          {project.isDemo && (
            <div className="flex flex-col items-start gap-3">
              <DemoLabel />
              <p className="max-w-[60ch] text-[0.95rem] text-ink-muted">{copy.demoNote}</p>
            </div>
          )}
          <dl className="case-facts">
            <div>
              <dt>{copy.category}</dt>
              <dd>{categoryLabel(locale, project.category)}</dd>
            </div>
            <div>
              <dt>{copy.sector}</dt>
              <dd>{project.sector}</dd>
            </div>
            <div>
              <dt>{copy.type}</dt>
              <dd>{project.isDemo ? copy.typeDemo : copy.typeClient}</dd>
            </div>
            <div className="case-facts-wide">
              <dt>{project.isDemo ? copy.technologyProposed : copy.technology}</dt>
              <dd>
                <TechnologyList technologies={project.technologies} />
              </dd>
            </div>
          </dl>
        </div>
      </PageIntro>

      <div className="shell">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-panel)] md:aspect-[16/8]">
          <div data-parallax="6" className="absolute inset-x-0 -inset-y-[9%]">
            <ProjectCover cover={project.cover} />
          </div>
        </div>
      </div>

      <div className="shell py-[var(--spacing-section)] lg:grid lg:grid-cols-12 lg:gap-x-12">
        <nav aria-label={copy.chapterNav} className="hidden lg:col-span-3 lg:block">
          <ol ref={railRef} className="case-rail">
            {chapterIds.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  data-chapter-link={id}
                  onClick={(event) => jump(event, id)}
                  className="case-rail-link"
                >
                  <span aria-hidden className="case-rail-index">
                    {chapterNumber(id)}
                  </span>
                  {chapterLabel(id)}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid gap-[clamp(4.5rem,9vw,7.5rem)] lg:col-span-9">
          <div className="grid gap-5 md:grid-cols-2">
            <section {...chapter("context")} className="case-card" data-reveal>
              <ChapterHead id="context">{copy.context}</ChapterHead>
              <p className="mt-5 text-lg leading-relaxed text-ink-muted">{project.context}</p>
            </section>
            <section {...chapter("problem")} className="case-card case-card-open" data-reveal>
              <ChapterHead id="problem">{copy.problem}</ChapterHead>
              <p className="mt-5 text-lg leading-relaxed text-ink-muted">{project.problem}</p>
            </section>
          </div>

          <section {...chapter("solution")}>
            <div data-solution className="case-solution">
              <ChapterHead id="solution">{copy.solution}</ChapterHead>
              <p className="mt-6 max-w-[46ch] text-[clamp(1.25rem,2vw,1.6rem)] leading-snug font-medium text-field-ink">
                {project.solution}
              </p>
            </div>
          </section>

          <section {...chapter("system")}>
            <ChapterHead id="system">{copy.systemTitle}</ChapterHead>
            <div className="case-panel mt-10">
              <SystemMap system={project.system} />
            </div>
          </section>

          <section {...chapter("flow")}>
            <ChapterHead id="flow">{copy.flowTitle}</ChapterHead>
            <ol data-flow className="relative mt-12 grid gap-8 md:grid-cols-5 md:gap-4">
              <span
                aria-hidden
                className="absolute top-0 bottom-0 left-[1.375rem] w-px bg-line-strong md:top-[1.375rem] md:right-[10%] md:bottom-auto md:left-[10%] md:h-px md:w-auto"
              />
              <span
                aria-hidden
                data-flow-line
                className="absolute top-0 bottom-0 left-[1.375rem] w-px origin-top bg-accent md:top-[1.375rem] md:right-[10%] md:bottom-auto md:left-[10%] md:h-px md:w-auto md:origin-left"
              />
              {project.flow.map((step, index) => {
                const last = index === project.flow.length - 1;
                return (
                  <li
                    key={step}
                    data-flow-step
                    className="group/step relative grid grid-cols-[2.75rem_1fr] items-center gap-x-5 md:flex md:flex-col md:items-center md:gap-4 md:text-center"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "relative z-10 grid size-11 place-items-center rounded-full text-sm font-bold transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/step:-translate-y-1",
                        last
                          ? "bg-accent text-accent-ink"
                          : "border border-accent bg-paper text-accent-text",
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="max-w-[16ch] leading-snug font-semibold">{step}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section {...chapter("features")}>
            <ChapterHead id="features">{copy.featuresTitle}</ChapterHead>
            <dl className="mt-10 grid gap-4 md:grid-cols-2">
              {project.features.map((feature, index) => (
                <div key={feature.name} data-reveal className="case-feature">
                  <span aria-hidden className="case-feature-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <dt className="text-xl font-bold tracking-[-0.02em] font-wide">{feature.name}</dt>
                  <dd className="mt-2 text-ink-muted">{feature.description}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section {...chapter("technology")}>
            <ChapterHead id="technology">
              {project.isDemo ? copy.technologyProposedTitle : copy.technologyTitle}
            </ChapterHead>
            {project.isDemo && (
              <p className="mt-5 max-w-[60ch] text-ink-muted">{copy.technologyProposedNote}</p>
            )}
            <div data-tech-stack className="mt-10">
              <TechnologyStack technologies={project.technologies} />
            </div>
          </section>

          <section {...chapter("measure")}>
            <ChapterHead id="measure">
              {hasResults ? copy.impactTitle : copy.measureTitle}
            </ChapterHead>
            {!hasResults && <p className="mt-5 max-w-[60ch] text-ink-muted">{copy.measureNote}</p>}
            <ul data-metrics className="mt-10 grid gap-4 sm:grid-cols-3">
              {(hasResults ? project.results : project.metricsToTrack).map((item) => (
                <li key={item} className="case-metric">
                  <span className="text-lg leading-snug font-semibold">{item}</span>
                  {!hasResults && (
                    <span className="mt-auto flex items-center gap-3 pt-6 text-sm text-ink-muted">
                      <span aria-hidden data-metric-slot className="case-metric-slot" />
                      {copy.measurePending}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {adjacent && (
        <nav aria-label={copy.moreLabel} className="shell pb-[var(--spacing-section)]">
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-10">
            <h2 className="text-heading font-wide">{copy.moreLabel}</h2>
            <Link
              to={path("portfolio")}
              className="group/all inline-flex items-center gap-2 font-semibold text-accent-text no-underline"
            >
              <span className="link-sweep">{copy.allProjects}</span>
              <ArrowRight
                aria-hidden
                weight="bold"
                className="size-4 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/all:translate-x-1"
              />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {(
              [
                { project: adjacent.previous, label: copy.previousLabel, dir: "previous" },
                { project: adjacent.next, label: copy.nextLabel, dir: "next" },
              ] as const
            ).map(({ project: other, label, dir }) => (
              <Link
                key={dir}
                to={projectHref(other.slug)}
                data-dir={dir}
                className="case-adjacent group"
              >
                <span aria-hidden className="case-adjacent-cover">
                  <ProjectCover cover={other.cover} />
                </span>
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-accent-text">
                    {dir === "previous" && (
                      <ArrowLeft
                        aria-hidden
                        weight="bold"
                        className="size-4 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-translate-x-1"
                      />
                    )}
                    {label}
                    {dir === "next" && (
                      <ArrowRight
                        aria-hidden
                        weight="bold"
                        className="size-4 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1"
                      />
                    )}
                  </span>
                  <span className="text-xl leading-snug font-bold tracking-[-0.02em] font-wide">
                    {other.title}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {categoryLabel(locale, other.category)}
                  </span>
                  {other.isDemo && <DemoLabel className="mt-1 self-start" />}
                </div>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </article>
  );
}
