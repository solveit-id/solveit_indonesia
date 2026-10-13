import { useRef } from "react";
import { ProjectCover } from "~/components/portfolio/project-cover";
import { useI18n } from "~/i18n";
import { motionQueries, useMotion } from "~/lib/motion";

/**
 * How working with Solveit feels, as four commitments. Each tile is uncovered
 * by a wipe along the logo's 33deg diagonal.
 */
export function Principles() {
  const { t } = useI18n();
  const copy = t.home.principles;
  const scope = useRef<HTMLElement>(null);

  useMotion(
    ({ gsap, ScrollTrigger }) => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        const tiles = gsap.utils.toArray<HTMLElement>("[data-tile]");
        gsap.set(tiles, { clipPath: "polygon(0% 100%, 0% 100%, 0% 100%, 0% 100%)" });
        ScrollTrigger.batch(tiles, {
          start: "top 85%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              clipPath: "polygon(0% -60%, 160% -60%, 160% 100%, 0% 100%)",
              duration: 1.3,
              stagger: 0.12,
              ease: "expo.out",
              onComplete: function () {
                gsap.set(this.targets(), { clearProps: "clipPath" });
              },
            }),
        });
      });
    },
    { scope },
  );

  return (
    <section
      ref={scope}
      aria-labelledby="principles-title"
      className="shell py-[var(--spacing-section)]"
    >
      <h2 id="principles-title" className="max-w-[16ch] text-title">
        {t.home.principlesTitle}
      </h2>

      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:mt-20 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
        <article
          data-tile
          className="relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-[var(--radius-panel)] bg-[#082a56] p-8 text-[#e9effa] md:col-span-2 lg:col-span-7 lg:row-span-2 lg:min-h-[34rem] lg:p-12"
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-[64%] [mask-image:linear-gradient(to_bottom,transparent,#000_22%,#000_55%,transparent)]"
          >
            <ProjectCover cover={{ pattern: "lattice", tone: "ink", seed: 7 }} />
          </div>
          <div className="relative max-w-[30ch]">
            <h3 className="text-heading font-wide">{copy.scope.title}</h3>
            <p className="mt-4 text-[#c3d0e4]">{copy.scope.text}</p>
          </div>
        </article>

        <article
          data-tile
          className="flex flex-col justify-between gap-10 rounded-[var(--radius-panel)] bg-accent p-8 text-accent-ink lg:col-span-5 lg:p-10"
        >
          <h3 className="text-heading font-wide">{copy.progress.title}</h3>
          <p className="text-[#dfe7ff]">{copy.progress.text}</p>
        </article>

        <article
          data-tile
          className="flex flex-col justify-between gap-10 rounded-[var(--radius-panel)] border border-line bg-paper-raised p-8 lg:col-span-5 lg:p-10"
        >
          <h3 className="text-heading font-wide">{copy.care.title}</h3>
          <p className="text-ink-muted">{copy.care.text}</p>
        </article>

        <article
          data-tile
          className="grid gap-8 rounded-[var(--radius-panel)] border border-line-strong p-8 md:col-span-2 lg:col-span-12 lg:grid-cols-12 lg:items-center lg:p-12"
        >
          <div className="lg:col-span-5">
            <h3 className="text-heading font-wide">{copy.portal.title}</h3>
            <p className="mt-4 text-ink-muted">{copy.portal.text}</p>
          </div>
          <ol
            aria-label={t.home.opsHubFlowLabel}
            className="flex flex-wrap gap-2 lg:col-span-7 lg:justify-end"
          >
            {t.home.opsHubFlow.map((stage) => (
              <li
                key={stage}
                className="rounded-full bg-paper-sunken px-4 py-2 text-sm font-semibold text-ink"
              >
                {stage}
              </li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
}
