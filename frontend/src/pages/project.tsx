import { useRef } from "react";
import { Link, type MetaFunction, useLocation } from "react-router";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { DemoLabel } from "~/components/portfolio/demo-label";
import { ProjectCover } from "~/components/portfolio/project-cover";
import { SystemMap } from "~/components/portfolio/system-map";
import { NotFoundContent } from "~/components/ui/not-found-content";
import { PageIntro } from "~/components/ui/page-intro";
import { useParallax } from "~/hooks/use-parallax";
import { useReveal } from "~/hooks/use-reveal";
import { getMessages, localeFromPath, pathFor, useI18n } from "~/i18n";
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

function CaseStudy({ project }: { project: ProjectData }) {
  const { t, locale, path } = useI18n();
  const copy = t.project;
  const scope = useRef<HTMLDivElement>(null);
  const adjacent = getAdjacentProjects(locale, project.key);
  const projectHref = (slug: string) => `${path("portfolio")}/${slug}`;
  useReveal(scope);
  // The cover drifts slower than the page: depth without moving layout.
  useParallax(scope);

  useMotion(
    ({ gsap }) => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        // The flow reads in order: the rail draws through each step.
        gsap
          .timeline({ scrollTrigger: { trigger: "[data-flow]", start: "top 80%", once: true } })
          .fromTo(
            "[data-flow-line]",
            { scaleX: 0, scaleY: 0 },
            { scaleX: 1, scaleY: 1, duration: 1.4, ease: "power2.inOut" },
          )
          .from("[data-flow-step]", { opacity: 0, y: 12, stagger: 0.22, duration: 0.6 }, 0.1);
        // System map: the parts step up the staircase one after another.
        gsap.from("[data-system-node]", {
          opacity: 0,
          x: -16,
          stagger: 0.12,
          duration: 0.8,
          scrollTrigger: { trigger: "[data-system-map]", start: "top 82%", once: true },
        });
      });
    },
    { scope },
  );

  const narrative = [
    { id: "context", title: copy.context, text: project.context },
    { id: "problem", title: copy.problem, text: project.problem },
    { id: "solution", title: copy.solution, text: project.solution },
  ];

  return (
    <article ref={scope}>
      <PageIntro
        breadcrumbs={[
          { name: t.nav.labels.portfolio, path: path("portfolio") },
          { name: project.title },
        ]}
        title={project.title}
        lede={<p>{project.summary}</p>}
      >
        <div className="enter mt-10 flex flex-col gap-6 [--enter-index:3]">
          {project.isDemo && (
            <div className="flex flex-col items-start gap-3">
              <DemoLabel />
              <p className="max-w-[60ch] text-[0.95rem] text-ink-muted">{copy.demoNote}</p>
            </div>
          )}
          <dl className="grid gap-6 border-t border-line pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-ink-muted">{copy.category}</dt>
              <dd className="mt-1 font-semibold">{categoryLabel(locale, project.category)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{copy.sector}</dt>
              <dd className="mt-1 font-semibold">{project.sector}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{copy.technology}</dt>
              <dd className="mt-1 font-semibold">{project.technologies.join(", ")}</dd>
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

      <section aria-label={copy.summaryLabel} className="shell py-[var(--spacing-section)]">
        <div className="grid gap-14">
          {narrative.map((block) => (
            <div key={block.id} className="grid gap-4 lg:grid-cols-12" data-reveal>
              <h2 className="text-heading font-wide lg:col-span-3">{block.title}</h2>
              <p className="max-w-[60ch] text-lede lg:col-span-8 lg:col-start-5">{block.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="system-title"
        className="bg-paper-sunken pt-[var(--spacing-section)]"
      >
        <div className="shell">
          <h2 id="system-title" data-reveal className="max-w-[14ch] text-title">
            {copy.systemTitle}
          </h2>
          <div className="mt-14">
            <SystemMap system={project.system} />
          </div>
        </div>
      </section>

      <section aria-labelledby="flow-title" className="bg-paper-sunken py-[var(--spacing-section)]">
        <div className="shell border-t border-line pt-[var(--spacing-section)]">
          <h2 id="flow-title" data-reveal className="max-w-[14ch] text-title">
            {copy.flowTitle}
          </h2>
          <ol data-flow className="relative mt-14 grid gap-8 md:grid-cols-5 md:gap-6">
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
                  className="relative grid grid-cols-[2.75rem_1fr] items-center gap-x-5 md:flex md:flex-col md:items-center md:gap-5 md:text-center"
                >
                  <span
                    aria-hidden
                    className={
                      last
                        ? "relative z-10 grid h-11 w-11 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink"
                        : "relative z-10 grid h-11 w-11 place-items-center rounded-full border border-accent bg-paper-sunken text-sm font-bold text-accent-text"
                    }
                  >
                    {index + 1}
                  </span>
                  <span className="max-w-[16ch] leading-snug font-semibold">{step}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section aria-labelledby="features-title" className="shell py-[var(--spacing-section)]">
        <h2 id="features-title" data-reveal className="max-w-[14ch] text-title">
          {copy.featuresTitle}
        </h2>
        <dl className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {project.features.map((feature) => (
            <div key={feature.name} data-reveal className="border-t border-line-strong pt-6">
              <dt className="text-xl font-bold tracking-[-0.02em] font-wide">{feature.name}</dt>
              <dd className="mt-3 text-ink-muted">{feature.description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="impact-title"
        className="border-t border-line py-[var(--spacing-section)]"
      >
        <div className="shell grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="impact-title" data-reveal className="max-w-[12ch] text-title">
              {project.results.length > 0 ? copy.impactTitle : copy.measureTitle}
            </h2>
            {project.results.length === 0 && (
              <p data-reveal className="mt-6 max-w-[42ch] text-ink-muted">
                {copy.measureNote}
              </p>
            )}
          </div>
          <ul className="grid gap-6 self-end lg:col-span-6 lg:col-start-7">
            {(project.results.length > 0 ? project.results : project.metricsToTrack).map((item) => (
              <li
                key={item}
                data-reveal
                className="border-t border-line-strong pt-5 text-lg font-semibold"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {adjacent && (
        <nav
          aria-label={copy.moreLabel}
          className="shell grid gap-4 pb-[var(--spacing-section)] md:grid-cols-2"
        >
          <Link
            to={projectHref(adjacent.previous.slug)}
            className="group flex flex-col gap-2 rounded-[var(--radius-panel)] border border-line p-7 no-underline transition-colors duration-300 hover:border-ink"
          >
            <span className="flex items-center gap-4 text-xl font-bold tracking-[-0.02em] font-wide">
              <ArrowLeft
                aria-hidden
                className="size-5 shrink-0 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-translate-x-1"
              />
              <span>
                <span className="sr-only">{copy.previous}</span>
                {adjacent.previous.title}
              </span>
            </span>
          </Link>
          <Link
            to={projectHref(adjacent.next.slug)}
            className="group flex flex-col items-end gap-2 rounded-[var(--radius-panel)] border border-line p-7 text-right no-underline transition-colors duration-300 hover:border-ink"
          >
            <span className="flex items-center gap-4 text-xl font-bold tracking-[-0.02em] font-wide">
              <span>
                <span className="sr-only">{copy.next}</span>
                {adjacent.next.title}
              </span>
              <ArrowRight
                aria-hidden
                className="size-5 shrink-0 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1"
              />
            </span>
          </Link>
        </nav>
      )}
    </article>
  );
}
