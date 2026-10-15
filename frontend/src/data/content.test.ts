import { describe, expect, it } from "vitest";
import { messages } from "~/i18n";
import { locales } from "~/i18n/config";
import { getProcessSteps, getServices } from "~/services/content";
import { getProjects } from "~/services/projects";
import { company } from "./company";
import { ecosystemParts } from "./ecosystem";
import { assistant as enAssistant } from "./locales/en/assistant";
import { assistant as idAssistant } from "./locales/id/assistant";
import { testimonialPlaceholders } from "./testimonials";
import { content } from "./locales";
import { processStepIds } from "./process";
import { projectCategories, projects } from "./projects";
import { serviceIds } from "./services";

const visibleStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [];
  if (Array.isArray(value)) return value.flatMap(visibleStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(visibleStrings);
  return [];
};

const keysOf = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, child]) => keysOf(child, `${prefix}${key}.`))
    : [prefix.slice(0, -1)];

describe("content integrity", () => {
  it("uses unique, URL-safe project slugs in every language", () => {
    for (const locale of locales) {
      const slugs = projects.map((project) => project.slugs[locale]);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("never claims results for demonstration projects, in any language", () => {
    for (const locale of locales) {
      for (const project of getProjects(locale).filter((item) => item.isDemo)) {
        expect(project.results).toEqual([]);
        expect(project.year).toBeUndefined();
      }
    }
  });

  it("gives every system map one handoff between each pair of actors", () => {
    for (const locale of locales)
      for (const project of getProjects(locale))
        expect(project.system.handoffs).toHaveLength(project.system.actors.length - 1);
  });

  it("keeps translated lists the same length as the original", () => {
    for (const project of projects) {
      const [id, en] = locales.map((locale) => content[locale].projects[project.key]);
      expect(en!.flow).toHaveLength(id!.flow.length);
      expect(en!.features).toHaveLength(id!.features.length);
      expect(en!.system.actors).toHaveLength(id!.system.actors.length);
      expect(en!.metricsToTrack).toHaveLength(id!.metricsToTrack.length);
    }
    for (const id of serviceIds) {
      expect(content.en.services[id].deliverables).toHaveLength(
        content.id.services[id].deliverables.length,
      );
    }
  });

  it("assigns every project to a known category", () => {
    for (const project of projects) expect(projectCategories).toContain(project.category);
  });

  it("keeps service ids unique and the process complete in both languages", () => {
    expect(new Set(serviceIds).size).toBe(serviceIds.length);
    for (const locale of locales) {
      expect(getServices(locale).map((service) => service.id)).toEqual(serviceIds);
      expect(getProcessSteps(locale).map((step) => step.id)).toEqual(processStepIds);
    }
  });

  it("provides every interface string in every language", () => {
    const reference = keysOf(messages.id).sort();
    for (const locale of locales) expect(keysOf(messages[locale]).sort()).toEqual(reference);
  });

  it("stores WhatsApp numbers in E.164 form matching their display", () => {
    expect(company.whatsapp).toHaveLength(3);
    for (const number of company.whatsapp) {
      expect(number.e164).toMatch(/^62\d{9,12}$/);
      expect(number.display.replace(/\D/g, "")).toBe(number.e164);
    }
  });

  it("links the official Instagram account over HTTPS", () => {
    expect(company.instagram.url).toBe("https://www.instagram.com/solveit.id/");
  });

  it("presents the ecosystem honestly: one live part, nothing launched", () => {
    for (const locale of locales) {
      const parts = ecosystemParts(locale);
      expect(parts.filter((part) => part.status === "current").map((part) => part.key)).toEqual([
        "website",
      ]);
      expect(parts.find((part) => part.key === "opshub")?.name).toBe("Solveit OpsHub");
      for (const part of parts) {
        expect(["current", "design", "planned"]).toContain(part.status);
        expect(part.role.length).toBeGreaterThan(10);
        expect(part.role).not.toMatch(/[–—]/);
        if (part.tier !== "foundation") expect(part.name).toMatch(/^Solveit [A-Z][a-zA-Z]+$/);
      }
    }
    // Orbit is the ecosystem's name, never an application of its own.
    expect(ecosystemParts("id").some((part) => part.name.includes("Orbit"))).toBe(false);
  });

  it("contains no em or en dashes in visible copy", () => {
    const strings = visibleStrings([
      company,
      content,
      messages,
      idAssistant,
      enAssistant,
      testimonialPlaceholders,
    ]);
    expect(strings.length).toBeGreaterThan(300);
    for (const text of strings) expect(text).not.toMatch(/[–—]/);
  });
});
