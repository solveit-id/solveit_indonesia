/** Route paths of the console. Only screens that really exist get a path. */
export const paths = {
  foundation: "/",
} as const;

/** Development and QA builds only; unused, and therefore dropped, in production builds. */
export const referencePath = "/referensi-komponen";

/**
 * The component reference exists on the dev server and in the CI reference build
 * (`vite build --mode reference`) only. Code tests the global `__ADMIN_COMPONENT_REFERENCE__`
 * directly (src/app/router.tsx, primary-navigation.tsx): vite.config.ts `define` writes the
 * literal in at each use, so production builds drop the route, its link, and its chunk
 * (scripts/check-build.mjs verifies it). Declared in src/env.d.ts.
 */
