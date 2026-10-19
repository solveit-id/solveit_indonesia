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

afterEach(() => {
  vi.unstubAllGlobals();
  resetSession();
});

describe("private area", () => {
  it("sends a visitor without a session to sign-in, keeping a safe return path", async () => {
    mockAdminApi({ "GET me": unauthenticated() });
    const router = renderApp("/akun/keamanan");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Masuk ke konsol admin" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/masuk");
    expect(router.state.location.search).toBe("?kembali=%2Fakun%2Fkeamanan");
    // No private navigation exists for this visitor.
    expect(screen.queryByRole("navigation", { name: "Navigasi utama", hidden: true })).toBeNull();
  });

  it("renders nothing private before GET me answers", async () => {
    let answer: (response: Response) => void = () => undefined;
    mockAdminApi({ "GET me": () => new Promise<Response>((resolve) => (answer = resolve)) });
    renderApp("/akun");

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.body.textContent).not.toContain("owner@example.test");
    expect(document.body.textContent).not.toContain("Contoh Owner");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();

    answer(me());
    expect(await screen.findByRole("heading", { level: 1, name: "Akun" })).toBeInTheDocument();
    expect(screen.getByText("owner@example.test")).toBeInTheDocument();
  });

  it("never treats an unreachable server as signed in", async () => {
    mockAdminApi({
      "GET me": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    renderApp("/");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Sesi belum dapat diperiksa" }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Contoh Owner");
    expect(screen.queryByRole("button", { name: "Keluar" })).toBeNull();
  });

  it("explains a 403 from the boundary without claiming a session", async () => {
    mockAdminApi({
      "GET me": json(403, { message: "Cross-origin requests to the admin API are not allowed." }),
    });
    renderApp("/");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Permintaan ditolak" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Masuk sebagai/)).toBeNull();
  });

  it("re-verifies on every private navigation and leaves when the session is gone", async () => {
    const api = mockAdminApi({ "GET me": [me(), me(), unauthenticated()] });
    const user = userEvent.setup();
    const router = renderApp("/");

    await screen.findByRole("heading", { level: 1, name: "Beranda konsol" });
    const [nav] = screen.getAllByRole("navigation", { name: "Navigasi utama", hidden: true });
    await user.click(within(nav!).getByRole("link", { name: "Akun", hidden: true }));
    await screen.findByRole("heading", { level: 1, name: "Akun" });

    await user.click(within(nav!).getByRole("link", { name: "Keamanan", hidden: true }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/masuk"));
    expect(router.state.location.search).toBe("?kembali=%2Fakun%2Fkeamanan&alasan=berakhir");
    expect(
      await screen.findByText("Sesi Anda berakhir. Masuk lagi untuk melanjutkan."),
    ).toBeVisible();
    // Three private navigations, then the sign-in screen's own check for a session.
    expect(api.callsTo("GET me")).toHaveLength(4);
  });

  it("lists only screens that exist and shows who is signed in", async () => {
    mockAdminApi({ "GET me": me(sampleAccount({ role: "admin", name: "Contoh Admin" })) });
    renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "Beranda konsol" });

    for (const navigation of screen.getAllByRole("navigation", {
      name: "Navigasi utama",
      hidden: true,
    })) {
      const links = within(navigation).getAllByRole("link", { hidden: true });
      expect(links.map((link) => link.textContent)).toEqual(["Beranda", "Akun", "Keamanan"]);
    }

    expect(screen.getByText("Anda masuk sebagai Contoh Admin, Admin.")).toBeInTheDocument();
  });

  it("shows every phase through B4b as released and none as deployed or in progress", async () => {
    mockAdminApi({ "GET me": me() });
    renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "Beranda konsol" });

    const track = screen.getByRole("region", { name: "Tahap pembangunan" });
    const rows = within(track).getAllByRole("listitem");
    expect(rows.map((row) => within(row).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "B3.1aIdentitas backend",
      "B3.1bAdministrasi pengguna dan audit (API)",
      "B3.2aFondasi konsol",
      "B3.2bMasuk, aktivasi, dan pemulihan",
      "B3.2cRuang kerja administrasi",
      "B3.2dRilis admin privat",
      "B4aPengelolaan inquiry (API)",
      "B4bKonsol inquiry",
    ]);
    for (const row of rows) {
      expect(row).not.toHaveAttribute("aria-current");
      expect(within(row).getByText("Dirilis, belum di-deploy")).toBeInTheDocument();
    }
    expect(within(track).queryByText("Sedang dibangun")).toBeNull();
    expect(
      within(track).getByText(
        "API dan konsol admin sudah dirilis ke main, tetapi belum di-deploy ke mana pun.",
      ),
    ).toBeInTheDocument();
  });

  it("signs out, clears the account view, and lands on sign-in", async () => {
    const api = mockAdminApi({
      "GET me": [me(), unauthenticated()],
      "POST auth/logout": noContent(),
    });
    const user = userEvent.setup();
    const router = renderApp("/akun");
    await screen.findByRole("heading", { level: 1, name: "Akun" });

    const [signOut] = screen.getAllByRole("button", { name: "Keluar", hidden: true });
    await user.click(signOut!);

    await waitFor(() => expect(router.state.location.pathname).toBe("/masuk"));
    expect(router.state.location.search).toBe("?alasan=keluar");
    expect(await screen.findByText("Anda sudah keluar dari konsol.")).toBeVisible();
    expect(document.body.textContent).not.toContain("owner@example.test");
    expect(api.callsTo("POST auth/logout")).toHaveLength(1);
  });

  it("keeps the account view when signing out gets no answer, and says so", async () => {
    const api = mockAdminApi({
      "GET me": me(),
      "POST auth/logout": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const user = userEvent.setup();
    renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "Beranda konsol" });

    const [signOut] = screen.getAllByRole("button", { name: "Keluar", hidden: true });
    await user.click(signOut!);

    expect(
      (await screen.findAllByText(/Keluar belum dapat dipastikan/, {}, { timeout: 3000 })).length,
    ).toBeGreaterThan(0);
    // Not resent on its own.
    expect(api.callsTo("POST auth/logout")).toHaveLength(1);
  });
});

describe("public screens", () => {
  it.each(["/users", "/audit-events", "/referensi-komponen", "/akun/lain"])(
    "%s is the honest 404, without an account",
    async (path) => {
      mockAdminApi({});
      renderApp(path);

      expect(
        await screen.findByRole("heading", { level: 1, name: "Halaman tidak ditemukan" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Ke beranda konsol" })).toHaveAttribute("href", "/");
    },
  );

  it("sends someone already signed in from /masuk to the (validated) return path", async () => {
    mockAdminApi({ "GET me": me() });
    const router = renderApp("/masuk?kembali=%2F%2Fevil.example%2Fakun");

    await screen.findByRole("heading", { level: 1, name: "Beranda konsol" });
    expect(router.state.location.pathname).toBe("/");
  });

  it("switches the language, the document language, and the title", async () => {
    mockAdminApi({ "GET me": unauthenticated() });
    const user = userEvent.setup();
    renderApp("/masuk");
    await screen.findByRole("heading", { level: 1 });

    const [english] = screen.getAllByRole("radio", { name: "English", hidden: true });
    await user.click(english!);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign in to the admin console" }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    await waitFor(() =>
      expect(document.title).toBe("Sign in to the admin console · Solveit Indonesia"),
    );
  });

  it("switches to dark and stores only the preference", async () => {
    mockAdminApi({ "GET me": unauthenticated() });
    const user = userEvent.setup();
    renderApp("/masuk");
    await screen.findByRole("heading", { level: 1 });

    const [darkOption] = screen.getAllByRole("radio", { name: "Gelap", hidden: true });
    await user.click(darkOption!);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(Object.keys({ ...localStorage })).toEqual(["solveit-admin-theme"]);
    expect(Object.keys({ ...sessionStorage })).toEqual([]);
  });
});
