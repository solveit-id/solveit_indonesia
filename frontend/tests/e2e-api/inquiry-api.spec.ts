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

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The CORS answer of backend/config/cors.php for an allowed origin. */
const corsFor = (request: Request) => ({
  "Access-Control-Allow-Origin": request.headers()["origin"] ?? "*",
  "Access-Control-Allow-Methods": "GET, POST",
  "Access-Control-Allow-Headers": "Accept, Content-Type, Idempotency-Key, X-Requested-With",
  "Access-Control-Expose-Headers":
    "Idempotent-Replayed, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining",
  Vary: "Origin",
});

const keyOf = (request: Request) => request.headers()["idempotency-key"];

/** Answers the endpoint (and its CORS preflight) like the Laravel API would. */
async function mockApi(page: Page, reply: Reply, delayMs = 0) {
  const posts: Request[] = [];
  await page.route(`${MOCK_API_ORIGIN}/**`, async (route: Route) => {
    const request = route.request();
    const cors = corsFor(request);
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
  expect(keyOf(request)).toMatch(UUID_V4);
  expect(request.url()).not.toContain(keyOf(request)!);
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
  await mockApi(page, {
    status: 503,
    body: {
      message:
        "The inquiry could not be saved. Please try again later or contact us by WhatsApp or email.",
    },
  });
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

/**
 * A stateful stand-in for B2.1: it stores one row per new key, replays the
 * stored reference for the same key and content, and answers 409 for the
 * same key with other content. `lose` drops the response of those attempts
 * after the row is stored, like a connection that breaks on the way back.
 */
async function idempotentApi(page: Page, { lose = [] as number[] } = {}) {
  const posts: Request[] = [];
  const rows = new Map<string, { body: string; reference: string }>();
  const references = ["INQ-7K3M-9QX2-HD4T", "INQ-2B4D-6F8G-0H1J", "INQ-3C5E-7G9K-1M2N"];
  await page.route(`${MOCK_API_ORIGIN}/**`, async (route: Route) => {
    const request = route.request();
    const cors = corsFor(request);
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    posts.push(request);
    const key = keyOf(request);
    const body = request.postData() ?? "";
    const reply = (status: number, json: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { ...cors, ...headers },
        body: JSON.stringify(json),
      });
    if (!key || !UUID_V4.test(key)) return reply(400, { message: "Invalid Idempotency-Key." });
    const stored = rows.get(key);
    if (stored && stored.body !== body)
      return reply(409, { message: "This Idempotency-Key was already used." });
    if (stored)
      return reply(
        201,
        { id: stored.reference, status: "received" },
        { "Idempotent-Replayed": "true" },
      );
    const reference = references[rows.size]!;
    rows.set(key, { body, reference });
    if (lose.includes(posts.length)) return route.abort("connectionreset");
    return reply(201, { id: reference, status: "received" });
  });
  return { posts, rows };
}

const axeViolations = async (page: Page) =>
  (
    await new AxeBuilder({ page })
      .include("form")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations.map((violation) => violation.id);

for (const english of [false, true]) {
  const copy = english
    ? {
        path: "/en/contact?service=website",
        send: "Send through website",
        retry: "Retry the same request",
        uncertain: "The website has not confirmed your request.",
        received: "received and recorded by the website",
        replayed: "Your earlier attempt had already been recorded",
      }
    : {
        path: "/kontak?layanan=website",
        send: "Kirim melalui website",
        retry: "Kirim ulang permintaan yang sama",
        uncertain: "Website belum memberi konfirmasi.",
        received: "diterima dan dicatat",
        replayed: "Percobaan sebelumnya ternyata sudah tercatat",
      };

  test(`${english ? "English" : "Indonesian"}: a lost response is recovered with the same key`, async ({
    page,
  }) => {
    const api = await idempotentApi(page, { lose: [1] });
    await page.goto(copy.path);
    await fill(page, english);
    await page.getByRole("button", { name: copy.send }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(copy.uncertain);
    await expect(alert).toBeFocused();
    // Stored on the server, but the browser never heard back.
    expect(api.rows.size).toBe(1);
    await expect(page.getByText(/INQ-/)).toHaveCount(0);
    expect(await axeViolations(page)).toEqual([]);

    // Nothing is retried by itself.
    await page.waitForTimeout(1000);
    expect(api.posts).toHaveLength(1);

    await page.getByRole("button", { name: copy.retry }).click();
    const receipt = page.getByRole("status").filter({ hasText: copy.received });
    await expect(receipt).toContainText("INQ-7K3M-9QX2-HD4T");
    await expect(receipt).toContainText(copy.replayed);
    await expect(receipt).toBeFocused();
    expect(api.posts).toHaveLength(2);
    expect(keyOf(api.posts[1]!)).toBe(keyOf(api.posts[0]!));
    expect(api.posts[1]!.postData()).toBe(api.posts[0]!.postData());
    // Still exactly one stored inquiry, and its reference is the one shown.
    expect(api.rows.size).toBe(1);
    expect([...api.rows.values()][0]!.reference).toBe("INQ-7K3M-9QX2-HD4T");
    await expect(page.getByText("INQ-7K3M-9QX2-HD4T")).toHaveCount(1);
    expect(await axeViolations(page)).toEqual([]);
    expect(page.url()).not.toContain(keyOf(api.posts[0]!)!);
    expect(await opened(page)).toEqual([]);
  });
}

test("changed content after an unknown outcome becomes a new submission with a new key", async ({
  page,
}) => {
  const api = await idempotentApi(page, { lose: [1] });
  await page.goto("/kontak?layanan=website");
  await fill(page);
  await page.getByRole("button", { name: "Kirim melalui website" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Website belum memberi konfirmasi.");

  const message = page.getByLabel(/^Ceritakan kebutuhan Anda/);
  await message.fill("Kami ingin memindahkan pemesanan katering dan stok ke aplikasi web.");
  await expect(alert).toContainText("Isian sudah berubah sejak percobaan tadi");
  await expect(page.getByRole("button", { name: "Kirim ulang permintaan yang sama" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Kirim melalui website" }).click();
  const receipt = page.getByRole("status").filter({ hasText: "diterima dan dicatat" });
  await expect(receipt).toContainText("INQ-2B4D-6F8G-0H1J");
  await expect(receipt).not.toContainText("Percobaan sebelumnya");
  expect(api.posts).toHaveLength(2);
  expect(keyOf(api.posts[1]!)).toMatch(UUID_V4);
  expect(keyOf(api.posts[1]!)).not.toBe(keyOf(api.posts[0]!));
  // The server never saw one key with two different bodies.
  expect(api.rows.size).toBe(2);
});

test("separate submissions after a receipt get separate keys", async ({ page }) => {
  const api = await idempotentApi(page);
  await page.goto("/kontak?layanan=website");
  await fill(page);
  const send = page.getByRole("button", { name: "Kirim melalui website" });
  await send.click();
  await expect(page.getByRole("status").filter({ hasText: "diterima" })).toContainText(
    "INQ-7K3M-9QX2-HD4T",
  );
  await expect(send).toBeDisabled();
  await page.getByLabel(/^Bisnis atau organisasi/).fill("Katering Sari Rasa");
  await send.click();
  await expect(page.getByRole("status").filter({ hasText: "diterima" })).toContainText(
    "INQ-2B4D-6F8G-0H1J",
  );
  expect(api.posts).toHaveLength(2);
  expect(keyOf(api.posts[1]!)).not.toBe(keyOf(api.posts[0]!));
  expect(api.rows.size).toBe(2);
});

test("a retry cannot be doubled by quick clicks", async ({ page }) => {
  const api = await idempotentApi(page, { lose: [1] });
  await page.goto("/kontak?layanan=website");
  await fill(page);
  await page.getByRole("button", { name: "Kirim melalui website" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Kirim ulang permintaan yang sama" }).dblclick();
  await expect(page.getByRole("status").filter({ hasText: "diterima" })).toContainText(
    "INQ-7K3M-9QX2-HD4T",
  );
  expect(api.posts).toHaveLength(2);
  expect(api.rows.size).toBe(1);
});

test("a 409 is explained without server text and never retried by itself", async ({ page }) => {
  const posts = await mockApi(page, {
    status: 409,
    body: { message: "This Idempotency-Key was already used for a different inquiry." },
  });
  await page.goto("/kontak?layanan=website");
  await fill(page);
  await page.getByRole("button", { name: "Kirim melalui website" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("bertabrakan dengan permintaan yang tercatat sebelumnya");
  await expect(page.getByText(/Idempotency-Key/)).toHaveCount(0);
  await expect(page.getByText(/INQ-/)).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(posts).toHaveLength(1);
  await page.getByRole("button", { name: "Kirim melalui website" }).click();
  await expect.poll(() => posts.length).toBe(2);
  expect(keyOf(posts[1]!)).not.toBe(keyOf(posts[0]!));
});

test("a gateway 503 is an unknown outcome, not a refusal", async ({ page }) => {
  await page.route(`${MOCK_API_ORIGIN}/**`, async (route) => {
    const cors = corsFor(route.request());
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({
      status: 503,
      contentType: "text/html",
      headers: cors,
      body: "<html><body>503 Service Temporarily Unavailable</body></html>",
    });
  });
  await page.goto("/kontak?layanan=website");
  await fill(page);
  await page.getByRole("button", { name: "Kirim melalui website" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Website belum memberi konfirmasi.");
  await expect(alert).not.toContainText("belum tercatat");
  await expect(
    page.getByRole("button", { name: "Kirim ulang permintaan yang sama" }),
  ).toBeVisible();
});
