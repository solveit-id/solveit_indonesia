import { describe, expect, it } from "vitest";
import { technologyIcons } from "~/components/portfolio/technology-icons";
import { messages } from "~/i18n";
import { projects } from "./projects";
import { technologyInfo, technologyRoles } from "./technologies";

describe("technology presentation", () => {
  it("describes every technology a case study lists", () => {
    const listed = new Set(projects.flatMap((project) => project.technologies));
    for (const name of listed) expect(technologyInfo, name).toHaveProperty([name]);
  });

  it("uses only brand marks that are bundled, and a neutral glyph for generic names", () => {
    for (const [name, info] of Object.entries(technologyInfo)) {
      if (info.icon) expect(technologyIcons, name).toHaveProperty([info.icon]);
      expect(technologyRoles).toContain(info.role);
    }
    // An architecture style is not a product: it has no brand mark.
    expect(technologyInfo["REST API"]?.icon).toBeUndefined();
  });

  it("frames a demo stack as a proposal in both languages", () => {
    expect(messages.id.project.technologyProposedTitle).toMatch(/diusulkan/i);
    expect(messages.en.project.technologyProposedTitle).toMatch(/proposed/i);
    expect(messages.id.project.technologyProposedNote).toMatch(/bukan/);
    expect(messages.en.project.technologyProposedNote).toMatch(/not/);
  });
});
