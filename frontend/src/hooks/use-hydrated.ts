import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during prerender and hydration, true afterwards. */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
