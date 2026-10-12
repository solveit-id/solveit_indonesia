import { type DependencyList, type RefObject, useLayoutEffect } from "react";

import type * as GsapModule from "./gsap";

type GsapApi = typeof GsapModule;

/** Media-query conditions shared by every gsap.matchMedia() call. */
export const motionQueries = {
  motion: "(prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
  desktop: "(min-width: 1024px)",
  finePointer: "(hover: hover) and (pointer: fine)",
} as const;

let api: GsapApi | null = null;
let pending: Promise<GsapApi> | null = null;

/**
 * GSAP is loaded on demand, after the prerendered page has painted, so it never
 * competes with first paint. Every caller shares one import.
 */
export const loadGsap = (): Promise<GsapApi> =>
  (pending ??= import("./gsap").then((module) => (api = module)));

/** The GSAP API if it has finished loading, for synchronous event handlers. */
export const getGsap = (): GsapApi | null => api;

interface MotionOptions {
  scope?: RefObject<Element | null>;
  dependencies?: DependencyList;
}

/**
 * Runs `setup` inside a gsap.context() scoped to `scope` once GSAP is loaded,
 * and reverts every tween, ScrollTrigger, and matchMedia it created when the
 * component unmounts or a dependency changes (the useGSAP contract, lazily).
 */
export function useMotion(
  setup: (gsapApi: GsapApi) => void | (() => void),
  { scope, dependencies = [] }: MotionOptions = {},
) {
  // Layout effect, like useGSAP: the revert must run before React removes DOM
  // nodes, because pinning wraps sections in elements React does not own.
  useLayoutEffect(() => {
    let cancelled = false;
    let context: ReturnType<GsapApi["gsap"]["context"]> | undefined;
    void loadGsap().then((loaded) => {
      if (cancelled) return;
      context = loaded.gsap.context(() => setup(loaded), scope?.current ?? undefined);
    });
    return () => {
      cancelled = true;
      context?.revert();
    };
    // Same contract as useGSAP: re-run only when the declared dependencies change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
