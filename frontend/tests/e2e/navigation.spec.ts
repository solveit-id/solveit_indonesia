import { expect, test } from "@playwright/test";

test("primary navigation moves between pages and marks the current one", async ({
  page,
  viewport,
}) => {
  test.skip((viewport?.width ?? 0) < 1024, "Navigation collapses into the menu below 1024px.");
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navigasi utama" });
  await nav.getByRole("link", { name: "Layanan" }).click();
  await expect(page).toHaveURL(/\/layanan$/);
  await expect(page.locator("h1")).toContainText("Layanan pengembangan software");
  await expect(nav.getByRole("link", { name: "Layanan" })).toHaveAttribute("aria-current", "page");
});

test("mobile menu opens, makes the page inert, and closes with Escape", async ({
  page,
  viewport,
}) => {
  test.skip((viewport?.width ?? 0) >= 1024, "Menu button is only shown below 1024px.");
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("button", { name: "Tutup" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  const menu = page.getByRole("navigation", { name: "Navigasi seluler" });
  await expect(menu).toBeVisible();
  await expect(page.locator("#main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await page.getByRole("button", { name: "Menu" }).click();
  await menu.getByRole("link", { name: "Portofolio" }).click();
  await expect(page).toHaveURL(/\/portofolio$/);
  await expect(menu).toBeHidden();
});

test("skip link moves focus to the main content", async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), "Keyboard flow is verified on desktop and tablet.");
  await page.goto("/layanan");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Lewati ke konten utama" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("portfolio filter narrows the list and announces the count", async ({ page }) => {
  await page.goto("/portofolio");
  const filter = page.getByRole("group", { name: "Saring berdasarkan kategori" });
  await filter.getByRole("button", { name: /Sistem informasi/ }).click();
  await expect(filter.getByRole("button", { name: /Sistem informasi/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-project-card]")).toHaveCount(2);
  await expect(page.getByText("Menampilkan 2 studi kasus.")).toBeAttached();
  await filter.getByRole("button", { name: /Semua/ }).click();
  await expect(page.locator("[data-project-card]")).toHaveCount(5);
});

test("case studies are labelled as demonstrations and link to neighbours", async ({ page }) => {
  await page.goto("/portofolio/portal-akademik-sekolah");
  await expect(page.getByText("Konsep demonstrasi, bukan proyek klien").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Yang akan diukur." })).toBeVisible();
  await page.getByRole("navigation", { name: "Studi kasus lain" }).getByRole("link").last().click();
  await expect(page).toHaveURL(/\/portofolio\/profil-perusahaan-manufaktur$/);
});

test("unknown case study slug is a real 404 that hydrates cleanly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/portofolio/tidak-ada");
  expect(response?.status()).toBe(404);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Halaman ini tidak ditemukan.");
  await expect(page.locator("main")).toHaveCount(1);
  expect(errors).toEqual([]);
});
