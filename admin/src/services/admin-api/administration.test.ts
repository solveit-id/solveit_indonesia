/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createAdministrationApi } from "./administration";
import { createAdminApiClient } from "./client";
import { AdminApiError } from "./errors";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const mismatch = () => json(419, { message: "CSRF token mismatch." });

const detail = {
  id: 2,
  name: "Admin Dua",
  email: "admin@example.test",
  role: "admin",
  status: "active",
  is_current_user: false,
  two_factor_confirmed: true,
  activated_at: null,
  suspended_at: null,
  last_login_at: null,
  created_at: null,
  active_sessions: 1,
  open_access_link: null,
};

const emptyPage = {
  data: [],
  links: { first: null, last: null, prev: null, next: null },
  meta: { path: "x", per_page: 25, next_cursor: null, prev_cursor: null },
};

interface Call {
  key: string;
  url: string;
  body: unknown;
}

/** A client over a scripted fetch; the cookie jar always holds a token. */
function api(answers: Record<string, Response[]>) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const key = `${init?.method} ${url.replace("/api/v1/admin/", "").replace(/\?.*$/, "")}`;
    calls.push({
      key,
      url,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });

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
    admin: createAdministrationApi(createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=t" })),
  };
}

type Admin = ReturnType<typeof api>["admin"];

const writes: [string, (a: Admin) => Promise<unknown>, Response][] = [
  ["PUT users/2/role", (a) => a.changeRole(2, "owner"), json(200, { data: detail })],
  ["POST users/2/suspension", (a) => a.suspend(2), json(200, { data: detail })],
  ["DELETE users/2/suspension", (a) => a.reactivate(2), json(200, { data: detail })],
  [
    "POST users/2/credential-reset",
    (a) => a.resetCredentials(2, { acknowledgeAccessLoss: true }),
    json(201, { data: { account: detail, access_link: { url: "x", expires_at: "y" } } }),
  ],
  [
    "POST invitations",
    (a) => a.invite({ email: "new@example.test", role: "admin" }),
    json(201, { data: { invitation: {}, access_link: { url: "x", expires_at: "y" } } }),
  ],
  ["DELETE invitations/9", (a) => a.revokeInvitation(9), json(200, { data: {} })],
];

describe("sensitive writes", () => {
  it.each(writes)("%s is never resent after a 419", async (key, call) => {
    const { calls, admin } = api({ [key]: [mismatch()] });

    const error = await call(admin).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AdminApiError);
    expect(error).toMatchObject({
      kind: "csrf",
      outcome: "not-applied",
      requiresConfirmation: true,
    });
    expect(calls.filter((made) => made.key === key)).toHaveLength(1);
  });

  it.each(writes)("%s reports a 423 as a password confirmation, not applied", async (key, call) => {
    const { calls, admin } = api({
      [key]: [json(423, { message: "Password confirmation required." })],
    });

    await expect(call(admin)).rejects.toMatchObject({
      kind: "password-confirmation-required",
      outcome: "not-applied",
    });
    expect(calls.filter((made) => made.key === key)).toHaveLength(1);
  });

  it.each(writes)("%s is uncertain after a 5xx and is not resent", async (key, call) => {
    const { calls, admin } = api({ [key]: [json(500, { message: "Server Error" })] });

    await expect(call(admin)).rejects.toMatchObject({ kind: "server", outcome: "uncertain" });
    expect(calls.filter((made) => made.key === key)).toHaveLength(1);
  });

  it.each(writes)("%s with an unreadable success is uncertain", async (key, call) => {
    const { admin } = api({ [key]: [json(200, { nothing: true })] });

    await expect(call(admin)).rejects.toMatchObject({
      kind: "invalid-response",
      outcome: "uncertain",
    });
  });

  it("sends exactly the documented bodies", async () => {
    const { calls, admin } = api(
      Object.fromEntries(writes.map(([key, , success]) => [key, [success]])),
    );

    for (const [, call] of writes) {
      await call(admin);
    }

    const bodies = Object.fromEntries(
      calls.filter((made) => made.key !== "GET auth/csrf-cookie").map((c) => [c.key, c.body]),
    );

    expect(bodies).toEqual({
      "PUT users/2/role": { role: "owner" },
      "POST users/2/suspension": undefined,
      "DELETE users/2/suspension": undefined,
      "POST users/2/credential-reset": { acknowledge_access_loss: true },
      "POST invitations": { email: "new@example.test", role: "admin" },
      "DELETE invitations/9": undefined,
    });
  });

  it("carries a 409 code and the 429 wait", async () => {
    const { admin } = api({
      "POST users/2/suspension": [
        json(409, { message: "At least one active owner must remain.", code: "last_active_owner" }),
        json(429, { message: "Too Many Attempts." }, { "Retry-After": "17" }),
      ],
    });

    await expect(admin.suspend(2)).rejects.toMatchObject({
      kind: "conflict",
      conflictCode: "last_active_owner",
    });
    await expect(admin.suspend(2)).rejects.toMatchObject({
      kind: "rate-limited",
      retryAfterSeconds: 17,
    });
  });
});

describe("reads", () => {
  it("sends only allowlisted filters, the page size, and the cursor as given", async () => {
    const { calls, admin } = api({
      "GET users": [json(200, emptyPage)],
      "GET invitations": [json(200, emptyPage)],
      "GET audit-events": [json(200, emptyPage)],
    });

    await admin.listUsers({ role: "admin", status: undefined }, { cursor: "eyJpZCI6MX0" });
    await admin.listInvitations({ status: "pending" });
    await admin.listAuditEvents({
      action: "account.suspended",
      subject_user_id: 2,
      occurred_from: "2026-10-18T00:00:00+07:00",
    });

    expect(calls.map((call) => call.url)).toEqual([
      "/api/v1/admin/users?role=admin&per_page=25&cursor=eyJpZCI6MX0",
      "/api/v1/admin/invitations?status=pending&per_page=25",
      "/api/v1/admin/audit-events?action=account.suspended&subject_user_id=2&occurred_from=2026-10-18T00%3A00%3A00%2B07%3A00&per_page=25",
    ]);
  });

  it("refuses a page without data or meta", async () => {
    const { admin } = api({ "GET users": [json(200, { data: "nope" })] });

    await expect(admin.listUsers()).rejects.toMatchObject({
      kind: "invalid-response",
      outcome: "not-applicable",
    });
  });

  it("returns the detail from its envelope", async () => {
    const { admin } = api({ "GET users/2": [json(200, { data: detail })] });

    await expect(admin.getUser(2)).resolves.toEqual(detail);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    "refuses the record ID %s before anything is sent",
    async (id) => {
      const { calls, admin } = api({});

      await expect(admin.getUser(id)).rejects.toBeInstanceOf(TypeError);
      await expect(admin.suspend(id)).rejects.toBeInstanceOf(TypeError);
      expect(calls).toHaveLength(0);
    },
  );
});
