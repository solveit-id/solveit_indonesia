/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createAccountApi, isExpiredSignIn, serverClockOffset } from "./account";
import { createAdminApiClient } from "./client";
import { EXPIRED_SIGN_IN_MESSAGE } from "./contracts";
import { AdminApiError } from "./errors";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const mismatch = () => json(419, { message: "CSRF token mismatch." });

/** A client over a scripted fetch; the cookie jar always holds a token. */
function api(answers: Record<string, Response[]>) {
  const calls: string[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method} ${String(input).replace("/api/v1/admin/", "")}`;
    calls.push(key);

    if (key === "GET auth/csrf-cookie") {
      return new Response(null, { status: 204 });
    }

    const next = answers[key]?.shift();

    if (next === undefined) {
      throw new Error(`unexpected ${key}`);
    }

    return next;
  });

  return {
    calls,
    account: createAccountApi(createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=t" })),
  };
}

describe("419 policy per endpoint", () => {
  it.each([
    [
      "auth/login",
      (a: ReturnType<typeof api>["account"]) => a.login("o@example.test", "pw"),
      json(200, { two_factor: true }),
    ],
    [
      "auth/two-factor-challenge",
      (a: ReturnType<typeof api>["account"]) => a.answerChallenge({ code: "123456" }),
      new Response(null, { status: 204 }),
    ],
    [
      "auth/confirm-password",
      (a: ReturnType<typeof api>["account"]) => a.confirmPassword("pw"),
      json(201, ""),
    ],
    [
      "auth/logout",
      (a: ReturnType<typeof api>["account"]) => a.logout(),
      new Response(null, { status: 204 }),
    ],
    [
      "access-links/inspect",
      (a: ReturnType<typeof api>["account"]) => a.inspectAccessLink("t".repeat(43)),
      json(200, {
        data: { purpose: "activation", email: "o***@x", requires_name: true, expires_at: "x" },
      }),
    ],
  ])("%s is resent once after a 419", async (path, call, success) => {
    const { calls, account } = api({ [`POST ${path}`]: [mismatch(), success] });

    await call(account);
    expect(calls.filter((key) => key === `POST ${path}`)).toHaveLength(2);
  });

  it.each([
    [
      "POST access-links/redeem",
      (a: ReturnType<typeof api>["account"]) =>
        a.redeemAccessLink({ token: "t", password: "p", password_confirmation: "p" }),
    ],
    [
      "POST access-links/confirm",
      (a: ReturnType<typeof api>["account"]) => a.confirmEnrollment("123456"),
    ],
    [
      "PUT me/password",
      (a: ReturnType<typeof api>["account"]) =>
        a.changePassword({ current_password: "a", password: "b", password_confirmation: "b" }),
    ],
    [
      "POST me/two-factor-recovery-codes",
      (a: ReturnType<typeof api>["account"]) => a.regenerateRecoveryCodes(),
    ],
    ["DELETE me/sessions", (a: ReturnType<typeof api>["account"]) => a.endOtherSessions()],
    [
      "DELETE me/sessions/" + "b".repeat(32),
      (a: ReturnType<typeof api>["account"]) => a.endSession("b".repeat(32)),
    ],
  ])("%s is never resent: the person decides", async (key, call) => {
    const { calls, account } = api({ [key]: [mismatch()] });

    await expect(call(account)).rejects.toMatchObject({
      kind: "csrf",
      requiresConfirmation: true,
      outcome: "not-applied",
    });
    expect(calls.filter((entry) => entry === key)).toHaveLength(1);
  });

  it("refuses a session handle that is not a plain path segment, before sending", async () => {
    const { calls, account } = api({});

    await expect(account.endSession("../users/1")).rejects.toThrow(TypeError);
    expect(calls).toEqual([]);
  });

  it("an unreadable success of a write is uncertain", async () => {
    const { account } = api({
      "PUT me/password": [
        new Response("<html>", { status: 200, headers: { "Content-Type": "text/html" } }),
      ],
    });

    await expect(
      account.changePassword({ current_password: "a", password: "b", password_confirmation: "b" }),
    ).rejects.toMatchObject({ kind: "invalid-response", outcome: "uncertain" });
  });

  it("a success without its data member is refused, not trusted", async () => {
    const { account } = api({ "GET me": [json(200, { name: "x" })] });

    await expect(account.me()).rejects.toMatchObject({ kind: "invalid-response" });
  });
});

describe("isExpiredSignIn", () => {
  it("matches only the expired-challenge message on `code`", () => {
    const expired = new AdminApiError({
      kind: "validation",
      status: 422,
      outcome: "not-applied",
      fieldErrors: { code: [EXPIRED_SIGN_IN_MESSAGE] },
    });
    const wrong = new AdminApiError({
      kind: "validation",
      status: 422,
      outcome: "not-applied",
      fieldErrors: { code: ["The provided two factor authentication code was invalid."] },
    });

    expect(isExpiredSignIn(expired)).toBe(true);
    expect(isExpiredSignIn(wrong)).toBe(false);
    expect(isExpiredSignIn(new Error("x"))).toBe(false);
  });
});

describe("serverClockOffset", () => {
  it("is the Date header minus this clock, and 0 when missing or absurd", () => {
    const now = Date.parse("2026-10-17T02:00:00Z");

    expect(serverClockOffset(new Headers({ Date: "Sat, 17 Oct 2026 01:59:50 GMT" }), now)).toBe(
      -10_000,
    );
    expect(serverClockOffset(new Headers(), now)).toBe(0);
    expect(serverClockOffset(new Headers({ Date: "Mon, 01 Jan 2024 00:00:00 GMT" }), now)).toBe(0);
  });
});
