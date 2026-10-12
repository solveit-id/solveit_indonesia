import { describe, expect, it } from "vitest";
import { company } from "./company";
import { processSteps } from "./process";
import { projectCategories, projects } from "./projects";
import { services } from "./services";

const visibleStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(visibleStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(visibleStrings);
  return [];
};

describe("content integrity", () => {
  it("uses unique project slugs in URL-safe form", () => {
    const slugs = projects.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("never claims results for demonstration projects", () => {
    for (const project of projects.filter((item) => item.isDemo)) {
      expect(project.results).toEqual([]);
      expect(project.year).toBeUndefined();
    }
  });

  it("gives every system map one handoff between each pair of actors", () => {
    for (const project of projects)
      expect(project.system.handoffs).toHaveLength(project.system.actors.length - 1);
  });

  it("assigns every project to a known category", () => {
    const ids = projectCategories.map((category) => category.id);
    for (const project of projects) expect(ids).toContain(project.category);
  });

  it("keeps service ids unique and the process complete", () => {
    expect(new Set(services.map((service) => service.id)).size).toBe(services.length);
    expect(processSteps.map((step) => step.id)).toEqual([
      "konsultasi",
      "analisis",
      "desain",
      "pengembangan",
      "pengujian",
      "implementasi",
      "dukungan",
    ]);
  });

  it("stores WhatsApp numbers in E.164 form matching their display", () => {
    for (const number of company.whatsapp) {
      expect(number.e164).toMatch(/^62\d{9,12}$/);
      expect(number.display.replace(/\D/g, "")).toBe(number.e164);
    }
  });

  it("contains no em or en dashes in visible copy", () => {
    const strings = visibleStrings([company, services, processSteps, projects]);
    for (const text of strings) expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
