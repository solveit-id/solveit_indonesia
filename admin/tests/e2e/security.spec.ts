import { expect, test } from "@playwright/test";

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

  const response = await page.goto("/");
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

test.describe("connection check", () => {
  test("real path: Laravel not answering is reported with its fix (no backend in this run)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Periksa koneksi" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "Laravel tidak menjawab" }),
    ).toBeVisible();
  });

  test("mocked 204: same-origin request with credentials, no token in storage", async ({
    page,
  }) => {
    let seen: { method: string; url: string; headers: Record<string, string> } | null = null;
    await page.route("**/api/v1/admin/auth/csrf-cookie", async (route) => {
      seen = {
        method: route.request().method(),
        url: route.request().url(),
        headers: route.request().headers(),
      };
      await route.fulfill({
        status: 204,
        headers: { "Set-Cookie": "XSRF-TOKEN=mocked-token; Path=/; SameSite=Strict" },
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Periksa koneksi" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "API admin menjawab (204)" }),
    ).toBeVisible();
    expect(seen).not.toBeNull();
    expect(seen!.method).toBe("GET");
    expect(seen!.url).toBe("http://127.0.0.1:4175/api/v1/admin/auth/csrf-cookie");
    expect(seen!.headers.authorization).toBeUndefined();

    const storage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(storage).not.toContain("mocked-token");
  });

  test("mocked 403: the boundary refusal names ADMIN_URL and this origin", async ({ page }) => {
    await page.route("**/api/v1/admin/auth/csrf-cookie", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Cross-origin requests to the admin API are not allowed.",
        }),
      }),
    );

    await page.goto("/");
    await page.getByRole("button", { name: "Periksa koneksi" }).click();

    await expect(
      page.getByRole("status").filter({
        hasText: "ADMIN_URL di backend harus sama dengan origin ini: http://127.0.0.1:4175",
      }),
    ).toBeVisible();
  });
});

test("the admin cannot be framed", async ({ page }) => {
  await page.setContent(`<iframe src="http://127.0.0.1:4175/" title="probe"></iframe>`);
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
