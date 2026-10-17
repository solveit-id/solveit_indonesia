import { expect, request, test } from "@playwright/test";
import { bootstrapOwner, resetBackend } from "./support/backend";
import { ADMIN_ORIGIN, LARAVEL_ORIGIN } from "./support/env.mjs";
import { activateThroughApi, newPerson, signInThroughUi } from "./support/flows";

/** Real Laravel on the MySQL testing database; synthetic data only. */
test.beforeEach(() => resetBackend());

test("a private screen sends a visitor without a session to sign-in, with a safe return path", async ({
  page,
}) => {
  await page.goto("/akun/keamanan");

  await expect(
    page.getByRole("heading", { level: 1, name: "Masuk ke konsol admin" }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
    "/masuk?kembali=%2Fakun%2Fkeamanan",
  );
  await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toHaveCount(0);
});

test("an unsafe return path is ignored after signing in", async ({ page }) => {
  const person = newPerson("owner");
  const owner = await activateThroughApi(bootstrapOwner(person.email), person);
  await owner.api.dispose();
  await page.goto("/masuk?kembali=%2F%2Fevil.example%2Fakun");

  await signInThroughUi(page, owner);

  expect(new URL(page.url()).origin).toBe(ADMIN_ORIGIN);
  expect(new URL(page.url()).pathname).toBe("/");
});

test("nothing private renders before Laravel answers GET me (real answer, delayed)", async ({
  page,
}) => {
  const person = newPerson("owner");
  const owner = await activateThroughApi(bootstrapOwner(person.email), person);
  await owner.api.dispose();
  await signInThroughUi(page, owner);

  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/v1/admin/me", async (route) => {
    await held;
    await route.continue();
  });

  await page.goto("/akun");
  await page.waitForTimeout(500);
  expect(await page.locator("body").innerText()).not.toContain(owner.email);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);

  release();
  await expect(page.getByRole("heading", { level: 1, name: "Akun" })).toBeVisible();
  await expect(page.getByText(owner.email)).toBeVisible();
});

test("session and CSRF cookies are host-only, SameSite=Strict, and end with the browser", async ({
  page,
  context,
}) => {
  const document = await page.goto("/masuk");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.request.get("/api/v1/admin/auth/csrf-cookie");

  const headers = document!.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("img-src 'self' data:");
  expect(headers["content-security-policy"]).not.toMatch(/unsafe-inline|unsafe-eval/);
  expect(headers["referrer-policy"]).toBe("same-origin");
  expect(headers["x-frame-options"]).toBe("DENY");

  const cookies = await context.cookies(ADMIN_ORIGIN);
  const session = cookies.find((cookie) => cookie.name === "solveit-admin-session");
  const xsrf = cookies.find((cookie) => cookie.name === "XSRF-TOKEN");

  expect(session).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/", expires: -1 });
  // Host-only: no leading dot, no parent domain.
  expect(session!.domain).toBe("127.0.0.1");
  // Readable by the console (it echoes the value); Laravel sets it for the 30-minute lifetime.
  expect(xsrf).toMatchObject({ httpOnly: false, sameSite: "Strict" });
  expect(xsrf!.expires * 1000 - Date.now()).toBeLessThanOrEqual(31 * 60_000);

  const api = await page.request.get("/api/v1/admin/me");
  expect(api.status()).toBe(401);
  expect(api.headers()["cache-control"]).toContain("no-store");
});

test.describe("the admin API boundary (real Laravel)", () => {
  test("another Origin, a cross-site fetch, or a write without Origin is refused before a session", async () => {
    const foreign = await request.newContext({
      baseURL: `${ADMIN_ORIGIN}/api/v1/admin/`,
      extraHTTPHeaders: { Origin: "http://evil.example", Accept: "application/json" },
    });
    const crossSite = await request.newContext({
      baseURL: `${ADMIN_ORIGIN}/api/v1/admin/`,
      extraHTTPHeaders: { "Sec-Fetch-Site": "cross-site", Accept: "application/json" },
    });
    const noOrigin = await request.newContext({
      baseURL: `${ADMIN_ORIGIN}/api/v1/admin/`,
      extraHTTPHeaders: { Accept: "application/json" },
    });

    for (const response of [
      await foreign.get("auth/csrf-cookie"),
      await crossSite.get("auth/csrf-cookie"),
      await noOrigin.post("auth/login", { data: { email: "x@example.test", password: "x" } }),
    ]) {
      expect(response.status()).toBe(403);
      expect(response.headers()["set-cookie"]).toBeUndefined();
    }

    await Promise.all([foreign.dispose(), crossSite.dispose(), noOrigin.dispose()]);
  });

  test("a write with the admin Origin but no CSRF token gets a real 419", async () => {
    const client = await request.newContext({
      baseURL: `${ADMIN_ORIGIN}/api/v1/admin/`,
      extraHTTPHeaders: { Origin: ADMIN_ORIGIN, Accept: "application/json" },
    });

    const response = await client.post("auth/login", {
      data: { email: "x@example.test", password: "x" },
    });

    expect(response.status()).toBe(419);
    expect(await response.json()).toEqual({ message: "CSRF token mismatch." });
    await client.dispose();
  });

  test("on any other host the admin API does not exist; the public API stays cookie-free", async () => {
    const direct = await request.newContext({ baseURL: LARAVEL_ORIGIN });

    const admin = await direct.get("/api/v1/admin/auth/csrf-cookie", {
      headers: { Accept: "application/json" },
    });
    expect(admin.status()).toBe(404);
    expect(admin.headers()["set-cookie"]).toBeUndefined();

    const health = await direct.get("/up");
    expect(health.status()).toBe(200);
    expect(health.headers()["set-cookie"]).toBeUndefined();

    const inquiry = await direct.post("/api/v1/inquiries", {
      headers: { Accept: "application/json" },
      data: {
        name: "E2E Sintetis",
        contact: "e2e-inquiry@example.test",
        service: "website",
        budget: "belum-tahu",
        timeline: "fleksibel",
        message: "Pesan sintetis dari tes browser B3.2b untuk memeriksa batas API publik.",
      },
    });
    expect(inquiry.status()).toBe(201);
    expect(inquiry.headers()["set-cookie"]).toBeUndefined();
    await direct.dispose();
  });
});
