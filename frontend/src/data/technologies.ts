import type { TechnologyIconName } from "~/components/portfolio/technology-icons";

/** The layer of a system a technology works in, in reading order. */
export type TechnologyRole = "interface" | "server" | "integration" | "data";

export const technologyRoles: TechnologyRole[] = ["interface", "server", "integration", "data"];

export interface TechnologyInfo {
  role: TechnologyRole;
  /**
   * Official brand mark, when one exists. Generic names (an architecture
   * style like REST API, not a product) get a neutral glyph instead.
   */
  icon?: TechnologyIconName;
}

/**
 * Every technology a case study may list (`technologies` in projects.ts).
 * A name missing here still renders, with the neutral glyph, in the
 * integration group; the content test keeps the two lists in step.
 */
export const technologyInfo: Record<string, TechnologyInfo> = {
  React: { role: "interface", icon: "React" },
  TypeScript: { role: "interface", icon: "TypeScript" },
  Laravel: { role: "server", icon: "Laravel" },
  "REST API": { role: "integration" },
  MySQL: { role: "data", icon: "MySQL" },
  PostgreSQL: { role: "data", icon: "PostgreSQL" },
};

export const describeTechnology = (name: string): TechnologyInfo =>
  technologyInfo[name] ?? { role: "integration" };
