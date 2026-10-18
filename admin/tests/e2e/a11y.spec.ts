import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { mockSignedIn, mockSignedOut } from "./support/mock-api";

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axe(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();

  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`);
}

const screens: { path: string; signedIn: boolean }[] = [
  { path: "/masuk", signedIn: false },
  { path: "/access", signedIn: false },
  { path: "/tidak-ada", signedIn: false },
  { path: "/referensi-komponen", signedIn: false },
  { path: "/", signedIn: true },
  { path: "/akun", signedIn: true },
  { path: "/akun/keamanan", signedIn: true },
];

for (const theme of ["light", "dark"] as const) {
  for (const { path, signedIn } of screens) {
    test(`${path} has no axe violations in the ${theme} theme (mocked API)`, async ({ page }) => {
      await page.addInitScript((chosen) => {
        if (chosen === "dark") localStorage.setItem("solveit-admin-theme", "dark");
      }, theme);
      await (signedIn ? mockSignedIn(page) : mockSignedOut(page));
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      if (path === "/akun/keamanan") {
        await page.getByText("Perangkat ini").waitFor();
      }

      expect(await axe(page)).toEqual([]);
    });
  }

  test(`a confirmation dialog has no axe violations in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((chosen) => {
      if (chosen === "dark") localStorage.setItem("solveit-admin-theme", "dark");
    }, theme);
    await mockSignedIn(page);
    await page.goto("/akun/keamanan");
    await page.getByRole("button", { name: "Akhiri semua sesi lain" }).click();
    await page.getByRole("dialog", { name: "Akhiri semua sesi lain?" }).waitFor();

    expect(await axe(page)).toEqual([]);
  });
}

test("the sign-in code step has no axe violations (mocked API)", async ({ page }) => {
  await mockSignedOut(page);
  await page.route("**/api/v1/admin/auth/login", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"two_factor":true}' }),
  );
  await page.goto("/masuk");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill("contoh kata sandi");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("heading", { level: 1, name: "Masukkan kode autentikator" }).waitFor();

  expect(await axe(page)).toEqual([]);
});

test("the open phone menu has no axe violations", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, "phone and tablet only");
  await mockSignedIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();

  expect(await axe(page)).toEqual([]);
});

test("keyboard: skip link first, then a visible focus ring", async ({ page }) => {
  await mockSignedOut(page);
  await page.goto("/masuk");
  await page.getByRole("heading", { level: 1 }).waitFor();

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Langsung ke konten" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

  // The next stop shows a ring: the focus outline, or the capsule field's own ring (a cobalt
  // border with a box-shadow halo), depending on the width's first control.
  await page.keyboard.press("Tab");
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return { outline: style.outlineStyle, shadow: style.boxShadow };
  });
  expect(ring.outline !== "none" || ring.shadow !== "none").toBe(true);
});
