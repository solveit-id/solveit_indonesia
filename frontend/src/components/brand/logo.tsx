import { cn } from "~/lib/cn";
import { type LogoCapsule as CapsuleSpec, primaryCapsules, primaryViewBox } from "./logo-paths";
import { LogoCapsule, logoPart } from "./logo-sprite";

interface CapsuleGradientsProps {
  capsules: CapsuleSpec[];
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

/** Primary lockup, drawn from the shared definitions in <LogoSprite />. */
export function Logo({ className, variant = "color", title = "Solveit Indonesia" }: LogoProps) {
  const mono = variant === "mono";
  return (
    <svg
      viewBox={primaryViewBox}
      className={cn("block h-auto", className)}
      role="img"
      aria-label={title}
      focusable="false"
    >
      {primaryCapsules.map((_, index) => (
        <LogoCapsule key={index} index={index} mono={mono} />
      ))}
      <use href={`#${logoPart.word}`} fill={mono ? "currentColor" : "var(--logo-word)"} />
      <use
        href={`#${logoPart.descriptor}`}
        fill={mono ? "currentColor" : "var(--logo-sub)"}
        opacity={mono ? 0.8 : 1}
      />
    </svg>
  );
}
