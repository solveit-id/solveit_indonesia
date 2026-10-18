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

const owner = sampleUser({ id: 1, name: "Contoh Owner", role: "owner", is_current_user: true });
const admin = sampleUser({ id: 2 });
const later = sampleUser({ id: 3, name: "Admin Tiga", email: "tiga@example.test" });

describe("users", () => {
  it("lists the accounts with role, status, and the way to each detail", async () => {
    mockAdminApi({ "GET me": me(ownerAccount()), "GET users": page([owner, admin]) });
    renderApp("/pengguna");

    const table = await screen.findByRole("table", { name: "Daftar akun admin" });
    const rows = within(table).getAllByRole("row");

    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByRole("link", { name: "Contoh Owner" })).toHaveAttribute(
      "href",
      "/pengguna/1",
    );
    expect(within(rows[1]!).getByText("Anda")).toBeVisible();
    expect(within(rows[2]!).getByText("Aktif")).toBeVisible();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Menampilkan 2 akun.");
  });

  it("names an invited account by its address until the person sets a name", async () => {
    mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": page([
        sampleUser({ id: 4, name: "", email: "baru@example.test", status: "pending" }),
      ]),
    });
    renderApp("/pengguna");

    expect(await screen.findByRole("link", { name: "baru@example.test" })).toHaveAttribute(
      "href",
      "/pengguna/4",
    );
    expect(screen.getByText("Nama belum ditetapkan")).toBeVisible();
  });

  it("filters through the address and Laravel, without asking GET me again", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": [page([owner, admin]), page([admin])],
    });
    const user = userEvent.setup();
    const router = renderApp("/pengguna");
    await screen.findByRole("table");
    const meCalls = api.callsTo("GET me").length;

    await user.click(screen.getByRole("radio", { name: "Admin" }));

    await waitFor(() => expect(router.state.location.search).toBe("?peran=admin"));
    await waitFor(() =>
      expect(within(screen.getByRole("table")).queryByText("Contoh Owner")).not.toBeInTheDocument(),
    );
    const calls = api.calls.filter((call) => call.path === "users");
    expect(calls).toHaveLength(2);
    expect(api.fetch.mock.calls.at(-1)![0]).toBe("/api/v1/admin/users?role=admin&per_page=25");
    expect(api.callsTo("GET me")).toHaveLength(meCalls);
  });

  it("never sends a filter value it does not know", async () => {
    const api = mockAdminApi({ "GET me": me(ownerAccount()), "GET users": page([admin]) });
    renderApp("/pengguna?peran=editor&status=deleted&sort=name");

    await screen.findByRole("table");
    expect(api.fetch.mock.calls.some(([url]) => String(url).includes("editor"))).toBe(false);
    expect(
      api.fetch.mock.calls.find(([url]) => String(url).startsWith("/api/v1/admin/users"))![0],
    ).toBe("/api/v1/admin/users?per_page=25");
  });

  it("loads the next page with Laravel's cursor and moves focus to the first new row", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": [page([owner, admin], "eyJpZCI6Mn0"), page([later])],
    });
    const user = userEvent.setup();
    renderApp("/pengguna");

    await user.click(await screen.findByRole("button", { name: "Muat lebih banyak" }));

    expect(await screen.findByRole("link", { name: "Admin Tiga" })).toHaveFocus();
    expect(api.fetch.mock.calls.at(-1)![0]).toBe(
      "/api/v1/admin/users?per_page=25&cursor=eyJpZCI6Mn0",
    );
    expect(screen.queryByRole("button", { name: "Muat lebih banyak" })).not.toBeInTheDocument();
    expect(screen.getByText("Menampilkan 3 akun.")).toBeVisible();
  });

  it("explains an empty filter and clears it", async () => {
    mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": [page([]), page([owner, admin])],
    });
    const user = userEvent.setup();
    const router = renderApp("/pengguna?status=suspended");

    expect(await screen.findByText("Tidak ada akun yang cocok")).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Hapus filter" })[0]!);

    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(await screen.findByRole("table")).toBeVisible();
  });

  it("explains a refused filter without showing rows", async () => {
    mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": json(422, {
        message: "Invalid.",
        errors: { cursor: ["The cursor is invalid."] },
      }),
    });
    renderApp("/pengguna");

    expect(await screen.findByText(/menolak filter atau penanda halaman/)).toBeVisible();
  });

  it("shows the owner-only state on a 403", async () => {
    mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": json(403, { message: "This action is unauthorized." }),
    });
    renderApp("/pengguna");

    expect(await screen.findByRole("heading", { name: "Khusus owner" })).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("does not ask for the list, or show the administration links, without the permission", async () => {
    const api = mockAdminApi({ "GET me": me(sampleAccount({ role: "admin" })) });
    renderApp("/pengguna");

    expect(await screen.findByRole("heading", { name: "Khusus owner" })).toBeVisible();
    expect(api.callsTo("GET users")).toHaveLength(0);
    const nav = screen.getAllByRole("navigation", { name: "Navigasi utama" })[0]!;
    expect(within(nav).queryByRole("link", { name: "Pengguna" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Audit log" })).not.toBeInTheDocument();
  });

  it("lists every account as a card below 768px", async () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion: reduce"),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    mockAdminApi({ "GET me": me(ownerAccount()), "GET users": page([owner, admin]) });
    renderApp("/pengguna");

    const list = await screen.findByRole("list", { name: "Daftar akun admin" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
