import { useRef } from "react";
import { Link } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { useI18n } from "~/i18n";
import { motionQueries, useMotion } from "~/lib/motion";
import { getProcessSteps } from "~/services/content";

/**
 * The engagement as a rail: the line fills with the reader's scroll and each
 * step's marker lights as it reaches the reading line.
 */
export function ProcessRail() {
  const { t, locale, path } = useI18n();
  const processSteps = getProcessSteps(locale);
  const scope = useRef<HTMLElement>(null);

  useMotion(
    ({ gsap, ScrollTrigger }) => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        const rail = scope.current?.querySelector<HTMLElement>("[data-rail]");
        if (rail) rail.dataset.armed = "true";
        gsap.fromTo(
          "[data-rail-fill]",
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-rail]",
              start: "top 60%",
              end: "bottom 60%",
              scrub: true,
            },
          },
        );
        for (const step of gsap.utils.toArray<HTMLElement>("[data-step]")) {
          ScrollTrigger.create({
            trigger: step,
            start: "top 60%",
            end: "bottom 60%",
            toggleClass: { targets: step, className: "is-current" },
            onEnter: () => step.classList.add("is-passed"),
            onLeaveBack: () => step.classList.remove("is-passed"),
          });
        }
        return () => {
          if (rail) rail.dataset.armed = "false";
        };
      });
    },
    { scope },
  );

  return (
    <section
      ref={scope}
      aria-labelledby="process-title"
      className="border-t border-line py-[var(--spacing-section)]"
    >
      <div className="shell grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <h2 id="process-title" className="max-w-[12ch] text-title">
              {t.home.processTitle}
            </h2>
            <p className="mt-6 max-w-[36ch] text-ink-muted">{t.home.processLede}</p>
            <Link to={path("process")} className="btn btn-secondary mt-8">
              {t.home.processCta}
              <ArrowRight aria-hidden className="btn-icon size-4" weight="bold" />
            </Link>
          </div>
        </div>

        <ol data-rail className="relative lg:col-span-7 lg:col-start-6">
          <span
            aria-hidden
            className="absolute top-2 bottom-2 left-[1.375rem] w-px bg-line-strong"
          />
          <span
            aria-hidden
            data-rail-fill
            className="absolute top-2 bottom-2 left-[1.375rem] w-px origin-top bg-accent"
          />
          {processSteps.map((step, index) => (
            <li
              key={step.id}
              data-step
              className="group/step relative grid grid-cols-[2.75rem_1fr] gap-x-6 pb-12 last:pb-0"
            >
              <span
                aria-hidden
                className="rail-marker relative z-10 grid h-11 w-11 place-items-center rounded-full border text-sm font-bold transition-[background-color,color,border-color] duration-500"
              >
                {index + 1}
              </span>
              <div className="pt-1.5">
                <h3 className="text-heading font-wide">{step.name}</h3>
                <p className="mt-3 max-w-[52ch] text-ink-muted">{step.description}</p>
                <p className="mt-4 text-[0.95rem]">
                  <span className="font-semibold text-ink">{t.home.youReceive}</span>
                  <span className="text-ink-muted">{step.output}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
