import { type DependencyList, type RefObject, useLayoutEffect } from "react";
import type * as GsapModule from "./gsap";

/**
 * Motion in the admin console (docs/design/design-system.md, Konsol admin, Motion). Rules:
 *
 * - GSAP is a lazy chunk, fetched when the browser is idle after start-up. Nothing ever waits
 *   for it: content renders visible, and an entrance plays only when GSAP is already loaded at
 *   the moment the content appears. If it is not (first paint, slow network, a failed chunk),
 *   the content simply shows, never a flash of hidden content and never a blocked screen.
 * - Transform and opacity only (colour for highlights), 150 to 420 ms, expo out; one authored
 *   moment (the one-time link reveal, ~600 ms).
 * - `prefers-reduced-motion: reduce` removes spatial movement; meaningful state stays visible.
 * - Every tween lives in a gsap.context() scoped to the component and is reverted when it
 *   unmounts or its dependencies change, so no tween, inline style, or listener outlives it.
 */
type GsapApi = typeof GsapModule;

export const motionQueries = {
  motion: "(prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
} as const;

let api: GsapApi | null = null;
let pending: Promise<GsapApi> | null = null;

export const loadGsap = (): Promise<GsapApi> =>
  (pending ??= import("./gsap").then(
    (module) => (api = module),
    (error: unknown) => {
      // A failed chunk leaves the console without motion, never without content; the next
      // caller may try again.
      pending = null;
      throw error;
    },
  ));

/** GSAP if it has finished loading. */
export const getGsap = (): GsapApi | null => api;

/** Fetch GSAP once the browser is idle, so it is ready before the first interaction needs it. */
export function preloadMotion(): void {
  const start = () => void loadGsap().catch(() => undefined);
  const idle = (window as Window & { requestIdleCallback?: (callback: () => void) => number })
    .requestIdleCallback;

  if (typeof idle === "function") {
    idle.call(window, start);
  } else {
    window.setTimeout(start, 1200);
  }
}

/** True when the reader asked for reduced motion (or the environment cannot say). */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia !== "function" || window.matchMedia(motionQueries.reduce).matches;
}

interface MotionOptions {
  scope?: RefObject<Element | null>;
  dependencies?: DependencyList;
}

/**
 * Runs `setup` in a gsap.context() scoped to `scope`, before paint, only when GSAP is loaded
 * and the reader has not asked for reduced motion; reverts everything on unmount or when a
 * dependency changes (the useGSAP contract). `setup` may return a cleanup of its own.
 */
export function useMotion(
  setup: (gsapApi: GsapApi) => void | (() => void),
  { scope, dependencies = [] }: MotionOptions = {},
): void {
  useLayoutEffect(() => {
    if (api === null || prefersReducedMotion()) {
      return;
    }

    const loaded = api;
    let cleanup: void | (() => void);
    const context = loaded.gsap.context(() => {
      cleanup = setup(loaded);
    }, scope?.current ?? undefined);

    return () => {
      if (typeof cleanup === "function") {
        cleanup();
      }

      context.revert();
    };
    // Same contract as useGSAP: re-run only when the declared dependencies change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
