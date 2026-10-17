import { type Browser, type Page, expect, test } from "@playwright/test";
import { bootstrapOwner, resetBackend, setServerClock } from "./support/backend";
import { ADMIN_ORIGIN } from "./support/env.mjs";
import {
  type Person,
  activateThroughApi,
  newPerson,
  openNavigation,
  passwordStep,
  signInThroughUi,
} from "./support/flows";
import { assertNoSecretsStored } from "./support/secrets";
import { freshTotp } from "./support/totp";

/** Real Laravel on the MySQL testing database; one activated synthetic owner per test. */
let owner: Person;

test.beforeEach(async () => {
  resetBackend();
  const person = newPerson("owner");
  const activated = await activateThroughApi(bootstrapOwner(person.email), person);
  // The activation signed that API client in; sign it out so only the test's devices count.
  expect((await activated.api.write("POST", "auth/logout")).status()).toBe(204);
  await activated.api.dispose();
  owner = activated;
});

test.afterEach(() => setServerClock(0));

/** A second browser (another device) signed in as the same owner. */
async function secondDevice(browser: Browser) {
  const context = await browser.newContext({ userAgent: "Mozilla/5.0 (E2E second device)" });
  const page = await context.newPage();
  await signInThroughUi(page, owner);

  return { context, page };
}

async function goToSecurity(page: Page) {
  await (await openNavigation(page)).getByRole("link", { name: "Keamanan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Keamanan akun" })).toBeVisible();
}

test("the account page shows what Laravel returns, read-only", async ({ page }) => {
  await signInThroughUi(page, owner);
  await (await openNavigation(page)).getByRole("link", { name: "Akun" }).click();

  await expect(page.getByText(owner.email)).toBeVisible();
  await expect(page.getByRole("main").getByText("Owner", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Aktif sejak /)).toBeVisible();
  await expect(page.getByText("8 kode tersisa")).toBeVisible();
  await expect(
    page.getByText("Berakhir lebih awal setelah 30 menit tanpa aktivitas."),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
});

test("changing the password ends the other device and keeps this one on a new session", async ({
  page,
  context,
  browser,
}) => {
  const other = await secondDevice(browser);
  await signInThroughUi(page, owner);
  const cookie = async () =>
    (await context.cookies()).find((entry) => entry.name === "solveit-admin-session")?.value;
  const before = await cookie();
  await goToSecurity(page);

  const next = newPerson("x").password;
  await page.getByLabel("Kata sandi sekarang").fill(owner.password);
  await page.getByLabel("Kata sandi baru", { exact: true }).fill(next);
  await page.getByLabel("Ulangi kata sandi baru").fill(next);
  await page.getByRole("button", { name: "Ganti kata sandi" }).click();

  await expect(page.getByText("Kata sandi diganti. 1 sesi lain diakhiri.")).toBeVisible();
  expect(await cookie()).not.toBe(before);
  await assertNoSecretsStored(page, context, [owner.password, next, owner.secret]);

  // The other device is out at its next step.
  await (await openNavigation(other.page)).getByRole("link", { name: "Akun" }).click();
  await expect(other.page).toHaveURL(/\/masuk\?kembali=%2Fakun&alasan=berakhir$/);
  await other.context.close();

  // This one continues, and the new password is the one that works.
  await (await openNavigation(page)).getByRole("link", { name: "Akun" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Akun" })).toBeVisible();
  await page.locator("aside").getByRole("button", { name: "Keluar" }).click();
  await signInThroughUi(page, { ...owner, password: next });
});

test("a wrong current password is named on its field and changes nothing", async ({ page }) => {
  await signInThroughUi(page, owner);
  await goToSecurity(page);

  const next = newPerson("x").password;
  await page.getByLabel("Kata sandi sekarang").fill(`${owner.password}x`);
  await page.getByLabel("Kata sandi baru", { exact: true }).fill(next);
  await page.getByLabel("Ulangi kata sandi baru").fill(next);
  await page.getByRole("button", { name: "Ganti kata sandi" }).click();

  await expect(page.getByLabel("Kata sandi sekarang")).toHaveAccessibleDescription(
    "Kata sandi sekarang tidak cocok.",
  );
});

test("sessions: list what Laravel records, end one device, then all others", async ({
  page,
  browser,
}) => {
  const other = await secondDevice(browser);
  const third = await secondDevice(browser);
  await signInThroughUi(page, owner);
  await goToSecurity(page);

  const list = page.getByRole("list").filter({ hasText: "Perangkat ini" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(list.getByText("Mozilla/5.0 (E2E second device)")).toHaveCount(2);
  // Handles are opaque and never shown.
  expect(await list.innerText()).not.toMatch(/[0-9a-f]{32}/);

  await list.getByRole("button", { name: "Akhiri sesi" }).first().click();
  await page
    .getByRole("dialog", { name: "Akhiri sesi ini?" })
    .getByRole("button", { name: "Akhiri sesi" })
    .click();
  await expect(page.getByText("Sesi diakhiri.")).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(2);

  await page.getByRole("button", { name: "Akhiri semua sesi lain" }).click();
  await page
    .getByRole("dialog", { name: "Akhiri semua sesi lain?" })
    .getByRole("button", { name: "Akhiri semua sesi lain" })
    .click();
  await expect(page.getByText("1 sesi lain diakhiri.")).toBeVisible();
  await expect(
    page.getByText("Tidak ada sesi lain. Hanya perangkat ini yang sedang masuk."),
  ).toBeVisible();

  for (const device of [other, third]) {
    expect((await device.page.request.get("/api/v1/admin/me")).status()).toBe(401);
    await device.context.close();
  }

  expect((await page.request.get("/api/v1/admin/me")).status()).toBe(200);
});

test("recovery codes: 423, password, a second decision, new codes once; old codes stop", async ({
  page,
  context,
  browser,
}) => {
  await signInThroughUi(page, owner);
  await goToSecurity(page);
  const statuses: number[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith("/me/two-factor-recovery-codes")) statuses.push(response.status());
  });

  await page.getByRole("button", { name: "Buat kode pemulihan baru" }).click();
  await page
    .getByRole("dialog", { name: "Buat kode pemulihan baru?" })
    .getByRole("button", { name: "Buat kode baru" })
    .click();

  const reauth = page.getByRole("dialog", { name: "Konfirmasi kata sandi" });
  await expect(reauth).toBeVisible();
  expect(statuses).toEqual([423]);
  await reauth.getByLabel("Kata sandi", { exact: true }).fill(owner.password);
  await reauth.getByRole("button", { name: "Konfirmasi" }).click();

  const confirmed = page.getByRole("dialog", { name: "Kata sandi dikonfirmasi" });
  await expect(confirmed).toBeVisible();
  // Nothing regenerated yet.
  expect(statuses).toEqual([423]);
  await confirmed.getByRole("button", { name: "Buat kode baru" }).click();

  const list = page.getByRole("list", { name: "Kode pemulihan" });
  await expect(list).toBeVisible();
  expect(statuses).toEqual([423, 200]);
  const fresh = await list.locator("li .select-all").allInnerTexts();
  expect(fresh).toHaveLength(8);
  await expect(page.getByText("Kode pemulihan lama sudah tidak berlaku.")).toBeVisible();
  await assertNoSecretsStored(page, context, [owner.password, ...fresh, ...owner.recoveryCodes]);

  await page.getByRole("checkbox", { name: /Saya sudah menyimpan kode ini/ }).check();
  await page.getByRole("button", { name: "Selesai" }).click();
  await expect(list).toHaveCount(0);

  // An old code is refused, a new one signs in.
  for (const [code, works] of [
    [owner.recoveryCodes[0]!, false],
    [fresh[0]!, true],
  ] as const) {
    const device = await browser.newContext();
    const visitor = await device.newPage();
    await passwordStep(visitor, owner);
    await visitor.getByRole("button", { name: "Pakai kode pemulihan" }).click();
    await visitor.getByLabel("Kode pemulihan").fill(code);
    await visitor.getByRole("button", { name: "Masuk" }).click();
    await expect(
      works
        ? visitor.getByRole("heading", { level: 1, name: "Beranda konsol" })
        : visitor.getByText("Kode pemulihan tidak cocok atau sudah pernah dipakai."),
    ).toBeVisible();
    await device.close();
  }
});

test("a password confirmation lasts 15 minutes, then Laravel asks again (423)", async ({
  page,
}) => {
  await signInThroughUi(page, owner);
  // A direct request from this browser's session: Origin and the XSRF token, as the console sends.
  const xsrf = (await page.context().cookies()).find((cookie) => cookie.name === "XSRF-TOKEN")!;
  const confirmation = await page.request.post("/api/v1/admin/auth/confirm-password", {
    headers: { Origin: ADMIN_ORIGIN, "X-XSRF-TOKEN": decodeURIComponent(xsrf.value) },
    data: { password: owner.password },
  });
  expect(confirmation.status()).toBe(201);

  setServerClock(16 * 60);
  await goToSecurity(page);
  await page.getByRole("button", { name: "Buat kode pemulihan baru" }).click();
  await page
    .getByRole("dialog", { name: "Buat kode pemulihan baru?" })
    .getByRole("button", { name: "Buat kode baru" })
    .click();

  await expect(page.getByRole("dialog", { name: "Konfirmasi kata sandi" })).toBeVisible();
});

test("a TOTP code used for sign-in is refused when replayed", async ({ browser }) => {
  const code = await freshTotp(owner.secret);

  for (const expected of ["Beranda konsol", "wrong"] as const) {
    const device = await browser.newContext();
    const page = await device.newPage();
    await passwordStep(page, owner);
    await page.getByLabel("Kode 6 digit").fill(code);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(
      expected === "wrong"
        ? page.getByText(/Kode tidak cocok\. Tunggu kode berikutnya/)
        : page.getByRole("heading", { level: 1, name: expected }),
    ).toBeVisible();
    await device.close();
  }
});
