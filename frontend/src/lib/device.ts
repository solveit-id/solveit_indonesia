interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

/**
 * Heuristic for constrained devices. Heavy effects (pinning, pointer parallax,
 * scrubbed sequences) fall back to lighter versions when this returns true.
 */
export const isLiteDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorWithHints;
  if (nav.connection?.saveData) return true;
  if (nav.connection?.effectiveType && /(^|-)2g$/.test(nav.connection.effectiveType)) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return true;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2) return true;
  return false;
};
