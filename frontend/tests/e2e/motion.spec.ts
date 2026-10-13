import { expect, test } from "./fixtures";

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

  test("portfolio covers and the hero layers move with scroll, and survive navigation", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const translateY = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);

    await page.goto("/portofolio");
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    const cover = "[data-parallax]";
    await page.locator(cover).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const before = await translateY(cover);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(700);
    expect(Math.abs((await translateY(cover)) - before)).toBeGreaterThan(2);

    // Leave and come back: the effect is rebuilt once, not doubled or lost.
    await page.goto("/");
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    const stage = "[data-hero-stage]";
    const stageBefore = await translateY(stage);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(700);
    expect(await translateY(stage)).toBeGreaterThan(stageBefore + 5);
    await page.goBack();
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(700);
    expect(errors).toEqual([]);
  });

  test("the about mark reassembles exactly when its section is centred", async ({ page }) => {
    await page.goto("/en/about");
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await page.locator("[data-philosophy]").evaluate((el) => {
      const rect = el.getBoundingClientRect();
      window.scrollBy(0, rect.top + rect.height / 2 - window.innerHeight / 2);
    });
    await page.waitForTimeout(1500);
    const offsets = await page
      .locator("[data-philosophy-mark] [data-capsule]")
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const matrix = new DOMMatrix(getComputedStyle(node).transform);
          return Math.hypot(matrix.m41, matrix.m42);
        }),
      );
    expect(offsets).toHaveLength(4);
    for (const offset of offsets) expect(offset).toBeLessThan(4);
  });
});
