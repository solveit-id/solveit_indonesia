import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSession } from "~/auth/session";
import { EXPIRED_SIGN_IN_MESSAGE } from "~/services/admin-api";
import { json, me, mockAdminApi, noContent, renderApp, unauthenticated } from "~/test/admin-api";

const PASSWORD = "correct horse battery";

afterEach(() => {
  vi.unstubAllGlobals();
  resetSession();
});

const challengeOk = () => json(200, { two_factor: true });
const wrongCode = () =>
  json(422, {
    message: "The provided two factor authentication code was invalid.",
    errors: { code: ["The provided two factor authentication code was invalid."] },
  });
const expired = () =>
  json(422, { message: EXPIRED_SIGN_IN_MESSAGE, errors: { code: [EXPIRED_SIGN_IN_MESSAGE] } });
const csrfMismatch = () => json(419, { message: "CSRF token mismatch." });

async function passPasswordStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Email"), "owner@example.test");
  await user.type(screen.getByLabelText("Kata sandi"), PASSWORD);
  await user.click(screen.getByRole("button", { name: "Lanjut" }));
  await screen.findByRole("heading", { level: 1, name: "Masukkan kode autentikator" });
}

describe("sign-in", () => {
  it("password, then TOTP, then a verified GET me before anything private", async () => {
    const api = mockAdminApi({
      "GET me": [unauthenticated(), me()],
      "POST auth/login": challengeOk(),
      "POST auth/two-factor-challenge": noContent(),
    });
    const user = userEvent.setup();
    const router = renderApp("/masuk?kembali=%2Fakun");

    expect(screen.queryByText("Contoh Owner")).toBeNull();
    await passPasswordStep(user);

    const login = api.callsTo("POST auth/login")[0]!;
    expect(login.body).toEqual({ email: "owner@example.test", password: PASSWORD });
    expect(login.headers.get("X-XSRF-TOKEN")).toBe("test-token");
    expect(login.headers.get("Authorization")).toBeNull();

    const code = screen.getByLabelText("Kode 6 digit");
    expect(code).toHaveFocus();
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    expect(code).toHaveAttribute("inputmode", "numeric");
    // The password left the component once it was sent.
    expect(document.body.innerHTML).not.toContain(PASSWORD);

    await user.type(code, "123 456");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    await screen.findByRole("heading", { level: 1, name: "Akun" });
    expect(router.state.location.pathname).toBe("/akun");
    expect(api.callsTo("POST auth/two-factor-challenge")[0]!.body).toEqual({ code: "123456" });
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(PASSWORD);
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain("123456");
  });

  it("has the right autocomplete for password managers", async () => {
    mockAdminApi({ "GET me": unauthenticated() });
    renderApp("/masuk");

    expect(await screen.findByLabelText("Email")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Kata sandi")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("Kata sandi")).toHaveAttribute("type", "password");
  });

  it("shows and hides the password with a real toggle", async () => {
    mockAdminApi({ "GET me": unauthenticated() });
    const user = userEvent.setup();
    renderApp("/masuk");

    const password = await screen.findByLabelText("Kata sandi");
    const toggle = screen.getByRole("button", { name: "Tampilkan kata sandi" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("checks the fields before sending anything", async () => {
    const api = mockAdminApi({ "GET me": unauthenticated() });
    const user = userEvent.setup();
    renderApp("/masuk");

    await user.click(await screen.findByRole("button", { name: "Lanjut" }));

    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Isi email akun Anda.");
    expect(api.callsTo("POST auth/login")).toHaveLength(0);
  });

  it("answers a wrong password with the same generic sentence and clears it", async () => {
    mockAdminApi({
      "GET me": unauthenticated(),
      "POST auth/login": json(422, {
        message: "These credentials do not match our records.",
        errors: { email: ["These credentials do not match our records."] },
      }),
    });
    const user = userEvent.setup();
    renderApp("/masuk");

    await user.type(await screen.findByLabelText("Email"), "someone@example.test");
    await user.type(screen.getByLabelText("Kata sandi"), "wrong password!");
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email atau kata sandi tidak cocok, atau akun ini belum dapat masuk.",
    );
    expect(screen.getByLabelText("Kata sandi")).toHaveValue("");
    expect(screen.queryByText(/These credentials/)).toBeNull();
  });

  it("reports a wrong TOTP code on the code step", async () => {
    mockAdminApi({
      "GET me": unauthenticated(),
      "POST auth/login": challengeOk(),
      "POST auth/two-factor-challenge": wrongCode(),
    });
    const user = userEvent.setup();
    renderApp("/masuk");
    await passPasswordStep(user);

    await user.type(screen.getByLabelText("Kode 6 digit"), "000000");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(await screen.findByText(/Kode tidak cocok\. Tunggu kode berikutnya/)).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Masukkan kode autentikator",
    );
  });

  it("signs in with a recovery code instead", async () => {
    const api = mockAdminApi({
      "GET me": [unauthenticated(), me()],
      "POST auth/login": challengeOk(),
      "POST auth/two-factor-challenge": noContent(),
    });
    const user = userEvent.setup();
    renderApp("/masuk");
    await passPasswordStep(user);

    await user.click(screen.getByRole("button", { name: "Pakai kode pemulihan" }));
    const field = screen.getByLabelText("Kode pemulihan");
    expect(field).toHaveFocus();
    await user.type(field, " abcdefghij-klmnopqrst ");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    await screen.findByRole("heading", { level: 1, name: "Beranda konsol" });
    expect(api.callsTo("POST auth/two-factor-challenge")[0]!.body).toEqual({
      recovery_code: "abcdefghij-klmnopqrst",
    });
  });

  it("reports a used recovery code as such", async () => {
    mockAdminApi({
      "GET me": unauthenticated(),
      "POST auth/login": challengeOk(),
      "POST auth/two-factor-challenge": json(422, {
        message: "The provided two factor recovery code was invalid.",
        errors: { recovery_code: ["The provided two factor recovery code was invalid."] },
      }),
    });
    const user = userEvent.setup();
    renderApp("/masuk");
    await passPasswordStep(user);
    await user.click(screen.getByRole("button", { name: "Pakai kode pemulihan" }));
    await user.type(screen.getByLabelText("Kode pemulihan"), "used-code");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(
      await screen.findByText("Kode pemulihan tidak cocok atau sudah pernah dipakai."),
    ).toBeVisible();
  });

  it("returns to the password step when the challenge expired, not 'wrong code'", async () => {
    mockAdminApi({
      "GET me": unauthenticated(),
      "POST auth/login": challengeOk(),
      "POST auth/two-factor-challenge": expired(),
    });
    const user = userEvent.setup();
    renderApp("/masuk");
    await passPasswordStep(user);

    await user.type(screen.getByLabelText("Kode 6 digit"), "123456");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Masuk ke konsol admin" }),
    ).toBeVisible();
    expect(screen.getByText(/Upaya masuk sudah kedaluwarsa/)).toBeVisible();
    expect(screen.queryByText(/Kode tidak cocok/)).toBeNull();
    expect(screen.getByLabelText("Kata sandi")).toHaveFocus();
    expect(screen.getByLabelText("Email")).toHaveValue("owner@example.test");
  });

  it("after a 419 the client resends once, and the expired answer still means start again", async () => {
    const api = mockAdminApi({
      "GET me": unauthenticated(),
      "POST auth/login": challengeOk(),
      "POST auth/two-factor-challenge": [csrfMismatch(), expired()],
    });
    const user = userEvent.setup();
    renderApp("/masuk");
    await passPasswordStep(user);

    await user.type(screen.getByLabelText("Kode 6 digit"), "123456");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Masuk ke konsol admin" }),
    ).toBeVisible();
    expect(screen.getByText(/Upaya masuk sudah kedaluwarsa/)).toBeVisible();

    const attempts = api.callsTo("POST auth/two-factor-challenge");
    expect(attempts).toHaveLength(2);
    expect(attempts[1]!.body).toEqual(attempts[0]!.body);
    // A fresh token was fetched between the two attempts.
    const order = api.calls.map((call) => `${call.method} ${call.path}`);
    const first = order.indexOf("POST auth/two-factor-challenge");
    expect(order.slice(first + 1, first + 3)).toEqual([
      "GET auth/csrf-cookie",
      "POST auth/two-factor-challenge",
    ]);
  });

  it("never resends the challenge after a network failure; it offers a session check", async () => {
    const api = mockAdminApi({
      "GET me": [unauthenticated(), unauthenticated()],
      "POST auth/login": challengeOk(),
      "POST auth/two-factor-challenge": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const user = userEvent.setup();
    renderApp("/masuk");
    await passPasswordStep(user);

    await user.type(screen.getByLabelText("Kode 6 digit"), "123456");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(await screen.findByText(/kode ini mungkin sudah terpakai/)).toBeVisible();
    expect(api.callsTo("POST auth/two-factor-challenge")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Periksa sesi" }));
    expect(
      await screen.findByText("Anda belum masuk. Masukkan kode berikutnya dari aplikasi."),
    ).toBeVisible();
    expect(api.callsTo("POST auth/two-factor-challenge")).toHaveLength(1);
  });

  it("enters the console when Laravel says it is already signed in (409)", async () => {
    mockAdminApi({
      "GET me": [unauthenticated(), me()],
      "POST auth/login": json(409, { message: "You are already signed in. Sign out first." }),
    });
    const user = userEvent.setup();
    const router = renderApp("/masuk");

    await user.type(await screen.findByLabelText("Email"), "owner@example.test");
    await user.type(screen.getByLabelText("Kata sandi"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    await screen.findByRole("heading", { level: 1, name: "Beranda konsol" });
    expect(router.state.location.pathname).toBe("/");
  });

  it("waits out a 429 with a countdown and sends nothing meanwhile", async () => {
    const api = mockAdminApi({
      "GET me": unauthenticated(),
      "POST auth/login": json(429, { message: "Too Many Attempts." }, { "Retry-After": "30" }),
    });
    const user = userEvent.setup();
    renderApp("/masuk");

    await user.type(await screen.findByLabelText("Email"), "owner@example.test");
    await user.type(screen.getByLabelText("Kata sandi"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    expect(
      await screen.findByText(/Terlalu banyak percobaan\. Coba lagi dalam 3\d detik/),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(api.callsTo("POST auth/login")).toHaveLength(1);
  });

  it("does not resend the password after a network failure", async () => {
    const api = mockAdminApi({
      "GET me": unauthenticated(),
      "POST auth/login": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const user = userEvent.setup();
    renderApp("/masuk");

    await user.type(await screen.findByLabelText("Email"), "owner@example.test");
    await user.type(screen.getByLabelText("Kata sandi"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    expect(await screen.findByText(/jadi Anda belum masuk/)).toBeVisible();
    await waitFor(() => expect(api.callsTo("POST auth/login")).toHaveLength(1));
  });

  it("shows the notice it was sent with, from a fixed list only", async () => {
    mockAdminApi({ "GET me": unauthenticated() });
    renderApp("/masuk?alasan=%3Cscript%3E");

    await screen.findByRole("heading", { level: 1, name: "Masuk ke konsol admin" });
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.body.innerHTML).not.toContain("<script>");
  });
});
