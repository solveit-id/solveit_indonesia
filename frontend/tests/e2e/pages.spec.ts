import { expect, test } from "@playwright/test";
import { SITE_URL } from "../../playwright.config";
import { pages } from "./routes";

test.describe("every public page", () => {
  for (const { path, h1 } of pages) {
    test(`${path} renders with unique metadata and no console errors`, async ({ page }) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(message.text());
      });
      page.on("pageerror", (error) => problems.push(error.message));

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(h1);
      await expect(page).toHaveTitle(/Solveit Indonesia/);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{50,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `${SITE_URL}${path}`,
      );
      await expect(page.locator("html")).toHaveAttribute("lang", "id");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0);
      expect(problems).toEqual([]);
    });
  }

  test("titles are unique across pages", async ({ page }) => {
    const titles = new Set<string>();
    for (const { path } of pages) {
      await page.goto(path);
      titles.add(await page.title());
    }
    expect(titles.size).toBe(pages.length);
  });

  test("prerendered HTML carries content and metadata without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    for (const { path, h1 } of pages) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveText(h1);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    }
    await context.close();
  });
});

test("unknown URLs return a real 404 page that is not indexed", async ({ page }) => {
  const response = await page.goto("/halaman-yang-tidak-ada");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Halaman ini tidak ditemukan.");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page
    .getByRole("navigation", { name: "Halaman utama" })
    .getByRole("link", { name: "Portofolio" })
    .click();
  await expect(page).toHaveURL(/\/portofolio$/);
});

test("every internal link resolves", async ({ page, request }) => {
  const hrefs = new Set<string>();
  for (const { path } of pages) {
    await page.goto(path);
    const found = await page
      .locator('a[href^="/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    for (const href of found) hrefs.add(href.split("#")[0]!.split("?")[0]!);
  }
  for (const href of hrefs) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
});
