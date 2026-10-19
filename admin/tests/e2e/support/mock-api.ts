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

/** MOCKED owner records: synthetic names on example.test, far-future dates. */
const mockUsers = [
  {
    id: 1,
    name: "Contoh Owner",
    email: "owner@example.test",
    role: "owner",
    status: "active",
    is_current_user: true,
    two_factor_confirmed: true,
    activated_at: "2026-10-16T05:31:00+00:00",
    suspended_at: null,
    last_login_at: "2026-10-18T06:02:00+00:00",
    created_at: "2026-10-16T05:20:00+00:00",
  },
  {
    id: 2,
    name: "Contoh Admin dengan nama yang cukup panjang",
    email: "admin.dengan.alamat.panjang@example.test",
    role: "admin",
    status: "suspended",
    is_current_user: false,
    two_factor_confirmed: true,
    activated_at: "2026-10-16T06:00:00+00:00",
    suspended_at: "2026-10-18T05:00:00+00:00",
    last_login_at: null,
    created_at: "2026-10-16T05:40:00+00:00",
  },
  {
    id: 3,
    name: "Admin Tertunda",
    email: "tertunda@example.test",
    role: "admin",
    status: "pending",
    is_current_user: false,
    two_factor_confirmed: false,
    activated_at: null,
    suspended_at: null,
    last_login_at: null,
    created_at: "2026-10-18T04:00:00+00:00",
  },
];

const mockInvitations = [
  {
    id: 9,
    status: "pending",
    account: { id: 3, email: "tertunda@example.test", role: "admin", status: "pending" },
    issued_by_user_id: 1,
    created_at: "2026-10-18T04:00:00+00:00",
    expires_at: "2099-10-20T04:00:00+00:00",
    redeemed_at: null,
    completed_at: null,
    revoked_at: null,
  },
  {
    id: 8,
    status: "completed",
    account: {
      id: 2,
      email: "admin.dengan.alamat.panjang@example.test",
      role: "admin",
      status: "suspended",
    },
    issued_by_user_id: null,
    created_at: "2026-10-16T05:40:00+00:00",
    expires_at: "2026-10-18T05:40:00+00:00",
    redeemed_at: "2026-10-16T05:50:00+00:00",
    completed_at: "2026-10-16T06:00:00+00:00",
    revoked_at: null,
  },
];

const mockEvents = [
  {
    id: 12,
    occurred_at: "2026-10-18T05:00:00.000000+00:00",
    action: "account.suspended",
    actor: { type: "user", user_id: 1 },
    subject: { type: "user", id: 2 },
    ip_address: "203.0.113.5",
    user_agent: "Mozilla/5.0 (contoh browser)",
    metadata: { sessions_ended: 1, access_links_revoked: 0 },
  },
  {
    id: 11,
    occurred_at: "2026-10-18T04:00:00.000000+00:00",
    action: "invitation.issued",
    actor: { type: "user", user_id: 1 },
    subject: { type: "user", id: 3 },
    ip_address: "203.0.113.5",
    user_agent: "Mozilla/5.0 (contoh browser)",
    metadata: { to_role: "admin", account_created: true, access_link_id: 9 },
  },
  {
    id: 10,
    occurred_at: "2026-10-17T22:00:00.000000+00:00",
    action: "login.failed",
    actor: { type: "anonymous", user_id: null },
    subject: null,
    ip_address: "198.51.100.7",
    user_agent: "curl/8.0",
    metadata: { email_fingerprint: "9f2c7a11d04b5e6f8a90" },
  },
];

/** MOCKED inquiries (B4b): synthetic senders, example.test contacts, masked as Laravel masks. */
const mockInquiries = [
  {
    id: 42,
    reference: "INQ-7K3M-9QX2-HD4T",
    status: "received",
    name: "Pengirim Contoh dengan nama yang cukup panjang",
    organization: "Toko Contoh Sejahtera",
    contact: { type: "email", masked: "p•••@e•••.test" },
    service: "sistem-informasi",
    budget: "10-50jt",
    timeline: "1-3-bulan",
    received_at: "2026-10-19T03:12:45+00:00",
    updated_at: "2026-10-19T03:12:45+00:00",
  },
  {
    id: 41,
    reference: "INQ-0000-ZZZZ-1234",
    status: "contacted",
    name: "Pengirim Kedua",
    organization: null,
    contact: { type: "phone", masked: "+•••••••358" },
    service: "website",
    budget: "belum-tahu",
    timeline: "fleksibel",
    received_at: "2026-10-18T09:00:00+00:00",
    updated_at: "2026-10-19T02:00:00+00:00",
  },
];

/** The full contact the mocked reveal returns: synthetic, example.test only. */
export const mockRevealedContact = "pengirim.contoh@example.test";

const mockInquiryDetail = (id: number) => {
  const found = mockInquiries.find((entry) => entry.id === id);

  return found === undefined
    ? null
    : {
        ...found,
        message: [
          "Kami butuh sistem stok untuk tiga cabang toko, dengan laporan harian per cabang.",
          "Mohon dihubungi lewat email pada jam kerja.",
        ].join(String.fromCharCode(10)),
        allowed_transitions:
          found.status === "received"
            ? ["in-review", "contacted", "closed"]
            : ["in-review", "closed"],
        notes_count: found.status === "received" ? 0 : 1,
        status_changes_count: found.status === "received" ? 0 : 1,
      };
};

const mockStatusChanges = [
  {
    id: 7,
    from_status: "received",
    to_status: "contacted",
    changed_by: { user_id: 1, name: "Contoh Owner" },
    changed_at: "2026-10-19T02:00:00+00:00",
  },
];

const mockNotes = [
  {
    id: 12,
    body: "Sudah ditelepon. Minta proposal singkat minggu depan.",
    author: { user_id: 1, name: "Contoh Owner" },
    created_at: "2026-10-19T02:05:00+00:00",
  },
];

const cursorPage = (data: unknown[]) => ({
  data,
  links: { first: null, last: null, prev: null, next: null },
  meta: { path: "x", per_page: 25, next_cursor: null, prev_cursor: null },
});

/** The synthetic one-time link the mocked invitation returns (never a real token). */
export const mockInviteUrl = `http://127.0.0.1:4175/access#token=${"m".repeat(43)}`;

/** A verified synthetic owner with the B3.2c endpoints answered from the records above. */
export async function mockOwner(page: Page) {
  await page.route("**/api/v1/admin/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1/admin/", "");
    const method = request.method();

    if (path === "auth/csrf-cookie") {
      return route.fulfill({
        status: 204,
        headers: { "Set-Cookie": "XSRF-TOKEN=mocked-token; Path=/; SameSite=Strict" },
      });
    }

    if (path === "me") {
      return json(route, 200, {
        data: {
          ...mockAccount,
          permissions: [
            "account.manage-own",
            "users.view",
            "users.invite",
            "users.change-role",
            "users.suspend",
            "users.reset-credentials",
            "audit.view-all",
            "inquiries.view",
            "inquiries.change-status",
            "inquiries.add-note",
            "inquiries.reveal-contact",
          ],
        },
      });
    }

    if (path === "users") return json(route, 200, cursorPage(mockUsers));
    if (path === "invitations" && method === "GET")
      return json(route, 200, cursorPage(mockInvitations));
    if (path === "audit-events") return json(route, 200, cursorPage(mockEvents));
    if (path === "inquiries") return json(route, 200, cursorPage(mockInquiries));

    const inquiry = /^inquiries\/(\d+)(?:\/(status-changes|notes|contact-reveal))?$/.exec(path);

    if (inquiry) {
      const detail = mockInquiryDetail(Number(inquiry[1]));

      if (detail === null) {
        return json(route, 404, { message: "Inquiry not found." });
      }

      if (inquiry[2] === "status-changes") {
        return json(route, 200, cursorPage(detail.status === "received" ? [] : mockStatusChanges));
      }

      if (inquiry[2] === "notes") {
        return json(route, 200, cursorPage(detail.status === "received" ? [] : mockNotes));
      }

      if (inquiry[2] === "contact-reveal" && method === "POST") {
        return json(route, 200, {
          data: {
            id: detail.id,
            reference: detail.reference,
            contact: { type: "email", value: mockRevealedContact },
            revealed_at: "2026-10-19T04:05:00.123456+00:00",
          },
        });
      }

      return json(route, 200, { data: detail });
    }

    const user = /^users\/(\d+)$/.exec(path);

    if (user) {
      const found = mockUsers.find((entry) => entry.id === Number(user[1]));

      return found
        ? json(route, 200, {
            data: {
              ...found,
              active_sessions: found.status === "active" ? 1 : 0,
              open_access_link:
                found.status === "pending"
                  ? {
                      id: 9,
                      purpose: "activation",
                      status: "pending",
                      issued_by_user_id: 1,
                      created_at: "2026-10-18T04:00:00+00:00",
                      expires_at: "2099-10-20T04:00:00+00:00",
                      redeemed_at: null,
                    }
                  : null,
            },
          })
        : json(route, 404, { message: "Account not found." });
    }

    if (path === "invitations" && method === "POST") {
      return json(route, 201, {
        data: {
          invitation: {
            ...mockInvitations[0],
            id: 10,
            account: { id: 4, email: "baru@example.test", role: "admin", status: "pending" },
          },
          access_link: { url: mockInviteUrl, expires_at: "2099-10-20T04:00:00+00:00" },
        },
      });
    }

    return json(route, 401, { message: "Unauthenticated." });
  });
}
