import { type Cookie, type Page, expect, test } from "@playwright/test";
import {
  activateThroughUi,
  cspViolations,
  newPerson,
  openNavigation,
  signInThroughUi,
  watchCsp,
} from "../integration/support/flows";
import { assertNoSecretsStored } from "../integration/support/secrets";
import { PRODUCTION_ADMIN_ORIGIN, bootstrapOwner, productionAdminHost } from "./support/stack";

/**
 * `GET me` from inside the page: the browser's own cookies, resolver, and TLS session. (The
 * Node-side request context would not resolve the test host, and its errors print cookies.)
 */
const meStatus = (page: Page) =>
  page.evaluate(async () => (await fetch("/api/v1/admin/me", { cache: "no-store" })).status);

/** Cookie attributes without the value, so a failure message never prints a session. */
const attributesOf = (cookies: Cookie[], name: string) => {
  const cookie = cookies.find((entry) => entry.name === name);

  return (
    cookie && {
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      expires: cookie.expires,
    }
  );
};

/**
 * B3.2d: the production admin image behind the private admin listener, over real TLS, against
 * Laravel and MySQL in the production images (synthetic stack, playwright.production.config.ts).
 * One journey, because the owner bootstrap works once per database: activation with TOTP
 * enrollment, the __Host- session cookie, the production headers as the browser received them,
 * an owner screen loaded lazily under the CSP, sign-out, and sign-in with password and TOTP.
 */
test("the first owner activates, signs out, and signs in with password and TOTP over TLS", async ({
  page,
  context,
}) => {
  await watchCsp(page);
  const who = newPerson("production-owner");
  const link = bootstrapOwner(who.email);

  const document = await page.goto("/masuk");
  expect(document?.status()).toBe(200);
  const headers = document!.headers();
  expect(headers["content-security-policy"]).toContain("script-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).not.toMatch(/unsafe-(inline|eval)/);
  expect(headers["strict-transport-security"]).toBe("max-age=31536000");
  expect(headers["referrer-policy"]).toBe("same-origin");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["cache-control"]).toBe("no-store");
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);

  const owner = await activateThroughUi(page, link, who, { name: "Production Owner" });
  expect(new URL(page.url()).origin).toBe(PRODUCTION_ADMIN_ORIGIN);

  const cookies = await context.cookies();
  const session = cookies.find((cookie) => cookie.name === "__Host-solveit-admin-session")?.value;
  expect(attributesOf(cookies, "__Host-solveit-admin-session")).toEqual({
    domain: productionAdminHost(),
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Strict",
    expires: -1,
  });
  expect(attributesOf(cookies, "solveit-admin-session")).toBeUndefined();
  expect(attributesOf(cookies, "XSRF-TOKEN")).toMatchObject({
    domain: productionAdminHost(),
    secure: true,
    httpOnly: false,
    sameSite: "Strict",
  });

  // An owner screen: a lazy chunk and the owner API, both under the production CSP.
  await (await openNavigation(page)).getByRole("link", { name: "Pengguna" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pengguna" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Production Owner" }).first()).toBeVisible();

  await page.locator("aside").getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/masuk\?alasan=keluar$/);
  expect(await meStatus(page)).toBe(401);

  await signInThroughUi(page, owner);
  const signedIn = (await context.cookies()).find(
    (cookie) => cookie.name === "__Host-solveit-admin-session",
  )?.value;
  expect(signedIn !== undefined && signedIn !== session, "a new session ID after sign-in").toBe(
    true,
  );
  expect(await meStatus(page)).toBe(200);

  await assertNoSecretsStored(page, context, [
    owner.password,
    owner.secret,
    ...owner.recoveryCodes,
    new URL(link).hash,
  ]);
  expect(await cspViolations(page)).toEqual([]);
});
