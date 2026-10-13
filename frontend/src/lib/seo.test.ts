import { describe, expect, it } from "vitest";
import { getProjects } from "~/services/projects";
import { buildMeta, creativeWorkSchema, formatTitle, organizationSchema } from "./seo";

describe("seo helpers", () => {
  it("appends the brand to page titles", () => {
    expect(formatTitle({ title: "Layanan" })).toBe("Layanan | Solveit Indonesia");
    expect(formatTitle({ title: "Beranda penuh", absoluteTitle: true })).toBe("Beranda penuh");
  });

  it("omits canonical, hreflang, and absolute URLs while no domain is configured", () => {
    const meta = buildMeta({
      locale: "id",
      title: "Tes",
      description: "Deskripsi",
      path: "/tentang",
    });
    expect(meta).toContainEqual({ name: "description", content: "Deskripsi" });
    expect(meta.some((item) => "rel" in item)).toBe(false);
    expect(meta.some((item) => "property" in item && item.property === "og:image")).toBe(false);
  });

  it("declares the page language for Open Graph", () => {
    const en = buildMeta({ locale: "en", title: "About", description: "x", path: "/en/about" });
    expect(en).toContainEqual({ property: "og:locale", content: "en_US" });
    expect(en).toContainEqual({ property: "og:locale:alternate", content: "id_ID" });
  });

  it("marks noindex pages", () => {
    const meta = buildMeta({
      locale: "id",
      title: "404",
      description: "x",
      path: "/404",
      noindex: true,
    });
    expect(meta).toContainEqual({ name: "robots", content: "noindex, follow" });
  });

  it("publishes confirmed contact points and the official Instagram only", () => {
    const org = organizationSchema("en");
    expect(org.email).toBe("solveit.team.id@gmail.com");
    expect(org.sameAs).toEqual(["https://www.instagram.com/solveit.id/"]);
    expect(org).not.toHaveProperty("address");
    expect(org).not.toHaveProperty("url");
    expect(String(org.description)).toMatch(/^Solveit Indonesia is/);
  });

  it("never emits CreativeWork for demonstration projects", () => {
    for (const project of getProjects("id").filter((item) => item.isDemo)) {
      expect(creativeWorkSchema(project)).toBeNull();
    }
    const real = { ...getProjects("en")[0]!, isDemo: false, year: 2026 };
    expect(creativeWorkSchema(real, "en")).toMatchObject({
      "@type": "CreativeWork",
      name: real.title,
      inLanguage: "en",
    });
  });
});
