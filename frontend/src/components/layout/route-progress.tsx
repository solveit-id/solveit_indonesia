import { useNavigation } from "react-router";
import { cn } from "~/lib/cn";

/** Thin capsule bar shown only when a navigation takes noticeable time. */
export function RouteProgress() {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[var(--z-progress)] h-[3px] origin-left rounded-full bg-accent",
        "transition-[transform,opacity] ease-[var(--ease-out-expo)]",
        busy
          ? "scale-x-[0.7] opacity-100 delay-150 duration-[1400ms]"
          : "scale-x-100 opacity-0 duration-500",
      )}
    />
  );
}
