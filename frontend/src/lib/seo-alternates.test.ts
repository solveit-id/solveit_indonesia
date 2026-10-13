import { describe, expect, it, vi } from "vitest";

// With a domain configured, every indexable page gets a self canonical and
// reciprocal hreflang links (plus x-default to the Indonesian original).
vi.mock("~/config/site", () => {
  const siteUrl = "https://example.test";
  return {
    siteConfig: {
      siteUrl,
      apiBaseUrl: null,
      googleSiteVerification: null,
      defaultOgImage: "/og/solveit-og.png",
    },
    absoluteUrl: (path: string) => `${siteUrl}${path}`,
  };
});

const { buildMeta } = await import("./seo");

const links = (path: string, locale: "id" | "en") =>
  buildMeta({ locale, title: "x", description: "y", path }).filter(
    (item): item is { tagName: "link"; rel: string; href: string; hrefLang?: string } =>
      "tagName" in item && item.tagName === "link",
  );

describe("hreflang and canonical", () => {
  it("pairs a case study across languages, slug to slug", () => {
    const id = links("/portofolio/sistem-antrean-klinik", "id");
    const en = links("/en/portfolio/clinic-queue-records-system", "en");
    expect(id.find((link) => link.rel === "canonical")?.href).toBe(
      "https://example.test/portofolio/sistem-antrean-klinik",
    );
    expect(en.find((link) => link.rel === "canonical")?.href).toBe(
      "https://example.test/en/portfolio/clinic-queue-records-system",
    );
    const alternates = (list: typeof id) =>
      Object.fromEntries(
        list.filter((link) => link.rel === "alternate").map((link) => [link.hrefLang, link.href]),
      );
    const expected = {
      id: "https://example.test/portofolio/sistem-antrean-klinik",
      en: "https://example.test/en/portfolio/clinic-queue-records-system",
      "x-default": "https://example.test/portofolio/sistem-antrean-klinik",
    };
    expect(alternates(id)).toEqual(expected);
    expect(alternates(en)).toEqual(expected);
  });

  it("maps the home pages to each other", () => {
    const en = links("/en", "en");
    expect(en.find((link) => link.hrefLang === "id")?.href).toBe("https://example.test/");
    expect(en.find((link) => link.hrefLang === "en")?.href).toBe("https://example.test/en");
  });

  it("gives noindex pages neither canonical nor hreflang", () => {
    const meta = buildMeta({
      locale: "en",
      title: "x",
      description: "y",
      path: "/en/404",
      noindex: true,
    });
    expect(meta.some((item) => "tagName" in item)).toBe(false);
  });
});
