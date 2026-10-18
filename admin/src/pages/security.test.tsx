import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSession } from "~/auth/session";
import {
  json,
  me,
  mockAdminApi,
  noContent,
  renderApp,
  sampleAccount,
  unauthenticated,
} from "~/test/admin-api";

const HANDLE_CURRENT = "a".repeat(32);
const HANDLE_OTHER = "b".repeat(32);
const NEW_CODES = ["new0000000-0000000001", "new0000000-0000000002"];

afterEach(() => {
  vi.unstubAllGlobals();
  resetSession();
});

const sessions = (withOther = true) =>
  json(200, {
    data: [
      {
        id: HANDLE_CURRENT,
        current: true,
        ip_address: "127.0.0.1",
        user_agent: "Mozilla/5.0 (current browser)",
        last_active_at: "2026-10-17T02:00:00+00:00",
      },
      ...(withOther
        ? [
            {
              id: HANDLE_OTHER,
              current: false,
              ip_address: "203.0.113.5",
              user_agent: "Mozilla/5.0 (other device)",
              last_active_at: "2026-10-17T01:00:00+00:00",
            },
          ]
        : []),
    ],
  });

async function openSecurity(routes: Parameters<typeof mockAdminApi>[0]) {
  const api = mockAdminApi({ "GET me": me(), "GET me/sessions": sessions(), ...routes });
  const user = userEvent.setup();
  const router = renderApp("/akun/keamanan");
  await screen.findByRole("heading", { level: 1, name: "Keamanan akun" });

  return { api, user, router };
}

describe("password", () => {
  it("changes it, reports the sessions ended, and refreshes account and sessions", async () => {
    const { api, user } = await openSecurity({
      "PUT me/password": json(200, { data: { other_sessions_ended: 1 } }),
    });
    await screen.findByText("Mozilla/5.0 (other device)");

    await user.type(screen.getByLabelText("Kata sandi sekarang"), "the old passphrase");
    await user.type(screen.getByLabelText("Kata sandi baru"), "a brand new passphrase");
    await user.type(screen.getByLabelText("Ulangi kata sandi baru"), "a brand new passphrase");
    await user.click(screen.getByRole("button", { name: "Ganti kata sandi" }));

    expect(await screen.findByText("Kata sandi diganti. 1 sesi lain diakhiri.")).toBeVisible();
    expect(api.callsTo("PUT me/password")[0]!.body).toEqual({
      current_password: "the old passphrase",
      password: "a brand new passphrase",
      password_confirmation: "a brand new passphrase",
    });
    expect(screen.getByLabelText("Kata sandi sekarang")).toHaveValue("");
    await waitFor(() => expect(api.callsTo("GET me/sessions").length).toBeGreaterThanOrEqual(2));
    expect(api.callsTo("GET me").length).toBeGreaterThanOrEqual(2);
  });

  it("puts a wrong current password on its field", async () => {
    const { user } = await openSecurity({
      "PUT me/password": json(422, {
        message: "The password is incorrect.",
        errors: { current_password: ["The password is incorrect."] },
      }),
    });

    await user.type(screen.getByLabelText("Kata sandi sekarang"), "not the password");
    await user.type(screen.getByLabelText("Kata sandi baru"), "a brand new passphrase");
    await user.type(screen.getByLabelText("Ulangi kata sandi baru"), "a brand new passphrase");
    await user.click(screen.getByRole("button", { name: "Ganti kata sandi" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Kata sandi sekarang")).toHaveAccessibleDescription(
        "Kata sandi sekarang tidak cocok.",
      ),
    );
  });

  it.each([
    ["419", () => json(419, { message: "CSRF token mismatch." }), /belum diproses server/],
    [
      "network failure",
      () => {
        throw new TypeError("Failed to fetch");
      },
      /kata sandi mungkin sudah diganti/,
    ],
    [
      "503",
      () => json(503, { message: "Service Unavailable" }),
      /kata sandi mungkin sudah diganti/,
    ],
  ])("after a %s it reports and never resends", async (_, answer, text) => {
    const { api, user } = await openSecurity({ "PUT me/password": answer });

    await user.type(screen.getByLabelText("Kata sandi sekarang"), "the old passphrase");
    await user.type(screen.getByLabelText("Kata sandi baru"), "a brand new passphrase");
    await user.type(screen.getByLabelText("Ulangi kata sandi baru"), "a brand new passphrase");
    await user.click(screen.getByRole("button", { name: "Ganti kata sandi" }));

    expect(await screen.findByText(text)).toBeVisible();
    expect(api.callsTo("PUT me/password")).toHaveLength(1);
  });

  it("goes to sign-in when the session ended meanwhile", async () => {
    const { user, router } = await openSecurity({ "PUT me/password": unauthenticated() });
    mockAdminApi({ "GET me": unauthenticated(), "PUT me/password": unauthenticated() });

    await user.type(screen.getByLabelText("Kata sandi sekarang"), "the old passphrase");
    await user.type(screen.getByLabelText("Kata sandi baru"), "a brand new passphrase");
    await user.type(screen.getByLabelText("Ulangi kata sandi baru"), "a brand new passphrase");
    await user.click(screen.getByRole("button", { name: "Ganti kata sandi" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/masuk"));
    expect(router.state.location.search).toContain("alasan=berakhir");
  });
});

describe("recovery codes", () => {
  it("423 asks for the password, then a deliberate second decision, then shows codes once", async () => {
    const { api, user } = await openSecurity({
      "POST me/two-factor-recovery-codes": [
        json(423, { message: "Password confirmation required." }),
        json(200, { data: { recovery_codes: NEW_CODES } }),
      ],
      // Fortify answers JSON "" with 201 (PasswordConfirmedResponse).
      "POST auth/confirm-password": json(201, ""),
    });

    await user.click(screen.getByRole("button", { name: "Buat kode pemulihan baru" }));
    const confirm = await screen.findByRole("dialog", { name: "Buat kode pemulihan baru?" });
    expect(within(confirm).getByRole("button", { name: "Batal" })).toHaveFocus();
    await user.click(within(confirm).getByRole("button", { name: "Buat kode baru" }));

    const reauth = await screen.findByRole("dialog", { name: "Konfirmasi kata sandi" });
    const password = within(reauth).getByLabelText("Kata sandi");
    expect(password).toHaveFocus();
    await user.type(password, "my passphrase");
    await user.click(within(reauth).getByRole("button", { name: "Konfirmasi" }));

    const confirmed = await screen.findByRole("dialog", { name: "Kata sandi dikonfirmasi" });
    // Confirmed, but nothing regenerated yet.
    expect(api.callsTo("POST me/two-factor-recovery-codes")).toHaveLength(1);
    expect(api.callsTo("POST auth/confirm-password")[0]!.body).toEqual({
      password: "my passphrase",
    });

    await user.click(within(confirmed).getByRole("button", { name: "Buat kode baru" }));

    expect(await screen.findByText("Kode pemulihan lama sudah tidak berlaku.")).toBeVisible();
    for (const code of NEW_CODES) {
      expect(screen.getByText(code)).toBeVisible();
    }
    expect(api.callsTo("POST me/two-factor-recovery-codes")).toHaveLength(2);
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(NEW_CODES[0]);

    await user.click(screen.getByRole("checkbox", { name: /Saya sudah menyimpan kode ini/ }));
    await user.click(screen.getByRole("button", { name: "Selesai" }));
    expect(screen.queryByText(NEW_CODES[0]!)).toBeNull();
  });

  it("a wrong password keeps the dialog open and regenerates nothing", async () => {
    const { api, user } = await openSecurity({
      "POST me/two-factor-recovery-codes": json(423, {
        message: "Password confirmation required.",
      }),
      "POST auth/confirm-password": json(422, {
        message: "The provided password was incorrect.",
        errors: { password: ["The provided password was incorrect."] },
      }),
    });

    await user.click(screen.getByRole("button", { name: "Buat kode pemulihan baru" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Buat kode baru" }),
    );
    const reauth = await screen.findByRole("dialog", { name: "Konfirmasi kata sandi" });
    await user.type(within(reauth).getByLabelText("Kata sandi"), "wrong");
    await user.click(within(reauth).getByRole("button", { name: "Konfirmasi" }));

    expect(await within(reauth).findByText("Kata sandi tidak cocok.")).toBeVisible();
    expect(api.callsTo("POST me/two-factor-recovery-codes")).toHaveLength(1);
  });

  it("blocks leaving before the codes are acknowledged", async () => {
    const { user, router } = await openSecurity({
      "POST me/two-factor-recovery-codes": json(200, { data: { recovery_codes: NEW_CODES } }),
    });

    await user.click(screen.getByRole("button", { name: "Buat kode pemulihan baru" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Buat kode baru" }),
    );
    await screen.findByText(NEW_CODES[0]!);

    const [nav] = screen.getAllByRole("navigation", { name: "Navigasi utama", hidden: true });
    await user.click(within(nav!).getByRole("link", { name: "Akun", hidden: true }));

    const leave = await screen.findByRole("dialog", { name: "Kode pemulihan belum disimpan" });
    expect(within(leave).getByRole("button", { name: "Tetap di sini" })).toHaveFocus();
    await user.click(within(leave).getByRole("button", { name: "Tetap di sini" }));
    expect(router.state.location.pathname).toBe("/akun/keamanan");
    expect(screen.getByText(NEW_CODES[0]!)).toBeVisible();
  });
});

describe("sessions", () => {
  it("lists what Laravel returns, never the handle, and ends another session after confirming", async () => {
    const { api, user } = await openSecurity({
      "GET me/sessions": [sessions(), sessions(false)],
      [`DELETE me/sessions/${HANDLE_OTHER}`]: noContent(),
    });

    expect(await screen.findByText("Mozilla/5.0 (other device)")).toBeVisible();
    expect(screen.getByText("203.0.113.5")).toBeVisible();
    expect(screen.getByText("Perangkat ini")).toBeVisible();
    expect(document.body.textContent).not.toContain(HANDLE_OTHER);
    // The current session cannot be ended here (sign out instead).
    expect(screen.getAllByRole("button", { name: "Akhiri sesi" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Akhiri sesi" }));
    const dialog = await screen.findByRole("dialog", { name: "Akhiri sesi ini?" });
    await user.click(within(dialog).getByRole("button", { name: "Akhiri sesi" }));

    expect(await screen.findByText("Sesi diakhiri.")).toBeVisible();
    expect(api.callsTo(`DELETE me/sessions/${HANDLE_OTHER}`)).toHaveLength(1);
    expect(
      await screen.findByText("Tidak ada sesi lain. Hanya perangkat ini yang sedang masuk."),
    ).toBeVisible();
  });

  it("cancelling ends nothing", async () => {
    const { api, user } = await openSecurity({});
    await screen.findByText("Mozilla/5.0 (other device)");

    await user.click(screen.getByRole("button", { name: "Akhiri semua sesi lain" }));
    const dialog = await screen.findByRole("dialog", { name: "Akhiri semua sesi lain?" });
    await user.click(within(dialog).getByRole("button", { name: "Batal" }));

    expect(api.calls.filter((call) => call.method === "DELETE")).toHaveLength(0);
  });

  it("ends all other sessions and says how many", async () => {
    const { user } = await openSecurity({
      "GET me/sessions": [sessions(), sessions(false)],
      "DELETE me/sessions": json(200, { data: { other_sessions_ended: 1 } }),
    });
    await screen.findByText("Mozilla/5.0 (other device)");

    await user.click(screen.getByRole("button", { name: "Akhiri semua sesi lain" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Akhiri semua sesi lain",
      }),
    );

    expect(await screen.findByText("1 sesi lain diakhiri.")).toBeVisible();
  });

  it("an uncertain end is not repeated; the list can be reloaded", async () => {
    const { api, user } = await openSecurity({
      [`DELETE me/sessions/${HANDLE_OTHER}`]: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await screen.findByText("Mozilla/5.0 (other device)");

    await user.click(screen.getByRole("button", { name: "Akhiri sesi" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Akhiri sesi" }),
    );

    expect(
      await screen.findByText(/Muat ulang daftar untuk melihat keadaan sekarang/),
    ).toBeVisible();
    expect(api.callsTo(`DELETE me/sessions/${HANDLE_OTHER}`)).toHaveLength(1);
  });
});

describe("account", () => {
  it("is read-only and shows what GET me returns", async () => {
    mockAdminApi({
      "GET me": me(
        sampleAccount({ two_factor: { confirmed_at: null, recovery_codes_remaining: 2 } }),
      ),
    });
    renderApp("/akun");

    expect(await screen.findByRole("heading", { level: 1, name: "Akun" })).toBeVisible();
    expect(screen.getByText("owner@example.test")).toBeVisible();
    expect(screen.getByText("Belum terkonfirmasi")).toBeVisible();
    expect(screen.getByText("2 kode tersisa")).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("the home screen warns when few recovery codes are left", async () => {
    mockAdminApi({
      "GET me": me(
        sampleAccount({
          two_factor: { confirmed_at: "2026-10-16T05:31:00+00:00", recovery_codes_remaining: 1 },
        }),
      ),
    });
    renderApp("/");

    expect(await screen.findByText(/Tersisa 1 kode pemulihan/)).toBeVisible();
  });
});
