import { type DependencyList, type RefObject, useLayoutEffect } from "react";

import type * as GsapModule from "./gsap";

type GsapApi = typeof GsapModule;

/** Media-query conditions shared by every gsap.matchMedia() call. */
export const motionQueries = {
  motion: "(prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
  tablet: "(min-width: 768px)",
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

/*
 * When GSAP first arrives, every mounted component sets up its motion at
 * once. Run back to back, those setups (ScrollTriggers measure layout) form
 * one long task that blocks input; queued one per task, the browser can
 * respond between them. Order is kept, so pins are still created top down.
 */
const queue: (() => void)[] = [];
let draining = false;
const drain = () => {
  queue.shift()?.();
  if (queue.length > 0) setTimeout(drain, 0);
  else draining = false;
};
const enqueue = (job: () => void) => {
  queue.push(job);
  if (draining) return;
  draining = true;
  setTimeout(drain, 0);
};

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
    const run = (loaded: GsapApi) => {
      if (cancelled) return;
      context = loaded.gsap.context(() => setup(loaded), scope?.current ?? undefined);
    };
    // Already loaded (client navigation): set up before the next paint, so
    // an entrance never flashes its end state first. First load: queue.
    if (api) run(api);
    else void loadGsap().then((loaded) => enqueue(() => run(loaded)));
    return () => {
      cancelled = true;
      context?.revert();
    };
    // Same contract as useGSAP: re-run only when the declared dependencies change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
