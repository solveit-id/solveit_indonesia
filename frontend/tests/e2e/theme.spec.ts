import { expect, test } from "./fixtures";

const LIGHT = "rgb(241, 244, 249)";
const DARK = "rgb(5, 15, 34)";

test.describe("theme", () => {
  // Visitors whose OS is dark still get the light theme by default.
  test.use({ colorScheme: "dark" });

  test("light is the default, even with a dark OS preference", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(LIGHT);
    await expect(page.getByRole("button", { name: "Tema gelap" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("the switch applies dark, persists it, and restores it before first paint", async ({
    page,
  }) => {
    const problems: string[] = [];
    page.on("console", (message) => message.type() === "error" && problems.push(message.text()));
    page.on("pageerror", (error) => problems.push(error.message));
    // Record the theme the moment the HTML is parsed, long before hydration.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { __early: string }).__early =
          document.documentElement.dataset.theme ?? "light";
      });
    });

    await page.goto("/portofolio");
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    const toggle = page.getByRole("button", { name: "Tema gelap" });
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe(DARK);

    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { __early: string }).__early)).toBe(
      "dark",
    );
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await expect(page.getByRole("button", { name: "Tema gelap" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Navigation keeps the theme; switching back to light persists too.
    await page.goto("/en/contact");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await page.getByRole("button", { name: "Dark theme" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { __early: string }).__early)).toBe(
      "light",
    );
    expect(problems).toEqual([]);
  });
});
