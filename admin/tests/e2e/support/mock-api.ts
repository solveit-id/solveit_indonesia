import type { Page, Route } from "@playwright/test";

/**
 * MOCKED admin API answers for the reference-build suite (tests/e2e). They exercise layout,
 * accessibility, themes, and headers with synthetic data and say nothing about Laravel; the
 * real API is tested by tests/integration against Laravel on the MySQL testing database.
 */
export const mockAccount = {
  id: 1,
  name: "Contoh Owner",
  email: "owner@example.test",
  role: "owner",
  permissions: ["account.manage-own"],
  two_factor: { confirmed_at: "2026-10-16T05:31:00+00:00", recovery_codes_remaining: 8 },
  session: {
    signed_in_at: "2026-10-17T01:00:00+00:00",
    absolute_expires_at: "2099-10-17T13:00:00+00:00",
    idle_timeout_minutes: 30,
  },
};

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Every admin request answers 401: nobody is signed in. */
export async function mockSignedOut(page: Page) {
  await page.route("**/api/v1/admin/**", (route) => {
    if (route.request().url().endsWith("/auth/csrf-cookie")) {
      return route.fulfill({
        status: 204,
        headers: { "Set-Cookie": "XSRF-TOKEN=mocked-token; Path=/; SameSite=Strict" },
      });
    }

    return json(route, 401, { message: "Unauthenticated." });
  });
}

/** A verified synthetic account with two sessions. */
export async function mockSignedIn(page: Page) {
  await page.route("**/api/v1/admin/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1/admin/", "");

    if (path === "me") {
      return json(route, 200, { data: mockAccount });
    }

    if (path === "me/sessions") {
      return json(route, 200, {
        data: [
          {
            id: "a".repeat(32),
            current: true,
            ip_address: "127.0.0.1",
            user_agent: "Mozilla/5.0 (contoh browser ini)",
            last_active_at: "2026-10-17T02:00:00+00:00",
          },
          {
            id: "b".repeat(32),
            current: false,
            ip_address: "203.0.113.5",
            user_agent:
              "Mozilla/5.0 (Linux; Android 14) contoh perangkat lain dengan nama yang panjang",
            last_active_at: "2026-10-17T01:00:00+00:00",
          },
        ],
      });
    }

    return json(route, 401, { message: "Unauthenticated." });
  });
}
