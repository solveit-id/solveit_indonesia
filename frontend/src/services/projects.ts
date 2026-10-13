import { content } from "~/data/locales";
import { type ProjectKey, projects } from "~/data/projects";
import type { Locale } from "~/i18n/config";
import { resolvePath } from "~/i18n/paths";
import type { Project, ProjectBase, ProjectCategory } from "~/types/content";

/**
 * Portfolio data access. Reads the typed local dataset today; when the Laravel
 * API exists, swap these bodies for API calls (see docs/integration-plan.md)
 * and move callers to route `clientLoader`s. Signatures stay stable.
 */
const localize = (base: ProjectBase, locale: Locale): Project => ({
  ...base,
  ...content[locale].projects[base.key as ProjectKey],
  slug: base.slugs[locale],
});

export const getProjects = (locale: Locale, category?: ProjectCategory): Project[] =>
  projects
    .filter((project) => !category || project.category === category)
    .map((project) => localize(project, locale));

export const getProjectBySlug = (locale: Locale, slug: string | undefined): Project | undefined => {
  const base = projects.find((project) => project.slugs[locale] === slug);
  return base ? localize(base, locale) : undefined;
};

/** The case study a pathname points to, in that URL's language. */
export const getProjectByPath = (pathname: string): Project | undefined => {
  const resolved = resolvePath(pathname);
  if (resolved?.kind !== "project") return undefined;
  const base = projects.find((project) => project.key === resolved.key);
  return base ? localize(base, resolved.locale) : undefined;
};

export const getAdjacentProjects = (
  locale: Locale,
  key: string,
): { previous: Project; next: Project } | null => {
  const index = projects.findIndex((project) => project.key === key);
  if (index === -1 || projects.length < 2) return null;
  const previous = projects[(index - 1 + projects.length) % projects.length]!;
  const next = projects[(index + 1) % projects.length]!;
  return { previous: localize(previous, locale), next: localize(next, locale) };
};
