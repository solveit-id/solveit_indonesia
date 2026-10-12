// Relative import: this module is also loaded by react-router.config.ts.
import { projects } from "../data/projects";
import type { Project, ProjectCategory } from "~/types/content";

/**
 * Portfolio data access. Reads the typed local dataset today; when the Laravel
 * API exists, swap these bodies for API calls (see docs/integration-plan.md)
 * and move callers to route `clientLoader`s. Signatures stay stable.
 */
export const getProjects = (category?: ProjectCategory): Project[] =>
  category ? projects.filter((project) => project.category === category) : projects;

export const getProjectBySlug = (slug: string | undefined): Project | undefined =>
  projects.find((project) => project.slug === slug);

export const getAdjacentProjects = (slug: string): { previous: Project; next: Project } | null => {
  const index = projects.findIndex((project) => project.slug === slug);
  if (index === -1 || projects.length < 2) return null;
  const previous = projects[(index - 1 + projects.length) % projects.length]!;
  const next = projects[(index + 1) % projects.length]!;
  return { previous, next };
};

export const getProjectSlugs = (): string[] => projects.map((project) => project.slug);
