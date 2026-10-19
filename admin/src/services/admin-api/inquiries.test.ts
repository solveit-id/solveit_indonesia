/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createAdminApiClient } from "./client";
import { AdminApiError } from "./errors";
import { createInquiryApi } from "./inquiries";
import { INQUIRY_REFERENCE } from "./inquiry-contracts";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const detail = {
  id: 42,
  reference: "INQ-7K3M-9QX2-HD4T",
  status: "in-review",
  name: "Pengirim Contoh",
  organization: null,
  contact: { type: "email", masked: "p•••@e•••.test" },
  service: "website",
  budget: "belum-tahu",
  timeline: "fleksibel",
  received_at: "2026-10-19T03:12:45+00:00",
  updated_at: "2026-10-19T03:12:45+00:00",
  message: "Pesan contoh yang cukup panjang untuk diterima.",
  allowed_transitions: ["contacted", "closed"],
  notes_count: 0,
  status_changes_count: 1,
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
    inquiries: createInquiryApi(createAdminApiClient({ fetch, cookies: () => "XSRF-TOKEN=t" })),
  };
}

describe("inquiry API client", () => {
  it("sends exactly the documented bodies", async () => {
    const { calls, inquiries } = api({
      "PUT inquiries/42/status": [json(200, { data: detail })],
      "POST inquiries/42/notes": [
        json(201, {
          data: { id: 1, body: "x", author: { user_id: 1, name: "A" }, created_at: null },
        }),
      ],
      "POST inquiries/42/contact-reveal": [
        json(200, {
          data: {
            id: 42,
            reference: detail.reference,
            contact: { type: "email", value: "pengirim@example.test" },
            revealed_at: "2026-10-19T04:05:00.123456+00:00",
          },
        }),
      ],
    });

    await inquiries.changeStatus(42, { status: "contacted", expectedStatus: "in-review" });
    await inquiries.addNote(42, "Telepon setelah jam 16.00.");
    const revealed = await inquiries.revealContact(42, { acknowledgePersonalData: true });

    expect(calls.map((call) => [call.key, call.body])).toEqual([
      ["PUT inquiries/42/status", { status: "contacted", expected_status: "in-review" }],
      ["POST inquiries/42/notes", { body: "Telepon setelah jam 16.00." }],
      ["POST inquiries/42/contact-reveal", { acknowledge_personal_data: true }],
    ]);
    expect(revealed.contact.value).toBe("pengirim@example.test");
  });

  it("sends only the allowlisted filters, the page size, and the cursor as given", async () => {
    const { calls, inquiries } = api({
      "GET inquiries": [json(200, emptyPage), json(200, emptyPage)],
    });

    await inquiries.listInquiries();
    await inquiries.listInquiries(
      {
        status: "received",
        service: "sistem-informasi",
        received_from: "2026-10-18T00:00:00+07:00",
        received_to: "2026-10-19T23:59:59.999+07:00",
        reference: "INQ-7K3M-9QX2-HD4T",
      },
      { cursor: "eyJpZCI6NDJ9", perPage: 10 },
    );

    expect(calls[0]!.url).toBe("/api/v1/admin/inquiries?per_page=25");
    const sent = new URL(calls[1]!.url, "http://x").searchParams;
    expect(Object.fromEntries(sent)).toEqual({
      status: "received",
      service: "sistem-informasi",
      received_from: "2026-10-18T00:00:00+07:00",
      received_to: "2026-10-19T23:59:59.999+07:00",
      reference: "INQ-7K3M-9QX2-HD4T",
      per_page: "10",
      cursor: "eyJpZCI6NDJ9",
    });
  });

  it("reads history and notes page by page with no filter", async () => {
    const { calls, inquiries } = api({
      "GET inquiries/42/status-changes": [json(200, emptyPage)],
      "GET inquiries/42/notes": [json(200, emptyPage)],
    });

    await inquiries.listStatusChanges(42, { cursor: "abc" });
    await inquiries.listNotes(42);

    expect(calls.map((call) => call.url)).toEqual([
      "/api/v1/admin/inquiries/42/status-changes?per_page=25&cursor=abc",
      "/api/v1/admin/inquiries/42/notes?per_page=25",
    ]);
  });

  it("carries the inquiry 409 codes and never resends after a 419", async () => {
    const { calls, inquiries } = api({
      "PUT inquiries/42/status": [
        json(409, { message: "changed", code: "status_changed" }),
        json(409, { message: "not allowed", code: "transition_not_allowed" }),
        json(419, { message: "CSRF token mismatch." }),
      ],
      "POST inquiries/42/notes": [json(419, { message: "CSRF token mismatch." })],
      "POST inquiries/42/contact-reveal": [json(419, { message: "CSRF token mismatch." })],
    });
    const change = () =>
      inquiries.changeStatus(42, { status: "contacted", expectedStatus: "in-review" });

    await expect(change()).rejects.toMatchObject({
      kind: "conflict",
      conflictCode: "status_changed",
      outcome: "not-applied",
    });
    await expect(change()).rejects.toMatchObject({ conflictCode: "transition_not_allowed" });
    await expect(change()).rejects.toMatchObject({ kind: "csrf", requiresConfirmation: true });
    await expect(inquiries.addNote(42, "x")).rejects.toMatchObject({ kind: "csrf" });
    await expect(
      inquiries.revealContact(42, { acknowledgePersonalData: true }),
    ).rejects.toMatchObject({ kind: "csrf" });

    // One attempt each: a 419 is followed by a fresh token only, never by the write again.
    expect(calls.filter((call) => call.key === "PUT inquiries/42/status")).toHaveLength(3);
    expect(calls.filter((call) => call.key === "POST inquiries/42/notes")).toHaveLength(1);
    expect(calls.filter((call) => call.key === "POST inquiries/42/contact-reveal")).toHaveLength(1);
  });

  it("reports a 5xx on a note or a reveal as uncertain, and a 423 as a password step", async () => {
    const { inquiries } = api({
      "POST inquiries/42/notes": [
        json(503, {
          message: "The note could not be saved. Read the notes again before retrying.",
        }),
      ],
      "POST inquiries/42/contact-reveal": [
        json(423, { message: "Password confirmation required." }),
        json(500, { message: "Server Error" }),
        json(429, { message: "Too Many Attempts." }, { "Retry-After": "42" }),
      ],
    });
    const reveal = () => inquiries.revealContact(42, { acknowledgePersonalData: true });

    await expect(inquiries.addNote(42, "x")).rejects.toMatchObject({
      kind: "unavailable",
      outcome: "uncertain",
    });
    await expect(reveal()).rejects.toMatchObject({ kind: "password-confirmation-required" });
    await expect(reveal()).rejects.toMatchObject({ kind: "server", outcome: "uncertain" });
    await expect(reveal()).rejects.toMatchObject({
      kind: "rate-limited",
      retryAfterSeconds: 42,
    });
  });

  it("refuses an ID that is not a positive integer before sending anything", async () => {
    const { calls, inquiries } = api({});

    await expect(inquiries.getInquiry(0)).rejects.toThrow(TypeError);
    await expect(inquiries.addNote(-1, "x")).rejects.toThrow(TypeError);
    await expect(inquiries.revealContact(1.5, { acknowledgePersonalData: true })).rejects.toThrow(
      TypeError,
    );
    expect(calls).toHaveLength(0);
  });

  it("returns the detail from its envelope and refuses a page without data", async () => {
    const { inquiries } = api({
      "GET inquiries/42": [json(200, { data: detail }), json(200, { nothing: true })],
      "GET inquiries": [json(200, { data: "x" })],
    });

    expect(await inquiries.getInquiry(42)).toEqual(detail);
    await expect(inquiries.getInquiry(42)).rejects.toBeInstanceOf(AdminApiError);
    await expect(inquiries.listInquiries()).rejects.toMatchObject({ kind: "invalid-response" });
  });
});

describe("the reference format", () => {
  it("matches Laravel's pattern: INQ and three Crockford groups, upper case", () => {
    expect(INQUIRY_REFERENCE.test("INQ-7K3M-9QX2-HD4T")).toBe(true);
    expect(INQUIRY_REFERENCE.test("INQ-0000-ZZZZ-1234")).toBe(true);

    for (const value of [
      "inq-7k3m-9qx2-hd4t",
      "INQ-7K3M-9QX2-HD4",
      "INQ-7K3M-9QX2-HD4TX",
      "INQ-ILOU-9QX2-HD4T",
      " INQ-7K3M-9QX2-HD4T",
      "INQ-7K3M-9QX2-HD4T\n",
      "7K3M-9QX2-HD4T",
    ]) {
      expect(INQUIRY_REFERENCE.test(value), value).toBe(false);
    }
  });
});
