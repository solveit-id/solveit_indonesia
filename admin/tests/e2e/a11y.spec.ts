import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const theme of ["light", "dark"] as const) {
  for (const path of ["/", "/referensi-komponen", "/tidak-ada"]) {
    test(`${path} has no axe violations in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((chosen) => {
        if (chosen === "dark") localStorage.setItem("solveit-admin-theme", "dark");
      }, theme);
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);

      const results = await new AxeBuilder({ page }).withTags(tags).analyze();

      expect(
        results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
      ).toEqual([]);
    });
  }
}

test("the open phone menu has no axe violations", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, "phone and tablet only");
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();

  const results = await new AxeBuilder({ page }).withTags(tags).analyze();

  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("keyboard: skip link first, then a visible focus ring", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { level: 1 }).waitFor();

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Langsung ke konten" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe("none");
});
