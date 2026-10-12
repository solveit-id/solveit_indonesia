import { useId } from "react";
import { cn } from "~/lib/cn";
import { CapsuleGradients } from "./logo";
import { iconCapsules, iconViewBox } from "./logo-paths";

interface BrandMarkProps {
  className?: string;
  /** Accessible name; omit for a decorative mark. */
  title?: string;
}

/**
 * The Solveit icon with each capsule as its own element (`data-capsule`), so
 * motion can move the pieces while the resting state is the exact logo.
 */
export function BrandMark({ className, title }: BrandMarkProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox={iconViewBox}
      className={cn("block h-auto overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <CapsuleGradients capsules={iconCapsules} idPrefix={id} />
      {iconCapsules.map((capsule, index) => (
        <path key={index} data-capsule={index} d={capsule.d} fill={`url(#${id}-${index})`} />
      ))}
    </svg>
  );
}
