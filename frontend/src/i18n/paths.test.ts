import { describe, expect, it } from "vitest";
import { localeFromPath, pagePaths } from "./config";
import { alternatePath, localizedRoutes, resolvePath } from "./paths";

describe("localized routing", () => {
  it("reads the language from the URL", () => {
    expect(localeFromPath("/")).toBe("id");
    expect(localeFromPath("/kontak")).toBe("id");
    expect(localeFromPath("/en")).toBe("en");
    expect(localeFromPath("/en/")).toBe("en");
    expect(localeFromPath("/en/contact")).toBe("en");
    // A path that merely starts with "en" is not English.
    expect(localeFromPath("/enterprise")).toBe("id");
  });

  it("maps every page to its translation and back", () => {
    for (const paths of Object.values(pagePaths)) {
      expect(alternatePath(paths.id, "en")).toBe(paths.en);
      expect(alternatePath(paths.en, "id")).toBe(paths.id);
      expect(alternatePath(paths.id, "id")).toBe(paths.id);
    }
  });

  it("maps case studies slug to slug", () => {
    expect(alternatePath("/portofolio/portal-akademik-sekolah", "en")).toBe(
      "/en/portfolio/school-academic-portal",
    );
    expect(alternatePath("/en/portfolio/school-academic-portal/", "id")).toBe(
      "/portofolio/portal-akademik-sekolah",
    );
  });

  it("sends unknown URLs to the target language's home page", () => {
    expect(alternatePath("/tidak-ada", "en")).toBe("/en");
    expect(alternatePath("/en/missing", "id")).toBe("/");
    expect(resolvePath("/en/portofolio")).toBeNull();
  });

  it("lists every indexable URL once, in both languages", () => {
    const routes = localizedRoutes();
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes).toHaveLength(2 * (6 + 5));
    expect(routes).toContain("/en/portfolio/clinic-queue-records-system");
  });
});
