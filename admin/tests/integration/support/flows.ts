import { type APIRequestContext, type Page, expect, request } from "@playwright/test";
import { tokenOf } from "./backend";
import { ADMIN_ORIGIN } from "./env.mjs";
import { gotoWithSecret } from "./secrets";
import { freshTotp } from "./totp";

/**
 * A synthetic person: an @example.test address, a password generated for this run, and the
 * authenticator secret and recovery codes Laravel issued. Held in test memory only.
 */
export interface Person {
  email: string;
  password: string;
  secret: string;
  recoveryCodes: string[];
}

let sequence = 0;

/** A new synthetic address and a long random password (never a fixed default). */
export function newPerson(prefix: string): Pick<Person, "email" | "password"> {
  sequence += 1;
  const random = crypto.randomUUID().replaceAll("-", "");

  return {
    email: `${prefix}-${sequence}@example.test`,
    password: `e2e ${random.slice(0, 12)} ${random.slice(12, 24)}`,
  };
}

/** The admin API as a non-browser client: real cookies, the admin Origin, CSRF by token. */
export class AdminApi {
  private constructor(readonly context: APIRequestContext) {}

  static async create(): Promise<AdminApi> {
    return new AdminApi(
      await request.newContext({
        baseURL: `${ADMIN_ORIGIN}/api/v1/admin/`,
        extraHTTPHeaders: { Origin: ADMIN_ORIGIN, Accept: "application/json" },
      }),
    );
  }

  private async xsrf(): Promise<string> {
    const find = async () =>
      (await this.context.storageState()).cookies.find((cookie) => cookie.name === "XSRF-TOKEN");

    if ((await find()) === undefined) {
      expect((await this.context.get("auth/csrf-cookie")).status()).toBe(204);
    }

    return decodeURIComponent((await find())!.value);
  }

  get(path: string) {
    return this.context.get(path);
  }

  async write(method: "POST" | "PUT" | "DELETE", path: string, data?: unknown) {
    return this.context.fetch(path, {
      method,
      data,
      headers: { "X-XSRF-TOKEN": await this.xsrf() },
    });
  }

  dispose() {
    return this.context.dispose();
  }
}

/** Activation through the real API (fast setup for tests about something else). */
export async function activateThroughApi(
  link: string,
  who: Pick<Person, "email" | "password">,
  name = "E2E Owner",
): Promise<Person & { api: AdminApi }> {
  const api = await AdminApi.create();
  const token = tokenOf(link);
  const inspected = await api.write("POST", "access-links/inspect", { token });
  expect(inspected.status()).toBe(200);
  const requiresName = ((await inspected.json()) as { data: { requires_name: boolean } }).data
    .requires_name;

  const redeemed = await api.write("POST", "access-links/redeem", {
    token,
    ...(requiresName ? { name } : {}),
    password: who.password,
    password_confirmation: who.password,
  });
  expect(redeemed.status()).toBe(200);
  const secret = ((await redeemed.json()) as { data: { two_factor: { setup_key: string } } }).data
    .two_factor.setup_key;

  const confirmed = await api.write("POST", "access-links/confirm", {
    code: await freshTotp(secret),
  });
  expect(confirmed.status()).toBe(200);
  const recoveryCodes = ((await confirmed.json()) as { data: { recovery_codes: string[] } }).data
    .recovery_codes;

  return { ...who, secret, recoveryCodes, api };
}

/**
 * Activation or credential reset through the console, as a person would do it. Ends on the
 * console home after acknowledging the recovery codes. Returns what the screens showed.
 */
export async function activateThroughUi(
  page: Page,
  link: string,
  who: Pick<Person, "email" | "password">,
  { name = "E2E Owner", reset = false }: { name?: string; reset?: boolean } = {},
): Promise<Person> {
  await gotoWithSecret(page, link);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: reset ? "Atur ulang akses akun" : "Aktifkan akun admin",
    }),
  ).toBeVisible();

  if (!reset) {
    await page.getByLabel("Nama").fill(name);
  }

  await page.getByLabel("Kata sandi baru", { exact: true }).fill(who.password);
  await page.getByLabel("Ulangi kata sandi baru").fill(who.password);
  await page.getByRole("button", { name: "Simpan dan lanjut" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Daftarkan aplikasi autentikator" }),
  ).toBeVisible();
  const secret = (await page.locator('[aria-labelledby="setup-key-label"]').innerText()).replace(
    /\s/g,
    "",
  );

  await page.getByLabel("Kode 6 digit dari aplikasi").fill(await freshTotp(secret));
  await page
    .getByRole("button", {
      name: reset ? "Konfirmasi autentikator baru" : "Konfirmasi dan aktifkan akun",
    })
    .click();

  await expect(
    page.getByRole("heading", { level: 2, name: "Simpan kode pemulihan Anda" }),
  ).toBeVisible();
  const recoveryCodes = await page
    .getByRole("list", { name: "Kode pemulihan" })
    .locator("li .select-all")
    .allInnerTexts();

  await page.getByRole("checkbox", { name: /Saya sudah menyimpan kode ini/ }).check();
  await page.getByRole("button", { name: "Lanjut ke konsol" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Beranda konsol" })).toBeVisible();

  return { ...who, secret, recoveryCodes };
}

/** The password step only; ends on the code step. */
export async function passwordStep(page: Page, who: Pick<Person, "email" | "password">) {
  if (!new URL(page.url()).pathname.startsWith("/masuk")) {
    await page.goto("/masuk");
  }

  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Lanjut" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Masukkan kode autentikator" }),
  ).toBeVisible();
}

/** Full sign-in through the console with a fresh TOTP code. */
export async function signInThroughUi(page: Page, who: Person, landing = "Beranda konsol") {
  await passwordStep(page, who);
  await page.getByLabel("Kode 6 digit").fill(await freshTotp(who.secret));
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { level: 1, name: landing })).toBeVisible();
}

/**
 * An owner invitation through the real API (fast setup): password confirmation, then
 * `POST invitations`. Returns the one-time link, held in test memory only.
 */
export async function inviteThroughApi(
  owner: Pick<Person, "password"> & { api: AdminApi },
  email: string,
  role: "owner" | "admin" = "admin",
): Promise<string> {
  expect(
    (await owner.api.write("POST", "auth/confirm-password", { password: owner.password })).status(),
  ).toBe(201);
  const issued = await owner.api.write("POST", "invitations", { email, role });
  expect(issued.status()).toBe(201);

  return ((await issued.json()) as { data: { access_link: { url: string } } }).data.access_link.url;
}

/**
 * Collects Content-Security-Policy violations in the page (GSAP writes styles through the
 * CSSOM, which the production CSP allows; this proves it). Read with `cspViolations(page)`.
 */
export async function watchCsp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = seen;
    document.addEventListener("securitypolicyviolation", (event) =>
      seen.push(`${event.violatedDirective} ${event.blockedURI}`),
    );
  });
}

export const cspViolations = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? []);

/** The phone and tablet layouts hide the rail behind the menu. */
export async function openNavigation(page: Page) {
  if (page.viewportSize()!.width < 1024) {
    await page.getByRole("button", { name: "Menu" }).click();
  }

  return page.getByRole("navigation", { name: "Navigasi utama" });
}
