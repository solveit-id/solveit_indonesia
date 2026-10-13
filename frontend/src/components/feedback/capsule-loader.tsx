import { iconCapsules, iconViewBox } from "~/components/brand/logo-paths";
import { cn } from "~/lib/cn";

/**
 * Indeterminate loading mark: the four logo capsules drift apart along the
 * 33 degree axis and lock back into the S, on a loop. It says "working",
 * never "how far": nothing about it pretends to measure progress.
 * CSS-only (no GSAP), so it can show before or without the motion bundle;
 * under reduced motion it rests as the assembled mark. Decorative: pair it
 * with visible or screen-reader text.
 */
export function CapsuleLoader({ className }: { className?: string }) {
  return (
    <svg
      viewBox={iconViewBox}
      aria-hidden
      focusable="false"
      className={cn("capsule-loader block h-auto overflow-visible", className)}
    >
      {iconCapsules.map((capsule, index) => (
        <path key={index} d={capsule.d} data-loader-capsule={index} fill="currentColor" />
      ))}
    </svg>
  );
}
