import { iconCapsules, iconViewBox } from "@solveit/brand/logo-paths";
import { useId, useRef } from "react";
import { useMotion } from "~/lib/motion";

/** The 33 degree axis as a unit vector in SVG space (y grows downward, so the axis rises). */
const AXIS = { x: Math.cos((33 * Math.PI) / 180), y: -Math.sin((33 * Math.PI) / 180) };
/** How far each capsule starts from its place, in viewBox units, and from which side. */
const ARRIVALS = [-96, 72, -72, 96];

/**
 * The B3.2c focal moment (owner decision 2026-10-18): when a one-time link appears, the mark
 * assembles from its four capsules travelling along the logo's own 33 degree axis, once, about
 * 600 ms, the brand story "parts becoming a solution" at the one moment a secret is visible.
 * The shapes are the original paths, untouched; only their position and opacity move (GSAP on
 * the SVG transform attribute). Without GSAP or under reduced motion the mark is simply whole.
 */
export function AssemblingMark({ className }: { className?: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const prefix = `assemble${useId().replace(/:/g, "")}`;

  useMotion(
    ({ gsap }) => {
      const capsules = svg.current?.querySelectorAll<SVGPathElement>("[data-capsule]");

      if (!capsules || capsules.length === 0) {
        return;
      }

      gsap.from(capsules, {
        x: (index: number) => AXIS.x * (ARRIVALS[index] ?? 0),
        y: (index: number) => AXIS.y * (ARRIVALS[index] ?? 0),
        opacity: 0,
        duration: 0.5,
        stagger: 0.04,
        ease: "expo.out",
      });
    },
    { scope: svg },
  );

  return (
    <svg
      ref={svg}
      viewBox={iconViewBox}
      className={className}
      aria-hidden
      focusable="false"
      overflow="visible"
    >
      <defs>
        {iconCapsules.map(({ gradient }, index) => (
          <linearGradient
            key={index}
            id={`${prefix}-${index}`}
            x1={gradient.x1}
            y1={gradient.y1}
            x2={gradient.x2}
            y2={gradient.y2}
            gradientUnits="userSpaceOnUse"
          >
            {gradient.stops.map(([offset, color]) => (
              <stop key={offset} offset={offset} stopColor={color} />
            ))}
          </linearGradient>
        ))}
      </defs>
      {iconCapsules.map(({ d }, index) => (
        <path key={index} data-capsule d={d} fill={`url(#${prefix}-${index})`} />
      ))}
    </svg>
  );
}
