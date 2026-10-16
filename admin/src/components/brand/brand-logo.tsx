import {
  type LogoCapsule,
  iconCapsules,
  iconViewBox,
  primaryCapsules,
  primaryDescriptor,
  primaryViewBox,
  primaryWordmark,
} from "@solveit/brand/logo-paths";
import { useId } from "react";

/**
 * The Solveit logo from the original path data (frontend/src/components/brand/logo-paths.ts,
 * copied verbatim from the SVGs in frontend/public/brand/; shapes never edited). The only
 * variation is the wordmark colour, which follows --logo-word and --logo-sub so it reads on the
 * navy rail and in the dark theme (docs/DESIGN.md, Don'ts).
 */
function Capsules({ capsules, prefix }: { capsules: LogoCapsule[]; prefix: string }) {
  return (
    <>
      <defs>
        {capsules.map(({ gradient }, index) => (
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
      {capsules.map(({ d }, index) => (
        <path key={index} d={d} fill={`url(#${prefix}-${index})`} />
      ))}
    </>
  );
}

interface LogoProps {
  className?: string;
  /** Accessible name; omit when the surrounding element already names the brand. */
  title?: string;
}

/** Primary lockup: mark, wordmark, and INDONESIA. */
export function BrandLockup({ className, title }: LogoProps) {
  const prefix = `lockup${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox={primaryViewBox}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <Capsules capsules={primaryCapsules} prefix={prefix} />
      <path d={primaryWordmark} fill="var(--logo-word)" />
      <path d={primaryDescriptor} fill="var(--logo-sub)" />
    </svg>
  );
}

/** The mark alone (four capsules), for narrow bars. */
export function BrandMark({ className, title }: LogoProps) {
  const prefix = `mark${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox={iconViewBox}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <Capsules capsules={iconCapsules} prefix={prefix} />
    </svg>
  );
}
