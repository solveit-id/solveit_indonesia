import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSession } from "~/auth/session";
import { dayBoundary } from "~/lib/local-day";
import type { AdminAuditEvent } from "~/services/admin-api/owner";
import {
  json,
  me,
  mockAdminApi,
  ownerAccount,
  page,
  renderApp,
  sampleUser,
} from "~/test/admin-api";

afterEach(() => {
  vi.unstubAllGlobals();
  resetSession();
});

function event(overrides: Partial<AdminAuditEvent> = {}): AdminAuditEvent {
  return {
    id: 120,
    occurred_at: "2026-10-18T07:41:12.512345+00:00",
    action: "account.suspended",
    actor: { type: "user", user_id: 1 },
    subject: { type: "user", id: 2 },
    ip_address: "203.0.113.5",
    user_agent: "Mozilla/5.0 (contoh)",
    metadata: { sessions_ended: 1, access_links_revoked: 0 },
    ...overrides,
  };
}

const directory = () =>
  page([
    sampleUser({ id: 1, name: "Contoh Owner", role: "owner", is_current_user: true }),
    sampleUser({ id: 2, name: "Contoh Admin" }),
  ]);

const lastAuditUrl = (api: ReturnType<typeof mockAdminApi>) =>
  String(api.fetch.mock.calls.filter(([url]) => String(url).includes("/audit-events")).at(-1)![0]);

describe("audit log", () => {
  it("tells each event in words: what, who, to whom, and its metadata", async () => {
    mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET audit-events": page([
        event(),
        event({
          id: 119,
          action: "login.failed",
          actor: { type: "anonymous", user_id: null },
          subject: null,
          metadata: { email_fingerprint: "a1b2c3d4e5f6a7b8c9d0" },
        }),
        event({
          id: 118,
          action: "owner.bootstrap-refused",
          actor: { type: "cli", user_id: null },
          subject: null,
          metadata: { reason: "active-owner-exists" },
        }),
      ]),
    });
    renderApp("/audit");

    const suspended = (await screen.findByRole("heading", { name: "Akun ditangguhkan" })).closest(
      "li",
    )!;
    expect(within(suspended).getByText("Anda")).toBeVisible();
    expect(within(suspended).getByText("Contoh Admin")).toBeVisible();
    expect(within(suspended).getByText("1 sesi diakhiri")).toBeVisible();
    expect(within(suspended).getByText("0 tautan dicabut")).toBeVisible();

    const failed = screen.getByRole("heading", { name: "Masuk gagal" }).closest("li")!;
    expect(within(failed).getByText("Tanpa akun")).toBeVisible();
    expect(within(failed).getByText("Sidik jari alamat a1b2c3d4e5f6")).toBeVisible();

    const refused = screen.getByRole("heading", { name: "Penerbitan owner pertama ditolak" });
    expect(within(refused.closest("li")!).getByText("Shell server")).toBeVisible();
    expect(screen.getByText("Alasan: sudah ada owner aktif")).toBeVisible();
  });

  it("names an event the console does not know by its code, without guessing", async () => {
    mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET audit-events": page([
        event({ action: "future.event", metadata: { unknown: "x" } as never }),
      ]),
    });
    renderApp("/audit");

    expect(await screen.findByRole("heading", { name: "Kejadian future.event" })).toBeVisible();
    expect(screen.queryByText("x")).not.toBeInTheDocument();
  });

  it("sends the filters Laravel allows, with days as local boundaries", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET audit-events": page([event()]),
    });
    renderApp("/audit?tindakan=account.suspended&subjek=2&dari=2026-10-01&sampai=2026-10-18&x=1");

    await screen.findByRole("heading", { name: "Akun ditangguhkan" });
    const url = new URL(lastAuditUrl(api), "http://127.0.0.1");

    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: "account.suspended",
      subject_user_id: "2",
      occurred_from: dayBoundary("2026-10-01", "start"),
      occurred_to: dayBoundary("2026-10-18", "end"),
      per_page: "25",
    });
  });

  it("refuses an end date before the start date without asking Laravel for it", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET audit-events": page([event()]),
    });
    renderApp("/audit?dari=2026-10-18&sampai=2026-10-01");

    expect(
      await screen.findByText("Tanggal akhir tidak boleh sebelum tanggal awal."),
    ).toBeVisible();
    await waitFor(() => expect(api.callsTo("GET audit-events")).toHaveLength(1));
    expect(lastAuditUrl(api)).toBe("/api/v1/admin/audit-events?per_page=25");
  });

  it("filters by action from the grouped list", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET audit-events": [page([event()]), page([])],
    });
    const user = userEvent.setup();
    const router = renderApp("/audit");
    await screen.findByRole("heading", { name: "Akun ditangguhkan" });

    await user.selectOptions(screen.getByLabelText("Tindakan"), "invitation.issued");

    await waitFor(() => expect(router.state.location.search).toBe("?tindakan=invitation.issued"));
    expect(await screen.findByText("Tidak ada kejadian yang cocok")).toBeVisible();
    expect(lastAuditUrl(api)).toBe(
      "/api/v1/admin/audit-events?action=invitation.issued&per_page=25",
    );
  });

  it("loads older events on request and keeps the day groups", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET audit-events": [
        page([event()], "eyJpZCI6MTIwfQ"),
        page([event({ id: 90, occurred_at: "2026-10-10T01:00:00+00:00", action: "logout" })]),
      ],
    });
    const user = userEvent.setup();
    renderApp("/audit");

    await user.click(await screen.findByRole("button", { name: "Muat kejadian lebih lama" }));

    expect(await screen.findByRole("heading", { name: "Keluar" })).toBeVisible();
    expect(lastAuditUrl(api)).toBe("/api/v1/admin/audit-events?per_page=25&cursor=eyJpZCI6MTIwfQ");
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThanOrEqual(3);
  });

  it("is read only: no control on the page writes anything", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET audit-events": json(200, {
        data: [event()],
        links: { first: null, last: null, prev: null, next: null },
        meta: { path: "x", per_page: 25, next_cursor: null, prev_cursor: null },
      }),
    });
    renderApp("/audit");

    await screen.findByRole("heading", { name: "Akun ditangguhkan" });
    expect(api.calls.filter((call) => call.method !== "GET")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /hapus kejadian|ekspor/i }),
    ).not.toBeInTheDocument();
  });
});

describe("inquiry events (B4a, labelled in B4b)", () => {
  const inquiryEvents = () =>
    page([
      event({
        id: 130,
        action: "inquiry.contact-revealed",
        actor: { type: "user", user_id: 2 },
        subject: { type: "inquiry", id: 42 },
        metadata: null,
      }),
      event({
        id: 129,
        action: "inquiry.status-changed",
        actor: { type: "user", user_id: 2 },
        subject: { type: "inquiry", id: 42 },
        metadata: { from_status: "received", to_status: "in-review" },
      }),
      event({
        id: 128,
        action: "inquiry.note-added",
        actor: { type: "user", user_id: 2 },
        subject: { type: "inquiry", id: 42 },
        metadata: { note_id: 12 },
      }),
    ]);

  it("names the three inquiry actions, their status and note, and links the inquiry", async () => {
    mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET audit-events": inquiryEvents(),
    });
    renderApp("/audit");

    expect(await screen.findByRole("heading", { name: "Kontak inquiry dibuka" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Status inquiry diubah" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Catatan inquiry ditambahkan" })).toBeVisible();
    expect(screen.queryByText(/Kejadian inquiry\./)).not.toBeInTheDocument();
    expect(screen.getByText("Status: Baru ke Ditinjau")).toBeVisible();
    expect(screen.getByText("Catatan #12")).toBeVisible();
    for (const link of screen.getAllByRole("link", { name: "Inquiry #42" })) {
      expect(link).toHaveAttribute("href", "/inquiry/42");
    }
  });

  it("offers the inquiry actions as a filter group", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET audit-events": [inquiryEvents(), inquiryEvents()],
    });
    const user = userEvent.setup();
    renderApp("/audit");
    await screen.findByRole("heading", { name: "Kontak inquiry dibuka" });

    const select = screen.getByLabelText("Tindakan");
    expect(within(select).getByRole("group", { name: "Inquiry" })).toBeInTheDocument();
    await user.selectOptions(select, "inquiry.contact-revealed");

    await waitFor(() => expect(lastAuditUrl(api)).toContain("action=inquiry.contact-revealed"));
  });

  it("filters by an inquiry from its detail, never together with an account subject", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET audit-events": [inquiryEvents(), page([event()])],
    });
    const user = userEvent.setup();
    const router = renderApp("/audit?inquiry=42&subjek=2");
    await screen.findByRole("heading", { name: "Kontak inquiry dibuka" });

    const sent = new URL(lastAuditUrl(api), "http://x").searchParams;
    expect(sent.get("subject_inquiry_id")).toBe("42");
    expect(sent.has("subject_user_id")).toBe(false);
    expect(screen.getByText(/Hanya kejadian yang mengenai Inquiry #42/)).toBeVisible();
    expect(screen.queryByLabelText("Akun terdampak")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tampilkan semua sasaran" }));
    await waitFor(() => expect(router.state.location.search).toBe("?subjek=2"));
    await waitFor(() => expect(lastAuditUrl(api)).toContain("subject_user_id=2"));
    expect(lastAuditUrl(api)).not.toContain("subject_inquiry_id");
  });
});
