// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AdminApiClient } from "./client";
import { checkAdminApiConnection } from "./connection";
import { readXsrfToken } from "./csrf";
import { AdminApiError, parseRetryAfter } from "./errors";

describe("readXsrfToken", () => {
  it.each([
    ["XSRF-TOKEN=abc", "abc"],
    ["a=1; XSRF-TOKEN=eyJ%3D%3D; b=2", "eyJ=="],
    ["solveit-admin-session=x", null],
    ["", null],
    ["XSRF-TOKEN=", null],
    ["NOT-XSRF-TOKEN=abc", null],
    ["XSRF-TOKEN=%E0%A4%A", null],
  ])("%j gives %j", (cookies, expected) => {
    expect(readXsrfToken(cookies)).toBe(expected);
  });
});

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-10-16T10:00:00Z");

  it.each([
    ["60", 60],
    [" 5 ", 5],
    ["Fri, 16 Oct 2026 10:00:30 GMT", 30],
    ["Fri, 16 Oct 2026 09:59:00 GMT", 0],
    ["soon", undefined],
    [null, undefined],
    ["", undefined],
  ] as const)("%j gives %j", (header, expected) => {
    expect(parseRetryAfter(header, now)).toBe(expected);
  });
});

describe("checkAdminApiConnection", () => {
  const clientThat = (outcome: () => Promise<{ status: number }>): AdminApiClient => ({
    request: (async () => ({
      ...(await outcome()),
      data: undefined,
      headers: new Headers(),
    })) as AdminApiClient["request"],
    refreshCsrfCookie: async () => undefined,
  });

  const failing = (details: ConstructorParameters<typeof AdminApiError>[0]) =>
    clientThat(() => Promise.reject(new AdminApiError(details)));

  it("204 is reachable", async () => {
    await expect(
      checkAdminApiConnection(clientThat(async () => ({ status: 204 }))),
    ).resolves.toEqual({
      state: "reachable",
    });
  });

  it.each([
    [
      { kind: "forbidden", status: 403 },
      { state: "refused", status: 403 },
    ],
    [
      { kind: "not-found", status: 404 },
      { state: "refused", status: 404 },
    ],
    [{ kind: "unavailable", status: 503 }, { state: "unavailable" }],
    [
      { kind: "rate-limited", status: 429, retryAfterSeconds: 12 },
      { state: "rate-limited", retryAfterSeconds: 12 },
    ],
    [
      { kind: "network", status: null },
      { state: "unreachable", status: null },
    ],
    [
      { kind: "timeout", status: null },
      { state: "unreachable", status: null },
    ],
    // A bodiless 5xx is the dev proxy telling us Laravel is not listening.
    [
      { kind: "server", status: 500 },
      { state: "unreachable", status: 500 },
    ],
    [
      { kind: "server", status: 500, serverMessage: "Server Error" },
      { state: "unexpected", status: 500 },
    ],
    [
      { kind: "unauthenticated", status: 401 },
      { state: "unexpected", status: 401 },
    ],
  ] as const)("%j becomes %j", async (error, expected) => {
    await expect(
      checkAdminApiConnection(failing({ outcome: "not-applicable", ...error })),
    ).resolves.toEqual(expected);
  });
});
