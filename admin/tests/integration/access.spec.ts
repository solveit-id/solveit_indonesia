import { expect, test } from "@playwright/test";
import {
  bootstrapOwner,
  resetBackend,
  resetCredentials,
  setServerClock,
  tokenOf,
} from "./support/backend";
import { ADMIN_ORIGIN } from "./support/env.mjs";
import {
  activateThroughApi,
  activateThroughUi,
  newPerson,
  passwordStep,
  signInThroughUi,
} from "./support/flows";
import { assertAbsent, assertNoSecretsStored, gotoWithSecret } from "./support/secrets";
import { freshTotp } from "./support/totp";

/** Real Laravel on the MySQL testing database; links come from the real shell commands. */
test.beforeEach(() => resetBackend());
test.afterEach(() => setServerClock(0));

test("activation: fragment removed, QR as image, setup key, codes shown once, then signed in", async ({
  page,
  context,
}) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  const person = newPerson("owner");
  const link = bootstrapOwner(person.email);
  const token = tokenOf(link);

  await gotoWithSecret(page, link);

  // The token left the address bar and the history entry at once.
  await expect(page.getByRole("heading", { level: 1, name: "Aktifkan akun admin" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/access");
  expect(new URL(page.url()).hash).toBe("");
  assertAbsent(
    await page.evaluate(() => location.href + JSON.stringify(history.state)),
    [token],
    "the address",
  );
  // The masked address Laravel returned, never the full one.
  await expect(page.getByText(/^o\*\*\*@example\.test$/)).toBeVisible();

  await page.getByLabel("Nama").fill("E2E Owner");
  await page.getByLabel("Kata sandi baru", { exact: true }).fill(person.password);
  await page.getByLabel("Ulangi kata sandi baru").fill(person.password);
  await page.getByRole("button", { name: "Simpan dan lanjut" }).click();

  const qr = page.getByRole("img", { name: /Kode QR untuk mendaftarkan/ });
  await expect(qr).toBeVisible();
  const qrInfo = await qr.evaluate((image: HTMLImageElement) => ({
    tag: image.tagName,
    scheme: image.src.startsWith("data:image/svg+xml;charset=utf-8,"),
    rendered: image.complete && image.naturalWidth > 0,
  }));
  expect(qrInfo).toEqual({ tag: "IMG", scheme: true, rendered: true });
  // Laravel's SVG is never injected as markup.
  // (The page's own icons are small inline SVGs; a QR has hundreds of shapes.)
  const largestInlineSvg = await page.evaluate(() =>
    Math.max(
      0,
      ...[...document.querySelectorAll("svg")].map((svg) => svg.querySelectorAll("*").length),
    ),
  );
  expect(largestInlineSvg).toBeLessThan(40);

  const secret = (await page.locator('[aria-labelledby="setup-key-label"]').innerText()).replace(
    /\s/g,
    "",
  );
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);

  await page.getByLabel("Kode 6 digit dari aplikasi").fill(await freshTotp(secret));
  await page.getByRole("button", { name: "Konfirmasi dan aktifkan akun" }).click();

  const list = page.getByRole("list", { name: "Kode pemulihan" });
  await expect(list).toBeVisible();
  const codes = await list.locator("li .select-all").allInnerTexts();
  expect(codes).toHaveLength(8);
  await assertNoSecretsStored(page, context, [token, secret, person.password, ...codes]);
  expect(violations).toEqual([]);

  // Leaving before acknowledging is interrupted, and the codes stay.
  await page.getByRole("button", { name: "Lanjut ke konsol" }).click();
  await expect(page.getByText("Centang konfirmasi di atas setelah kode tersimpan.")).toBeVisible();

  await page.getByRole("checkbox", { name: /Saya sudah menyimpan kode ini/ }).check();
  await page.getByRole("button", { name: "Lanjut ke konsol" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Beranda konsol" })).toBeVisible();

  // The codes are gone for good: /access has nothing to show, and nothing was stored.
  await page.goto("/access");
  await expect(
    page.getByRole("heading", { level: 1, name: "Tautan akses tidak lengkap" }),
  ).toBeVisible();
  assertAbsent(await page.locator("body").innerText(), codes, "the access page after reload");
  await assertNoSecretsStored(page, context, [token, secret, person.password, ...codes]);

  // The account is active and this browser is signed in.
  await page.goto("/akun");
  await expect(page.getByText(person.email)).toBeVisible();
  await expect(page.getByText("8 kode tersisa")).toBeVisible();
});

test("a used, unknown, or expired link gets one answer, and no form", async ({ page, browser }) => {
  const person = newPerson("owner");
  const link = bootstrapOwner(person.email);
  await activateThroughUi(page, link, person);

  for (const candidate of [link, `${ADMIN_ORIGIN}/access#token=${"Z".repeat(43)}`]) {
    const fresh = await browser.newContext();
    const visitor = await fresh.newPage();
    await gotoWithSecret(visitor, candidate);
    await expect(
      visitor.getByRole("heading", { level: 1, name: "Tautan ini tidak dapat dipakai" }),
    ).toBeVisible();
    await expect(visitor.getByLabel("Kata sandi baru", { exact: true })).toHaveCount(0);
    await fresh.close();
  }

  // Expired: a new shell link (the account's reset), then 31 minutes on Laravel's clock.
  const reset = resetCredentials(person.email);
  setServerClock(31 * 60);
  const fresh = await browser.newContext();
  const visitor = await fresh.newPage();
  await gotoWithSecret(visitor, reset);
  await expect(
    visitor.getByRole("heading", { level: 1, name: "Tautan ini tidak dapat dipakai" }),
  ).toBeVisible();
  await fresh.close();
});

test("an interrupted enrollment never shows the setup key again and needs a new link", async ({
  page,
}) => {
  const person = newPerson("owner");
  const link = bootstrapOwner(person.email);
  await gotoWithSecret(page, link);
  await page.getByLabel("Nama").fill("E2E Owner");
  await page.getByLabel("Kata sandi baru", { exact: true }).fill(person.password);
  await page.getByLabel("Ulangi kata sandi baru").fill(person.password);
  await page.getByRole("button", { name: "Simpan dan lanjut" }).click();
  await expect(page.getByRole("img", { name: /Kode QR/ })).toBeVisible();

  // Reload: the key was only in memory.
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Tautan akses tidak lengkap" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /Kode QR/ })).toHaveCount(0);

  // The link itself is used up. Opened afresh, as from the message it came in (from /access a
  // fragment-only change would not reload the page).
  await page.goto("about:blank");
  await gotoWithSecret(page, link);
  await expect(
    page.getByRole("heading", { level: 1, name: "Tautan ini tidak dapat dipakai" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Cara mendapatkan tautan baru" }),
  ).toBeVisible();
});

test("an enrollment past its 15 minutes says a new link is needed", async ({ page }) => {
  const person = newPerson("owner");
  await gotoWithSecret(page, bootstrapOwner(person.email));
  await page.getByLabel("Nama").fill("E2E Owner");
  await page.getByLabel("Kata sandi baru", { exact: true }).fill(person.password);
  await page.getByLabel("Ulangi kata sandi baru").fill(person.password);
  await page.getByRole("button", { name: "Simpan dan lanjut" }).click();
  const secret = (await page.locator('[aria-labelledby="setup-key-label"]').innerText()).replace(
    /\s/g,
    "",
  );

  setServerClock(16 * 60);
  await page.getByLabel("Kode 6 digit dari aplikasi").fill(await freshTotp(secret));
  await page.getByRole("button", { name: "Konfirmasi dan aktifkan akun" }).click();

  await expect(page.getByText(/Pendaftaran ini tidak dapat diselesaikan/)).toBeVisible();
  await expect(page.locator('[aria-labelledby="setup-key-label"]')).toHaveCount(0);
});

test("credential reset replaces password and authenticator; the old ones stop working", async ({
  page,
  browser,
}) => {
  const person = newPerson("owner");
  const before = await activateThroughApi(bootstrapOwner(person.email), person);
  await before.api.dispose();

  const replacement = { email: person.email, password: newPerson("x").password };
  const after = await activateThroughUi(page, resetCredentials(person.email), replacement, {
    reset: true,
  });
  expect(after.secret).not.toBe(before.secret);

  const fresh = await browser.newContext();
  const visitor = await fresh.newPage();
  await visitor.goto("/masuk");
  await visitor.getByLabel("Email").fill(person.email);
  await visitor.getByLabel("Kata sandi", { exact: true }).fill(before.password);
  await visitor.getByRole("button", { name: "Lanjut" }).click();
  await expect(visitor.getByRole("alert")).toContainText("Email atau kata sandi tidak cocok");

  // An old recovery code no longer signs in either.
  await passwordStep(visitor, replacement);
  await visitor.getByRole("button", { name: "Pakai kode pemulihan" }).click();
  await visitor.getByLabel("Kode pemulihan").fill(before.recoveryCodes[0]!);
  await visitor.getByRole("button", { name: "Masuk" }).click();
  await expect(
    visitor.getByText("Kode pemulihan tidak cocok atau sudah pernah dipakai."),
  ).toBeVisible();

  await visitor.getByRole("button", { name: "Pakai kode autentikator" }).click();
  await visitor.getByLabel("Kode 6 digit").fill(await freshTotp(after.secret));
  await visitor.getByRole("button", { name: "Masuk" }).click();
  await expect(visitor.getByRole("heading", { level: 1, name: "Beranda konsol" })).toBeVisible();
  await fresh.close();
});

test("an invited admin activates, sees their own account only, and owner routes answer 403", async ({
  page,
}) => {
  const ownerPerson = newPerson("owner");
  const owner = await activateThroughApi(bootstrapOwner(ownerPerson.email), ownerPerson);
  expect(
    (await owner.api.write("POST", "auth/confirm-password", { password: owner.password })).status(),
  ).toBe(201);
  const admin = newPerson("admin");
  const invitation = await owner.api.write("POST", "invitations", {
    email: admin.email,
    role: "admin",
  });
  expect(invitation.status()).toBe(201);
  const inviteLink = ((await invitation.json()) as { data: { access_link: { url: string } } }).data
    .access_link.url;
  await owner.api.dispose();

  await activateThroughUi(page, inviteLink, admin, { name: "E2E Admin" });
  await expect(page.getByText("Anda masuk sebagai E2E Admin, Admin.")).toBeVisible();
  await page.goto("/akun");
  await expect(page.getByText("Mengelola keamanan akun sendiri.")).toBeVisible();

  // Laravel stays the authority: an owner route refuses this session.
  const users = await page.request.get("/api/v1/admin/users");
  expect(users.status()).toBe(403);
});

test("a link opened while signed in asks to sign out first, then checks the same link", async ({
  page,
}) => {
  const ownerPerson = newPerson("owner");
  const owner = await activateThroughApi(bootstrapOwner(ownerPerson.email), ownerPerson);
  expect(
    (await owner.api.write("POST", "auth/confirm-password", { password: owner.password })).status(),
  ).toBe(201);
  const invitation = await owner.api.write("POST", "invitations", {
    email: newPerson("admin").email,
    role: "admin",
  });
  const inviteLink = ((await invitation.json()) as { data: { access_link: { url: string } } }).data
    .access_link.url;
  await owner.api.dispose();
  await signInThroughUi(page, owner);

  await gotoWithSecret(page, inviteLink);

  await expect(
    page.getByRole("heading", { level: 1, name: "Anda sedang masuk di browser ini" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keluar dan lanjutkan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Aktifkan akun admin" })).toBeVisible();
  expect((await page.request.get("/api/v1/admin/me")).status()).toBe(401);
});
