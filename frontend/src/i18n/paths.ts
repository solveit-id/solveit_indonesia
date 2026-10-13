// Relative imports only: this module is also loaded by react-router.config.ts.
import { projects } from "../data/projects";
import { type Locale, locales, normalizePath, type PageKey, pageKeys, pagePaths } from "./config";

type Slugged = { slugs: Record<Locale, string> };

export const projectPath = (project: Slugged, locale: Locale): string =>
  `${pagePaths.portfolio[locale]}/${project.slugs[locale]}`;

/** Every indexable URL in every language. Shared by prerendering, the router, and tests. */
export const localizedRoutes = (): string[] =>
  locales.flatMap((locale) => [
    ...pageKeys.map((key) => pagePaths[key][locale]),
    ...projects.map((project) => projectPath(project, locale)),
  ]);

export type ResolvedPath =
  | { kind: "page"; key: PageKey; locale: Locale }
  | { kind: "project"; key: string; locale: Locale }
  | null;

/** Identifies which page a pathname is, in which language. `null` for unknown URLs. */
export function resolvePath(pathname: string): ResolvedPath {
  const path = normalizePath(pathname);
  for (const locale of locales) {
    for (const key of pageKeys)
      if (pagePaths[key][locale] === path) return { kind: "page", key, locale };
    for (const project of projects)
      if (projectPath(project, locale) === path)
        return { kind: "project", key: project.key, locale };
  }
  return null;
}

/**
 * The same page in another language. Case studies map slug to slug; unknown
 * URLs (404) fall back to the target language's home page.
 */
export function alternatePath(pathname: string, target: Locale): string {
  const resolved = resolvePath(pathname);
  if (!resolved) return pagePaths.home[target];
  if (resolved.kind === "page") return pagePaths[resolved.key][target];
  const project = projects.find((item) => item.key === resolved.key);
  return project ? projectPath(project, target) : pagePaths.portfolio[target];
}

/** Paths of one page in every language, for hreflang. */
export const alternatesFor = (pathname: string): Record<Locale, string> | null => {
  if (!resolvePath(pathname)) return null;
  return Object.fromEntries(
    locales.map((locale) => [locale, alternatePath(pathname, locale)]),
  ) as Record<Locale, string>;
};
