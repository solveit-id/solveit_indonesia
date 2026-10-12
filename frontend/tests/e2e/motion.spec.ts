import { expect, test } from "@playwright/test";

const translateX = (el: Element) => new DOMMatrix(getComputedStyle(el).transform).m41;

test.describe("motion", () => {
  test.skip(({ isMobile }) => isMobile, "Pinned and pointer motion is desktop-only by design.");

  test("hero assembles into the exact logo and the work row pans with scroll", async ({
    page,
    viewport,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");

    // After the entrance, every hero capsule rests at its original position.
    await page.waitForTimeout(2600);
    const offsets = await page
      .locator('section[aria-labelledby="hero-title"] [data-capsule]')
      .evaluateAll((nodes) =>
        nodes.map((node) => new DOMMatrix(getComputedStyle(node).transform).m41),
      );
    expect(offsets).toHaveLength(4);
    for (const offset of offsets) expect(Math.abs(offset)).toBeLessThan(1);

    if ((viewport?.width ?? 0) >= 1024) {
      const section = page.locator('section[aria-labelledby="work-title"]');
      await expect(section).toHaveAttribute("data-pan", "true");
      const track = section.getByRole("region", { name: "Studi kasus konsep" });
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const before = await track.evaluate(translateX);
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(1500);
      const after = await track.evaluate(translateX);
      expect(after).toBeLessThan(before - 100);
    }
    expect(errors).toEqual([]);
  });

  test("animations are cleaned up when leaving a page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);
    await page.locator("#main").getByRole("link", { name: "Lihat portofolio" }).first().click();
    await expect(page).toHaveURL(/\/portofolio$/);
    // Unmounting a pinned section must not break React's DOM removal.
    await expect(page.locator("h1")).toHaveText("Portofolio dan studi kasus.");
    await expect(page.locator(".pin-spacer")).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page.waitForTimeout(500);
    // At most one pinned section after returning: no duplicated ScrollTriggers.
    expect(await page.locator(".pin-spacer").count()).toBeLessThanOrEqual(1);
  });

  test("reduced motion shows everything without animation", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator('section[aria-labelledby="work-title"]')).toHaveAttribute(
      "data-pan",
      "false",
    );
    const word = page.locator("[data-word]").first();
    expect(await word.evaluate((el) => el.style.color)).toBe("");
    await context.close();
  });
});
