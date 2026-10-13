import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { pages } from "./routes";

test.use({ reducedMotion: "reduce" });
// axe on the longest pages takes a while in Firefox and WebKit.
test.describe.configure({ timeout: 90_000 });

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("solveit-theme", value), theme);
    });

    for (const { path } of pages) {
      test(`${path} has no WCAG 2.x A/AA violations`, async ({ page }) => {
        await page.goto(path);
        if (theme === "dark")
          await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        const summary = results.violations.map(
          (violation) =>
            `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
        );
        expect(summary).toEqual([]);
      });
    }
  });
}
