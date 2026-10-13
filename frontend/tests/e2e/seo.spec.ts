import { expect, type Page, test } from "./fixtures";
import { SITE_URL } from "../../playwright.config";
import { pages } from "./routes";

const jsonLd = async (page: Page) =>
  (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
    (block) => JSON.parse(block) as Record<string, unknown>,
  );

test.describe("structured data and crawl files", () => {
  test.skip(({ isMobile }) => isMobile, "Viewport independent; run on larger viewports only.");

  test("every page ships parseable JSON-LD and Open Graph tags", async ({ page }) => {
    // Visits every page; WebKit under parallel load needs more than the default budget.
    test.setTimeout(90_000);
    for (const { path } of pages) {
      await page.goto(path);
      const blocks = await jsonLd(page);
      expect(blocks.length, path).toBeGreaterThan(0);
      for (const block of blocks) expect(block["@context"]).toBe("https://schema.org");
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        `${SITE_URL}/og/solveit-og.png`,
      );
    }
  });

  test("home declares Organization and WebSite with confirmed contacts only", async ({ page }) => {
    await page.goto("/");
    const blocks = await jsonLd(page);
    const org = blocks.find((item) => item["@type"] === "Organization");
    expect(org?.email).toBe("solveit.team.id@gmail.com");
    expect(org).not.toHaveProperty("address");
    expect(blocks.some((item) => item["@type"] === "WebSite")).toBe(true);
  });

  test("demonstration case studies publish no CreativeWork", async ({ page }) => {
    await page.goto("/portofolio/sistem-antrean-klinik");
    const types = (await jsonLd(page)).map((item) => item["@type"]);
    expect(types).not.toContain("CreativeWork");
    expect(types).toContain("BreadcrumbList");
  });

  test("sitemap and robots describe the indexable pages", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const { path } of pages) expect(sitemap).toContain(`<loc>${SITE_URL}${path}</loc>`);
    expect(sitemap).not.toContain("404");
  });
});
