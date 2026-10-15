import { type CSSProperties, useRef } from "react";
import { ProjectCover } from "~/components/portfolio/project-cover";
import { useI18n } from "~/i18n";
import { motionQueries, useMotion } from "~/lib/motion";

// Each tile is uncovered along the logo's 33deg diagonal, from bottom left.
const COVERED = "polygon(0% 100%, 0% 100%, 0% 100%, 0% 100%)";
const UNCOVERED = "polygon(0% -60%, 160% -60%, 160% 100%, 0% 100%)";

/**
 * How working with Solveit feels, as four commitments in the order an
 * engagement meets them: written scope, visible progress, care after
 * launch, and the portal that will hold the whole journey.
 *
 * From 1024px they arrive as one composition: the tiles are uncovered along
 * the 33deg diagonal in that order, each tile's copy rises after its
 * surface, the scope tile's lattice settles into depth, the four preview
 * capsules on the progress tile land one by one, and the portal's stages
 * line up in sequence. Below 1024px each tile simply wipes in. With a fine
 * pointer, hovering answers inside a tile (the lattice drifts on its axis,
 * the previews tick through, the portal stages run in order) without lift,
 * outline, or pointer cursor, because the tiles are not links.
 */
export function Principles() {
  const { t } = useI18n();
  const copy = t.home.principles;
  const scope = useRef<HTMLElement>(null);

  useMotion(
    ({ gsap, ScrollTrigger }) => {
      const mm = gsap.matchMedia();
      mm.add({ motion: motionQueries.motion, desktop: motionQueries.desktop }, (context) => {
        const { motion, desktop } = context.conditions as Record<string, boolean>;
        if (!motion) return;
        const tiles = gsap.utils.toArray<HTMLElement>("[data-tile]");

        if (!desktop) {
          gsap.set(tiles, { clipPath: COVERED });
          ScrollTrigger.batch(tiles, {
            start: "top 85%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                clipPath: UNCOVERED,
                duration: 1.2,
                stagger: 0.1,
                ease: "expo.out",
                clearProps: "clipPath",
              }),
          });
          return;
        }

        const settle = { clearProps: "transform,opacity" };
        const story = gsap.timeline({
          scrollTrigger: { trigger: "[data-principles]", start: "top 72%", once: true },
          defaults: { ease: "expo.out" },
        });
        tiles.forEach((tile, index) => {
          const at = index * 0.16;
          story.fromTo(
            tile,
            { clipPath: COVERED },
            { clipPath: UNCOVERED, duration: 1.25, clearProps: "clipPath" },
            at,
          );
          story.from(
            tile.querySelectorAll("[data-tile-copy] > *"),
            { y: 22, opacity: 0, duration: 0.9, stagger: 0.08, ...settle },
            at + 0.3,
          );
        });
        story
          .from("[data-tile-art]", { scale: 1.14, yPercent: 5, duration: 1.8, ...settle }, 0)
          .from(
            "[data-tile-preview]",
            { x: -10, opacity: 0, duration: 0.6, stagger: 0.09, ...settle },
            0.62,
          )
          .from(
            "[data-tile-stage]",
            { x: -12, opacity: 0, duration: 0.6, stagger: 0.06, ...settle },
            0.86,
          );
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

      <div
        data-principles
        className="mt-14 grid gap-4 md:grid-cols-2 lg:mt-20 lg:grid-cols-12 lg:grid-rows-[auto_auto]"
      >
        <article
          data-tile
          className="principle-scope relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-[var(--radius-panel)] bg-[#082a56] p-8 text-[#e9effa] md:col-span-2 lg:col-span-7 lg:row-span-2 lg:min-h-[34rem] lg:p-12"
        >
          <div
            aria-hidden
            data-tile-art
            className="principle-art absolute inset-x-0 top-0 h-[64%] [mask-image:linear-gradient(to_bottom,transparent,#000_22%,#000_55%,transparent)]"
          >
            <ProjectCover cover={{ pattern: "lattice", tone: "ink", seed: 7 }} />
          </div>
          <div data-tile-copy className="relative max-w-[30ch]">
            <h3 className="text-heading font-wide">{copy.scope.title}</h3>
            <p className="mt-4 text-[#c3d0e4]">{copy.scope.text}</p>
          </div>
        </article>

        <article
          data-tile
          className="principle-progress relative flex flex-col justify-between gap-10 rounded-[var(--radius-panel)] bg-accent p-8 text-accent-ink lg:col-span-5 lg:p-10"
        >
          {/* One preview per stage: four capsules on the logo's axis. */}
          <span aria-hidden className="principle-previews">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                data-tile-preview
                className="principle-preview"
                style={{ "--i": index } as CSSProperties}
              />
            ))}
          </span>
          <div data-tile-copy className="flex flex-1 flex-col justify-between gap-10">
            <h3 className="max-w-[18ch] text-heading font-wide">{copy.progress.title}</h3>
            <p className="text-[#dfe7ff]">{copy.progress.text}</p>
          </div>
        </article>

        <article
          data-tile
          className="flex flex-col justify-between gap-10 rounded-[var(--radius-panel)] border border-line bg-paper-raised p-8 lg:col-span-5 lg:p-10"
        >
          <div data-tile-copy className="flex flex-1 flex-col justify-between gap-10">
            <h3 className="text-heading font-wide">{copy.care.title}</h3>
            <p className="text-ink-muted">{copy.care.text}</p>
          </div>
        </article>

        <article
          data-tile
          className="principle-portal grid gap-8 rounded-[var(--radius-panel)] border border-line-strong p-8 md:col-span-2 lg:col-span-12 lg:grid-cols-12 lg:items-center lg:p-12"
        >
          <div data-tile-copy className="lg:col-span-5">
            <h3 className="text-heading font-wide">{copy.portal.title}</h3>
            <p className="mt-4 text-ink-muted">{copy.portal.text}</p>
          </div>
          <ol
            aria-label={t.home.ecosystemFlowLabel}
            className="flex flex-wrap gap-2 lg:col-span-7 lg:justify-end"
          >
            {t.home.ecosystemFlow.map((stage, index) => (
              <li
                key={stage}
                data-tile-stage
                className="principle-stage"
                style={{ "--i": index } as CSSProperties}
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
