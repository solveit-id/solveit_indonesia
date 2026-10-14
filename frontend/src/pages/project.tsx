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
import { motionQueries, useMotion } from "~/lib/motion";
import { documentTop, pickChapter, readingLine } from "~/lib/scrollspy";
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
function ChapterHead({
  id,
  compact = false,
  children,
}: {
  id: ChapterId;
  /** Heading scale, for chapters set inside a card. */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="case-chapter-head">
      <span aria-hidden className="case-chapter-index">
        {chapterNumber(id)}
      </span>
      <h2 id={`${id}-title`} className={compact ? "text-heading font-wide" : "text-title"}>
        {children}
      </h2>
    </div>
  );
}

/*
 * Case study as an editorial sequence read top to bottom: context, then the
 * problem, then the solution on the cobalt field, how its parts connect,
 * how a user moves through it, what it can do, what it would be built with,
 * and what would prove it works. Wide screens keep a chapter rail in view
 * that follows the reader. Everything is readable without JavaScript;
 * motion only stages what is already there.
 */
const markRail = (rail: HTMLElement | null, id: ChapterId | null) =>
  rail?.querySelectorAll<HTMLAnchorElement>("a[data-chapter-link]").forEach((link) => {
    if (link.dataset.chapterLink === id) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });

function CaseStudy({ project }: { project: ProjectData }) {
  const { t, locale, path } = useI18n();
  const copy = t.project;
  const scope = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLOListElement>(null);
  // The one current chapter, and the chapter a rail click asked for: it
  // holds until the reader scrolls on their own (near the page end the
  // target may never reach the reading line).
  const active = useRef<ChapterId | null>(null);
  const requested = useRef<ChapterId | null>(null);
  const adjacent = getAdjacentProjects(locale, project.key);
  const projectHref = (slug: string) => `${path("portfolio")}/${slug}`;
  const hasResults = project.results.length > 0;
  const chapterLabel = (id: ChapterId) =>
    id === "measure" && hasResults ? copy.chapters.impact : copy.chapters[id];
  useReveal(scope);
  // The cover drifts slower than the page: depth without moving layout.
  useParallax(scope);

  const setActive = (id: ChapterId | null) => {
    if (active.current === id) return;
    active.current = id;
    markRail(railRef.current, id);
  };

  /*
   * Chapter rail (any motion setting: it is state, not motion). One
   * listener computes the single current chapter from the chapters'
   * positions against a reading line under the header (lib/scrollspy.ts),
   * so neighbouring chapters can never toggle each other, and the rail is
   * written only when the answer changes.
   */
  useMotion(
    ({ gsap, ScrollTrigger }) => {
      const chapters = gsap.utils.toArray<HTMLElement>("[data-chapter]");
      const header = document.querySelector<HTMLElement>(".site-header");
      const update = () => {
        if (requested.current) return setActive(requested.current);
        const scrollY = window.scrollY;
        const viewport = window.innerHeight;
        setActive(
          pickChapter(
            chapters.map((el) => ({
              id: el.dataset.chapter as ChapterId,
              top: documentTop(el) - scrollY,
            })),
            {
              line: readingLine(header?.offsetHeight ?? 0, viewport),
              viewport,
              atBottom: scrollY >= ScrollTrigger.maxScroll(window) - 2,
            },
          ),
        );
      };
      ScrollTrigger.create({ start: 0, end: "max", onUpdate: update, onRefresh: update });
      update();
      // Any input of the reader's own hands the rail back to the scrollspy.
      const release = () => {
        if (!requested.current) return;
        requested.current = null;
        update();
      };
      const inputs = ["wheel", "touchstart", "keydown", "pointerdown", "hashchange"] as const;
      for (const type of inputs) window.addEventListener(type, release, { passive: true });
      return () => {
        for (const type of inputs) window.removeEventListener(type, release);
        requested.current = null;
      };
    },
    { scope },
  );

  useMotion(
    ({ gsap }) => {
      const root = scope.current;
      if (!root) return;
      const mm = gsap.matchMedia();
      mm.add({ motion: motionQueries.motion, tablet: motionQueries.tablet }, (context) => {
        const { motion, tablet } = context.conditions as Record<string, boolean>;
        if (!motion) return;
        const once = (trigger: string, start = "top 80%") => ({ trigger, start, once: true });
        const pick = <T extends Element = Element>(parent: Element, selector: string) =>
          parent.querySelector<T>(selector);

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

        /*
         * System map: the data's journey. Each part extends along its own
         * length, its handoff label follows, and the connector draws up the
         * 33deg stair with a signal capsule riding its tip; the next part
         * rings once as the signal arrives, then extends in turn. On phones
         * the spine draws down beside the same sequence. About 2s in all.
         */
        const map = pick<HTMLElement>(root, "[data-system-map]");
        if (map) {
          const journey = gsap.timeline({
            scrollTrigger: once("[data-system-map]", "top 78%"),
            defaults: { ease: "expo.out" },
          });
          // Each part starts as the previous connector finishes drawing.
          const STEP = 0.54;
          gsap.utils.toArray<HTMLElement>("[data-system-node]", map).forEach((node, index) => {
            const start = index * STEP;
            const capsule = pick(node, "[data-system-capsule]");
            const ring = pick(node, "[data-system-ring]");
            const link = pick(node, "[data-system-link]");
            const signal = pick(node, "[data-system-signal]");
            const handoff = pick(node, "[data-system-handoff]");
            journey.fromTo(
              capsule,
              { clipPath: "inset(0% 100% 0% 0% round 9999px)" },
              {
                clipPath: "inset(0% 0% 0% 0% round 9999px)",
                duration: 0.5,
                clearProps: "clipPath",
              },
              start,
            );
            if (ring)
              journey.fromTo(
                ring,
                { opacity: 1, scale: 0.97 },
                {
                  opacity: 0,
                  scale: 1.12,
                  duration: 0.7,
                  ease: "power2.out",
                  immediateRender: false,
                },
                start,
              );
            if (handoff) journey.from(handoff, { opacity: 0, y: 6, duration: 0.45 }, start + 0.14);
            if (link) {
              journey.fromTo(
                link,
                { scaleX: 0 },
                { scaleX: 1, duration: 0.36, ease: "power2.inOut" },
                start + 0.22,
              );
              if (signal)
                journey
                  .fromTo(
                    signal,
                    { opacity: 0 },
                    { opacity: 1, duration: 0.08, immediateRender: false },
                    start + 0.22,
                  )
                  .to(signal, { opacity: 0, duration: 0.24, ease: "power1.out" }, start + 0.6);
            }
          });
          const spine = pick(root, "[data-system-spine]");
          if (spine && !tablet)
            journey.fromTo(
              spine,
              { scaleY: 0 },
              { scaleY: 1, duration: journey.duration(), ease: "none" },
              0,
            );
        }

        /*
         * Flow: progress follows the reader. The cobalt line fills with the
         * scroll (across from 768px, down on phones) and each step's marker
         * lights, with a small press, when the line reaches it. Labels stay
         * readable throughout; unlit steps are only quieter.
         */
        const flow = pick<HTMLElement>(root, "[data-flow]");
        const track = flow && pick<HTMLElement>(flow, "[data-flow-track]");
        const line = flow && pick<HTMLElement>(flow, "[data-flow-line]");
        if (flow && track && line) {
          const steps = gsap.utils.toArray<HTMLElement>("[data-flow-step]", flow);
          let marks: number[] = [];
          const measure = () => {
            const box = track.getBoundingClientRect();
            marks = steps.map((step) => {
              const marker = (
                pick<HTMLElement>(step, "[data-flow-marker]") ?? step
              ).getBoundingClientRect();
              const at = tablet
                ? (marker.left + marker.width / 2 - box.left) / box.width
                : (marker.top + marker.height / 2 - box.top) / box.height;
              return Math.min(1, Math.max(0, at));
            });
          };
          const light = (progress: number) =>
            steps.forEach((step, index) =>
              step.classList.toggle(
                "is-passed",
                progress > 0.001 && progress >= (marks[index] ?? 0) - 0.02,
              ),
            );
          measure();
          flow.dataset.armed = "true";
          gsap.fromTo(line, tablet ? { scaleX: 0 } : { scaleY: 0 }, {
            ...(tablet ? { scaleX: 1 } : { scaleY: 1 }),
            ease: "none",
            onUpdate() {
              light(this.progress());
            },
            scrollTrigger: {
              trigger: flow,
              start: tablet ? "top 80%" : "top 62%",
              end: tablet ? "top 36%" : "bottom 62%",
              scrub: 0.35,
              onRefresh: measure,
            },
          });
        }

        /*
         * What would be measured: a frame for a value that does not exist
         * yet. The card's rule draws, the indicator settles, and the empty
         * slot turns from flat onto the logo's axis beside its note. No
         * numbers, no fill, no progress: it shows a plan, not a result.
         */
        const metrics = gsap.utils.toArray<HTMLElement>("[data-metric]");
        if (metrics.length > 0) {
          const plan = gsap.timeline({
            scrollTrigger: once("[data-metrics]", "top 82%"),
            defaults: { ease: "expo.out" },
          });
          metrics.forEach((metric, index) => {
            const at = index * 0.14;
            plan.fromTo(
              pick(metric, "[data-metric-rule]"),
              { scaleX: 0 },
              { scaleX: 1, duration: 0.8, ease: "power3.out" },
              at,
            );
            plan.from(
              pick(metric, "[data-metric-name]"),
              { opacity: 0, y: 12, duration: 0.7 },
              at + 0.12,
            );
            const slot = pick(metric, "[data-metric-slot]");
            if (slot)
              plan.from(slot, { rotate: 0, scaleX: 0.35, opacity: 0, duration: 0.9 }, at + 0.32);
            const note = pick(metric, "[data-metric-note]");
            if (note) plan.from(note, { opacity: 0, x: -6, duration: 0.6 }, at + 0.42);
          });
        }

        // Technology layers settle one after another, badges popping in.
        gsap.from("[data-tech-layer] [data-tech-badge]", {
          opacity: 0,
          scale: 0.9,
          y: 8,
          stagger: 0.06,
          duration: 0.6,
          scrollTrigger: once("[data-tech-stack]"),
        });

        return () => {
          if (!flow) return;
          flow.dataset.armed = "false";
          for (const step of flow.querySelectorAll(".is-passed"))
            step.classList.remove("is-passed");
        };
      });
    },
    { scope },
  );

  // Rail links scroll smoothly (instantly under reduced motion), mark their
  // chapter at once, and move focus to it, so keyboard and screen reader
  // users land there too. The URL takes the hash without a new history entry.
  const jump = (event: MouseEvent<HTMLAnchorElement>, id: ChapterId) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    requested.current = id;
    setActive(id);
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
          {/* The brief: context, then the problem it leads to, one under the
              other in reading order (never side by side, so each chapter has
              its own place on the reading line). */}
          <div className="grid gap-4 md:gap-5">
            <section {...chapter("context")} className="case-card" data-reveal>
              <ChapterHead id="context" compact>
                {copy.context}
              </ChapterHead>
              <p className="case-card-text">{project.context}</p>
            </section>
            <section {...chapter("problem")} className="case-card case-card-open" data-reveal>
              <ChapterHead id="problem" compact>
                {copy.problem}
              </ChapterHead>
              <p className="case-card-text">{project.problem}</p>
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
            <div data-flow className="relative mt-12">
              <span aria-hidden data-flow-track className="flow-rule bg-line-strong" />
              <span aria-hidden data-flow-line className="flow-rule flow-fill bg-accent" />
              <ol className="relative grid gap-8 md:grid-cols-5 md:gap-4">
                {project.flow.map((step, index) => (
                  <li key={step} data-flow-step className="flow-step">
                    <span aria-hidden data-flow-marker className="flow-marker">
                      {index + 1}
                    </span>
                    <span className="flow-label">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
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
                <li key={item} data-metric className="case-metric">
                  <span aria-hidden data-metric-rule className="case-metric-rule" />
                  <span data-metric-name className="text-lg leading-snug font-semibold">
                    {item}
                  </span>
                  {!hasResults && (
                    <span className="mt-auto flex items-center gap-3 pt-6 text-sm text-ink-muted">
                      <span aria-hidden data-metric-slot className="case-metric-slot" />
                      <span data-metric-note>{copy.measurePending}</span>
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
