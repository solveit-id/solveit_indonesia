import { expect, test } from "@playwright/test";

const isDesktop = (width: number) => width >= 1024;

test.describe("shell", () => {
  test("opens on the foundation overview, with the right frame for the width", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Fondasi konsol admin" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Fondasi konsol admin · Solveit Indonesia");

    const width = page.viewportSize()!.width;
    const rail = page.locator("aside.rail-scope");
    const bar = page.locator("header.rail-scope");

    if (isDesktop(width)) {
      await expect(rail).toBeVisible();
      await expect(bar).toBeHidden();
    } else {
      await expect(rail).toBeHidden();
      await expect(bar).toBeVisible();
    }

    // Exactly one navigation landmark is exposed at any width.
    await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toHaveCount(
      isDesktop(width) ? 1 : 0,
    );
  });

  test("never scrolls sideways", async ({ page }) => {
    for (const path of ["/", "/referensi-komponen", "/tidak-ada"]) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("the phone menu discloses navigation and closes on Escape", async ({ page }) => {
    test.skip(isDesktop(page.viewportSize()!.width), "the rail is always visible from 1024px");
    await page.goto("/");

    const toggle = page.getByRole("button", { name: "Menu" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });

  test("navigates between screens and lands focus on the content", async ({ page }) => {
    await page.goto("/");
    if (!isDesktop(page.viewportSize()!.width)) {
      await page.getByRole("button", { name: "Menu" }).click();
    }

    await page.getByRole("link", { name: "Referensi komponen" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Referensi komponen" })).toBeVisible();
    await expect(page.locator("#main")).toBeFocused();
  });

  test("unknown addresses, including sign-in, are the honest 404", async ({ page }) => {
    for (const path of ["/masuk", "/login", "/users"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: "Halaman tidak ditemukan" }),
      ).toBeVisible();
    }
  });

  test("the brand renders from the original paths and the self-hosted face", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const fontReady = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('720 16px "Archivo Variable"');
    });
    expect(fontReady).toBe(true);

    const logo = page
      .locator(isDesktop(page.viewportSize()!.width) ? "aside svg" : "header svg")
      .first();
    await expect(logo).toBeVisible();
    // Primary lockup: 4 capsules, wordmark, descriptor. Mark alone: 4 capsules.
    expect(await logo.locator("path").count()).toBeGreaterThanOrEqual(4);
  });
});

test.describe("preferences", () => {
  test("dark survives a reload without flashing light, and only preferences are stored", async ({
    page,
  }) => {
    await page.goto("/");
    if (!isDesktop(page.viewportSize()!.width)) {
      await page.getByRole("button", { name: "Menu" }).click();
    }
    await page.getByRole("radio", { name: "Gelap" }).check({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // theme-init.js runs before the app: the attribute is already set at DOMContentLoaded.
    const atLoad = page
      .waitForEvent("domcontentloaded")
      .then(() => page.evaluate(() => document.documentElement.dataset.theme ?? "light"));
    await page.reload();
    expect(await atLoad).toBe("dark");

    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe("rgb(5, 15, 34)");

    const stored = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));
    expect(stored.local).toEqual(["solveit-admin-theme"]);
    expect(stored.session).toEqual([]);
  });

  test("reduced motion stops the decorative motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/referensi-komponen");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const durations = await page.evaluate(() => {
      const skeleton = document.querySelector(".skeleton")!;
      const button = document.querySelector(".btn")!;
      return [
        getComputedStyle(skeleton).animationDuration,
        getComputedStyle(button).transitionDuration,
      ];
    });
    for (const value of durations) {
      expect(Number.parseFloat(value)).toBeLessThan(0.01);
    }
  });
});
