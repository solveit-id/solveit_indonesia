// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { adminApiUrl, createAdminApiClient } from "./client";
import { type AdminApiError, isAdminApiError } from "./errors";

type Call = { url: string; init: RequestInit };

/** A fetch stand-in that answers from a queue and records every call. */
function fakeFetch(...responses: (Response | (() => Response | Promise<Response>) | Error)[]) {
  const calls: Call[] = [];
  const queue = [...responses];

  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    const next = queue.shift();

    if (next === undefined) {
      throw new Error(`unexpected request ${String(input)}`);
    }

    if (next instanceof Error) {
      throw next;
    }

    return typeof next === "function" ? next() : next;
  });

  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const noContent = () => new Response(null, { status: 204 });

/** A cookie jar the test controls; the CSRF cookie request "sets" a new token. */
function jar(initial = "") {
  let cookie = initial;
  return {
    cookies: () => cookie,
    set: (value: string) => {
      cookie = value;
    },
  };
}

const header = (call: Call, name: string) => new Headers(call.init.headers).get(name);

async function rejection(promise: Promise<unknown>): Promise<AdminApiError> {
  try {
    await promise;
  } catch (error) {
    if (isAdminApiError(error)) {
      return error;
    }
    throw error;
  }
  throw new Error("expected the request to fail");
}

describe("request basics", () => {
  it("reads same-origin, uncached, without following redirects, and sends no CSRF header", async () => {
    const { fetch, calls } = fakeFetch(json(200, { data: { id: 1 } }));
    const client = createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=abc" });

    const response = await client.request<{ data: { id: number } }>({ method: "GET", path: "me" });

    expect(response.data).toEqual({ data: { id: 1 } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/v1/admin/me");
    expect(calls[0]?.init).toMatchObject({
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    });
    expect(header(calls[0]!, "Accept")).toBe("application/json");
    expect(header(calls[0]!, "X-XSRF-TOKEN")).toBeNull();
    expect(header(calls[0]!, "Authorization")).toBeNull();
  });

  it("returns undefined data for 204", async () => {
    const { fetch } = fakeFetch(noContent());
    const client = createAdminApiClient({ fetch, cookies: () => "" });

    await expect(
      client.request({ method: "GET", path: "auth/csrf-cookie" }),
    ).resolves.toMatchObject({
      status: 204,
      data: undefined,
    });
  });

  it("builds query strings and skips undefined values", () => {
    expect(adminApiUrl("users", { role: "admin", per_page: 25, cursor: undefined })).toBe(
      "/api/v1/admin/users?role=admin&per_page=25",
    );
    expect(adminApiUrl("users", { email: "a b&c" })).toBe("/api/v1/admin/users?email=a+b%26c");
  });

  it.each([
    "../up",
    "/users",
    "https://evil.example/api",
    "//evil.example",
    "users?role=owner",
    "users#x",
    "users/../../up",
    "users\\x",
    "",
  ])("refuses the path %j, so nothing can leave /api/v1/admin", (path) => {
    expect(() => adminApiUrl(path)).toThrow(TypeError);
  });
});

describe("CSRF", () => {
  it("fetches the CSRF cookie before the first write and echoes the decoded token", async () => {
    const cookies = jar();
    const { fetch, calls } = fakeFetch(() => {
      cookies.set("XSRF-TOKEN=eyJpdiI6%3D%3D; other=1");
      return noContent();
    }, noContent());
    const client = createAdminApiClient({ fetch, cookies: cookies.cookies });

    await client.request({ method: "POST", path: "auth/logout", replay: "automatic" });

    expect(calls.map((call) => `${call.init.method} ${call.url}`)).toEqual([
      "GET /api/v1/admin/auth/csrf-cookie",
      "POST /api/v1/admin/auth/logout",
    ]);
    expect(header(calls[1]!, "X-XSRF-TOKEN")).toBe("eyJpdiI6==");
  });

  it("does not refetch while a token cookie exists", async () => {
    const { fetch, calls } = fakeFetch(json(201, {}));
    const client = createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=t1" });

    await client.request({
      method: "POST",
      path: "auth/confirm-password",
      body: { password: "x" },
    });

    expect(calls).toHaveLength(1);
    expect(header(calls[0]!, "X-XSRF-TOKEN")).toBe("t1");
    expect(header(calls[0]!, "Content-Type")).toBe("application/json");
    expect(calls[0]?.init.body).toBe(JSON.stringify({ password: "x" }));
  });

  it("shares one CSRF cookie request between concurrent writes", async () => {
    const cookies = jar();
    const { fetch, calls } = fakeFetch(
      () => {
        cookies.set("XSRF-TOKEN=t");
        return noContent();
      },
      noContent(),
      noContent(),
    );
    const client = createAdminApiClient({ fetch, cookies: cookies.cookies });

    await Promise.all([
      client.request({ method: "POST", path: "auth/logout", replay: "automatic" }),
      client.request({ method: "DELETE", path: "me/sessions" }),
    ]);

    expect(calls.filter((call) => call.url.endsWith("auth/csrf-cookie"))).toHaveLength(1);
  });
});

describe("419: never replay a sensitive write behind the person's back", () => {
  it.each([
    ["POST", "invitations"],
    ["DELETE", "invitations/4"],
    ["PUT", "users/7/role"],
    ["POST", "users/7/suspension"],
    ["DELETE", "users/7/suspension"],
    ["POST", "users/7/credential-reset"],
  ] as const)(
    "%s %s: refreshes the token, does not resend, asks for confirmation",
    async (method, path) => {
      const { fetch, calls } = fakeFetch(
        json(419, { message: "CSRF token mismatch." }),
        noContent(),
      );
      const client = createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=old" });

      const error = await rejection(client.request({ method, path, body: { role: "owner" } }));

      expect(error.kind).toBe("csrf");
      expect(error.requiresConfirmation).toBe(true);
      // The CSRF check runs before any controller: nothing happened.
      expect(error.outcome).toBe("not-applied");
      expect(calls.map((call) => call.init.method)).toEqual([method, "GET"]);
      expect(calls.filter((call) => call.init.method === method)).toHaveLength(1);
    },
  );

  it("resends an `automatic` write exactly once after refreshing the token", async () => {
    const cookies = jar("XSRF-TOKEN=old");
    const { fetch, calls } = fakeFetch(
      json(419, { message: "CSRF token mismatch." }),
      () => {
        cookies.set("XSRF-TOKEN=new");
        return noContent();
      },
      json(200, { two_factor: true }),
    );
    const client = createAdminApiClient({ fetch, cookies: cookies.cookies });

    const response = await client.request<{ two_factor: boolean }>({
      method: "POST",
      path: "auth/login",
      body: { email: "owner@example.com", password: "secret" },
      replay: "automatic",
    });

    expect(response.data).toEqual({ two_factor: true });
    expect(calls.map((call) => call.init.method)).toEqual(["POST", "GET", "POST"]);
    expect(header(calls[0]!, "X-XSRF-TOKEN")).toBe("old");
    expect(header(calls[2]!, "X-XSRF-TOKEN")).toBe("new");
  });

  it("stops after one replay: a second 419 is returned, not looped", async () => {
    const { fetch, calls } = fakeFetch(
      json(419, { message: "CSRF token mismatch." }),
      noContent(),
      json(419, { message: "CSRF token mismatch." }),
      noContent(),
    );
    const client = createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=t" });

    const error = await rejection(
      client.request({ method: "POST", path: "auth/logout", replay: "automatic" }),
    );

    expect(error.kind).toBe("csrf");
    expect(calls.filter((call) => call.init.method === "POST")).toHaveLength(2);
  });
});

describe("error classification", () => {
  it.each([
    [400, "bad-request"],
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [405, "bad-request"],
    [423, "password-confirmation-required"],
    [503, "unavailable"],
    [500, "server"],
    [502, "server"],
  ] as const)("%i is %s", async (status, kind) => {
    const { fetch } = fakeFetch(json(status, { message: "Message." }));
    const client = createAdminApiClient({ fetch, cookies: () => "" });

    const error = await rejection(client.request({ method: "GET", path: "users" }));

    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
    expect(error.serverMessage).toBe("Message.");
    expect(error.outcome).toBe("not-applicable");
  });

  it("422 carries the field errors", async () => {
    const { fetch } = fakeFetch(
      json(422, {
        message: "The email field is required.",
        errors: { email: ["The email field is required."], role: ["Bad.", 3] },
      }),
    );
    const client = createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=t" });

    const error = await rejection(
      client.request({ method: "POST", path: "invitations", body: {} }),
    );

    expect(error.kind).toBe("validation");
    expect(error.fieldErrors).toEqual({ email: ["The email field is required."], role: ["Bad."] });
    expect(error.outcome).toBe("not-applied");
  });

  it("409 carries a known conflict code and drops an unknown one", async () => {
    const { fetch } = fakeFetch(
      json(409, { message: "At least one active owner must remain.", code: "last_active_owner" }),
      json(409, { message: "Other.", code: "made_up_code" }),
    );
    const client = createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=t" });

    const known = await rejection(client.request({ method: "PUT", path: "users/2/role" }));
    const unknown = await rejection(client.request({ method: "PUT", path: "users/2/role" }));

    expect(known.kind).toBe("conflict");
    expect(known.conflictCode).toBe("last_active_owner");
    expect(unknown.conflictCode).toBeUndefined();
  });

  it("429 reads Retry-After as seconds or as an HTTP date", async () => {
    const inThirtySeconds = new Date(Date.now() + 30_000).toUTCString();
    const { fetch } = fakeFetch(
      json(429, { message: "Too Many Attempts." }, { "Retry-After": "42" }),
      json(429, { message: "Too Many Attempts." }, { "Retry-After": inThirtySeconds }),
      json(429, { message: "Too Many Attempts." }),
    );
    const client = createAdminApiClient({ fetch, cookies: () => "" });

    const seconds = await rejection(client.request({ method: "GET", path: "users" }));
    const date = await rejection(client.request({ method: "GET", path: "users" }));
    const missing = await rejection(client.request({ method: "GET", path: "users" }));

    expect(seconds.retryAfterSeconds).toBe(42);
    expect(date.retryAfterSeconds).toBeGreaterThanOrEqual(29);
    expect(date.retryAfterSeconds).toBeLessThanOrEqual(31);
    expect(missing.retryAfterSeconds).toBeUndefined();
  });

  it("an error body that is not JSON still classifies by status", async () => {
    const { fetch } = fakeFetch(new Response("<html>Bad gateway</html>", { status: 502 }));
    const client = createAdminApiClient({ fetch, cookies: () => "" });

    const error = await rejection(client.request({ method: "GET", path: "users" }));

    expect(error.kind).toBe("server");
    expect(error.serverMessage).toBeUndefined();
  });

  it("the error message names the kind and status only, never request data", async () => {
    const { fetch } = fakeFetch(json(422, { message: "Invalid.", errors: {} }));
    const client = createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=t" });

    const error = await rejection(
      client.request({
        method: "POST",
        path: "auth/login",
        body: { email: "owner@example.com", password: "hunter2-secret" },
      }),
    );

    expect(error.message).toBe("Admin API validation (422)");
    expect(JSON.stringify(error)).not.toContain("hunter2-secret");
    expect(JSON.stringify(error)).not.toContain("owner@example.com");
  });
});

describe("uncertain outcomes are never retried", () => {
  it.each([
    ["5xx", () => json(500, { message: "Server Error" })],
    ["unreadable success", () => new Response("not json", { status: 201 })],
  ] as const)("%s on a write is uncertain and sent once", async (_, make) => {
    const { fetch, calls } = fakeFetch(make());
    const client = createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=t" });

    const error = await rejection(
      client.request({ method: "POST", path: "invitations", body: { email: "a@example.com" } }),
    );

    expect(error.outcome).toBe("uncertain");
    expect(calls).toHaveLength(1);
  });

  it("a network failure on a write is uncertain and sent once", async () => {
    const { fetch, calls } = fakeFetch(new TypeError("Failed to fetch"));
    const client = createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=t" });

    const error = await rejection(client.request({ method: "POST", path: "users/3/suspension" }));

    expect(error.kind).toBe("network");
    expect(error.status).toBeNull();
    expect(error.outcome).toBe("uncertain");
    expect(calls).toHaveLength(1);
  });

  it("a read that fails on the network is `not-applicable`", async () => {
    const { fetch } = fakeFetch(new TypeError("Failed to fetch"));
    const client = createAdminApiClient({ fetch, cookies: () => "" });

    const error = await rejection(client.request({ method: "GET", path: "users" }));

    expect(error.kind).toBe("network");
    expect(error.outcome).toBe("not-applicable");
  });

  it("times out", async () => {
    const hang = (_: RequestInfo | URL, init: RequestInit = {}) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const client = createAdminApiClient({
      fetch: hang as typeof fetch,
      cookies: () => "XSRF-TOKEN=t",
      timeoutMs: 20,
    });

    const error = await rejection(client.request({ method: "PUT", path: "users/2/role" }));

    expect(error.kind).toBe("timeout");
    expect(error.outcome).toBe("uncertain");
  });

  it("an abort by the caller is reported as such", async () => {
    const hang = (_: RequestInfo | URL, init: RequestInit = {}) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const controller = new AbortController();
    const client = createAdminApiClient({ fetch: hang as typeof fetch, cookies: () => "" });

    const pending = rejection(
      client.request({ method: "GET", path: "users", signal: controller.signal }),
    );
    controller.abort();

    expect((await pending).kind).toBe("aborted");
  });
});
