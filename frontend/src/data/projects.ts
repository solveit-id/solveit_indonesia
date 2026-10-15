import type { ProjectBase, ProjectCategory } from "~/types/content";

/**
 * DEMONSTRATION CONTENT.
 * Solveit Indonesia has no published client work yet. Every entry below is an
 * illustrative concept (`isDemo: true`): no client, result, or statistic is
 * claimed. Replace or extend with real, approved case studies; the UI and
 * structured data switch automatically when `isDemo` is false. Concepts have
 * no real screens, so their responsive preview is an illustration
 * (`preview.kind: "concept"`); use "screenshots" only for published work. Narrative copy
 * per language lives in `src/data/locales/<locale>/projects.ts`, keyed by `key`.
 */
export const projects = [
  {
    key: "sistem-antrean-klinik",
    slugs: { id: "sistem-antrean-klinik", en: "clinic-queue-records-system" },
    category: "sistem-informasi",
    isDemo: true,
    technologies: ["React", "TypeScript", "Laravel", "REST API", "MySQL"],
    cover: { pattern: "stack", tone: "cobalt", seed: 11 },
    preview: { kind: "concept" },
  },
  {
    key: "pemesanan-katering-harian",
    slugs: { id: "pemesanan-katering-harian", en: "daily-catering-ordering" },
    category: "aplikasi-web",
    isDemo: true,
    technologies: ["React", "TypeScript", "Laravel", "REST API"],
    cover: { pattern: "orbit", tone: "sky", seed: 23 },
    preview: { kind: "concept" },
  },
  {
    key: "inventori-gudang-distribusi",
    slugs: { id: "inventori-gudang-distribusi", en: "distribution-warehouse-inventory" },
    category: "custom-software",
    isDemo: true,
    technologies: ["React", "TypeScript", "Laravel", "REST API", "PostgreSQL"],
    cover: { pattern: "lattice", tone: "deep", seed: 37 },
    preview: { kind: "concept" },
  },
  {
    key: "portal-akademik-sekolah",
    slugs: { id: "portal-akademik-sekolah", en: "school-academic-portal" },
    category: "sistem-informasi",
    isDemo: true,
    technologies: ["React", "TypeScript", "Laravel", "REST API", "MySQL"],
    cover: { pattern: "stair", tone: "ink", seed: 41 },
    preview: { kind: "concept" },
  },
  {
    key: "profil-perusahaan-manufaktur",
    slugs: { id: "profil-perusahaan-manufaktur", en: "manufacturer-company-website" },
    category: "website",
    isDemo: true,
    technologies: ["React", "TypeScript", "Laravel"],
    cover: { pattern: "weave", tone: "porcelain", seed: 53 },
    preview: { kind: "concept" },
  },
] as const satisfies readonly ProjectBase[];

export type ProjectKey = (typeof projects)[number]["key"];

export const projectCategories: ProjectCategory[] = [
  "website",
  "aplikasi-web",
  "sistem-informasi",
  "custom-software",
];
