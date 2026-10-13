import { expect, type Page, test } from "./fixtures";
import { pages } from "./routes";

const switchTo = async (
  page: Page,
  isMobile: boolean,
  language: "English" | "Bahasa Indonesia",
) => {
  if (isMobile) {
    await page.getByRole("button", { name: /^(Menu)$/ }).click();
    await page.locator("#mobile-menu").getByRole("link", { name: language }).click();
  } else {
    const label = language === "English" ? "Bahasa" : "Language";
    await page
      .getByRole("banner")
      .getByRole("navigation", { name: label })
      .getByRole("link", { name: language })
      .click();
  }
};

test.describe("language switching", () => {
  for (const { path, twin, lang, h1 } of pages.filter((item) => item.lang === "id")) {
    test(`${path} switches to its English twin and back`, async ({ page, isMobile }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(path);
      await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
      await switchTo(page, Boolean(isMobile), "English");
      await expect(page).toHaveURL(new RegExp(`${twin.replace(/\//g, "\\/")}$`));
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      const english = pages.find((item) => item.path === twin)!;
      await expect(page.locator("h1")).toHaveText(english.h1);

      await page.goBack();
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("h1")).toHaveText(h1);
      await page.goForward();
      await expect(page.locator("h1")).toHaveText(english.h1);

      await switchTo(page, Boolean(isMobile), "Bahasa Indonesia");
      await expect(page.locator("h1")).toHaveText(h1);
      expect(errors).toEqual([]);
    });
  }

  test("English pages link only to English pages", async ({ page }) => {
    await page.goto("/en");
    const hrefs = await page
      .locator('main a[href^="/"], header nav[aria-label="Main navigation"] a')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of hrefs) expect(href, href).toMatch(/^\/en(\/|$|\?|#)/);
  });
});

test.describe("language preference", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "Viewport independent.");

  test("a returning visitor who chose English lands on /en, crawlers never do", async ({
    page,
    browser,
  }) => {
    await page.goto("/");
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await switchTo(page, false, "English");
    await expect(page).toHaveURL(/\/en$/);
    // A new visit to the bare home page (no same-site referrer) follows the choice.
    await page.goto("about:blank");
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    // Deep links are never redirected.
    await page.goto("/kontak");
    await expect(page).toHaveURL(/\/kontak$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "id");

    // A visitor without stored preference (any crawler) gets the Indonesian page.
    const fresh = await browser.newContext();
    const other = await fresh.newPage();
    await other.goto("/");
    await expect(other).toHaveURL(/\/$/);
    await expect(other.locator("html")).toHaveAttribute("lang", "id");
    await fresh.close();
  });
});

test("phones can switch language from the header without opening the menu", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "The single-capsule toggle is the phone header control.");
  await page.goto("/layanan");
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await page.getByRole("banner").getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/services$/);
  await page.getByRole("banner").getByRole("link", { name: "Bahasa Indonesia" }).click();
  await expect(page).toHaveURL(/\/layanan$/);
});
