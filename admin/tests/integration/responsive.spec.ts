import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { bootstrapOwner, resetBackend } from "./support/backend";
import {
  activateThroughApi,
  inviteThroughApi,
  newPerson,
  passwordStep,
  signInThroughUi,
} from "./support/flows";
import { gotoWithSecret } from "./support/secrets";

/**
 * The real screens (Laravel's answers, not mocks) at desktop, tablet, and phone widths: no
 * axe violations (WCAG 2.2 AA tags) and no sideways scrolling. Runs in all three projects.
 */
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function check(page: Page, label: string) {
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
    label,
  ).toEqual([]);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} scrolls sideways`).toBeLessThanOrEqual(0);
}

test.beforeEach(() => resetBackend());

test("sign-in, access-link, and enrollment screens", async ({ page }) => {
  const person = newPerson("owner");
  await page.goto("/masuk");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await check(page, "sign-in");

  await gotoWithSecret(page, bootstrapOwner(person.email));
  await page.getByLabel("Nama").waitFor();
  await check(page, "activation form");

  await page.getByLabel("Nama").fill("E2E Owner");
  await page.getByLabel("Kata sandi baru", { exact: true }).fill(person.password);
  await page.getByLabel("Ulangi kata sandi baru").fill(person.password);
  await page.getByRole("button", { name: "Simpan dan lanjut" }).click();
  await page.getByRole("img", { name: /Kode QR/ }).waitFor();
  await check(page, "enrollment");

  await page.goto("/access");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await check(page, "access without a link");
});

test("signed-in screens and the code step", async ({ page }) => {
  const person = newPerson("owner");
  const owner = await activateThroughApi(bootstrapOwner(person.email), person);
  await owner.api.dispose();

  await passwordStep(page, owner);
  await check(page, "code step");

  await page.goto("/masuk");
  await signInThroughUi(page, owner);
  await check(page, "home");

  for (const [path, heading] of [
    ["/akun", "Akun"],
    ["/akun/keamanan", "Keamanan akun"],
  ] as const) {
    await page.goto(path);
    await page.getByRole("heading", { level: 1, name: heading }).waitFor();
    if (path === "/akun/keamanan") await page.getByText("Perangkat ini").waitFor();
    await check(page, path);
  }
});

test("owner screens with real accounts, invitations, and audit events", async ({ page }) => {
  const person = newPerson("owner");
  const owner = await activateThroughApi(bootstrapOwner(person.email), person, "Owner Utama");
  const invitee = newPerson("admin");
  const admin = await activateThroughApi(
    await inviteThroughApi(owner, invitee.email),
    invitee,
    "Admin dengan nama yang cukup panjang untuk baris tabel",
  );
  await inviteThroughApi(owner, newPerson("pending").email);
  await admin.api.dispose();
  expect((await owner.api.write("POST", "auth/logout")).status()).toBe(204);
  await owner.api.dispose();

  await signInThroughUi(page, owner);

  for (const [path, heading] of [
    ["/pengguna", "Pengguna"],
    ["/undangan", "Undangan"],
    ["/undangan/baru", "Undang admin"],
    ["/audit", "Audit log"],
  ] as const) {
    await page.goto(path);
    await page.getByRole("heading", { level: 1, name: heading }).waitFor();
    await expect(page.getByRole("status").filter({ hasText: /^Memuat/ })).toHaveCount(0);
    await check(page, path);
  }

  await page.goto("/pengguna");
  await page.getByRole("link", { name: /Admin dengan nama/ }).click();
  await page.getByRole("heading", { name: "Aktivitas terbaru" }).waitFor();
  await expect(page.getByRole("heading", { name: "Undangan diterbitkan" }).first()).toBeVisible();
  await check(page, "account detail");
});
