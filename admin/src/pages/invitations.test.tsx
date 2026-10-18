import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSession } from "~/auth/session";
import type { AdminInvitation } from "~/services/admin-api/owner";
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

const INVITE_URL = "http://127.0.0.1:5174/access#token=" + "i".repeat(43);

function invitation(overrides: Partial<AdminInvitation> = {}): AdminInvitation {
  return {
    id: 9,
    status: "pending",
    account: { id: 4, email: "calon@example.test", role: "admin", status: "pending" },
    issued_by_user_id: 1,
    created_at: "2026-10-18T05:00:00+00:00",
    expires_at: "2099-10-20T05:00:00+00:00",
    redeemed_at: null,
    completed_at: null,
    revoked_at: null,
    ...overrides,
  };
}

const directory = () =>
  page([sampleUser({ id: 1, name: "Contoh Owner", role: "owner", is_current_user: true })]);

describe("invitations", () => {
  it("lists invitations with who issued them, and revokes only open ones", async () => {
    mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET invitations": page([
        invitation(),
        invitation({ id: 8, status: "completed", issued_by_user_id: null }),
      ]),
    });
    renderApp("/undangan");

    const table = await screen.findByRole("table", { name: "Daftar undangan" });
    const [, open, done] = within(table).getAllByRole("row");

    expect(within(open!).getByText("Menunggu")).toBeVisible();
    expect(within(open!).getByText("oleh Anda")).toBeVisible();
    expect(
      within(open!).getByRole("button", { name: "Cabut undangan untuk calon@example.test" }),
    ).toBeVisible();
    expect(within(done!).getByText("oleh Shell server")).toBeVisible();
    expect(within(done!).queryByRole("button")).not.toBeInTheDocument();
  });

  it("revokes after confirmation, once, and shows the new status", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET invitations": page([invitation()]),
      "DELETE invitations/9": json(200, {
        data: invitation({ status: "revoked", revoked_at: "2026-10-18T06:00:00+00:00" }),
      }),
    });
    const user = userEvent.setup();
    renderApp("/undangan");

    await user.click(await screen.findByRole("button", { name: /Cabut undangan untuk/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/langsung berhenti bekerja/)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Cabut" }));

    expect(await screen.findByText("Undangan untuk calon@example.test dicabut.")).toBeVisible();
    expect(within(screen.getByRole("table")).getByText("Dicabut")).toBeVisible();
    expect(api.callsTo("DELETE invitations/9")).toHaveLength(1);
  });

  it("reports an uncertain revocation and reloads only when asked", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "GET users": directory(),
      "GET invitations": [page([invitation()]), page([invitation({ status: "revoked" })])],
      "DELETE invitations/9": () => {
        throw new TypeError("network down");
      },
    });
    const user = userEvent.setup();
    renderApp("/undangan");

    await user.click(await screen.findByRole("button", { name: /Cabut undangan untuk/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cabut" }));

    expect(await screen.findByText(/undangan mungkin sudah dicabut/)).toBeVisible();
    expect(api.callsTo("GET invitations")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Muat ulang daftar" }));
    await waitFor(() => expect(api.callsTo("GET invitations")).toHaveLength(2));
    expect(api.callsTo("DELETE invitations/9")).toHaveLength(1);
  });
});

describe("invite", () => {
  async function fillAndReview(user: ReturnType<typeof userEvent.setup>, email: string) {
    await user.type(await screen.findByLabelText("Email orang yang diundang"), email);
    await user.click(screen.getByRole("radio", { name: /Owner/ }));
    await user.click(screen.getByRole("button", { name: "Tinjau undangan" }));
  }

  it("checks the address before anything is sent", async () => {
    const api = mockAdminApi({ "GET me": me(ownerAccount()) });
    const user = userEvent.setup();
    renderApp("/undangan/baru");

    await user.click(await screen.findByRole("button", { name: "Tinjau undangan" }));
    expect(screen.getByText("Isi email orang yang diundang.")).toBeVisible();
    await user.type(screen.getByLabelText("Email orang yang diundang"), "bukan-email");
    await user.click(screen.getByRole("button", { name: "Tinjau undangan" }));
    expect(screen.getByText(/Tulis email lengkap/)).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.callsTo("POST invitations")).toHaveLength(0);
  });

  it("creates the invitation after review and shows its link once", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "POST invitations": json(201, {
        data: {
          invitation: invitation({
            account: { id: 4, email: "calon@example.test", role: "owner", status: "pending" },
          }),
          access_link: { url: INVITE_URL, expires_at: "2099-10-20T05:00:00+00:00" },
        },
      }),
    });
    const user = userEvent.setup();
    renderApp("/undangan/baru");

    await fillAndReview(user, "  Calon@Example.TEST ");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Undangan Owner untuk calon@example.test/)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Buat undangan" }));

    const revealed = await screen.findByRole("heading", {
      name: "Tautan undangan untuk calon@example.test",
    });
    await waitFor(() => expect(revealed).toHaveFocus());
    expect(screen.getByText(INVITE_URL)).toBeVisible();
    expect(api.callsTo("POST invitations")[0]!.body).toEqual({
      email: "calon@example.test",
      role: "owner",
    });
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain("i".repeat(43));
  });

  it("explains a 409 by its code and sends nothing more", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "POST invitations": json(409, {
        message: "A live invitation exists.",
        code: "invitation_pending",
      }),
    });
    const user = userEvent.setup();
    renderApp("/undangan/baru");

    await fillAndReview(user, "calon@example.test");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Buat undangan" }),
    );

    expect(await screen.findByText(/masih punya undangan yang berlaku/)).toBeVisible();
    expect(api.callsTo("POST invitations")).toHaveLength(1);
  });

  it("returns to the field Laravel refused", async () => {
    mockAdminApi({
      "GET me": me(ownerAccount()),
      "POST invitations": json(422, {
        message: "The email field must be a valid email address.",
        errors: { email: ["The email field must be a valid email address."] },
      }),
    });
    const user = userEvent.setup();
    renderApp("/undangan/baru");

    await fillAndReview(user, "calon@example.test");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Buat undangan" }),
    );

    expect(
      await screen.findByText("Server menolak isian ini. Periksa email dan peran."),
    ).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText("Email orang yang diundang")).toHaveFocus());
  });

  it("resolves an uncertain invitation by reading the waiting ones", async () => {
    const api = mockAdminApi({
      "GET me": me(ownerAccount()),
      "POST invitations": json(504, { message: "Gateway Timeout" }),
      "GET invitations": page([invitation()]),
    });
    const user = userEvent.setup();
    renderApp("/undangan/baru");

    await fillAndReview(user, "calon@example.test");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Buat undangan" }),
    );
    await user.click(await screen.findByRole("button", { name: "Periksa undangan" }));

    expect(
      await screen.findByText(/sudah ada, tetapi tautannya tidak dapat ditampilkan/),
    ).toBeVisible();
    expect(api.fetch.mock.calls.at(-1)![0]).toBe(
      "/api/v1/admin/invitations?status=pending&per_page=100",
    );
    expect(api.callsTo("POST invitations")).toHaveLength(1);
  });
});
