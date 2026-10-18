import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { mockInviteUrl, mockOwner } from "./support/mock-api";

/**
 * B3.2c screens on the reference build with the production CSP, MOCKED owner data (synthetic,
 * tests/e2e/support/mock-api.ts): layout per width, accessibility in both themes, the motion
 * rules (lazy GSAP, reduced motion, nothing left transformed, no CSP violation). The real
 * flows against Laravel are tests/integration/owner-administration.spec.ts.
 */
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axe(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Let entrance motion settle (the longest, a row stagger, ends under 500 ms): axe measures
  // contrast with the current opacity, and a fade in progress is not the screen people read.
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

async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener("securitypolicyviolation", (event) =>
      seen.push(`${event.violatedDirective} ${event.blockedURI}`),
    );
  });
}

const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);

const screens = [
  { path: "/pengguna", heading: "Pengguna" },
  { path: "/pengguna/2", heading: "Contoh Admin dengan nama yang cukup panjang" },
  { path: "/pengguna/3", heading: "Admin Tertunda" },
  { path: "/undangan", heading: "Undangan" },
  { path: "/undangan/baru", heading: "Undang admin" },
  { path: "/audit", heading: "Audit log" },
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
      await page
        .getByRole("status")
        .filter({ hasText: /Memuat/ })
        .waitFor({ state: "detached" });

      expect(await axe(page)).toEqual([]);
      await noSidewaysScroll(page);
    });
  }
}

test("lists are tables from 768px and cards below", async ({ page }) => {
  await mockOwner(page);
  await page.goto("/pengguna");
  await expect(page.getByRole("link", { name: "Contoh Owner" })).toBeVisible();
  const wide = page.viewportSize()!.width >= 768;

  await expect(page.getByRole("table", { name: "Daftar akun admin" })).toHaveCount(wide ? 1 : 0);
  await expect(page.getByRole("list", { name: "Daftar akun admin" })).toHaveCount(wide ? 0 : 1);
});

test("the one-time link reveal: focal mark, focus, no CSP violation, nothing left moved", async ({
  page,
}) => {
  await watchCsp(page);
  await mockOwner(page);
  await page.goto("/undangan/baru");
  await page.getByLabel("Email orang yang diundang").fill("baru@example.test");
  await page.getByRole("button", { name: "Tinjau undangan" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Buat undangan" }).click();

  const heading = page.getByRole("heading", { name: "Tautan undangan untuk baru@example.test" });
  await expect(heading).toBeFocused();
  await expect(page.getByText(mockInviteUrl)).toBeVisible();

  // After the ~600 ms assembly every capsule is back on its original path.
  await page.waitForTimeout(1200);
  const transforms = await page
    .locator("[data-capsule]")
    .evaluateAll((paths) => paths.map((path) => getComputedStyle(path).transform));
  expect(transforms).toHaveLength(4);
  for (const transform of transforms) {
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
  }
  // Checked once settled: mid-fade, axe would measure a transient contrast.
  expect(await axe(page)).toEqual([]);
  expect(await violations(page)).toEqual([]);
  await noSidewaysScroll(page);
});

test("GSAP is a lazy chunk, fetched after start-up, never in the HTML", async ({ page }) => {
  await mockOwner(page);
  const html = await (await page.request.get("/")).text();
  expect(html).not.toMatch(/gsap/i);

  const gsap = page.waitForResponse((response) => /\/assets\/gsap-[^/]+\.js$/.test(response.url()));
  await page.goto("/pengguna");
  await expect(page.getByRole("heading", { level: 1, name: "Pengguna" })).toBeVisible();
  expect((await gsap).status()).toBe(200);
});

test("screen changes animate and settle; the nav capsule ends in place", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1024, "the rail navigation is desktop only");
  await watchCsp(page);
  await mockOwner(page);
  await page.goto("/pengguna");
  await page.waitForResponse(/\/assets\/gsap-[^/]+\.js$/);
  await page.waitForTimeout(300);

  const rail = page.locator("aside").getByRole("navigation", { name: "Navigasi utama" });
  await rail.getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
  await page.waitForTimeout(800);

  const marker = rail.locator('[aria-current="page"] [data-nav-marker]');
  expect(await marker.evaluate((element) => getComputedStyle(element).transform)).toMatch(
    /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
  );
  expect(
    await page
      .locator("#main > div > div")
      .first()
      .evaluate((element) => element.style.opacity),
  ).toMatch(/^(1|)$/);
  expect(await violations(page)).toEqual([]);
});

test("reduced motion: screen changes leave no inline motion styles", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockOwner(page);
  await page.goto("/pengguna");
  await page.waitForResponse(/\/assets\/gsap-[^/]+\.js$/);
  await page.waitForTimeout(300);

  // An in-app screen change with GSAP loaded: the case that would animate without the setting.
  if (page.viewportSize()!.width < 1024) {
    await page.getByRole("button", { name: "Menu" }).click();
  }
  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .filter({ visible: true })
    .getByRole("link", { name: "Audit log" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
  const styled = await page
    .locator("#main [style]")
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("style")));
  expect(styled.filter((style) => /transform|opacity/.test(style ?? ""))).toEqual([]);
});
