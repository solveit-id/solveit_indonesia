export type ServiceId =
  "website" | "aplikasi-web" | "sistem-informasi" | "custom-software" | "dukungan-teknis";

/** Services that can be the subject of a portfolio project. */
export type ProjectCategory = Exclude<ServiceId, "dukungan-teknis">;

/** Localized copy for one service. */
export interface ServiceCopy {
  name: string;
  /** Short name for chips and compact navigation. */
  shortName: string;
  /** One answer-first sentence: what this service is. */
  summary: string;
  /** Who typically needs it. */
  forWhom: string;
  examples: string[];
  deliverables: string[];
}

export interface Service extends ServiceCopy {
  /** Stable id: query strings, anchors, and inquiry payloads use it in both languages. */
  id: ServiceId;
}

export type ProcessStepId =
  "konsultasi" | "analisis" | "desain" | "pengembangan" | "pengujian" | "implementasi" | "dukungan";

export interface ProcessStepCopy {
  name: string;
  description: string;
  /** What the client holds at the end of this step. */
  output: string;
  /** What we need from the client during this step. */
  clientRole: string;
}

export interface ProcessStep extends ProcessStepCopy {
  id: ProcessStepId;
}

export type CoverPattern = "lattice" | "stack" | "stair" | "orbit" | "weave";
export type CoverTone = "cobalt" | "deep" | "sky" | "ink" | "porcelain";

export interface ProjectCover {
  pattern: CoverPattern;
  tone: CoverTone;
  /** Deterministic seed for the generative capsule layout. */
  seed: number;
}

export type PreviewDevice = "desktop" | "tablet" | "mobile";

/** One real screenshot per device class (static files under public/). */
export interface PreviewShot {
  src: string;
  width: number;
  height: number;
}

/**
 * What the case study's responsive preview shows. `concept` renders an
 * illustrative wireframe from the case study's own narrative and must be
 * labelled as such; `screenshots` is for real, published application
 * screens only, never mockups presented as real.
 */
export type ProjectPreview =
  { kind: "concept" } | { kind: "screenshots"; shots: Record<PreviewDevice, PreviewShot> };

/** Language-independent facts about a case study. */
export interface ProjectBase {
  /** Stable key (the original Indonesian slug). */
  key: string;
  /** URL slug per language. */
  slugs: { id: string; en: string };
  category: ProjectCategory;
  /**
   * Demonstration concepts are illustrative only. They are labelled in the UI,
   * excluded from structured data, and must be replaced by real, approved work.
   */
  isDemo: boolean;
  year?: number;
  technologies: readonly string[];
  cover: ProjectCover;
  preview: ProjectPreview;
}

/** Localized narrative for a case study. */
export interface ProjectCopy {
  title: string;
  /** Sector the concept is written for, never a client name. */
  sector: string;
  summary: string;
  context: string;
  problem: string;
  solution: string;
  /** Primary user flow, in order. */
  flow: string[];
  /**
   * Concept system map: the parts of the solution, in order, and what passes
   * between neighbours (`handoffs.length === actors.length - 1`).
   */
  system: { actors: string[]; handoffs: string[] };
  features: { name: string; description: string }[];
  /**
   * Real, verified outcomes only. Demo projects describe what would be measured
   * instead and must leave `results` empty.
   */
  results: string[];
  metricsToTrack: string[];
}

/** A case study as a page renders it: base facts plus copy in one language. */
export interface Project extends ProjectBase, ProjectCopy {
  /** Slug in the language being rendered. */
  slug: string;
}

/**
 * Development status of an ecosystem part. There is deliberately no
 * "available" state: the roadmap shows plans, never shipped products.
 */
export type EcosystemStatus = "current" | "design" | "planned";

export interface EcosystemPart {
  key: string;
  /** Proposed working name, except the company website. */
  name: string;
  /** Foundation (this website), the internal hub, or a client-facing module. */
  tier: "foundation" | "hub" | "module";
  status: EcosystemStatus;
  role: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}
