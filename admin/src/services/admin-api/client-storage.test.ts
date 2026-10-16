// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminApiClient } from "./client";
import { isAdminApiError } from "./errors";

const SECRET = "first-secret-do-not-keep";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

/**
 * In a browser environment: a write with a secret, a 419, a CSRF refresh, and a replay that
 * fails leave nothing of the payload in storage, cookies, the console, or the error.
 */
describe("secrets in a replayed write", () => {
  it("are never logged, stored, or copied into the error", async () => {
    const consoleSpies = (["log", "info", "warn", "error", "debug", "trace"] as const).map(
      (method) => vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const responses = [
      new Response(JSON.stringify({ message: "CSRF token mismatch." }), {
        status: 419,
        headers: { "Content-Type": "application/json" },
      }),
      new Response(null, { status: 204 }),
      new Response(JSON.stringify({ message: "Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    ];
    const fetch = vi.fn(async () => responses.shift()!) as unknown as typeof globalThis.fetch;
    const client = createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=t" });

    const error = await client
      .request({
        method: "POST",
        path: "auth/login",
        body: { email: "owner@example.com", password: SECRET },
        replay: "automatic",
      })
      .catch((caught: unknown) => caught);

    expect(isAdminApiError(error)).toBe(true);
    expect(JSON.stringify(error)).not.toContain(SECRET);
    expect(String(error)).not.toContain(SECRET);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain(SECRET);
    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
