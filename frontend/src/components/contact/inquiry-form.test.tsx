// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InquiryForm } from "./inquiry-form";

const renderForm = (url = "/kontak") => {
  const router = createMemoryRouter([{ path: "/kontak", element: <InquiryForm /> }], {
    initialEntries: [url],
  });
  return render(<RouterProvider router={router} />);
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("InquiryForm", () => {
  it("lists every missing field instead of pretending to send", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: /kirim lewat whatsapp/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ada 4 kolom yang perlu dilengkapi.",
    );
    expect(screen.getByLabelText(/^nama/i)).toHaveAttribute("aria-invalid", "true");
    expect(open).not.toHaveBeenCalled();
  });

  it("prefills the service from the query string", async () => {
    renderForm("/kontak?layanan=aplikasi-web");
    expect(await screen.findByRole("radio", { name: "Aplikasi web" })).toBeChecked();
  });

  it("opens WhatsApp with the composed message and explains the next step", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderForm("/kontak?layanan=website");
    await userEvent.type(screen.getByLabelText(/^nama/i), "Rina Wulandari");
    await userEvent.type(screen.getByLabelText(/email atau nomor whatsapp/i), "rina@example.com");
    await userEvent.type(
      screen.getByLabelText(/ceritakan kebutuhan anda/i),
      "Kami butuh website profil dengan katalog produk.",
    );
    await userEvent.click(screen.getByRole("button", { name: /kirim lewat whatsapp/i }));

    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0]![0]).startsWith("https://wa.me/6287759641358?text=")).toBe(
      true,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Pesan baru terkirim setelah Anda menekan tombol kirim di WhatsApp.",
    );
  });
});
