import AxeBuilder from "@axe-core/playwright";
import type { Request, Route } from "@playwright/test";
import { MOCK_API_ORIGIN } from "../../playwright.api.config";
import { expect, type Page, test } from "../e2e/fixtures";

/**
 * The API-enabled build (playwright.api.config.ts). Every call to the API
 * origin is answered here; no request leaves the browser and no real inquiry
 * data is used. Real HTTP integration with Laravel and MySQL is a separate
 * check (docs/qa/qa-report.md).
 */
const ENDPOINT = `${MOCK_API_ORIGIN}/api/v1/inquiries`;
const REFERENCE = "INQ-7K3M-9QX2-HD4T";

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | "abort";

/** Answers the endpoint (and its CORS preflight) like the Laravel API would. */
async function mockApi(page: Page, reply: Reply, delayMs = 0) {
  const posts: Request[] = [];
  await page.route(`${MOCK_API_ORIGIN}/**`, async (route: Route) => {
    const request = route.request();
    const origin = request.headers()["origin"] ?? "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Accept, Content-Type, X-Requested-With",
      "Access-Control-Expose-Headers": "Retry-After",
      Vary: "Origin",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    posts.push(request);
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (reply === "abort") return route.abort("connectionreset");
    return route.fulfill({
      status: reply.status,
      contentType: "application/json",
      headers: { ...cors, ...reply.headers },
      body: JSON.stringify(reply.body ?? {}),
    });
  });
  return posts;
}

async function fill(page: Page, english = false) {
  await page.getByLabel(english ? /^Name/ : /^Nama/).fill("Rina Wulandari");
  await page
    .getByLabel(english ? /^Email or WhatsApp number/ : /^Email atau nomor WhatsApp/)
    .fill("rina@example.com");
  await page
    .getByLabel(english ? /^Tell us what you need/ : /^Ceritakan kebutuhan Anda/)
    .fill("Kami ingin memindahkan pemesanan katering ke aplikasi web.");
}

test.beforeEach(async ({ page }) => {
  // Record window.open calls instead of leaving the site.
  await page.addInitScript(() => {
    const log = window as unknown as { __opened: string[] };
    log.__opened = [];
    window.open = ((url?: string | URL) => {
      log.__opened.push(String(url));
      return null;
    }) as typeof window.open;
  });
});

const opened = (page: Page) =>
  page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);

test("the enabled build offers the website channel and explains it", async ({ page }) => {
  const posts = await mockApi(page, { status: 500 });
  await page.goto("/kontak");
  await expect(page.getByRole("button", { name: "Kirim melalui website" })).toBeEnabled();
  await expect(page.getByText(/isian formulir dikirim ke server Solveit/)).toBeVisible();
  await expect(page.getByText(/Hanya untuk kirim lewat WhatsApp/)).toBeVisible();
  // The honeypot is in the form but not visible or focusable for people.
  const honeypot = page.locator('input[name="homepage"]');
  await expect(honeypot).toHaveValue("");
  await expect(honeypot).not.toBeInViewport();
  expect(posts).toHaveLength(0);
});

test("a 201 shows the real reference after exactly one POST", async ({ page }) => {
  const posts = await mockApi(
    page,
    { status: 201, body: { id: REFERENCE, status: "received" } },
    400,
  );
  await page.goto("/kontak?layanan=aplikasi-web");
  await fill(page);
  const send = page.getByRole("button", { name: "Kirim melalui website" });
  // Two quick clicks: the second lands while the first is in flight.
  await send.dblclick();
  await expect(page.getByRole("button", { name: "Mengirim..." })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  const receipt = page.getByRole("status").filter({ hasText: "diterima dan dicatat" });
  await expect(receipt).toContainText(REFERENCE);
  await expect(receipt).toBeFocused();
  expect(posts).toHaveLength(1);
  const request = posts[0]!;
  expect(request.url()).toBe(ENDPOINT);
  expect(request.method()).toBe("POST");
  expect(request.headers()["content-type"]).toBe("application/json");
  expect(request.headers()["accept"]).toBe("application/json");
  expect(request.headers()["cookie"]).toBeUndefined();
  expect(request.postDataJSON()).toEqual({
    name: "Rina Wulandari",
    organization: "",
    contact: "rina@example.com",
    service: "aplikasi-web",
    budget: "belum-tahu",
    timeline: "fleksibel",
    message: "Kami ingin memindahkan pemesanan katering ke aplikasi web.",
    homepage: "",
  });
  // Nothing personal ends up in the page URL, and the button cannot resend.
  expect(page.url()).not.toContain("Rina");
  await expect(page.getByRole("button", { name: "Kirim melalui website" })).toBeDisabled();
  expect(await opened(page)).toEqual([]);
  // The receipt state passes axe.
  const results = await new AxeBuilder({ page })
    .include("form")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

test("English: server validation becomes field errors and values stay", async ({ page }) => {
  await mockApi(page, {
    status: 422,
    body: {
      message: "The given data was invalid.",
      errors: { name: ["The name field must not be greater than 120 characters."] },
    },
  });
  await page.goto("/en/contact?service=website");
  await fill(page, true);
  await page.getByRole("button", { name: "Send through website" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("The website could not accept 1 field.");
  const name = page.getByLabel(/^Name/);
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveValue("Rina Wulandari");
  await expect(name).toHaveAccessibleDescription(/The website could not accept this entry/);
  await expect(page.getByText(/greater than 120/)).toHaveCount(0);
});

test("a 503 is explained, the form is kept, and nothing opens by itself", async ({ page }) => {
  await mockApi(page, { status: 503, body: { message: "The inquiry could not be saved." } });
  await page.goto("/kontak?layanan=website");
  await fill(page);
  await page.getByRole("button", { name: "Kirim melalui website" }).click();
  await expect(page.getByRole("alert")).toContainText("permintaan ini belum tercatat");
  await expect(page.getByLabel(/^Nama/)).toHaveValue("Rina Wulandari");
  expect(await opened(page)).toEqual([]);
  // The visitor can still choose WhatsApp themselves.
  await page.getByRole("button", { name: "Kirim lewat WhatsApp" }).click();
  const urls = await opened(page);
  expect(urls).toHaveLength(1);
  expect(urls[0]).toContain("https://wa.me/6287759641358?text=");
});

test("email stays a separate choice and never calls the API", async ({ page, browserName }) => {
  test.skip(
    browserName === "webkit",
    "WebKit hands mailto: to the system mail handler, which replaces the page under test.",
  );
  const posts = await mockApi(page, { status: 500 });
  await page.goto("/kontak?layanan=website");
  await fill(page);
  await page.getByRole("button", { name: "Kirim lewat email" }).click();
  const status = page.getByRole("status").filter({ hasText: "Aplikasi email dibuka" });
  await expect(status.getByRole("link", { name: "Buka lagi" })).toHaveAttribute(
    "href",
    /^mailto:solveit\.team\.id@gmail\.com\?subject=/,
  );
  expect(posts).toHaveLength(0);
});

test("a 429 explains the wait from Retry-After", async ({ page }) => {
  await mockApi(page, {
    status: 429,
    body: { message: "Too Many Attempts." },
    headers: { "Retry-After": "120" },
  });
  await page.goto("/kontak?layanan=website");
  await fill(page);
  await page.getByRole("button", { name: "Kirim melalui website" }).click();
  await expect(page.getByRole("alert")).toContainText("Coba lagi dalam sekitar 2 menit");
});

test("a dropped connection is an unknown outcome, never a success", async ({ page }) => {
  const posts = await mockApi(page, "abort");
  await page.goto("/kontak?layanan=website");
  await fill(page);
  await page.getByRole("button", { name: "Kirim melalui website" }).click();
  await expect(page.getByRole("alert")).toContainText("mungkin sudah sampai ke server");
  await expect(page.getByText(/INQ-/)).toHaveCount(0);
  expect(posts).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Kirim melalui website" })).toBeEnabled();
});

test("feedback never makes the page scroll sideways", async ({ page }) => {
  await mockApi(page, "abort");
  await page.goto("/kontak?layanan=website");
  await fill(page);
  await page.getByRole("button", { name: "Kirim melalui website" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
