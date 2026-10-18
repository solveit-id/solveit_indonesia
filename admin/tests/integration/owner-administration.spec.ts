import { type Page, expect, test } from "@playwright/test";
import { bootstrapOwner, resetBackend, tokenOf } from "./support/backend";
import {
  type AdminApi,
  type Person,
  activateThroughApi,
  cspViolations,
  inviteThroughApi,
  newPerson,
  openNavigation,
  signInThroughUi,
  watchCsp,
} from "./support/flows";
import { assertAbsent, assertNoSecretsStored } from "./support/secrets";
import { freshTotp } from "./support/totp";

/**
 * B3.2c against real Laravel on the MySQL testing database: owner administration through the
 * console, nothing mocked except the one 502 written out in the uncertain-outcome test (the
 * real request still reaches Laravel). Accounts are synthetic (@example.test) and created only
 * through the real commands and API.
 */
let owner: Person & { api: AdminApi };

test.beforeEach(async ({ page }) => {
  resetBackend();
  const person = newPerson("owner");
  owner = await activateThroughApi(bootstrapOwner(person.email), person, "Owner Utama");
  await watchCsp(page);
});

test.afterEach(async () => {
  await owner.api.dispose();
});

/** An admin invited by the owner and activated through the API; signed in on its own client. */
async function invitedAdmin(name = "Admin Kedua") {
  const person = newPerson("admin");
  const link = await inviteThroughApi(owner, person.email);

  return activateThroughApi(link, person, name);
}

async function signOutOwnerApi() {
  expect((await owner.api.write("POST", "auth/logout")).status()).toBe(204);
}

async function go(page: Page, name: string, heading = name) {
  await (await openNavigation(page)).getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
}

/** The dialog's 423 step: confirm the password, then the deliberate second press. */
async function confirmPasswordThenPress(page: Page, action: string) {
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Konfirmasi kata sandi" })).toBeVisible();
  await dialog.getByLabel("Kata sandi Anda").fill(owner.password);
  await dialog.getByRole("button", { name: "Konfirmasi kata sandi" }).click();
  await expect(dialog.getByRole("heading", { name: "Kata sandi dikonfirmasi" })).toBeVisible();
  await dialog.getByRole("button", { name: action }).click();
}

test("an owner invites an admin, the link works once, and the account appears", async ({
  page,
  context,
}) => {
  await signOutOwnerApi();
  await signInThroughUi(page, owner);
  await go(page, "Undangan");

  await page.getByRole("link", { name: "Undang admin" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Undang admin" })).toBeVisible();
  const invitee = newPerson("invitee");
  await page.getByLabel("Email orang yang diundang").fill(invitee.email);
  await page.getByRole("button", { name: "Tinjau undangan" }).click();

  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/v1/admin/invitations")) {
      writes.push(request.url());
    }
  });
  await page.getByRole("dialog").getByRole("button", { name: "Buat undangan" }).click();
  // A fresh sign-in has no password confirmation yet: Laravel answers 423 for real.
  await confirmPasswordThenPress(page, "Buat undangan");

  await expect(
    page.getByRole("heading", { name: `Tautan undangan untuk ${invitee.email}` }),
  ).toBeFocused();
  const link = (await page.locator("code.secret-value").innerText()).trim();
  expect(link).toMatch(/^http:\/\/127\.0\.0\.1:4176\/access#token=[A-Za-z0-9_-]{43}$/);
  expect(writes).toHaveLength(2); // the 423, then the one deliberate resend
  await assertNoSecretsStored(page, context, [tokenOf(link), owner.password]);

  // Leaving before securing the link asks first.
  await (await openNavigation(page)).getByRole("link", { name: "Pengguna" }).click();
  await expect(page.getByRole("dialog", { name: "Tautan belum diamankan" })).toBeVisible();
  await page.getByRole("button", { name: "Tetap di sini" }).click();

  await page.getByRole("checkbox", { name: /sudah menyalin atau menyerahkan/ }).check();
  await page.getByRole("button", { name: "Selesai" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Undangan" })).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(invitee.email) });
  await expect(row.getByText("Menunggu")).toBeVisible();
  await expect(row.getByText("oleh Anda")).toBeVisible();
  assertAbsent(await page.content(), [tokenOf(link)], "the page after Done");

  // The invitee activates with the link; the owner then sees an accepted invitation.
  const activated = await activateThroughApi(link, invitee, "Calon Admin");
  await activated.api.dispose();
  await page.reload();
  await expect(
    page.getByRole("row", { name: new RegExp(invitee.email) }).getByText("Diterima"),
  ).toBeVisible();

  await go(page, "Pengguna");
  const account = page.getByRole("row", { name: /Calon Admin/ });
  await expect(account.getByText("Aktif")).toBeVisible();
  await expect(account.getByText("Terkonfirmasi")).toBeVisible();
  expect(await cspViolations(page)).toEqual([]);
});

test("role change, suspension, and reactivation act on the real account", async ({ page }) => {
  const admin = await invitedAdmin();
  await signOutOwnerApi();
  await signInThroughUi(page, owner);
  await go(page, "Pengguna");
  await page.getByRole("link", { name: "Admin Kedua" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Admin Kedua" })).toBeVisible();
  await expect(page.getByText("1 sesi")).toBeVisible();

  await page.getByRole("button", { name: "Jadikan Owner" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Jadikan Owner" }).click();
  await confirmPasswordThenPress(page, "Jadikan Owner");
  await expect(
    page.getByText("Admin Kedua sekarang Owner. Semua sesinya sudah diakhiri."),
  ).toBeVisible();
  // The role change ended the admin's session on its own client.
  expect((await admin.api.get("me")).status()).toBe(401);

  // The confirmation from a minute ago still holds: no password step this time.
  await page.getByRole("button", { name: "Jadikan Admin" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Jadikan Admin" }).click();
  await expect(page.getByText("Admin Kedua sekarang Admin.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Tangguhkan akun" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tangguhkan akun" }).click();
  await expect(page.getByText("Admin Kedua ditangguhkan.", { exact: false })).toBeVisible();
  // The pressed button is gone (it became "Aktifkan ulang"): focus continues at the result.
  await expect(
    page.getByRole("status").filter({ hasText: "Admin Kedua ditangguhkan." }),
  ).toBeFocused();
  await expect(page.getByRole("main").getByText("Ditangguhkan").first()).toBeVisible();

  await page.getByRole("button", { name: "Aktifkan ulang" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aktifkan ulang" }).click();
  await expect(page.getByText("Admin Kedua diaktifkan ulang.", { exact: false })).toBeVisible();

  // Every change is in the audit log, with the owner as actor.
  await page.getByRole("link", { name: "Lihat semua di audit log" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
  await page.getByLabel("Tindakan").selectOption("account.suspended");
  const suspended = page.getByRole("listitem").filter({ hasText: "Akun ditangguhkan" });
  await expect(suspended).toHaveCount(1);
  await expect(suspended.getByText("Anda")).toBeVisible();
  await expect(suspended.getByText("Admin Kedua")).toBeVisible();
  await expect(
    suspended.getByText("1 sesi diakhiri").or(suspended.getByText("0 sesi diakhiri")),
  ).toBeVisible();
  await admin.api.dispose();
  expect(await cspViolations(page)).toEqual([]);
});

test("a credential reset shows its link once and the person completes it", async ({
  page,
  context,
}) => {
  const admin = await invitedAdmin("Admin Reset");
  await admin.api.dispose();
  await signOutOwnerApi();
  await signInThroughUi(page, owner);
  await go(page, "Pengguna");
  await page.getByRole("link", { name: "Admin Reset" }).click();

  await page.getByRole("button", { name: "Reset kredensial" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Reset kredensial" }).click();
  await expect(dialog.getByText(/Centang pernyataan/)).toBeVisible();
  await dialog.getByRole("checkbox", { name: /tidak dapat masuk sampai/ }).check();
  await dialog.getByRole("button", { name: "Reset kredensial" }).click();
  await confirmPasswordThenPress(page, "Reset kredensial");

  await expect(page.getByRole("heading", { name: "Tautan reset untuk Admin Reset" })).toBeFocused();
  const link = (await page.locator("code.secret-value").innerText()).trim();
  await expect(page.getByRole("main").getByText("Reset tertunda").first()).toBeVisible();
  await assertNoSecretsStored(page, context, [tokenOf(link)]);
  await page.getByRole("checkbox", { name: /sudah menyalin atau menyerahkan/ }).check();
  await page.getByRole("button", { name: "Selesai" }).click();
  await expect(page.getByRole("button", { name: "Terbitkan reset baru" })).toBeVisible();

  // The person completes the reset with a new password and authenticator.
  const renewed = await activateThroughApi(link, { ...admin, password: newPerson("x").password });
  await renewed.api.dispose();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Admin Reset" })).toBeVisible();
  await expect(page.getByRole("main").getByText("Aktif").first()).toBeVisible();
  expect(await cspViolations(page)).toEqual([]);
});

test("a refused invitation explains its 409, and the own account offers no action", async ({
  page,
}) => {
  const pending = newPerson("pending");
  await inviteThroughApi(owner, pending.email);
  await signOutOwnerApi();
  await signInThroughUi(page, owner);

  await page.goto("/undangan/baru");
  await page.getByLabel("Email orang yang diundang").fill(pending.email);
  await page.getByRole("button", { name: "Tinjau undangan" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Buat undangan" }).click();
  await confirmPasswordThenPress(page, "Buat undangan");
  await expect(
    page.getByRole("dialog").getByText(/masih punya undangan yang berlaku/),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Tutup" }).click();

  await go(page, "Pengguna");
  await page.getByRole("link", { name: "Owner Utama" }).click();
  await expect(page.getByText(/Ini akun Anda/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tindakan" })).toHaveCount(0);
});

test("an uncertain outcome is resolved by a read, never resent", async ({ page }) => {
  const admin = await invitedAdmin("Admin Ragu");
  await admin.api.dispose();
  // A fresh confirmation on the browser's own session follows below; this client is not it.
  await signOutOwnerApi();
  await signInThroughUi(page, owner);
  await go(page, "Pengguna");
  await page.getByRole("link", { name: "Admin Ragu" }).click();

  let sent = 0;
  // The request really reaches Laravel (and applies); only its answer is lost on the way back.
  await page.route("**/api/v1/admin/users/*/suspension", async (route) => {
    sent += 1;
    const response = await route.fetch();

    if (response.status() === 423) {
      return route.fulfill({ response });
    }

    return route.fulfill({ status: 502, body: "Bad Gateway" });
  });

  await page.getByRole("button", { name: "Tangguhkan akun" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tangguhkan akun" }).click();
  await confirmPasswordThenPress(page, "Tangguhkan akun");
  await expect(page.getByText(/mungkin sudah berlaku/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Periksa keadaan akun" }).click();
  await expect(page.getByText("yang tercatat di server sekarang", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aktifkan ulang" })).toBeVisible();
  expect(sent).toBe(2); // the 423 and the one deliberate send; nothing resent by itself
});

test("an admin account sees no owner screen, and Laravel refuses the API", async ({ page }) => {
  const admin = await invitedAdmin("Admin Biasa");
  await signOutOwnerApi();
  expect((await admin.api.get("users")).status()).toBe(403);
  expect((await admin.api.get("audit-events")).status()).toBe(403);
  expect((await admin.api.write("POST", "auth/logout")).status()).toBe(204);
  await admin.api.dispose();

  await page.goto("/masuk");
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(admin.password);
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByLabel("Kode 6 digit").fill(await freshTotp(admin.secret));
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Beranda konsol" })).toBeVisible();

  const nav = await openNavigation(page);
  await expect(nav.getByRole("link", { name: "Pengguna" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Audit log" })).toHaveCount(0);

  for (const path of ["/pengguna", "/undangan/baru", "/audit"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Khusus owner" })).toBeVisible();
  }
});
