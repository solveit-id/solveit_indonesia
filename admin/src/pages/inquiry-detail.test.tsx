import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSession } from "~/auth/session";
import {
  REVEALED_CONTACT,
  adminAccount,
  json,
  me,
  mockAdminApi,
  ownerAccount,
  page,
  renderApp,
  sampleAccount,
  sampleInquiry,
  sampleNote,
  sampleStatusChange,
  unauthenticated,
} from "~/test/admin-api";

afterEach(() => {
  vi.unstubAllGlobals();
  resetSession();
  localStorage.clear();
  sessionStorage.clear();
});

const needsPassword = () => json(423, { message: "Password confirmation required." });
const revealed = () =>
  json(200, {
    data: {
      id: 42,
      reference: "INQ-7K3M-9QX2-HD4T",
      contact: { type: "email", value: REVEALED_CONTACT },
      revealed_at: "2026-10-19T04:05:00.123456+00:00",
    },
  });

async function openInquiry(
  routes: Parameters<typeof mockAdminApi>[0] = {},
  account = adminAccount(),
  path = "/inquiry/42",
) {
  const api = mockAdminApi({
    "GET me": me(account),
    "GET inquiries/42": json(200, { data: sampleInquiry() }),
    "GET inquiries/42/status-changes": page([]),
    "GET inquiries/42/notes": page([]),
    ...routes,
  });
  const user = userEvent.setup();
  const router = renderApp(path);
  await screen.findByRole("heading", { level: 1, name: "Pengirim Contoh" });

  return { api, user, router };
}

const dialog = () => screen.getByRole("dialog");

/** Everything the page could leave behind: storage, address, history state, title. */
const surfaces = () =>
  JSON.stringify({
    local: { ...localStorage },
    session: { ...sessionStorage },
    href: location.href,
    history: history.state,
    title: document.title,
  });

describe("an inquiry", () => {
  it("puts the one Status panel before the submission in the document", async () => {
    await openInquiry();

    const status = screen.getByRole("region", { name: "Status" });
    const submission = screen.getByRole("region", { name: "Kiriman" });
    expect(
      status.compareDocumentPosition(submission) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // One instance, never a copy per breakpoint.
    expect(screen.getAllByRole("region", { name: "Status" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Tandai ditinjau" })).toHaveLength(1);
  });

  it("shows what the visitor sent with the contact masked and the moves Laravel allows", async () => {
    await openInquiry();

    const submission = screen.getByRole("region", { name: "Kiriman" });
    expect(within(submission).getByText("p•••@e•••.test")).toBeVisible();
    expect(within(submission).getByText("Toko Contoh")).toBeVisible();
    expect(within(submission).getByText("Rp10 sampai 50 juta")).toBeVisible();
    expect(within(submission).getByText(/Kami butuh sistem stok/)).toBeVisible();
    const status = screen.getByRole("region", { name: "Status" });
    for (const move of ["Tandai ditinjau", "Tandai sudah dihubungi", "Tutup inquiry"]) {
      expect(within(status).getByRole("button", { name: move })).toBeVisible();
    }
    expect(screen.queryByText(REVEALED_CONTACT)).not.toBeInTheDocument();
    // The page title never carries the sender's name.
    expect(document.title).not.toContain("Pengirim");
  });

  it("offers reopening for a closed inquiry and nothing back to new", async () => {
    await openInquiry({
      "GET inquiries/42": json(200, {
        data: sampleInquiry({ status: "closed", allowed_transitions: ["in-review"] }),
      }),
    });

    const status = screen.getByRole("region", { name: "Status" });
    expect(within(status).getAllByRole("button")).toHaveLength(1);
    expect(within(status).getByRole("button", { name: "Buka lagi untuk ditinjau" })).toBeVisible();
  });

  it("explains instead of offering what the account may not do", async () => {
    const api = (
      await openInquiry({}, adminAccount({ permissions: ["account.manage-own", "inquiries.view"] }))
    ).api;

    expect(
      screen.getByText("Akun Anda tidak mendapat izin mengubah status inquiry."),
    ).toBeVisible();
    expect(screen.getByText("Akun Anda tidak mendapat izin menambah catatan.")).toBeVisible();
    expect(screen.getByText("Akun Anda tidak mendapat izin membuka kontak lengkap.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Buka kontak lengkap" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tambah catatan" })).not.toBeInTheDocument();
    expect(api.calls.filter((call) => call.method !== "GET")).toHaveLength(0);
  });

  it("asks Laravel nothing for an ID that is not a number", async () => {
    const api = mockAdminApi({ "GET me": me(adminAccount()) });
    renderApp("/inquiry/07");

    expect(await screen.findByRole("heading", { name: "Inquiry tidak ditemukan" })).toBeVisible();
    expect(api.calls.filter((call) => call.path.startsWith("inquiries"))).toHaveLength(0);
  });

  it("says when the inquiry does not exist", async () => {
    mockAdminApi({
      "GET me": me(adminAccount()),
      "GET inquiries/9": json(404, { message: "Inquiry not found." }),
    });
    renderApp("/inquiry/9");

    expect(await screen.findByRole("heading", { name: "Inquiry tidak ditemukan" })).toBeVisible();
  });

  it("shows nothing to an account without inquiries.view, without asking", async () => {
    const api = mockAdminApi({ "GET me": me(sampleAccount()) });
    renderApp("/inquiry/42");

    expect(await screen.findByRole("heading", { name: "Tanpa izin inquiry" })).toBeVisible();
    expect(api.calls.filter((call) => call.path.startsWith("inquiries"))).toHaveLength(0);
  });

  it("names who moved it and who wrote each note", async () => {
    await openInquiry({
      "GET inquiries/42": json(200, {
        data: sampleInquiry({ status: "in-review", status_changes_count: 1, notes_count: 2 }),
      }),
      "GET inquiries/42/status-changes": page([sampleStatusChange()]),
      "GET inquiries/42/notes": page([
        sampleNote({ id: 13, author: { user_id: 5, name: "Admin Lain" }, body: "Kedua" }),
        sampleNote(),
      ]),
    });

    const history = screen.getByRole("region", { name: "Riwayat status" });
    expect(await within(history).findByText("Baru ke Ditinjau")).toBeVisible();
    // The signed-in admin (ID 2) made the change.
    expect(within(history).getByText("Anda")).toBeVisible();
    const notes = screen.getByRole("region", { name: "Catatan internal" });
    expect(await within(notes).findByText("Admin Lain")).toBeVisible();
    expect(within(notes).getByText("Minta ditelepon setelah jam 16.00.")).toBeVisible();
    // Notes are append-only: no way to edit or delete one.
    expect(within(notes).queryByRole("button", { name: /Ubah|Hapus/ })).not.toBeInTheDocument();
  });
});

describe("a status change", () => {
  it("sends the status on screen as expected_status, then reads the history again", async () => {
    const { api, user } = await openInquiry({
      "PUT inquiries/42/status": json(200, {
        data: sampleInquiry({
          status: "in-review",
          allowed_transitions: ["contacted", "closed"],
          status_changes_count: 1,
        }),
      }),
    });

    await user.click(screen.getByRole("button", { name: "Tandai ditinjau" }));
    expect(within(dialog()).getByRole("heading", { name: "Pindahkan ke Ditinjau?" })).toBeVisible();
    expect(within(dialog()).getByRole("button", { name: "Batal" })).toHaveFocus();
    await user.click(within(dialog()).getByRole("button", { name: "Tandai ditinjau" }));

    expect(await screen.findByText("Status inquiry sekarang Ditinjau.")).toBeVisible();
    expect(api.callsTo("PUT inquiries/42/status")[0]!.body).toEqual({
      status: "in-review",
      expected_status: "received",
    });
    await waitFor(() => expect(api.callsTo("GET inquiries/42/status-changes")).toHaveLength(2));
    expect(screen.getByRole("button", { name: "Tandai sudah dihubungi" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Tandai ditinjau" })).not.toBeInTheDocument();
  });

  it("says so when it already had that status (200 without a change)", async () => {
    const { user } = await openInquiry({
      "PUT inquiries/42/status": json(200, {
        data: sampleInquiry({ status: "closed", allowed_transitions: ["in-review"] }),
      }),
    });

    await user.click(screen.getByRole("button", { name: "Tutup inquiry" }));
    await user.click(within(dialog()).getByRole("button", { name: "Tutup inquiry" }));

    expect(await screen.findByText(/sudah Selesai; tidak ada perubahan baru/)).toBeVisible();
  });

  it("on a 409 says someone else moved it, leaves only Close, and shows the current status", async () => {
    const { api, user } = await openInquiry({
      "PUT inquiries/42/status": json(409, {
        message:
          "The inquiry status has changed since it was read. Read it again before changing it.",
        code: "status_changed",
      }),
      "GET inquiries/42": [
        json(200, { data: sampleInquiry() }),
        json(200, {
          data: sampleInquiry({
            status: "contacted",
            allowed_transitions: ["in-review", "closed"],
            status_changes_count: 1,
          }),
        }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "Tandai ditinjau" }));
    await user.click(within(dialog()).getByRole("button", { name: "Tandai ditinjau" }));

    expect(await within(dialog()).findByText(/sudah diubah sejak Anda membukanya/)).toBeVisible();
    expect(
      within(dialog()).queryByRole("button", { name: "Tandai ditinjau" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(api.callsTo("GET inquiries/42")).toHaveLength(2));

    await user.click(within(dialog()).getByRole("button", { name: "Tutup" }));
    const notice = await screen.findByText(/Status dimuat ulang dari server: sekarang Dihubungi/);
    await waitFor(() => expect(notice.closest("[tabindex='-1']")).toHaveFocus());
    // Never resent: the person decides again on the current state.
    expect(api.callsTo("PUT inquiries/42/status")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Tutup inquiry" })).toBeVisible();
  });

  it("explains a transition that is no longer allowed and reloads", async () => {
    const { api, user } = await openInquiry({
      "PUT inquiries/42/status": json(409, {
        message: "The inquiry cannot move from its current status to the requested one.",
        code: "transition_not_allowed",
      }),
    });

    await user.click(screen.getByRole("button", { name: "Tandai sudah dihubungi" }));
    await user.click(within(dialog()).getByRole("button", { name: "Tandai sudah dihubungi" }));

    expect(
      await within(dialog()).findByText(/tidak dapat dipindahkan ke status itu/),
    ).toBeVisible();
    await waitFor(() => expect(api.callsTo("GET inquiries/42")).toHaveLength(2));
  });

  it("keeps the dialog after a 419 and sends nothing until pressed again", async () => {
    const { api, user } = await openInquiry({
      "PUT inquiries/42/status": [
        json(419, { message: "CSRF token mismatch." }),
        json(200, { data: sampleInquiry({ status: "in-review", status_changes_count: 1 }) }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "Tandai ditinjau" }));
    await user.click(within(dialog()).getByRole("button", { name: "Tandai ditinjau" }));
    expect(await within(dialog()).findByText(/belum diproses server/)).toBeVisible();
    expect(api.callsTo("PUT inquiries/42/status")).toHaveLength(1);

    await user.click(within(dialog()).getByRole("button", { name: "Tandai ditinjau" }));
    expect(await screen.findByText("Status inquiry sekarang Ditinjau.")).toBeVisible();
    expect(api.callsTo("PUT inquiries/42/status")).toHaveLength(2);
  });

  it("resolves an uncertain outcome by reading the inquiry, never by resending", async () => {
    const { api, user } = await openInquiry({
      "PUT inquiries/42/status": json(502, { message: "Bad Gateway" }),
      "GET inquiries/42": [
        json(200, { data: sampleInquiry() }),
        json(200, { data: sampleInquiry({ status: "in-review", status_changes_count: 1 }) }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "Tandai ditinjau" }));
    await user.click(within(dialog()).getByRole("button", { name: "Tandai ditinjau" }));

    expect(await screen.findByText(/status mungkin sudah berubah/)).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Periksa keadaan inquiry" }));
    expect(
      await screen.findByText("Status yang tercatat di server sekarang: Ditinjau."),
    ).toBeVisible();
    expect(api.callsTo("PUT inquiries/42/status")).toHaveLength(1);
  });

  it("re-reads the account after a 403", async () => {
    const { api, user } = await openInquiry({
      "PUT inquiries/42/status": json(403, { message: "This action is unauthorized." }),
    });

    await user.click(screen.getByRole("button", { name: "Tandai ditinjau" }));
    await user.click(within(dialog()).getByRole("button", { name: "Tandai ditinjau" }));

    expect(await within(dialog()).findByText(/Server menolak tindakan ini/)).toBeVisible();
    await waitFor(() => expect(api.callsTo("GET me").length).toBeGreaterThan(1));
  });
});

describe("a note", () => {
  it("is added with one press, trimmed, and the notes are read again", async () => {
    const { api, user } = await openInquiry({
      "POST inquiries/42/notes": json(201, { data: sampleNote() }),
      "GET inquiries/42/notes": [page([]), page([sampleNote()])],
    });

    await user.type(
      screen.getByLabelText("Catatan baru"),
      "  Minta ditelepon setelah jam 16.00.  ",
    );
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));

    expect(await screen.findByText("Catatan ditambahkan.")).toBeVisible();
    expect(api.callsTo("POST inquiries/42/notes")[0]!.body).toEqual({
      body: "Minta ditelepon setelah jam 16.00.",
    });
    expect(screen.getByLabelText("Catatan baru")).toHaveValue("");
    expect(
      await within(screen.getByRole("region", { name: "Catatan internal" })).findByText(
        "Minta ditelepon setelah jam 16.00.",
      ),
    ).toBeVisible();
  });

  it("refuses an empty or too long note without sending it", async () => {
    const { api, user } = await openInquiry();

    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));
    expect(await screen.findByText("Tulis catatannya dulu.")).toBeVisible();

    await user.click(screen.getByLabelText("Catatan baru"));
    await user.paste("x".repeat(2001));
    expect(screen.getAllByText("Catatan maksimal 2000 karakter.").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));

    expect(api.callsTo("POST inquiries/42/notes")).toHaveLength(0);
  });

  it("holds an uncertain note read only, and calls it saved only for a newer note of this account", async () => {
    const { api, user } = await openInquiry({
      "POST inquiries/42/notes": json(503, {
        message: "The note could not be saved. Read the notes again before retrying.",
      }),
      "GET inquiries/42/notes": [
        page([sampleNote({ id: 10, body: "Lama", author: { user_id: 5, name: "Admin Lain" } })]),
        page([
          sampleNote({ id: 13, body: "Catatan uji", author: { user_id: 2, name: "Contoh Admin" } }),
          sampleNote({ id: 10, body: "Lama", author: { user_id: 5, name: "Admin Lain" } }),
        ]),
      ],
    });

    await user.type(screen.getByLabelText("Catatan baru"), "Catatan uji");
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));

    expect(await screen.findByText(/catatan ini mungkin sudah tersimpan/)).toBeVisible();
    const field = screen.getByLabelText("Catatan baru");
    expect(field).toHaveValue("Catatan uji");
    expect(field).toHaveAttribute("readonly");

    // Pressing again sends nothing while the outcome is unknown.
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));
    expect(api.callsTo("POST inquiries/42/notes")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Periksa catatan" }));
    expect(await screen.findByText(/tersimpan sebagai catatan #13/)).toBeVisible();
    expect(screen.getByLabelText("Catatan baru")).toHaveValue("");
    expect(api.callsTo("POST inquiries/42/notes")).toHaveLength(1);
  });

  it("never takes an older identical note of this account as proof", async () => {
    const older = sampleNote({ id: 12, body: "Catatan uji", author: { user_id: 2, name: "A" } });
    const { api, user } = await openInquiry({
      "POST inquiries/42/notes": json(502, { message: "Bad Gateway" }),
      "GET inquiries/42/notes": [page([older]), page([older])],
    });
    await screen.findByText("Catatan uji");

    await user.type(screen.getByLabelText("Catatan baru"), "Catatan uji");
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));
    await user.click(await screen.findByRole("button", { name: "Periksa catatan" }));

    expect(await screen.findByText(/hasilnya tetap belum pasti/)).toBeVisible();
    expect(screen.queryByText(/tersimpan sebagai catatan/)).not.toBeInTheDocument();
    // Still held: the text stays, read only, and Add sends nothing.
    expect(screen.getByLabelText("Catatan baru")).toHaveValue("Catatan uji");
    expect(screen.getByLabelText("Catatan baru")).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));
    expect(api.callsTo("POST inquiries/42/notes")).toHaveLength(1);
  });

  it("after a check that proves nothing, sends again only on a deliberate press", async () => {
    const { api, user } = await openInquiry({
      "POST inquiries/42/notes": [
        json(500, { message: "Server Error" }),
        json(201, { data: sampleNote({ body: "Catatan uji" }) }),
      ],
      "GET inquiries/42/notes": page([]),
    });

    await user.type(screen.getByLabelText("Catatan baru"), "Catatan uji");
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));
    await user.click(await screen.findByRole("button", { name: "Periksa catatan" }));
    expect(await screen.findByText(/catatan ganda tidak dapat dihapus/)).toBeVisible();
    expect(api.callsTo("POST inquiries/42/notes")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Kirim lagi" }));
    expect(await screen.findByText("Catatan ditambahkan.")).toBeVisible();
    expect(api.callsTo("POST inquiries/42/notes")).toHaveLength(2);
    expect(api.callsTo("POST inquiries/42/notes")[1]!.body).toEqual({ body: "Catatan uji" });
  });

  it("lets the person drop a held text instead of sending it again", async () => {
    const { api, user } = await openInquiry({
      "POST inquiries/42/notes": json(504, { message: "Gateway Timeout" }),
      "GET inquiries/42/notes": page([]),
    });

    await user.type(screen.getByLabelText("Catatan baru"), "Catatan uji");
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));
    await user.click(await screen.findByRole("button", { name: "Periksa catatan" }));
    await user.click(await screen.findByRole("button", { name: "Buang teks ini" }));

    expect(screen.getByLabelText("Catatan baru")).toHaveValue("");
    expect(screen.getByLabelText("Catatan baru")).not.toHaveAttribute("readonly");
    expect(screen.getByText(/Teks catatan dibuang dari kolom/)).toBeVisible();
    expect(api.callsTo("POST inquiries/42/notes")).toHaveLength(1);
  });

  it("calls a match unprovable when the notes had not loaded before sending", async () => {
    const { api, user } = await openInquiry({
      "POST inquiries/42/notes": json(500, { message: "Server Error" }),
      "GET inquiries/42/notes": [
        json(500, { message: "Server Error" }),
        page([sampleNote({ id: 13, body: "Catatan uji", author: { user_id: 2, name: "A" } })]),
      ],
    });
    expect(await screen.findByText("Catatan belum dapat dimuat.")).toBeVisible();

    await user.type(screen.getByLabelText("Catatan baru"), "Catatan uji");
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));
    await user.click(await screen.findByRole("button", { name: "Periksa catatan" }));

    expect(await screen.findByText(/tidak dapat memastikan itu catatan tadi/)).toBeVisible();
    expect(screen.getByLabelText("Catatan baru")).toHaveValue("Catatan uji");
    expect(api.callsTo("POST inquiries/42/notes")).toHaveLength(1);
  });

  it("sends one note however fast the button is pressed", async () => {
    let release: (response: Response) => void = () => undefined;
    const { api, user } = await openInquiry({
      "POST inquiries/42/notes": () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });

    await user.type(screen.getByLabelText("Catatan baru"), "Catatan uji");
    const add = screen.getByRole("button", { name: "Tambah catatan" });
    await user.click(add);
    await user.click(screen.getByRole("button", { name: /Menyimpan catatan|Tambah catatan/ }));
    await user.keyboard("{Enter}");
    release(json(201, { data: sampleNote({ body: "Catatan uji" }) }));

    expect(await screen.findByText("Catatan ditambahkan.")).toBeVisible();
    expect(api.callsTo("POST inquiries/42/notes")).toHaveLength(1);
  });

  it("says a 419 was not processed and a 429 must wait, sending nothing more", async () => {
    const { api, user } = await openInquiry({
      "POST inquiries/42/notes": [
        json(419, { message: "CSRF token mismatch." }),
        json(429, { message: "Too Many Attempts." }, { "Retry-After": "30" }),
      ],
    });

    await user.type(screen.getByLabelText("Catatan baru"), "Catatan uji");
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));
    expect(await screen.findByText(/catatan tadi belum diproses server/)).toBeVisible();
    expect(api.callsTo("POST inquiries/42/notes")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));
    expect(await screen.findByText(/Coba lagi dalam \d+ detik/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));
    expect(api.callsTo("POST inquiries/42/notes")).toHaveLength(2);
  });
});

describe("the full contact", () => {
  it("needs the acknowledgement, the 423 password step, and one more press", async () => {
    const { api, user } = await openInquiry({
      "POST inquiries/42/contact-reveal": [needsPassword(), revealed()],
      "POST auth/confirm-password": json(201, ""),
    });

    await user.click(screen.getByRole("button", { name: "Buka kontak lengkap" }));
    expect(within(dialog()).getByRole("heading", { name: "Buka kontak lengkap?" })).toBeVisible();
    expect(within(dialog()).getByRole("button", { name: "Batal" })).toHaveFocus();

    // Without the acknowledgement nothing is sent.
    await user.click(within(dialog()).getByRole("button", { name: "Buka kontak lengkap" }));
    expect(within(dialog()).getByText(/Centang pernyataan di atas/)).toBeVisible();
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(0);

    await user.click(within(dialog()).getByRole("checkbox"));
    await user.click(within(dialog()).getByRole("button", { name: "Buka kontak lengkap" }));
    expect(
      await within(dialog()).findByText(/Kontak belum dibuka dan belum ada yang dicatat/),
    ).toBeVisible();

    await user.type(within(dialog()).getByLabelText("Kata sandi Anda"), "kata sandi admin");
    await user.click(within(dialog()).getByRole("button", { name: "Konfirmasi kata sandi" }));
    expect(
      await within(dialog()).findByRole("heading", { name: "Kata sandi dikonfirmasi" }),
    ).toBeVisible();
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(1);

    await user.click(within(dialog()).getByRole("button", { name: "Buka kontak lengkap" }));

    expect(await screen.findByText(REVEALED_CONTACT)).toBeVisible();
    expect(screen.getByText(/dibuka dan dicatat di audit log/)).toBeVisible();
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(2);
    expect(api.callsTo("POST inquiries/42/contact-reveal")[1]!.body).toEqual({
      acknowledge_personal_data: true,
    });
    // Memory only: no storage, address, history state, or title holds it.
    expect(surfaces()).not.toContain(REVEALED_CONTACT);
    expect(
      [...document.querySelectorAll("*")].some((element) =>
        [...element.attributes].some((attribute) => attribute.value.includes(REVEALED_CONTACT)),
      ),
    ).toBe(false);
  });

  it("hides it again on request; another look is a new recorded opening", async () => {
    const { api, user } = await openInquiry({
      "POST inquiries/42/contact-reveal": [revealed(), revealed()],
    });

    await user.click(screen.getByRole("button", { name: "Buka kontak lengkap" }));
    await user.click(within(dialog()).getByRole("checkbox"));
    await user.click(within(dialog()).getByRole("button", { name: "Buka kontak lengkap" }));
    expect(await screen.findByText(REVEALED_CONTACT)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Sembunyikan" }));
    expect(screen.queryByText(REVEALED_CONTACT)).not.toBeInTheDocument();
    expect(screen.getByText(/Membukanya lagi dicatat sebagai pembukaan baru/)).toBeVisible();

    // The acknowledgement is asked again for the new opening.
    await user.click(screen.getByRole("button", { name: "Buka kontak lengkap" }));
    expect(within(dialog()).getByRole("checkbox")).not.toBeChecked();
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(1);
  });

  it("sends nothing when the person cancels, at the decision or at the password", async () => {
    const { api, user } = await openInquiry({
      "POST inquiries/42/contact-reveal": needsPassword(),
    });

    await user.click(screen.getByRole("button", { name: "Buka kontak lengkap" }));
    await user.click(within(dialog()).getByRole("button", { name: "Batal" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Buka kontak lengkap" }));
    await user.click(within(dialog()).getByRole("checkbox"));
    await user.click(within(dialog()).getByRole("button", { name: "Buka kontak lengkap" }));
    await within(dialog()).findByLabelText("Kata sandi Anda");
    // jsdom has no Escape-to-cancel on <dialog>; the browser suites press Escape for real.
    await user.click(within(dialog()).getByRole("button", { name: "Batal" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(1);
    expect(api.callsTo("POST auth/confirm-password")).toHaveLength(0);
    expect(screen.getByText("p•••@e•••.test")).toBeVisible();
    expect(screen.queryByText(REVEALED_CONTACT)).not.toBeInTheDocument();
  });

  it("counts down the reveal limit and sends nothing while it runs", async () => {
    const { api, user } = await openInquiry({
      "POST inquiries/42/contact-reveal": json(
        429,
        { message: "Too Many Attempts." },
        { "Retry-After": "60" },
      ),
    });

    await user.click(screen.getByRole("button", { name: "Buka kontak lengkap" }));
    await user.click(within(dialog()).getByRole("checkbox"));
    await user.click(within(dialog()).getByRole("button", { name: "Buka kontak lengkap" }));
    expect(await within(dialog()).findByText(/Coba lagi dalam \d+ detik/)).toBeVisible();

    await user.click(within(dialog()).getByRole("button", { name: "Buka kontak lengkap" }));
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(1);
  });

  it("shows no contact after an uncertain answer and says the opening may be recorded", async () => {
    const { api, user } = await openInquiry({
      "POST inquiries/42/contact-reveal": json(500, { message: "Server Error" }),
    });

    await user.click(screen.getByRole("button", { name: "Buka kontak lengkap" }));
    await user.click(within(dialog()).getByRole("checkbox"));
    await user.click(within(dialog()).getByRole("button", { name: "Buka kontak lengkap" }));

    expect(await screen.findByText(/catatan itu tetap ada di audit log/)).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(REVEALED_CONTACT)).not.toBeInTheDocument();
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(1);
  });

  it("never shows a contact Laravel returned for another inquiry", async () => {
    const { user } = await openInquiry({
      "POST inquiries/42/contact-reveal": json(200, {
        data: {
          id: 43,
          reference: "INQ-0000-ZZZZ-1234",
          contact: { type: "email", value: "lain@example.test" },
          revealed_at: "2026-10-19T04:05:00+00:00",
        },
      }),
    });

    await user.click(screen.getByRole("button", { name: "Buka kontak lengkap" }));
    await user.click(within(dialog()).getByRole("checkbox"));
    await user.click(within(dialog()).getByRole("button", { name: "Buka kontak lengkap" }));

    expect(await screen.findByText(/catatan itu tetap ada di audit log/)).toBeVisible();
    expect(screen.queryByText("lain@example.test")).not.toBeInTheDocument();
  });

  it("goes to sign-in when the session ended meanwhile, showing nothing", async () => {
    const { router, user } = await openInquiry({
      "POST inquiries/42/contact-reveal": unauthenticated(),
    });
    mockAdminApi({
      "GET me": unauthenticated(),
      "POST inquiries/42/contact-reveal": unauthenticated(),
    });

    await user.click(screen.getByRole("button", { name: "Buka kontak lengkap" }));
    await user.click(within(dialog()).getByRole("checkbox"));
    await user.click(within(dialog()).getByRole("button", { name: "Buka kontak lengkap" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/masuk"));
    expect(router.state.location.search).toContain("alasan=berakhir");
    expect(router.state.location.search).toContain("kembali=%2Finquiry%2F42");
    expect(screen.queryByText("Pengirim Contoh")).not.toBeInTheDocument();
  });
});

describe("for an owner", () => {
  it("leads to the inquiry's events in the audit log", async () => {
    await openInquiry({}, ownerAccount());

    expect(screen.getByRole("link", { name: /Lihat kejadiannya di audit log/ })).toHaveAttribute(
      "href",
      "/audit?inquiry=42",
    );
  });

  it("offers no audit link to an admin, who cannot read the audit log", async () => {
    await openInquiry();

    expect(
      screen.queryByRole("link", { name: /Lihat kejadiannya di audit log/ }),
    ).not.toBeInTheDocument();
  });
});

/** Simulates the Page Visibility API (tab switch, minimise, phone locked) in jsdom. */
function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function confirmReveal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Buka kontak lengkap" }));
  await user.click(within(dialog()).getByRole("checkbox"));
  await user.click(within(dialog()).getByRole("button", { name: "Buka kontak lengkap" }));
}

describe("the revealed contact's lifetime", () => {
  afterEach(() => setVisibility("visible"));

  it("is dropped when the tab is hidden and never comes back by itself", async () => {
    const { api, user } = await openInquiry({ "POST inquiries/42/contact-reveal": revealed() });
    await confirmReveal(user);
    expect(await screen.findByText(REVEALED_CONTACT)).toBeVisible();

    setVisibility("hidden");
    expect(screen.queryByText(REVEALED_CONTACT)).not.toBeInTheDocument();
    setVisibility("visible");

    expect(await screen.findByText(/disembunyikan karena tab ini ditinggalkan/)).toBeVisible();
    expect(screen.queryByText(REVEALED_CONTACT)).not.toBeInTheDocument();
    expect(screen.getByText("p•••@e•••.test")).toBeVisible();
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(1);
  });

  it("is dropped on pagehide, so the back-forward cache keeps nothing", async () => {
    const { api, user } = await openInquiry({ "POST inquiries/42/contact-reveal": revealed() });
    await confirmReveal(user);
    expect(await screen.findByText(REVEALED_CONTACT)).toBeVisible();

    window.dispatchEvent(new Event("pagehide"));
    expect(screen.queryByText(REVEALED_CONTACT)).not.toBeInTheDocument();
    window.dispatchEvent(new Event("pageshow"));

    await waitFor(() => expect(screen.getByText("p•••@e•••.test")).toBeVisible());
    expect(screen.queryByText(REVEALED_CONTACT)).not.toBeInTheDocument();
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(1);
  });

  it("never shows an answer that arrives while the tab is hidden", async () => {
    let release: (response: Response) => void = () => undefined;
    const { api, user } = await openInquiry({
      "POST inquiries/42/contact-reveal": () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    await confirmReveal(user);

    setVisibility("hidden");
    release(revealed());
    await new Promise((resolve) => setTimeout(resolve, 20));
    setVisibility("visible");

    expect(await screen.findByText(/tidak ditampilkan karena tab ini ditinggalkan/)).toBeVisible();
    expect(screen.queryByText(REVEALED_CONTACT)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(1);
  });

  it("never shows an answer that arrives after leaving the inquiry", async () => {
    let release: (response: Response) => void = () => undefined;
    const { api, user, router } = await openInquiry({
      "POST inquiries/42/contact-reveal": () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
      "GET inquiries": page([]),
    });
    await confirmReveal(user);

    await router.navigate("/inquiry");
    expect(await screen.findByText("Belum ada inquiry")).toBeVisible();
    release(revealed());
    await router.navigate("/inquiry/42");

    expect(await screen.findByText("p•••@e•••.test")).toBeVisible();
    expect(screen.queryByText(REVEALED_CONTACT)).not.toBeInTheDocument();
    expect(api.callsTo("POST inquiries/42/contact-reveal")).toHaveLength(1);
  });

  it("is dropped when the account no longer holds the reveal permission", async () => {
    const withoutReveal = adminAccount({
      permissions: ["account.manage-own", "inquiries.view", "inquiries.change-status"],
    });
    const { user } = await openInquiry({
      "GET me": [me(adminAccount()), me(withoutReveal)],
      "POST inquiries/42/contact-reveal": revealed(),
      "PUT inquiries/42/status": json(403, { message: "This action is unauthorized." }),
    });
    await confirmReveal(user);
    expect(await screen.findByText(REVEALED_CONTACT)).toBeVisible();

    // A refused write makes the console read the account again (refreshAccount).
    await user.click(screen.getByRole("button", { name: "Tandai ditinjau" }));
    await user.click(within(dialog()).getByRole("button", { name: "Tandai ditinjau" }));

    expect(
      await screen.findByText("Akun Anda tidak mendapat izin membuka kontak lengkap."),
    ).toBeVisible();
    expect(screen.queryByText(REVEALED_CONTACT)).not.toBeInTheDocument();
  });

  it("leaves the DOM with the account when the session ends", async () => {
    const { user, router } = await openInquiry({ "POST inquiries/42/contact-reveal": revealed() });
    await confirmReveal(user);
    expect(await screen.findByText(REVEALED_CONTACT)).toBeVisible();
    mockAdminApi({ "GET me": unauthenticated(), "POST inquiries/42/notes": unauthenticated() });

    await user.type(screen.getByLabelText("Catatan baru"), "Catatan uji");
    await user.click(screen.getByRole("button", { name: "Tambah catatan" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/masuk"));
    expect(document.body.textContent).not.toContain(REVEALED_CONTACT);
  });
});

describe("visitor content", () => {
  it("is plain text: markup, scripts, and links are shown, never run or linked", async () => {
    const hostile = [
      '<img src=x onerror="window.__pwned=1">',
      "<script>window.__pwned=1</script>",
      '<a href="javascript:alert(1)">klik</a>',
      "https://phishing.example.test/login?next=admin",
      `Tanda khusus: ${String.fromCharCode(0x202e)}txt.exe & < > " ' ${String.fromCharCode(0)}`,
    ].join(String.fromCharCode(10));
    mockAdminApi({
      "GET me": me(adminAccount()),
      "GET inquiries/42": json(200, {
        data: sampleInquiry({ name: "<b>Nama</b> & co", message: hostile }),
      }),
      "GET inquiries/42/status-changes": page([]),
      "GET inquiries/42/notes": page([]),
    });
    renderApp("/inquiry/42");

    expect(
      await screen.findByRole("heading", { level: 1, name: "<b>Nama</b> & co" }),
    ).toBeVisible();
    const message = screen.getByText(/onerror/);
    expect(message.querySelector("img, script, a, b")).toBeNull();
    expect(message.textContent).toContain("<script>window.__pwned=1</script>");
    expect(screen.queryByRole("link", { name: /phishing|klik/ })).not.toBeInTheDocument();
    expect(document.querySelector("main img, main script")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });
});

describe("answers out of order", () => {
  it("never lets an older read paint over a newer state", async () => {
    let releaseRead: (response: Response) => void = () => undefined;
    const { user } = await openInquiry({
      "GET inquiries/42": [
        json(200, { data: sampleInquiry() }),
        () =>
          new Promise<Response>((resolve) => {
            releaseRead = resolve;
          }),
      ],
      "PUT inquiries/42/status": [
        json(502, { message: "Bad Gateway" }),
        json(200, {
          data: sampleInquiry({
            status: "in-review",
            allowed_transitions: ["contacted", "closed"],
            status_changes_count: 1,
          }),
        }),
      ],
    });

    // An uncertain change, then a check whose read is slow.
    await user.click(screen.getByRole("button", { name: "Tandai ditinjau" }));
    await user.click(within(dialog()).getByRole("button", { name: "Tandai ditinjau" }));
    await user.click(await screen.findByRole("button", { name: "Periksa keadaan inquiry" }));

    // Meanwhile a confirmed change lands first.
    await user.click(screen.getByRole("button", { name: "Tandai ditinjau" }));
    await user.click(within(dialog()).getByRole("button", { name: "Tandai ditinjau" }));
    expect(await screen.findByText("Status inquiry sekarang Ditinjau.")).toBeVisible();

    // The slow read answers with the older state: dropped.
    releaseRead(json(200, { data: sampleInquiry() }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole("button", { name: "Tandai sudah dihubungi" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Tandai ditinjau" })).not.toBeInTheDocument();
  });
});
