import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSession } from "~/auth/session";
import { dayBoundary } from "~/lib/local-day";
import type { AdminInquiry } from "~/services/admin-api/inquiry";
import {
  adminAccount,
  json,
  me,
  mockAdminApi,
  page,
  renderApp,
  sampleAccount,
  sampleInquiry,
} from "~/test/admin-api";

afterEach(() => {
  vi.unstubAllGlobals();
  resetSession();
});

/** List items carry no message: only the list fields, as `GET inquiries` returns them. */
const listed = (overrides: Parameters<typeof sampleInquiry>[0] = {}): AdminInquiry => {
  const detail = sampleInquiry(overrides);

  return {
    id: detail.id,
    reference: detail.reference,
    status: detail.status,
    name: detail.name,
    organization: detail.organization,
    contact: detail.contact,
    service: detail.service,
    budget: detail.budget,
    timeline: detail.timeline,
    received_at: detail.received_at,
    updated_at: detail.updated_at,
  };
};

const first = listed();
const second = listed({
  id: 41,
  reference: "INQ-0000-ZZZZ-1234",
  name: "Pengirim Kedua",
  organization: null,
  status: "contacted",
  service: "website",
});
const older = listed({ id: 40, reference: "INQ-1111-2222-3333", name: "Pengirim Lama" });

const lastUrl = (api: ReturnType<typeof mockAdminApi>) =>
  String(
    api.fetch.mock.calls
      .filter(([url]) => String(url).startsWith("/api/v1/admin/inquiries"))
      .at(-1)![0],
  );

describe("the inquiry list", () => {
  it("lists sender, reference, service, and status, never a contact or a message", async () => {
    mockAdminApi({ "GET me": me(adminAccount()), "GET inquiries": page([first, second]) });
    renderApp("/inquiry");

    const table = await screen.findByRole("table", { name: "Daftar inquiry" });
    const rows = within(table).getAllByRole("row");

    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByRole("link", { name: "Pengirim Contoh" })).toHaveAttribute(
      "href",
      "/inquiry/42",
    );
    expect(within(rows[1]!).getByText("Toko Contoh")).toBeVisible();
    expect(within(rows[1]!).getByText("INQ-7K3M-9QX2-HD4T")).toBeVisible();
    expect(within(rows[1]!).getByText("Sistem informasi")).toBeVisible();
    expect(within(rows[1]!).getByText("Baru")).toBeVisible();
    expect(within(rows[2]!).getByText("Dihubungi")).toBeVisible();
    // Neither the masked contact nor the message is part of the list.
    expect(screen.queryByText(first.contact.masked)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kami butuh sistem stok/)).not.toBeInTheDocument();
    expect(screen.getByText("Menampilkan 2 inquiry.")).toBeVisible();
    expect(document.title).not.toContain("Pengirim");
  });

  it("filters by status and service through the address and Laravel, without GET me again", async () => {
    const api = mockAdminApi({
      "GET me": me(adminAccount()),
      "GET inquiries": [page([first, second]), page([second]), page([second])],
    });
    const user = userEvent.setup();
    const router = renderApp("/inquiry");
    await screen.findByRole("table");
    const meCalls = api.callsTo("GET me").length;

    await user.selectOptions(screen.getByLabelText("Status"), "contacted");
    await waitFor(() => expect(router.state.location.search).toBe("?status=contacted"));
    await waitFor(() =>
      expect(lastUrl(api)).toBe("/api/v1/admin/inquiries?status=contacted&per_page=25"),
    );

    await user.selectOptions(screen.getByLabelText("Layanan"), "website");
    await waitFor(() =>
      expect(lastUrl(api)).toBe(
        "/api/v1/admin/inquiries?status=contacted&service=website&per_page=25",
      ),
    );
    expect(api.callsTo("GET me")).toHaveLength(meCalls);
  });

  it("sends days as local-day boundaries", async () => {
    const api = mockAdminApi({ "GET me": me(adminAccount()), "GET inquiries": page([first]) });
    renderApp("/inquiry?dari=2026-10-18&sampai=2026-10-19");

    await screen.findByRole("table");
    const sent = new URL(lastUrl(api), "http://x").searchParams;
    expect(sent.get("received_from")).toBe(dayBoundary("2026-10-18", "start"));
    expect(sent.get("received_to")).toBe(dayBoundary("2026-10-19", "end"));
  });

  it("holds back a reversed date range and says why", async () => {
    const api = mockAdminApi({ "GET me": me(adminAccount()), "GET inquiries": page([]) });
    renderApp("/inquiry?dari=2026-10-19&sampai=2026-10-18");

    expect(
      await screen.findByText("Tanggal akhir tidak boleh sebelum tanggal awal."),
    ).toBeVisible();
    // The error renders from the address at once; wait for the list's own answer before
    // reading what was sent (CI once read it before any request existed).
    expect(await screen.findByText("Tidak ada inquiry yang cocok")).toBeVisible();
    expect(lastUrl(api)).toBe("/api/v1/admin/inquiries?per_page=25");
  });

  it("never sends a filter value it does not know", async () => {
    const api = mockAdminApi({ "GET me": me(adminAccount()), "GET inquiries": page([first]) });
    renderApp("/inquiry?status=deleted&layanan=hosting&referensi=inq-7k3m&sort=name&q=Rina");

    await screen.findByRole("table");
    expect(lastUrl(api)).toBe("/api/v1/admin/inquiries?per_page=25");
    expect(screen.getByText(/Tulis nomor referensi lengkap/)).toBeVisible();
  });

  it("searches an exact reference, upper-cased, and refuses a malformed one without sending", async () => {
    const api = mockAdminApi({
      "GET me": me(adminAccount()),
      "GET inquiries": [page([first, second]), page([first])],
    });
    const user = userEvent.setup();
    const router = renderApp("/inquiry");
    await screen.findByRole("table");
    const field = screen.getByLabelText("Nomor referensi");

    await user.type(field, "INQ-7K3M");
    await user.click(screen.getByRole("button", { name: "Cari" }));
    expect(await screen.findByText(/Tulis nomor referensi lengkap/)).toBeVisible();
    expect(api.callsTo("GET inquiries")).toHaveLength(1);

    await user.clear(field);
    await user.type(field, " inq-7k3m-9qx2-hd4t ");
    await user.click(screen.getByRole("button", { name: "Cari" }));

    await waitFor(() => expect(router.state.location.search).toBe("?referensi=INQ-7K3M-9QX2-HD4T"));
    await waitFor(() =>
      expect(lastUrl(api)).toBe("/api/v1/admin/inquiries?reference=INQ-7K3M-9QX2-HD4T&per_page=25"),
    );
  });

  it("loads older inquiries with Laravel's cursor and moves focus to the first new row", async () => {
    const api = mockAdminApi({
      "GET me": me(adminAccount()),
      "GET inquiries": [page([first, second], "eyJpZCI6NDF9"), page([older])],
    });
    const user = userEvent.setup();
    renderApp("/inquiry");

    await user.click(await screen.findByRole("button", { name: "Muat inquiry lebih lama" }));

    expect(await screen.findByRole("link", { name: "Pengirim Lama" })).toHaveFocus();
    expect(lastUrl(api)).toBe("/api/v1/admin/inquiries?per_page=25&cursor=eyJpZCI6NDF9");
    expect(screen.getByText("Menampilkan 3 inquiry.")).toBeVisible();
  });

  it("explains an empty list, and an empty filter with a way to clear it", async () => {
    mockAdminApi({ "GET me": me(adminAccount()), "GET inquiries": [page([]), page([])] });
    const user = userEvent.setup();
    const router = renderApp("/inquiry?status=closed");

    expect(await screen.findByText("Tidak ada inquiry yang cocok")).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Hapus filter" })[0]!);

    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(await screen.findByText("Belum ada inquiry")).toBeVisible();
  });

  it("says when the list cannot load and retries with a plain read", async () => {
    const api = mockAdminApi({
      "GET me": me(adminAccount()),
      "GET inquiries": [json(500, { message: "Server Error" }), page([first])],
    });
    const user = userEvent.setup();
    renderApp("/inquiry");

    expect(await screen.findByText("Daftar inquiry belum dapat dimuat.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Coba lagi" }));

    expect(await screen.findByRole("link", { name: "Pengirim Contoh" })).toBeVisible();
    expect(api.callsTo("GET inquiries")).toHaveLength(2);
  });

  it("explains a refused filter without showing Laravel's words", async () => {
    mockAdminApi({
      "GET me": me(adminAccount()),
      "GET inquiries": json(422, {
        message: "The cursor is invalid.",
        errors: { cursor: ["The cursor is invalid."] },
      }),
    });
    renderApp("/inquiry");

    expect(await screen.findByText(/Server menolak filter atau penanda halaman/)).toBeVisible();
    expect(screen.queryByText("The cursor is invalid.")).not.toBeInTheDocument();
  });

  it("shows no data to an account without inquiries.view, and asks Laravel nothing", async () => {
    const api = mockAdminApi({ "GET me": me(sampleAccount()) });
    renderApp("/inquiry");

    expect(await screen.findByRole("heading", { name: "Tanpa izin inquiry" })).toBeVisible();
    expect(api.callsTo("GET inquiries")).toHaveLength(0);
  });

  it("explains a 403 from Laravel the same way", async () => {
    mockAdminApi({
      "GET me": me(adminAccount()),
      "GET inquiries": json(403, { message: "This action is unauthorized." }),
    });
    renderApp("/inquiry");

    expect(await screen.findByRole("heading", { name: "Tanpa izin inquiry" })).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("the way in", () => {
  it("lists Inquiry under Operasional for an account with the permission, and no owner group", async () => {
    mockAdminApi({ "GET me": me(adminAccount()) });
    renderApp("/");

    const nav = await screen.findByRole("navigation", { name: "Navigasi utama" });
    const operations = within(nav).getByRole("list", { name: "Operasional" });
    expect(within(operations).getByRole("link", { name: "Inquiry" })).toHaveAttribute(
      "href",
      "/inquiry",
    );
    expect(within(nav).queryByRole("link", { name: "Pengguna" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Operasional" })).getByRole("link", {
        name: /Inquiry/,
      }),
    ).toBeVisible();
  });

  it("offers no inquiry link without the permission", async () => {
    mockAdminApi({ "GET me": me(sampleAccount()) });
    renderApp("/");

    const nav = await screen.findByRole("navigation", { name: "Navigasi utama" });
    expect(within(nav).queryByRole("link", { name: "Inquiry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Operasional" })).not.toBeInTheDocument();
  });
});
