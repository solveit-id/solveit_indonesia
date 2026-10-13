import { expect, test } from "./fixtures";

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

test("skip link moves focus to the main content", async ({ page, isMobile, browserName }) => {
  test.skip(Boolean(isMobile), "Keyboard flow is verified on desktop and tablet.");
  test.skip(browserName === "webkit", "Safari only tabs to links with Option+Tab by default.");
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
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Halaman ini tidak ditemukan.");
  await expect(page.locator("main")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("header order follows the visitor journey, with contact as the closing capsule", async ({
  page,
  viewport,
}) => {
  test.skip((viewport?.width ?? 0) < 1280, "The full desktop order is shown from 1280px.");
  await page.goto("/en");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link")).toHaveText([
    "Home",
    "Services",
    "Portfolio",
    "Process",
    "About Us",
  ]);
  await page.goto("/kontak");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Mulai konsultasi" }),
  ).toHaveAttribute("aria-current", "page");
});

test("the active indicator sits under the current section, nested pages included", async ({
  page,
  viewport,
}) => {
  test.skip((viewport?.width ?? 0) < 1024, "The indicator belongs to the desktop navigation.");
  await page.goto("/en/portfolio/school-academic-portal");
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const current = nav.getByRole("link", { name: "Portfolio" });
  await expect(current).toHaveAttribute("aria-current", "page");
  const indicator = nav.locator(".nav-indicator");
  await expect(indicator).toHaveAttribute("data-visible", "true");

  const centre = async () => {
    const box = (await indicator.boundingBox())!;
    return box.x + box.width / 2;
  };
  const linkBox = (await current.boundingBox())!;
  await expect.poll(centre).toBeGreaterThan(linkBox.x);
  expect(await centre()).toBeLessThan(linkBox.x + linkBox.width);

  // Hover previews another section, then the indicator settles back.
  const services = nav.getByRole("link", { name: "Services" });
  await services.hover();
  const servicesBox = (await services.boundingBox())!;
  await expect.poll(centre).toBeLessThan(servicesBox.x + servicesBox.width);
  await page.mouse.move(10, 400);
  await expect.poll(centre).toBeGreaterThan(linkBox.x);

  // Client navigation moves it, and refresh keeps it.
  await services.click();
  await expect(services).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Services" }),
  ).toHaveAttribute("aria-current", "page");
});

test("the mobile menu marks the current page", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) >= 1024, "Menu button is only shown below 1024px.");
  await page.goto("/en/process");
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(menu.getByRole("link", { name: "Process" })).toHaveAttribute("aria-current", "page");
  await expect(menu.getByRole("link", { name: "Home" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
});
