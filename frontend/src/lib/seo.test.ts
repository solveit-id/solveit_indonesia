import { describe, expect, it } from "vitest";
import { projects } from "~/data/projects";
import { buildMeta, creativeWorkSchema, formatTitle, organizationSchema } from "./seo";

describe("seo helpers", () => {
  it("appends the brand to page titles", () => {
    expect(formatTitle({ title: "Layanan" })).toBe("Layanan | Solveit Indonesia");
    expect(formatTitle({ title: "Beranda penuh", absoluteTitle: true })).toBe("Beranda penuh");
  });

  it("omits canonical and absolute URLs while no domain is configured", () => {
    const meta = buildMeta({ title: "Tes", description: "Deskripsi", path: "/tes" });
    expect(meta).toContainEqual({ name: "description", content: "Deskripsi" });
    expect(meta.some((item) => "rel" in item && item.rel === "canonical")).toBe(false);
    expect(meta.some((item) => "property" in item && item.property === "og:image")).toBe(false);
  });

  it("marks noindex pages", () => {
    const meta = buildMeta({ title: "404", description: "x", path: "/404", noindex: true });
    expect(meta).toContainEqual({ name: "robots", content: "noindex, follow" });
  });

  it("publishes confirmed contact points only", () => {
    const org = organizationSchema();
    expect(org.email).toBe("solveit.team.id@gmail.com");
    expect(org).not.toHaveProperty("address");
    expect(org).not.toHaveProperty("url");
  });

  it("never emits CreativeWork for demonstration projects", () => {
    for (const project of projects.filter((item) => item.isDemo)) {
      expect(creativeWorkSchema(project)).toBeNull();
    }
    const real = { ...projects[0]!, isDemo: false, year: 2026 };
    expect(creativeWorkSchema(real)).toMatchObject({ "@type": "CreativeWork", name: real.title });
  });
});
