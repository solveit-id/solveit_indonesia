import { useId } from "react";
import { cn } from "~/lib/cn";
import {
  type LogoCapsule,
  primaryCapsules,
  primaryDescriptor,
  primaryViewBox,
  primaryWordmark,
} from "./logo-paths";

interface CapsuleGradientsProps {
  capsules: LogoCapsule[];
  idPrefix: string;
}

export function CapsuleGradients({ capsules, idPrefix }: CapsuleGradientsProps) {
  return (
    <defs>
      {capsules.map(({ gradient }, index) => (
        <linearGradient
          key={index}
          id={`${idPrefix}-${index}`}
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
  );
}

interface LogoProps {
  className?: string;
  /**
   * `color`: original artwork (the wordmark follows the theme's ink token so it
   * stays legible in dark mode). `mono`: single-colour reversal for use on the
   * cobalt field. Shapes are never altered.
   */
  variant?: "color" | "mono";
  title?: string;
}

export function Logo({ className, variant = "color", title = "Solveit Indonesia" }: LogoProps) {
  const id = useId().replace(/:/g, "");
  const mono = variant === "mono";
  return (
    <svg
      viewBox={primaryViewBox}
      className={cn("block h-auto", className)}
      role="img"
      aria-label={title}
      focusable="false"
    >
      {!mono && <CapsuleGradients capsules={primaryCapsules} idPrefix={id} />}
      {primaryCapsules.map((capsule, index) => (
        <path key={index} d={capsule.d} fill={mono ? "currentColor" : `url(#${id}-${index})`} />
      ))}
      <path d={primaryWordmark} fill={mono ? "currentColor" : "var(--logo-word)"} />
      <path
        d={primaryDescriptor}
        fill={mono ? "currentColor" : "var(--logo-sub)"}
        opacity={mono ? 0.8 : 1}
      />
    </svg>
  );
}
