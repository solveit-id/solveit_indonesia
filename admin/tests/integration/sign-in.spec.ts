import { type Page, expect, test } from "@playwright/test";
import { bootstrapOwner, resetBackend, setServerClock } from "./support/backend";
import {
  type Person,
  activateThroughApi,
  newPerson,
  openNavigation,
  passwordStep,
  signInThroughUi,
} from "./support/flows";
import { assertNoSecretsStored } from "./support/secrets";
import { freshTotp, wrongTotp } from "./support/totp";

/** Real Laravel on the MySQL testing database; one activated synthetic owner per test. */
let owner: Person;

test.beforeEach(async () => {
  resetBackend();
  const person = newPerson("owner");
  const activated = await activateThroughApi(bootstrapOwner(person.email), person);
  await activated.api.dispose();
  owner = activated;
});

test.afterEach(() => setServerClock(0));

const statusesOf = (page: Page, path: string) => {
  const seen: number[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith(`/api/v1/admin/${path}`)) {
      seen.push(response.status());
    }
  });

  return seen;
};

test("password and TOTP sign in, rotate the session, and sign out for good", async ({
  page,
  context,
}) => {
  await page.goto("/masuk");
  await page.getByRole("heading", { level: 1 }).waitFor();
  const sessionCookie = async () =>
    (await context.cookies()).find((cookie) => cookie.name === "solveit-admin-session")?.value;
  const anonymous = await sessionCookie();

  await signInThroughUi(page, owner);

  await expect(page.getByText(`Anda masuk sebagai E2E Owner, Owner.`)).toBeVisible();
  // A pushed history entry for Back to return to after signing out.
  await (await openNavigation(page)).getByRole("link", { name: "Akun" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Akun" })).toBeVisible();
  // Laravel issued a new session ID at sign-in.
  expect(await sessionCookie()).not.toBe(anonymous);
  await assertNoSecretsStored(page, context, [
    owner.password,
    owner.secret,
    ...owner.recoveryCodes,
  ]);

  await page.locator("aside").getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/masuk\?alasan=keluar$/);
  await expect(page.getByText("Anda sudah keluar dari konsol.")).toBeVisible();

  // Back does not bring the account view back: the private loader asks Laravel again.
  await page.goBack();
  await expect(
    page.getByRole("heading", { level: 1, name: "Masuk ke konsol admin" }),
  ).toBeVisible();
  await expect(page.getByText("E2E Owner")).toHaveCount(0);
  expect((await page.request.get("/api/v1/admin/me")).status()).toBe(401);
});

test("a wrong password gets the generic answer; a wrong TOTP code is named as such", async ({
  page,
}) => {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(`${owner.password}x`);
  await page.getByRole("button", { name: "Lanjut" }).click();
  await expect(page.getByRole("alert")).toContainText("Email atau kata sandi tidak cocok");

  // The same words for an address without an account.
  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Lanjut" }).click();
  await expect(page.getByRole("alert")).toContainText("Email atau kata sandi tidak cocok");

  await passwordStep(page, owner);
  await page.getByLabel("Kode 6 digit").fill(wrongTotp(owner.secret));
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText(/Kode tidak cocok\. Tunggu kode berikutnya/)).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Masukkan kode autentikator" }),
  ).toBeVisible();
});

test("a recovery code signs in once and is refused the second time", async ({ browser }) => {
  const code = owner.recoveryCodes[0]!;

  for (const attempt of ["first", "second"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await passwordStep(page, owner);
    await page.getByRole("button", { name: "Pakai kode pemulihan" }).click();
    await page.getByLabel("Kode pemulihan").fill(code);
    await page.getByRole("button", { name: "Masuk" }).click();

    if (attempt === "first") {
      await expect(page.getByRole("heading", { level: 1, name: "Beranda konsol" })).toBeVisible();
      await page.goto("/akun");
      await expect(page.getByText("7 kode tersisa")).toBeVisible();
    } else {
      await expect(
        page.getByText("Kode pemulihan tidak cocok atau sudah pernah dipakai."),
      ).toBeVisible();
    }

    await context.close();
  }
});

test("an expired five-minute challenge returns to the password step, not 'wrong code'", async ({
  page,
}) => {
  await passwordStep(page, owner);
  setServerClock(6 * 60);

  await page.getByLabel("Kode 6 digit").fill(await freshTotp(owner.secret));
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Masuk ke konsol admin" }),
  ).toBeVisible();
  await expect(page.getByText(/Upaya masuk sudah kedaluwarsa/)).toBeVisible();
  await expect(page.getByText(/Kode tidak cocok/)).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveValue(owner.email);
});

test("after a 419 the one replay meets the expired challenge (419 simulated, replay real)", async ({
  page,
  context,
}) => {
  await passwordStep(page, owner);
  const statuses = statusesOf(page, "auth/two-factor-challenge");

  // The session row is gone, as after the idle garbage collector. Chromium marks every console
  // request Sec-Fetch-Site: same-origin and restores that header even when a test removes it,
  // so Laravel's CSRF check passes it and a browser cannot provoke a real 419 here (the real
  // 419 is tested at the API boundary, boundaries.spec.ts). So the first answer alone is
  // simulated; the client's token refresh and its single replay go to real Laravel.
  await context.clearCookies({ name: "solveit-admin-session" });
  let answered = false;
  await page.route("**/api/v1/admin/auth/two-factor-challenge", async (route) => {
    if (answered) {
      return route.continue();
    }

    answered = true;
    await route.fulfill({
      status: 419,
      contentType: "application/json",
      body: JSON.stringify({ message: "CSRF token mismatch." }),
    });
  });

  await page.getByLabel("Kode 6 digit").fill(await freshTotp(owner.secret));
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Masuk ke konsol admin" }),
  ).toBeVisible();
  await expect(page.getByText(/Upaya masuk sudah kedaluwarsa/)).toBeVisible();
  // The simulated 419, then the client's single replay, refused as expired by real Laravel.
  expect(statuses).toEqual([419, 422]);
});

test("a second tab that signs in first makes the 409 lead into the console", async ({
  context,
}) => {
  const first = await context.newPage();
  await first.goto("/masuk");
  await first.getByLabel("Email").fill(owner.email);
  await first.getByLabel("Kata sandi", { exact: true }).fill(owner.password);

  const second = await context.newPage();
  await signInThroughUi(second, owner);

  const statuses = statusesOf(first, "auth/login");
  await first.getByRole("button", { name: "Lanjut" }).click();

  await expect(first.getByRole("heading", { level: 1, name: "Beranda konsol" })).toBeVisible();
  expect(statuses).toEqual([409]);
});

test("too many attempts get Laravel's 429 and a countdown; nothing is sent meanwhile", async ({
  page,
}) => {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(owner.email);
  const statuses = statusesOf(page, "auth/login");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.getByLabel("Kata sandi", { exact: true }).fill(`wrong password ${attempt}`);
    await page.getByRole("button", { name: "Lanjut" }).click();
    await expect.poll(() => statuses.length).toBe(attempt + 1);
  }

  await page.getByLabel("Kata sandi", { exact: true }).fill("wrong password 6");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await expect(
    page.getByText(/Terlalu banyak percobaan\. Coba lagi dalam \d+ detik/),
  ).toBeVisible();
  expect(statuses).toEqual([422, 422, 422, 422, 422, 429]);

  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.waitForTimeout(500);
  expect(statuses).toHaveLength(6);
});

test("an idle session warns first, then ends on the server and leads to sign-in", async ({
  page,
}) => {
  await page.clock.install();
  await signInThroughUi(page, owner);
  await page.goto("/akun");
  await expect(page.getByRole("heading", { level: 1, name: "Akun" })).toBeVisible();

  // runFor fires every timer in order, as continuous idle time does (a jump would read as
  // sleep, and the console would re-check the session on waking).
  await page.clock.runFor("25:30");
  const warning = page.getByRole("alertdialog", { name: "Sesi akan berakhir" });
  await expect(warning).toBeVisible();

  // Laravel's clock passes the 30 idle minutes too; the console then asks once and leaves.
  setServerClock(31 * 60);
  // Just past the expected expiry (30:00 plus a 5 s margin): the check is a real request, so
  // fake time must not run on past the client's 20 s timeout while it is in flight.
  await page.clock.runFor("04:45");

  await expect(page).toHaveURL(/\/masuk\?kembali=%2Fakun&alasan=berakhir$/);
  await expect(page.getByText("Sesi Anda berakhir. Masuk lagi untuk melanjutkan.")).toBeVisible();
  await expect(page.getByText(owner.email)).toHaveCount(0);
});

test("'stay signed in' is one real request that keeps the server session", async ({ page }) => {
  await page.clock.install();
  await signInThroughUi(page, owner);

  setServerClock(25 * 60);
  await page.clock.runFor("25:30");
  const meStatuses = statusesOf(page, "me");
  await page.getByRole("button", { name: "Tetap masuk" }).click();

  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(meStatuses).toEqual([200]);

  // 25 more minutes on the server: still alive because the request renewed it.
  setServerClock(50 * 60);
  const nav = await openNavigation(page);
  await nav.getByRole("link", { name: "Akun" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Akun" })).toBeVisible();
});

test("the 12-hour limit ends even an active session", async ({ page }) => {
  await signInThroughUi(page, owner);

  // Active every 20 minutes for twelve hours, through the browser's own session cookie.
  for (let minutes = 20; minutes < 12 * 60; minutes += 20) {
    setServerClock(minutes * 60);
    expect((await page.request.get("/api/v1/admin/me")).status()).toBe(200);
  }

  setServerClock(12 * 60 * 60 + 60);
  await page.goto("/akun");

  await expect(page).toHaveURL(/\/masuk\?kembali=%2Fakun/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Masuk ke konsol admin" }),
  ).toBeVisible();
});
