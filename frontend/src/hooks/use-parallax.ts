import type { DependencyList, RefObject } from "react";
import { motionQueries, useMotion } from "~/lib/motion";

/**
 * Scroll parallax for `[data-parallax]` elements inside `scope`: each one
 * drifts vertically inside its frame (the parent, which clips it) while the
 * frame crosses the viewport. `data-parallax` is the travel in percent of the
 * element's own height; the element must overhang its frame by at least that
 * much (e.g. `-inset-y-[9%]` for 6). Half the travel below 768px; none under
 * reduced motion, where the element simply rests centred.
 */
export function useParallax(
  scope: RefObject<HTMLElement | null>,
  dependencies: DependencyList = [],
) {
  useMotion(
    ({ gsap }) => {
      const mm = gsap.matchMedia();
      mm.add({ motion: motionQueries.motion, tablet: motionQueries.tablet }, (context) => {
        const { motion, tablet } = context.conditions as Record<string, boolean>;
        if (!motion) return;
        for (const el of gsap.utils.toArray<HTMLElement>("[data-parallax]")) {
          const travel = (Number(el.dataset.parallax) || 6) * (tablet ? 1 : 0.5);
          gsap.fromTo(
            el,
            { yPercent: -travel },
            {
              yPercent: travel,
              ease: "none",
              scrollTrigger: {
                trigger: el.parentElement ?? el,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          );
        }
      });
    },
    { scope, dependencies },
  );
}
