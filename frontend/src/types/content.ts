export type ServiceId =
  "website" | "aplikasi-web" | "sistem-informasi" | "custom-software" | "dukungan-teknis";

/** Services that can be the subject of a portfolio project. */
export type ProjectCategory = Exclude<ServiceId, "dukungan-teknis">;

export interface Service {
  id: ServiceId;
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

export interface ProcessStep {
  id: string;
  name: string;
  description: string;
  /** What the client holds at the end of this step. */
  output: string;
  /** What we need from the client during this step. */
  clientRole: string;
}

export type CoverPattern = "lattice" | "stack" | "stair" | "orbit" | "weave";
export type CoverTone = "cobalt" | "deep" | "sky" | "ink" | "porcelain";

export interface ProjectCover {
  pattern: CoverPattern;
  tone: CoverTone;
  /** Deterministic seed for the generative capsule layout. */
  seed: number;
}

export interface Project {
  slug: string;
  title: string;
  category: ProjectCategory;
  /**
   * Demonstration concepts are illustrative only. They are labelled in the UI,
   * excluded from structured data, and must be replaced by real, approved work.
   */
  isDemo: boolean;
  /** Sector the concept is written for, never a client name. */
  sector: string;
  year?: number;
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
  technologies: string[];
  /**
   * Real, verified outcomes only. Demo projects describe what would be measured
   * instead and must leave `results` empty.
   */
  results: string[];
  metricsToTrack: string[];
  cover: ProjectCover;
}

export interface FaqItem {
  question: string;
  answer: string;
}
