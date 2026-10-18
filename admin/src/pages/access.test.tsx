import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSession } from "~/auth/session";
import { holdAccessLinkToken, releaseHeldAccessLinkToken } from "~/lib/access-link";
import {
  json,
  me,
  mockAdminApi,
  renderApp,
  sampleAccount,
  unauthenticated,
} from "~/test/admin-api";
import { svgDataUri } from "./access";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";
const SETUP_KEY = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const CODES = ["aaaaaaaaaa-bbbbbbbbbb", "cccccccccc-dddddddddd"];
const QR =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
const PASSWORD = "a long enough passphrase";

afterEach(() => {
  vi.unstubAllGlobals();
  resetSession();
  releaseHeldAccessLinkToken();
});

/** Simulates opening `/access#token=...`: main.tsx holds the token before the router starts. */
function arriveWithToken() {
  window.history.replaceState(null, "", `/access#token=${TOKEN}`);
  holdAccessLinkToken(window, "/access");
  expect(window.location.hash).toBe("");
}

const inspection = (purpose: "activation" | "credential-reset") =>
  json(200, {
    data: {
      purpose,
      email: "o***@example.test",
      requires_name: purpose === "activation",
      expires_at: "2026-10-17T06:00:00+00:00",
    },
  });

const redemption = () =>
  json(200, {
    data: {
      two_factor: { qr_code_svg: QR, setup_key: SETUP_KEY },
      confirm_before: "2026-10-17T05:45:00+00:00",
    },
  });

const confirmation = () => json(200, { data: { recovery_codes: CODES, account: sampleAccount() } });

async function fillActivation(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Nama"), "Contoh Owner");
  await user.type(screen.getByLabelText("Kata sandi baru"), PASSWORD);
  await user.type(screen.getByLabelText("Ulangi kata sandi baru"), PASSWORD);
  await user.click(screen.getByRole("button", { name: "Simpan dan lanjut" }));
}

describe("access links", () => {
  it("without a token explains how to get a new link and calls nothing", async () => {
    const api = mockAdminApi({});
    renderApp("/access");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Tautan akses tidak lengkap" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: "Cara mendapatkan tautan baru" }),
    ).toBeVisible();
    expect(api.calls).toHaveLength(0);
  });

  it("activation: inspect, redeem on submit only, QR as an image, confirm, codes once", async () => {
    arriveWithToken();
    const api = mockAdminApi({
      "POST access-links/inspect": inspection("activation"),
      "POST access-links/redeem": redemption(),
      "POST access-links/confirm": confirmation(),
      "GET me": me(),
    });
    const user = userEvent.setup();
    const router = renderApp("/access");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Aktifkan akun admin" }),
    ).toBeVisible();
    expect(screen.getByText("o***@example.test")).toBeVisible();
    expect(api.callsTo("POST access-links/inspect")[0]!.body).toEqual({ token: TOKEN });
    expect(api.callsTo("POST access-links/redeem")).toHaveLength(0);

    await fillActivation(user);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Daftarkan aplikasi autentikator" }),
    ).toBeVisible();
    expect(api.callsTo("POST access-links/redeem")[0]!.body).toEqual({
      token: TOKEN,
      name: "Contoh Owner",
      password: PASSWORD,
      password_confirmation: PASSWORD,
    });

    const qr = screen.getByRole("img", { name: /Kode QR untuk mendaftarkan/ });
    expect(qr.tagName).toBe("IMG");
    expect(qr.getAttribute("src")).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
    // The SVG is never injected as markup.
    expect(document.querySelector("main svg rect")).toBeNull();
    expect(document.querySelector('[aria-labelledby="setup-key-label"]')).toHaveTextContent(
      "JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP",
    );

    await user.type(screen.getByLabelText("Kode 6 digit dari aplikasi"), "654321");
    await user.click(screen.getByRole("button", { name: "Konfirmasi dan aktifkan akun" }));

    expect(
      await screen.findByRole("heading", { level: 2, name: "Simpan kode pemulihan Anda" }),
    ).toBeVisible();
    for (const code of CODES) {
      expect(screen.getByText(code)).toBeVisible();
    }
    expect(api.callsTo("POST access-links/confirm")[0]!.body).toEqual({ code: "654321" });

    // Nothing secret is in browser storage, the address, or the history state.
    const stored = JSON.stringify({ ...localStorage, ...sessionStorage, h: history.state });
    for (const secret of [TOKEN, SETUP_KEY, PASSWORD, ...CODES]) {
      expect(stored).not.toContain(secret);
      expect(window.location.href).not.toContain(secret);
    }

    // Acknowledgement first.
    await user.click(screen.getByRole("button", { name: "Lanjut ke konsol" }));
    expect(
      await screen.findByText("Centang konfirmasi di atas setelah kode tersimpan."),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/access");

    await user.click(
      screen.getByRole("checkbox", {
        name: "Saya sudah menyimpan kode ini di tempat aman di luar konsol",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Lanjut ke konsol" }));
    await screen.findByRole("heading", { level: 1, name: "Beranda konsol" });
    expect(document.body.textContent).not.toContain(CODES[0]);
  });

  it("credential reset says the old authenticator is gone and asks for no name", async () => {
    arriveWithToken();
    const api = mockAdminApi({
      "POST access-links/inspect": inspection("credential-reset"),
      "POST access-links/redeem": redemption(),
    });
    const user = userEvent.setup();
    renderApp("/access");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Atur ulang akses akun" }),
    ).toBeVisible();
    expect(
      screen.getByText(/Autentikator dan kode pemulihan lama sudah tidak berlaku/),
    ).toBeVisible();
    expect(screen.queryByLabelText("Nama")).toBeNull();

    await user.type(screen.getByLabelText("Kata sandi baru"), PASSWORD);
    await user.type(screen.getByLabelText("Ulangi kata sandi baru"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Simpan dan lanjut" }));

    expect(
      await screen.findByRole("button", { name: "Konfirmasi autentikator baru" }),
    ).toBeVisible();
    expect(api.callsTo("POST access-links/redeem")[0]!.body).not.toHaveProperty("name");
  });

  it("an unknown, expired, used, or revoked link gets one answer and no form", async () => {
    arriveWithToken();
    mockAdminApi({
      "POST access-links/inspect": json(404, {
        message: "This access link is invalid or has expired.",
      }),
    });
    renderApp("/access");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Tautan ini tidak dapat dipakai" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Kata sandi baru")).toBeNull();
  });

  it("checks the password policy before using the link", async () => {
    arriveWithToken();
    const api = mockAdminApi({ "POST access-links/inspect": inspection("activation") });
    const user = userEvent.setup();
    renderApp("/access");

    await user.type(await screen.findByLabelText("Nama"), "Contoh");
    await user.type(screen.getByLabelText("Kata sandi baru"), "short");
    await user.type(screen.getByLabelText("Ulangi kata sandi baru"), "short");
    await user.click(screen.getByRole("button", { name: "Simpan dan lanjut" }));
    expect(screen.getByLabelText("Kata sandi baru")).toHaveAccessibleDescription(
      expect.stringContaining("Kata sandi minimal 12 karakter."),
    );

    // 73 bytes: 12 characters, but too long for bcrypt.
    const long = "é".repeat(36) + "x";
    await user.clear(screen.getByLabelText("Kata sandi baru"));
    await user.type(screen.getByLabelText("Kata sandi baru"), long);
    await user.click(screen.getByRole("button", { name: "Simpan dan lanjut" }));
    expect(screen.getByLabelText("Kata sandi baru")).toHaveAccessibleDescription(
      expect.stringContaining("maksimal 72 byte"),
    );
    expect(api.callsTo("POST access-links/redeem")).toHaveLength(0);
  });

  it("an uncertain redeem is never resent; the person checks the link first", async () => {
    arriveWithToken();
    const api = mockAdminApi({
      "POST access-links/inspect": [
        inspection("activation"),
        json(404, { message: "This access link is invalid or has expired." }),
      ],
      "POST access-links/redeem": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const user = userEvent.setup();
    renderApp("/access");
    await fillActivation(user);

    expect(await screen.findByText(/tautan mungkin sudah terpakai/)).toBeVisible();
    expect(api.callsTo("POST access-links/redeem")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Periksa tautan" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Tautan ini tidak dapat dipakai" }),
    ).toBeVisible();
    expect(api.callsTo("POST access-links/redeem")).toHaveLength(1);
  });

  it("a 419 on redeem is not resent automatically", async () => {
    arriveWithToken();
    const api = mockAdminApi({
      "POST access-links/inspect": inspection("activation"),
      "POST access-links/redeem": json(419, { message: "CSRF token mismatch." }),
    });
    const user = userEvent.setup();
    renderApp("/access");
    await fillActivation(user);

    expect(await screen.findByText(/permintaan tadi belum diproses server/)).toBeVisible();
    expect(api.callsTo("POST access-links/redeem")).toHaveLength(1);
  });

  it("an expired enrollment says a new link is needed", async () => {
    arriveWithToken();
    mockAdminApi({
      "POST access-links/inspect": inspection("activation"),
      "POST access-links/redeem": redemption(),
      "POST access-links/confirm": json(404, {
        message: "This access link is invalid or has expired.",
      }),
    });
    const user = userEvent.setup();
    renderApp("/access");
    await fillActivation(user);

    await user.type(await screen.findByLabelText("Kode 6 digit dari aplikasi"), "654321");
    await user.click(screen.getByRole("button", { name: "Konfirmasi dan aktifkan akun" }));

    expect(await screen.findByText(/Pendaftaran ini tidak dapat diselesaikan/)).toBeVisible();
    expect(screen.queryByText(/JBSW/)).toBeNull();
  });

  it("an uncertain confirmation is resolved by a read, never a resend", async () => {
    arriveWithToken();
    const api = mockAdminApi({
      "POST access-links/inspect": inspection("activation"),
      "POST access-links/redeem": redemption(),
      "POST access-links/confirm": () => {
        throw new TypeError("Failed to fetch");
      },
      "GET me": me(),
    });
    const user = userEvent.setup();
    renderApp("/access");
    await fillActivation(user);

    await user.type(await screen.findByLabelText("Kode 6 digit dari aplikasi"), "654321");
    await user.click(screen.getByRole("button", { name: "Konfirmasi dan aktifkan akun" }));
    await user.click(await screen.findByRole("button", { name: "Periksa akun" }));

    expect(await screen.findByText(/kode pemulihannya tidak dapat ditampilkan lagi/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Buka Keamanan" })).toHaveAttribute(
      "href",
      "/akun/keamanan",
    );
    expect(api.callsTo("POST access-links/confirm")).toHaveLength(1);
  });

  it("while signed in, offers to sign out and then checks the same link again", async () => {
    arriveWithToken();
    const api = mockAdminApi({
      "POST access-links/inspect": [
        json(409, { message: "You are already signed in. Sign out first." }),
        inspection("activation"),
      ],
      "POST auth/logout": new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();
    renderApp("/access");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Anda sedang masuk di browser ini" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Keluar dan lanjutkan" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Aktifkan akun admin" }),
    ).toBeVisible();
    await waitFor(() => expect(api.callsTo("POST access-links/inspect")).toHaveLength(2));
    expect(api.callsTo("POST access-links/inspect")[1]!.body).toEqual({ token: TOKEN });
  });

  it("a reload finds no token: links are not reusable from the browser", async () => {
    arriveWithToken();
    releaseHeldAccessLinkToken();
    const api = mockAdminApi({ "GET me": unauthenticated() });
    renderApp("/access");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Tautan akses tidak lengkap" }),
    ).toBeVisible();
    expect(api.calls).toHaveLength(0);
  });
});

describe("svgDataUri", () => {
  it("accepts an SVG document only", () => {
    expect(svgDataUri(QR)).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(svgDataUri('<?xml version="1.0"?>\n<svg></svg>')).not.toBeNull();
    expect(svgDataUri("<script>alert(1)</script>")).toBeNull();
    expect(svgDataUri("javascript:alert(1)")).toBeNull();
  });
});
