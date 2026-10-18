import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSession } from "~/auth/session";
import {
  json,
  me,
  mockAdminApi,
  ownerAccount,
  page,
  renderApp,
  sampleAccount,
  sampleUser,
} from "~/test/admin-api";

afterEach(() => {
  vi.unstubAllGlobals();
  resetSession();
});

const RESET_URL = "http://127.0.0.1:5174/access#token=" + "r".repeat(43);
const needsPassword = () => json(423, { message: "Password confirmation required." });

async function openAccount(
  routes: Parameters<typeof mockAdminApi>[0],
  account = ownerAccount(),
  path = "/pengguna/2",
) {
  const api = mockAdminApi({
    "GET me": me(account),
    "GET users/2": json(200, { data: sampleUser() }),
    "GET users": page([]),
    "GET audit-events": page([]),
    ...routes,
  });
  const user = userEvent.setup();
  renderApp(path);

  return { api, user };
}

const dialog = () => screen.getByRole("dialog");

describe("the account and what it allows", () => {
  it("shows the account as Laravel reports it, with the owner actions", async () => {
    await openAccount({});

    expect(await screen.findByRole("heading", { level: 1, name: "Contoh Admin" })).toBeVisible();
    expect(screen.getByText("admin@example.test")).toBeVisible();
    expect(screen.getByRole("button", { name: "Jadikan Owner" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tangguhkan akun" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reset kredensial" })).toBeVisible();
  });

  it("offers no action on the owner's own account", async () => {
    await openAccount({
      "GET users/2": json(200, { data: sampleUser({ is_current_user: true, role: "owner" }) }),
    });

    await screen.findByText(/Ini akun Anda/);
    expect(screen.queryByRole("heading", { name: "Tindakan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tangguhkan/ })).not.toBeInTheDocument();
  });

  it("explains instead of offering a role change or reset to a pending account", async () => {
    await openAccount({
      "GET users/2": json(200, { data: sampleUser({ status: "pending" }) }),
    });

    expect(await screen.findByText(/mendapat perannya dari undangan/)).toBeVisible();
    expect(screen.getByText(/dipulihkan dengan undangan baru/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Jadikan Owner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset kredensial" })).not.toBeInTheDocument();
  });

  it("asks nothing of Laravel for an ID that is not a number", async () => {
    const { api } = await openAccount({}, ownerAccount(), "/pengguna/abc");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Akun tidak ditemukan" }),
    ).toBeVisible();
    expect(api.callsTo("GET users/abc")).toHaveLength(0);
  });

  it("says when the account does not exist", async () => {
    await openAccount({ "GET users/2": json(404, { message: "Account not found." }) });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Akun tidak ditemukan" }),
    ).toBeVisible();
  });

  it("shows the owner-only state to an account without the permission, without asking", async () => {
    const { api } = await openAccount({}, sampleAccount({ role: "admin" }));

    expect(await screen.findByRole("heading", { name: "Khusus owner" })).toBeVisible();
    expect(api.callsTo("GET users/2")).toHaveLength(0);
  });
});

describe("a sensitive write", () => {
  it("asks for the password on 423, then needs one more press before sending again", async () => {
    const { api, user } = await openAccount({
      "POST users/2/suspension": [
        needsPassword(),
        json(200, { data: sampleUser({ status: "suspended", active_sessions: 0 }) }),
      ],
      "POST auth/confirm-password": json(201, ""),
    });

    await user.click(await screen.findByRole("button", { name: "Tangguhkan akun" }));
    expect(
      within(dialog()).getByRole("heading", { name: "Tangguhkan Contoh Admin?" }),
    ).toBeVisible();
    // Focus starts on the safe choice.
    expect(within(dialog()).getByRole("button", { name: "Batal" })).toHaveFocus();

    await user.click(within(dialog()).getByRole("button", { name: "Tangguhkan akun" }));
    expect(
      await within(dialog()).findByRole("heading", { name: "Konfirmasi kata sandi" }),
    ).toBeVisible();
    expect(api.callsTo("POST users/2/suspension")).toHaveLength(1);

    await user.type(within(dialog()).getByLabelText("Kata sandi Anda"), "kata sandi owner");
    await user.click(within(dialog()).getByRole("button", { name: "Konfirmasi kata sandi" }));

    expect(
      await within(dialog()).findByRole("heading", { name: "Kata sandi dikonfirmasi" }),
    ).toBeVisible();
    // Confirmed, but nothing was sent again by itself.
    expect(api.callsTo("POST users/2/suspension")).toHaveLength(1);
    expect(api.callsTo("POST auth/confirm-password")[0]!.body).toEqual({
      password: "kata sandi owner",
    });

    await user.click(within(dialog()).getByRole("button", { name: "Tangguhkan akun" }));

    expect(await screen.findByText(/Contoh Admin ditangguhkan/)).toBeVisible();
    expect(api.callsTo("POST users/2/suspension")).toHaveLength(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktifkan ulang" })).toBeVisible();
  });

  it("keeps the dialog after a 419 and sends nothing until pressed again", async () => {
    const { api, user } = await openAccount({
      "PUT users/2/role": [
        json(419, { message: "CSRF token mismatch." }),
        json(200, { data: sampleUser({ role: "owner" }) }),
      ],
    });

    await user.click(await screen.findByRole("button", { name: "Jadikan Owner" }));
    await user.click(within(dialog()).getByRole("button", { name: "Jadikan Owner" }));

    expect(await within(dialog()).findByText(/belum diproses server/)).toBeVisible();
    expect(api.callsTo("PUT users/2/role")).toHaveLength(1);

    await user.click(within(dialog()).getByRole("button", { name: "Jadikan Owner" }));
    expect(await screen.findByText(/Contoh Admin sekarang Owner/)).toBeVisible();
    expect(api.callsTo("PUT users/2/role")).toHaveLength(2);
    expect(api.callsTo("PUT users/2/role")[1]!.body).toEqual({ role: "owner" });
  });

  it("explains a 409 by its code, leaves only Close, and reloads the account", async () => {
    const { api, user } = await openAccount({
      "PUT users/2/role": json(409, {
        message: "At least one active owner must remain.",
        code: "last_active_owner",
      }),
      "GET users/2": [
        json(200, { data: sampleUser({ role: "owner" }) }),
        json(200, { data: sampleUser({ role: "owner" }) }),
      ],
    });

    await user.click(await screen.findByRole("button", { name: "Jadikan Admin" }));
    await user.click(within(dialog()).getByRole("button", { name: "Jadikan Admin" }));

    expect(await within(dialog()).findByText(/tanpa owner aktif/)).toBeVisible();
    expect(
      within(dialog()).queryByRole("button", { name: "Jadikan Admin" }),
    ).not.toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Tutup" })).toBeVisible();
    await waitFor(() => expect(api.callsTo("GET users/2")).toHaveLength(2));
    expect(api.callsTo("PUT users/2/role")).toHaveLength(1);
  });

  it("counts down a 429 and sends nothing while it runs", async () => {
    const { api, user } = await openAccount({
      "POST users/2/suspension": json(
        429,
        { message: "Too Many Attempts." },
        { "Retry-After": "30" },
      ),
    });

    await user.click(await screen.findByRole("button", { name: "Tangguhkan akun" }));
    await user.click(within(dialog()).getByRole("button", { name: "Tangguhkan akun" }));
    expect(await within(dialog()).findByText(/Coba lagi dalam \d+ detik/)).toBeVisible();

    await user.click(within(dialog()).getByRole("button", { name: "Tangguhkan akun" }));
    expect(api.callsTo("POST users/2/suspension")).toHaveLength(1);
  });

  it("resolves an uncertain outcome by reading the account, never by resending", async () => {
    const { api, user } = await openAccount({
      "POST users/2/suspension": json(500, { message: "Server Error" }),
      "GET users/2": [
        json(200, { data: sampleUser() }),
        json(200, { data: sampleUser({ status: "suspended" }) }),
      ],
    });

    await user.click(await screen.findByRole("button", { name: "Tangguhkan akun" }));
    await user.click(within(dialog()).getByRole("button", { name: "Tangguhkan akun" }));

    expect(await screen.findByText(/mungkin sudah berlaku/)).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Periksa keadaan akun" }));
    expect(await screen.findByText(/yang tercatat di server sekarang/)).toBeVisible();
    expect(screen.getAllByText("Ditangguhkan").length).toBeGreaterThan(0);
    expect(api.callsTo("POST users/2/suspension")).toHaveLength(1);
  });
});

describe("a credential reset", () => {
  const issued = () =>
    json(201, {
      data: {
        account: sampleUser({ status: "credential-reset-pending", two_factor_confirmed: false }),
        access_link: {
          id: 7,
          purpose: "credential-reset",
          url: RESET_URL,
          expires_at: "2099-10-19T07:00:00+00:00",
        },
      },
    });

  it("needs the acknowledgement before anything is sent", async () => {
    const { api, user } = await openAccount({ "POST users/2/credential-reset": issued() });

    await user.click(await screen.findByRole("button", { name: "Reset kredensial" }));
    await user.click(within(dialog()).getByRole("button", { name: "Reset kredensial" }));

    expect(within(dialog()).getByText(/Centang pernyataan/)).toBeVisible();
    expect(api.callsTo("POST users/2/credential-reset")).toHaveLength(0);
  });

  it("shows the link once, keeps it out of storage, and drops it on Done", async () => {
    const { api, user } = await openAccount({ "POST users/2/credential-reset": issued() });

    await user.click(await screen.findByRole("button", { name: "Reset kredensial" }));
    await user.click(within(dialog()).getByRole("checkbox", { name: /tidak dapat masuk sampai/ }));
    await user.click(within(dialog()).getByRole("button", { name: "Reset kredensial" }));

    const heading = await screen.findByRole("heading", { name: "Tautan reset untuk Contoh Admin" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText(RESET_URL)).toBeVisible();
    expect(api.callsTo("POST users/2/credential-reset")[0]!.body).toEqual({
      acknowledge_access_loss: true,
    });
    // While the link is on screen there is no second action that could replace it.
    expect(screen.queryByRole("heading", { name: "Tindakan" })).not.toBeInTheDocument();

    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain("r".repeat(43));
    expect(window.location.href).not.toContain("r".repeat(43));

    await user.click(screen.getByRole("button", { name: "Selesai" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Centang konfirmasi/);
    expect(screen.getByText(RESET_URL)).toBeVisible();

    await user.click(screen.getByRole("checkbox", { name: /sudah menyalin atau menyerahkan/ }));
    await user.click(screen.getByRole("button", { name: "Selesai" }));

    await waitFor(() => expect(screen.queryByText(RESET_URL)).not.toBeInTheDocument());
    expect(document.body.innerHTML).not.toContain("r".repeat(43));
    expect(screen.getByRole("button", { name: "Terbitkan reset baru" })).toBeVisible();
  });

  it("explains an uncertain reset that did apply: the link cannot be shown again", async () => {
    const { api, user } = await openAccount({
      "POST users/2/credential-reset": json(502, { message: "Bad Gateway" }),
      "GET users/2": [
        json(200, { data: sampleUser() }),
        json(200, {
          data: sampleUser({
            status: "credential-reset-pending",
            open_access_link: {
              id: 7,
              purpose: "credential-reset",
              status: "pending",
              issued_by_user_id: 1,
              created_at: "2099-10-18T07:00:00+00:00",
              expires_at: "2099-10-19T07:00:00+00:00",
              redeemed_at: null,
            },
          }),
        }),
      ],
    });

    await user.click(await screen.findByRole("button", { name: "Reset kredensial" }));
    await user.click(within(dialog()).getByRole("checkbox", { name: /tidak dapat masuk sampai/ }));
    await user.click(within(dialog()).getByRole("button", { name: "Reset kredensial" }));
    await user.click(await screen.findByRole("button", { name: "Periksa keadaan akun" }));

    expect(await screen.findByText(/tautannya tidak dapat ditampilkan lagi/)).toBeVisible();
    expect(api.callsTo("POST users/2/credential-reset")).toHaveLength(1);
  });
});
