import { expect, type Page, test } from "@playwright/test";

type OpenLog = { __opened: string[] };

test.beforeEach(async ({ page }) => {
  // Record window.open calls instead of leaving the site.
  await page.addInitScript(() => {
    const log = window as unknown as OpenLog;
    log.__opened = [];
    window.open = ((url?: string | URL) => {
      log.__opened.push(String(url));
      return null;
    }) as typeof window.open;
  });
});

const opened = (page: Page) => page.evaluate(() => (window as unknown as OpenLog).__opened);

test("hero service picker carries the choice into the contact form", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Sistem informasi" }).check({ force: true });
  await page.locator("#main").getByRole("button", { name: "Mulai konsultasi" }).click();
  await expect(page).toHaveURL(/\/kontak\?layanan=sistem-informasi$/);
  await expect(page.getByRole("radio", { name: "Sistem informasi" })).toBeChecked();
});

test("the form validates and never claims to have sent anything", async ({ page }) => {
  await page.goto("/kontak");
  await page.getByRole("button", { name: "Kirim lewat WhatsApp" }).click();
  await expect(page.getByRole("alert")).toContainText("Ada 4 kolom yang perlu dilengkapi.");
  expect(await opened(page)).toEqual([]);
  await expect(page.getByText(/berhasil dikirim/i)).toHaveCount(0);
});

test("a complete form opens WhatsApp with the composed message", async ({ page }) => {
  await page.goto("/kontak?layanan=aplikasi-web");
  await page.getByLabel(/^Nama/).fill("Rina Wulandari");
  await page.getByLabel(/^Email atau nomor WhatsApp/).fill("0812 3456 7890");
  await page
    .getByLabel(/^Ceritakan kebutuhan Anda/)
    .fill("Kami ingin memindahkan pemesanan katering ke aplikasi web.");
  await page.getByRole("button", { name: "Kirim lewat WhatsApp" }).click();

  const urls = await opened(page);
  expect(urls).toHaveLength(1);
  expect(urls[0]).toContain("https://wa.me/6287759641358?text=");
  expect(decodeURIComponent(urls[0]!)).toContain("Layanan: Aplikasi Web");
  await expect(page.getByRole("status")).toContainText(
    "Pesan baru terkirim setelah Anda menekan tombol kirim",
  );
});
