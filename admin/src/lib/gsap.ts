import { gsap } from "gsap";

// Loaded lazily through ~/lib/motion, never in the initial chunk. Core only: the console needs
// no plugin (no ScrollTrigger: nothing here is scroll-driven; no Flip: the one FLIP is computed
// by hand in the navigation). Defaults are the console's state timing (docs/design/design-system.md,
// Konsol admin, Motion).
gsap.defaults({ ease: "expo.out", duration: 0.28 });
// Callers guard their targets; the console never logs (eslint no-console), GSAP included.
gsap.config({ nullTargetWarn: false });

export { gsap };
