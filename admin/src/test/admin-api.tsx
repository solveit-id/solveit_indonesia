import { render } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { vi } from "vitest";
import { routes } from "~/app/router";
import { I18nProvider } from "~/i18n/i18n";
import type { AdminAccount } from "~/services/admin-api";
import type { AdminUserDetail } from "~/services/admin-api/owner";

/**
 * A stand-in for Laravel in component tests: `fetch` answers by method and path, in order,
 * and every call is recorded. It is a mock and only a mock; the real API is exercised by
 * tests/integration (Laravel on the MySQL testing database).
 */
export interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
  headers: Headers;
}

type Answer = Response | (() => Response | Promise<Response>);

export function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export const noContent = () => new Response(null, { status: 204 });

export const unauthenticated = () => json(401, { message: "Unauthenticated." });

export function sampleAccount(overrides: Partial<AdminAccount> = {}): AdminAccount {
  return {
    id: 1,
    name: "Contoh Owner",
    email: "owner@example.test",
    role: "owner",
    permissions: ["account.manage-own"],
    two_factor: { confirmed_at: "2026-10-16T05:31:00+00:00", recovery_codes_remaining: 8 },
    session: {
      // Far in the future: a fixed date would expire as the calendar moves on (it did once,
      // turning the idle warning's expiry check into an endless loop in the tests).
      signed_in_at: "2099-10-17T01:00:00+00:00",
      absolute_expires_at: "2099-10-17T13:00:00+00:00",
      idle_timeout_minutes: 30,
    },
    ...overrides,
  };
}

export const me = (account: AdminAccount = sampleAccount()) => json(200, { data: account });

/** Every permission Laravel grants the owner role (docs/api/admin-users.md, Izin dan peran). */
export const ownerPermissions: AdminAccount["permissions"] = [
  "account.manage-own",
  "users.view",
  "users.invite",
  "users.change-role",
  "users.suspend",
  "users.reset-credentials",
  "audit.view-all",
];

export const ownerAccount = (overrides: Partial<AdminAccount> = {}) =>
  sampleAccount({ permissions: ownerPermissions, ...overrides });

/** A synthetic admin account as `GET users/{id}` returns it. */
export function sampleUser(overrides: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id: 2,
    name: "Contoh Admin",
    email: "admin@example.test",
    role: "admin",
    status: "active",
    is_current_user: false,
    two_factor_confirmed: true,
    activated_at: "2026-10-16T05:31:00+00:00",
    suspended_at: null,
    last_login_at: "2026-10-17T06:02:00+00:00",
    created_at: "2026-10-16T05:20:00+00:00",
    active_sessions: 1,
    open_access_link: null,
    ...overrides,
  };
}

/** A cursor page as Laravel returns it. */
export const page = <T,>(data: T[], nextCursor: string | null = null) =>
  json(200, {
    data,
    links: { first: null, last: null, prev: null, next: nextCursor ? "x" : null },
    meta: { path: "x", per_page: 25, next_cursor: nextCursor, prev_cursor: null },
  });

/**
 * Install the stub. `routes` maps "METHOD path" (relative to /api/v1/admin) to answers used in
 * order; the last answer repeats. `GET auth/csrf-cookie` sets an XSRF cookie unless overridden.
 */
export function mockAdminApi(routes: Record<string, Answer | Answer[]>) {
  const calls: RecordedCall[] = [];
  const queues = new Map(
    Object.entries(routes).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : [value],
    ]),
  );

  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://127.0.0.1:5174");
    const path = url.pathname.replace(/^\/api\/v1\/admin\//, "");
    const method = init?.method ?? "GET";
    const key = `${method} ${path}`;
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body, headers: new Headers(init?.headers) });

    if (init?.signal?.aborted) {
      throw new DOMException("aborted", "AbortError");
    }

    const queue = queues.get(key);

    if (queue === undefined || queue.length === 0) {
      if (key === "GET auth/csrf-cookie") {
        document.cookie = "XSRF-TOKEN=test-token; path=/";

        return noContent();
      }

      throw new Error(`Unexpected admin API call in test: ${key}`);
    }

    const answer = queue.length > 1 ? queue.shift()! : queue[0]!;
    const response = typeof answer === "function" ? await answer() : answer.clone();

    return response;
  });

  vi.stubGlobal("fetch", fetch);

  return {
    calls,
    fetch,
    /** Calls to one endpoint, for example `"POST auth/login"`. */
    callsTo: (key: string) => calls.filter((call) => `${call.method} ${call.path}` === key),
  };
}

export function renderApp(path = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>,
  );

  return router;
}
