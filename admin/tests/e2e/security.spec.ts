import { expect, test } from "@playwright/test";
import { mockSignedIn, mockSignedOut } from "./support/mock-api";

test("the document carries the production policy and nothing loads from another origin", async ({
  page,
}) => {
  const origins = new Set<string>();
  const violations: string[] = [];
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  await mockSignedOut(page);

  const response = await page.goto("/masuk");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);

  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("script-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).not.toMatch(/unsafe-inline|unsafe-eval/);
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("same-origin");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  expect(headers["cache-control"]).toBe("no-store");

  expect([...origins]).toEqual(["http://127.0.0.1:4175"]);
  expect(violations).toEqual([]);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test("the TOTP QR renders as a data: image under the production CSP (mocked API)", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  await mockSignedOut(page);
  await page.route("**/api/v1/admin/access-links/inspect", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          purpose: "activation",
          email: "o***@example.test",
          requires_name: true,
          expires_at: "2099-10-17T06:00:00+00:00",
        },
      }),
    }),
  );
  await page.route("**/api/v1/admin/access-links/redeem", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          two_factor: {
            qr_code_svg:
              '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/><rect width="4" height="4" fill="#2d3748"/><script>window.__qrScriptRan = true</script></svg>',
            setup_key: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
          },
          confirm_before: "2099-10-17T05:45:00+00:00",
        },
      }),
    }),
  );

  await page.goto(`/access#token=${"A".repeat(43)}`);
  await expect(page).toHaveURL(/\/access$/);
  await page.getByLabel("Nama").fill("Contoh Owner");
  await page.getByLabel("Kata sandi baru", { exact: true }).fill("contoh kata sandi panjang");
  await page.getByLabel("Ulangi kata sandi baru").fill("contoh kata sandi panjang");
  await page.getByRole("button", { name: "Simpan dan lanjut" }).click();

  const qr = page.getByRole("img", { name: /Kode QR untuk mendaftarkan/ });
  await expect(qr).toBeVisible();
  expect(await qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(
    true,
  );
  // Script inside an SVG shown through <img> never runs.
  expect(await page.evaluate(() => "__qrScriptRan" in window)).toBe(false);
  expect(violations).toEqual([]);
});

test("the developer connection check exists only on the reference page", async ({ page }) => {
  await page.goto("/referensi-komponen");
  await page.getByRole("button", { name: "Periksa koneksi" }).click();

  // No backend in this run: the real "Laravel not answering" path.
  await expect(
    page.getByRole("status").filter({ hasText: "Laravel tidak menjawab" }),
  ).toBeVisible();
});

test("a signed-in screen stores no account data in the browser (mocked API)", async ({ page }) => {
  await mockSignedIn(page);
  await page.goto("/akun");
  await page.getByText("owner@example.test").waitFor();

  const stored = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage, cookie: document.cookie }),
  );
  expect(stored).not.toContain("owner@example.test");
  expect(stored).not.toContain("Contoh Owner");
});

test("the admin cannot be framed", async ({ page }) => {
  await page.setContent(`<iframe src="http://127.0.0.1:4175/masuk" title="probe"></iframe>`);
  const frame = page
    .frames()
    .find((candidate) => candidate.url().startsWith("http://127.0.0.1:4175"));
  // Refused by frame-ancestors 'none' / X-Frame-Options: the frame never renders the console.
  const heading = frame
    ? await frame
        .locator("h1")
        .count()
        .catch(() => 0)
    : 0;
  expect(heading).toBe(0);
});
