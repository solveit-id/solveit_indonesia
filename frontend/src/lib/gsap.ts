import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Loaded lazily through ~/lib/motion. Plugins register once, in the browser only.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, Flip);
  gsap.defaults({ ease: "expo.out", duration: 0.9 });
}

export { Flip, gsap, ScrollTrigger };
