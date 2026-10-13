import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";

/**
 * Pages are complete static HTML and React hydrates after first paint. Tests
 * that interact (filters, menus, forms) must act on the hydrated app, so
 * `goto` and `reload` resolve once <html data-hydrated> is set. Contexts
 * created by hand (e.g. JavaScript disabled) are not affected, and
 * `waitUntil: "commit"` opts out for tests about the pre-hydration page.
 *
 * The branded load overlay (src/lib/boot.ts) plays on every document load.
 * It never blocks input, but it would cover screenshots and add ~1.7 s per
 * page, so the suite opts out through the documented hook; the loader's own
 * tests set `bootLoader: true` to see the real sequence.
 */
export const test = base.extend<{ bootLoader: boolean }>({
  bootLoader: [false, { option: true }],
  page: async ({ page, bootLoader }, provide) => {
    if (!bootLoader)
      await page.addInitScript(() => {
        (window as Window & { __solveitBoot?: string }).__solveitBoot = "off";
      });
    const ready = () =>
      page.locator("html[data-hydrated]").waitFor({ state: "attached", timeout: 20_000 });
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    page.goto = async (...args) => {
      const response = await goto(...args);
      if (args[1]?.waitUntil !== "commit" && page.url().startsWith("http")) await ready();
      return response;
    };
    page.reload = async (...args) => {
      const response = await reload(...args);
      await ready();
      return response;
    };
    await provide(page);
  },
});
