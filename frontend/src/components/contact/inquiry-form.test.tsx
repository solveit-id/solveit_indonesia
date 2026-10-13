// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InquiryForm } from "./inquiry-form";

const renderForm = (url = "/kontak") => {
  const router = createMemoryRouter(
    [
      { path: "/kontak", element: <InquiryForm /> },
      { path: "/en/contact", element: <InquiryForm /> },
    ],
    {
      initialEntries: [url],
    },
  );
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

  it("keeps the composed message when the WhatsApp number changes", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderForm("/kontak?layanan=website");
    await userEvent.type(screen.getByLabelText(/^nama/i), "Rina Wulandari");
    await userEvent.type(screen.getByLabelText(/email atau nomor whatsapp/i), "rina@example.com");
    await userEvent.type(
      screen.getByLabelText(/ceritakan kebutuhan anda/i),
      "Kami butuh website profil dengan katalog produk.",
    );
    await userEvent.click(screen.getByRole("radio", { name: /\+62 812-3025-2499/ }));
    await userEvent.click(screen.getByRole("button", { name: /kirim lewat whatsapp/i }));
    const first = String(open.mock.calls[0]![0]);
    expect(first.startsWith("https://wa.me/6281230252499?text=")).toBe(true);

    // Switch to the third number after opening: "open again" follows it, same text.
    await userEvent.click(screen.getByRole("radio", { name: /\+62 823-3550-1778/ }));
    const reopen = screen.getByRole("link", { name: "Buka lagi" }).getAttribute("href") ?? "";
    expect(reopen.startsWith("https://wa.me/6282335501778?text=")).toBe(true);
    expect(reopen.split("?text=")[1]).toBe(first.split("?text=")[1]);
    expect(screen.getByLabelText(/^nama/i)).toHaveValue("Rina Wulandari");
  });

  it("speaks English on the English contact page", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderForm("/en/contact?service=aplikasi-web");
    expect(await screen.findByRole("radio", { name: "Web app" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: /send via whatsapp/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("3 fields need your attention.");
    expect(open).not.toHaveBeenCalled();
  });
});
