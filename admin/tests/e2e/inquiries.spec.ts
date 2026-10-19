import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { mockOwner, mockRevealedContact } from "./support/mock-api";

/**
 * B4b inquiry screens on the reference build with the production CSP and MOCKED data
 * (synthetic, tests/e2e/support/mock-api.ts): layout per width, accessibility in both themes,
 * the keyboard path, and the reveal's memory-only rule. The real flows against Laravel are
 * tests/integration/inquiries.spec.ts.
 */
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axe(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Let entrance motion settle: axe measures contrast with the current opacity.
  await page.waitForTimeout(700);
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();

  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`);
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function settled(page: Page) {
  await page
    .getByRole("status")
    .filter({ hasText: /Memuat/ })
    .first()
    .waitFor({ state: "detached" });
}

const screens = [
  { path: "/inquiry", heading: "Inquiry" },
  { path: "/inquiry/42", heading: "Pengirim Contoh dengan nama yang cukup panjang" },
  { path: "/inquiry/41", heading: "Pengirim Kedua" },
];

for (const theme of ["light", "dark"] as const) {
  for (const { path, heading } of screens) {
    test(`${path} in the ${theme} theme: no axe violation, no sideways scroll (mocked)`, async ({
      page,
    }) => {
      await page.addInitScript((chosen) => {
        if (chosen === "dark") localStorage.setItem("solveit-admin-theme", "dark");
      }, theme);
      await mockOwner(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await settled(page);

      expect(await axe(page)).toEqual([]);
      await noSidewaysScroll(page);
    });
  }
}

test("the inquiry list is a table from 768px and cards below", async ({ page }) => {
  await mockOwner(page);
  await page.goto("/inquiry");
  await expect(page.getByRole("link", { name: "Pengirim Kedua" })).toBeVisible();
  const wide = page.viewportSize()!.width >= 768;

  await expect(page.getByRole("table", { name: "Daftar inquiry" })).toHaveCount(wide ? 1 : 0);
  await expect(page.getByRole("list", { name: "Daftar inquiry" })).toHaveCount(wide ? 0 : 1);
});

test("the status dialog and the reveal dialog have no axe violations", async ({ page }) => {
  await mockOwner(page);
  await page.goto("/inquiry/42");
  await settled(page);

  await page.getByRole("button", { name: "Tandai ditinjau" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Buka kontak lengkap" }).click();
  await expect(page.getByRole("dialog").getByRole("checkbox")).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test("keyboard: from the list to an inquiry and into the reveal, Escape is the safe choice", async ({
  page,
}) => {
  await mockOwner(page);
  await page.goto("/inquiry");
  const link = page.getByRole("link", { name: "Pengirim Kedua" });
  await expect(link).toBeVisible();

  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Pengirim Kedua" })).toBeVisible();

  const reveal = page.getByRole("button", { name: "Buka kontak lengkap" });
  await reveal.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  // Focus starts on the safe choice; Escape chooses it and focus returns to the opener.
  await expect(dialog.getByRole("button", { name: "Batal" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(reveal).toBeFocused();
});

test("a revealed contact stays in memory: no storage, address, or history state holds it", async ({
  page,
}) => {
  const violations: string[] = [];
  await page.exposeFunction("__reportCsp", (entry: string) => violations.push(entry));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) =>
      (window as unknown as { __reportCsp: (entry: string) => void }).__reportCsp(
        `${event.violatedDirective} ${event.blockedURI}`,
      ),
    );
  });
  await mockOwner(page);
  await page.goto("/inquiry/42");
  await settled(page);

  await page.getByRole("button", { name: "Buka kontak lengkap" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Buka kontak lengkap" }).click();
  await expect(page.getByText(mockRevealedContact)).toBeVisible();
  expect(await axe(page)).toEqual([]);

  const surfaces = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
      cookie: document.cookie,
      href: location.href,
      history: history.state,
      title: document.title,
    }),
  );
  expect(surfaces.includes(mockRevealedContact)).toBe(false);

  await page.getByRole("button", { name: "Sembunyikan" }).click();
  await expect(page.getByText(mockRevealedContact)).toHaveCount(0);
  expect(violations).toEqual([]);
});

test("visitor markup stays text under the production CSP and long links wrap", async ({ page }) => {
  await mockOwner(page);
  await page.goto("/inquiry/42");
  await settled(page);

  await expect(page.getByText(/onerror=/)).toBeVisible();
  expect(await page.locator("main img, main script").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBe(
    undefined,
  );
  await noSidewaysScroll(page);
});

test("a revealed contact is dropped when the tab is hidden or the page is put away", async ({
  page,
}) => {
  await mockOwner(page);
  await page.goto("/inquiry/42");
  await settled(page);
  const reveal = async () => {
    await page.getByRole("button", { name: "Buka kontak lengkap" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Buka kontak lengkap" }).click();
    await expect(page.getByText(mockRevealedContact)).toBeVisible();
  };
  const setVisibility = (state: "hidden" | "visible") =>
    page.evaluate((value) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
      document.dispatchEvent(new Event("visibilitychange"));
    }, state);

  await reveal();
  await setVisibility("hidden");
  await setVisibility("visible");
  await expect(page.getByText(/disembunyikan karena tab ini ditinggalkan/)).toBeVisible();
  expect(await page.content()).not.toContain(mockRevealedContact);

  await reveal();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  expect(await page.content()).not.toContain(mockRevealedContact);
});
