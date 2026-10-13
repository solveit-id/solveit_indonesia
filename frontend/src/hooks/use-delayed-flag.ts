import { useEffect, useState } from "react";

/**
 * True once `active` has stayed true for `delay` ms; false again as soon as
 * it turns false. Keeps loading feedback from flashing for fast operations,
 * without delaying the operation itself.
 */
export function useDelayedFlag(active: boolean, delay: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setElapsed(true), delay);
    return () => {
      window.clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delay]);
  return active && elapsed;
}
