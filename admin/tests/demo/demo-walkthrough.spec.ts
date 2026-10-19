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
import { EMULATED_VISITOR_ADDRESS } from "./support/edge";
import { bootstrapDemoOwner, demoTarget } from "./support/stack";

const target = demoTarget();
const adminHost = new URL(target.origin).hostname;

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
    }
  );
};

/** The owner's audit events as the API gives them to the page (owners see IP addresses). */
const auditFromPage = (page: Page) =>
  page.evaluate(async () => {
    const response = await fetch("/api/v1/admin/audit-events?per_page=100", { cache: "no-store" });

    return (await response.json()) as {
      data: { action: string; actor: { user_id: number | null }; ip_address: string | null }[];
    };
  });

/**
 * B5a: the presentation path of the team demo on the stack manage-demo.sh started, in the mode
 * it is in (local for screen sharing, or tunnel mode behind the edge stand-in). The owner is
 * created with the runbook's command; the seeded synthetic inbox, history, notes, and audit are
 * what the walkthrough shows; one status change and a sign-in prove that writes, CSRF, Origin,
 * and the __Host- session work on this origin.
 */
test(`the demo walkthrough works end to end in ${target.mode} mode`, async ({ page, context }) => {
  if (target.mode === "tunnel") {
    // A visitor's own X-Forwarded-For: Cloudflare (here the edge stand-in) appends the real
    // address after it, and the listener takes only the last one from the trusted path.
    await context.setExtraHTTPHeaders({ "X-Forwarded-For": "203.0.113.50" });
  }
  await watchCsp(page);
  const who = newPerson(`demo-${target.mode}`);
  const link = bootstrapDemoOwner(who.email);

  const document = await page.goto("/masuk");
  expect(document?.status()).toBe(200);
  const headers = document!.headers();
  expect(headers["content-security-policy"]).toContain("script-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["cache-control"]).toBe("no-store");
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);

  const owner = await activateThroughUi(page, link, who, { name: "Pemilik Demo" });
  expect(new URL(page.url()).origin).toBe(target.origin);
  const cookies = await context.cookies();
  expect(attributesOf(cookies, "__Host-solveit-admin-session")).toEqual({
    domain: adminHost,
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Strict",
  });
  expect(attributesOf(cookies, "XSRF-TOKEN")).toMatchObject({ secure: true, sameSite: "Strict" });

  // The seeded inbox: six synthetic inquiries in every status, newest first.
  await (await openNavigation(page)).getByRole("link", { name: "Inquiry" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Inquiry" })).toBeVisible();
  const table = page.getByRole("table", { name: "Daftar inquiry" });
  await expect(table.getByRole("row")).toHaveCount(7);
  await expect(table.getByRole("row").nth(1)).toContainText("Contoh Pengirim Satu");
  for (const status of ["Baru", "Ditinjau", "Dihubungi", "Selesai"]) {
    await expect(table.getByText(status, { exact: true }).first()).toBeVisible();
  }
  expect(await page.content()).not.toMatch(/@example\.test/);

  // A contacted inquiry: masked contact, its history and notes by the demo persona.
  await table.getByRole("link", { name: "Contoh Pengirim Empat" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Contoh Pengirim Empat" }),
  ).toBeVisible();
  const history = page.getByRole("region", { name: "Riwayat status" });
  await expect(history.getByText("Baru ke Ditinjau")).toBeVisible();
  await expect(history.getByText("Ditinjau ke Dihubungi")).toBeVisible();
  await expect(history.getByText(/Operator Demo/).first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Catatan internal" }).getByText(/Panggilan pertama selesai/),
  ).toBeVisible();
  expect(await page.content()).not.toContain("pengirim.empat@example.test");

  // One real write on this origin: compare and set from the screen's status.
  await page.goBack();
  await table.getByRole("link", { name: "Contoh Pengirim Satu" }).click();
  await page.getByRole("button", { name: "Tandai ditinjau" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tandai ditinjau" }).click();
  await expect(page.getByText("Status inquiry sekarang Ditinjau.")).toBeVisible();

  // The audit log: the persona's reveals and changes, and this owner's own events.
  await (await openNavigation(page)).getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByRole("heading", { name: "Kontak inquiry dibuka" }).first()).toBeVisible();
  const audit = await auditFromPage(page);
  const actions = new Set(audit.data.map((event) => event.action));
  for (const action of [
    "inquiry.status-changed",
    "inquiry.note-added",
    "inquiry.contact-revealed",
    "owner.bootstrap-issued",
  ]) {
    expect(actions.has(action), action).toBe(true);
  }
  const ownEvents = audit.data.filter((event) => event.ip_address !== null);
  expect(ownEvents.length).toBeGreaterThan(0);
  if (target.mode === "tunnel") {
    // The listener trusted only the cloudflared path and took the visitor's address, never the
    // address the visitor claimed.
    expect(new Set(ownEvents.map((event) => event.ip_address))).toEqual(
      new Set([EMULATED_VISITOR_ADDRESS]),
    );
  }

  // Sign out and back in with password and a fresh TOTP code.
  await page.locator("aside").getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/masuk\?alasan=keluar$/);
  await signInThroughUi(page, owner);

  await assertNoSecretsStored(page, context, [
    owner.password,
    owner.secret,
    ...owner.recoveryCodes,
    new URL(link).hash,
  ]);
  expect(await cspViolations(page)).toEqual([]);
});
