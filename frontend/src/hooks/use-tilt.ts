import type { RefObject } from "react";
import { isLiteDevice } from "~/lib/device";
import { motionQueries, useMotion } from "~/lib/motion";

/**
 * Restrained 3D tilt for `[data-tilt]` elements inside `scope`: fine pointers
 * only, never on reduced motion or constrained devices.
 */
export function useTilt(scope: RefObject<HTMLElement | null>, maxDegrees = 5) {
  useMotion(
    ({ gsap }) => {
      const mm = gsap.matchMedia();
      mm.add(`${motionQueries.motion} and ${motionQueries.finePointer}`, () => {
        if (isLiteDevice()) return;
        const cleanups = gsap.utils.toArray<HTMLElement>("[data-tilt]").map((el) => {
          gsap.set(el, { transformPerspective: 900 });
          const rotateX = gsap.quickTo(el, "rotationX", { duration: 0.8, ease: "power3.out" });
          const rotateY = gsap.quickTo(el, "rotationY", { duration: 0.8, ease: "power3.out" });
          const onMove = (event: PointerEvent) => {
            const rect = el.getBoundingClientRect();
            rotateY(((event.clientX - rect.left) / rect.width - 0.5) * maxDegrees * 2);
            rotateX(-((event.clientY - rect.top) / rect.height - 0.5) * maxDegrees * 2);
          };
          const onLeave = () => {
            rotateX(0);
            rotateY(0);
          };
          el.addEventListener("pointermove", onMove);
          el.addEventListener("pointerleave", onLeave);
          return () => {
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerleave", onLeave);
          };
        });
        return () => cleanups.forEach((cleanup) => cleanup());
      });
    },
    { scope },
  );
}
