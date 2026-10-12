import type { RefObject } from "react";
import { motionQueries, useMotion } from "~/lib/motion";

/**
 * Staggered scroll reveal for `[data-reveal]` descendants of `scope`.
 * Content is visible by default (no-JS, reduced motion); the hidden state is
 * applied only when motion is allowed and the element is still below the fold.
 */
export function useReveal(scope: RefObject<HTMLElement | null>) {
  useMotion(
    ({ gsap, ScrollTrigger }) => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        const targets = gsap.utils.toArray<HTMLElement>("[data-reveal]");
        const below = targets.filter((el) => el.getBoundingClientRect().top > window.innerHeight);
        if (below.length === 0) return;
        // Opacity, not visibility: hidden-until-scrolled content must stay in the
        // accessibility tree for screen reader users browsing ahead.
        gsap.set(below, { opacity: 0, y: 28 });
        ScrollTrigger.batch(below, {
          start: "top 88%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { opacity: 1, y: 0, duration: 1, stagger: 0.08, overwrite: true }),
        });
      });
    },
    { scope },
  );
}
