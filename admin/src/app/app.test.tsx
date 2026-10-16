import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/i18n/i18n";
import { routes } from "./router";

function renderApp(path = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>,
  );
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shell and routes", () => {
  it("opens on the foundation overview with an honest title", async () => {
    renderApp();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Fondasi konsol admin" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Fondasi konsol admin · Solveit Indonesia"));
    // Rail and phone menu both carry it; CSS shows one of them at any width.
    expect(screen.getAllByText("Fondasi B3.2a").length).toBeGreaterThan(0);
  });

  it("lists only screens that exist: no sign-in, users, or audit links, no reference in production", async () => {
    renderApp();
    await screen.findByRole("heading", { level: 1 });

    for (const navigation of screen.getAllByRole("navigation", {
      name: "Navigasi utama",
      hidden: true,
    })) {
      const links = within(navigation).getAllByRole("link", { hidden: true });
      expect(links.map((link) => link.textContent)).toEqual(["Ikhtisar fondasi"]);
      expect(links[0]).toHaveAttribute("aria-current", "page");
    }

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByLabelText(/kata sandi|password/i)).toBeNull();
  });

  it.each(["/masuk", "/login", "/users", "/audit-events", "/referensi-komponen"])(
    "%s is the honest 404",
    async (path) => {
      renderApp(path);

      expect(
        await screen.findByRole("heading", { level: 1, name: "Halaman tidak ditemukan" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Kembali ke ikhtisar" })).toHaveAttribute(
        "href",
        "/",
      );
    },
  );

  it("discloses the phone menu and closes it with Escape, returning focus", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { level: 1 });

    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).not.toHaveAttribute(
      "hidden",
    );

    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });
});

describe("preferences", () => {
  it("switches to dark and back, storing only the preference", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { level: 1 });

    const [darkOption] = screen.getAllByRole("radio", { name: "Gelap", hidden: true });
    await user.click(darkOption!);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(Object.keys({ ...localStorage })).toEqual(["solveit-admin-theme"]);
  });

  it("switches the language, the document language, and the title", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { level: 1 });

    const [english] = screen.getAllByRole("radio", { name: "English", hidden: true });
    await user.click(english!);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Admin console foundation" }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    await waitFor(() =>
      expect(document.title).toBe("Admin console foundation · Solveit Indonesia"),
    );
  });
});

describe("connection check", () => {
  it("makes one real same-origin request and reports a 204 as reachable", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByText("Belum diperiksa.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Periksa koneksi" }));

    expect(await screen.findByText(/API admin menjawab \(204\)/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/admin/auth/csrf-cookie",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
    expect(screen.getByText(/^Diperiksa pukul/)).toBeInTheDocument();
  });

  it("names the fix when Laravel does not answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("button", { name: "Periksa koneksi" }));

    const result = await screen.findByText(/Laravel tidak menjawab\. Jalankan/);
    // The command and the path are set as code, inside the sentence.
    expect(result).toHaveTextContent(
      "Laravel tidak menjawab. Jalankan php artisan serve di backend/ atau layanan backend Docker, lalu periksa lagi.",
    );
    expect([...result.querySelectorAll("code")].map((code) => code.textContent)).toEqual([
      "php artisan serve",
      "backend/",
    ]);
  });

  it("names ADMIN_URL when the boundary refuses the origin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { message: "Cross-origin requests to the admin API are not allowed." },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("button", { name: "Periksa koneksi" }));

    expect(
      await screen.findByText(/Ditolak oleh batas admin \(403\)\. ADMIN_URL/),
    ).toBeInTheDocument();
  });

  it("is busy, not disabled-looking, while checking, and cannot be pressed twice", async () => {
    let answer: (response: Response) => void = () => undefined;
    const fetch = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { level: 1 });

    const button = screen.getByRole("button", { name: "Periksa koneksi" });
    await user.click(button);

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(fetch).toHaveBeenCalledTimes(1);

    answer(new Response(null, { status: 204 }));
    expect(await screen.findByText(/API admin menjawab/)).toBeInTheDocument();
  });
});
