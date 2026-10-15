// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SiteModule from "~/config/site";
import { InquiryForm } from "./inquiry-form";

// A build with the website channel enabled (VITE_INQUIRY_API_ENABLED=true and
// a valid VITE_API_BASE_URL). Responses are mocked; nothing leaves the test.
vi.mock("~/config/site", async (importOriginal) => {
  const actual = await importOriginal<typeof SiteModule>();
  return {
    ...actual,
    siteConfig: {
      ...actual.siteConfig,
      inquiryApiUrl: "https://api.example.test/api/v1/inquiries",
    },
  };
});

const ENDPOINT = "https://api.example.test/api/v1/inquiries";
const REFERENCE = "INQ-7K3M-9QX2-HD4T";

const renderForm = (url = "/kontak?layanan=website") => {
  const router = createMemoryRouter(
    [
      { path: "/kontak", element: <InquiryForm /> },
      { path: "/en/contact", element: <InquiryForm /> },
    ],
    { initialEntries: [url] },
  );
  return render(<RouterProvider router={router} />);
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

/** A fetch that answers only when the test says so. */
function deferredFetch() {
  let answer!: (response: Response) => void;
  let fail!: (error: unknown) => void;
  const pending = new Promise<Response>((resolve, reject) => {
    answer = resolve;
    fail = reject;
  });
  return { pending, answer, fail };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const user = () => userEvent.setup();

async function fillValid(u: ReturnType<typeof user>, english = false) {
  await u.type(screen.getByLabelText(english ? /^name/i : /^nama/i), "Rina Wulandari");
  await u.type(
    screen.getByLabelText(english ? /email or whatsapp number/i : /email atau nomor whatsapp/i),
    "rina@example.com",
  );
  await u.type(
    screen.getByLabelText(english ? /tell us what you need/i : /ceritakan kebutuhan anda/i),
    "Kami butuh website profil dengan katalog produk.",
  );
}

/** The receipt box; the form also has a separate live region for progress. */
const receipt = async (text: RegExp) =>
  (await screen.findByText(text)).closest<HTMLElement>('[role="status"]')!;

const sendButton = () => screen.getByRole("button", { name: /kirim melalui website|mengirim/i });
const body = (call = 0) => JSON.parse(String((fetchMock.mock.calls[call]![1] as RequestInit).body));

describe("InquiryForm with the website channel", () => {
  it("offers the website channel and explains where the data goes", () => {
    const { container } = renderForm();
    expect(sendButton()).toBeEnabled();
    expect(screen.getByText(/isian formulir dikirim ke server Solveit/)).toBeInTheDocument();
    expect(screen.queryByText(/tidak mengirim atau menyimpan data/)).toBeNull();
    expect(screen.getByText(/Hanya untuk kirim lewat WhatsApp/)).toBeInTheDocument();
    // WhatsApp and email stay as independent choices.
    expect(screen.getByRole("button", { name: /kirim lewat whatsapp/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /kirim lewat email/i })).toBeEnabled();
    // The honeypot is present, empty, and hidden from people.
    const honeypot = container.querySelector<HTMLInputElement>('input[name="homepage"]')!;
    expect(honeypot).toHaveValue("");
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
    expect(honeypot.closest("[aria-hidden]")).not.toBeNull();
    // Rendering alone never calls the API.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates before sending anything", async () => {
    const u = user();
    renderForm("/kontak");
    await u.click(sendButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ada 4 kolom yang perlu dilengkapi.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends once, shows progress, and shows the real reference only after a 201", async () => {
    const u = user();
    const request = deferredFetch();
    fetchMock.mockReturnValue(request.pending);
    renderForm();
    await fillValid(u);
    await u.selectOptions(screen.getByLabelText(/perkiraan anggaran/i), "10-50jt");
    await u.click(sendButton());

    // Pending: busy, announced, and further clicks do nothing.
    expect(sendButton()).toHaveAttribute("aria-busy", "true");
    expect(sendButton()).toHaveAttribute("aria-disabled", "true");
    expect(sendButton()).toHaveTextContent("Mengirim...");
    expect(screen.getByText("Mengirim permintaan Anda ke website.")).toBeInTheDocument();
    await u.click(sendButton());
    await u.click(screen.getByRole("button", { name: /kirim lewat whatsapp/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(REFERENCE)).toBeNull();

    expect(fetchMock.mock.calls[0]![0]).toBe(ENDPOINT);
    expect(body()).toEqual({
      name: "Rina Wulandari",
      organization: "",
      contact: "rina@example.com",
      service: "website",
      budget: "10-50jt",
      timeline: "fleksibel",
      message: "Kami butuh website profil dengan katalog produk.",
      homepage: "",
    });

    await act(async () => request.answer(json(201, { id: REFERENCE, status: "received" })));
    const status = await receipt(/diterima dan dicatat oleh website/);
    expect(within(status).getByText(REFERENCE)).toBeInTheDocument();
    expect(status).not.toHaveTextContent(/dibalas|sudah dibaca|notifikasi/i);
    expect(status).toHaveFocus();
    // The same details cannot be sent twice by accident.
    expect(sendButton()).toBeDisabled();
    expect(screen.getByLabelText(/^nama/i)).toHaveValue("Rina Wulandari");

    // An edit after sending is flagged as not sent, and can be sent anew.
    await u.type(screen.getByLabelText(/ceritakan kebutuhan anda/i), " Ditambah stok.");
    expect(status).toHaveTextContent("Perubahan setelah pengiriman ini belum terkirim");
    expect(within(status).getByText(REFERENCE)).toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
    expect(screen.getByLabelText(/ceritakan kebutuhan anda/i)).toHaveFocus();
  });

  it("never shows success for a malformed 201", async () => {
    const u = user();
    fetchMock.mockResolvedValue(json(201, { id: "123", status: "received" }));
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Website belum memberi konfirmasi.");
    expect(screen.queryByText(/INQ-/)).toBeNull();
    expect(screen.queryByText(/diterima dan dicatat/)).toBeNull();
  });

  it("maps server validation errors to localized field errors and keeps the values", async () => {
    const u = user();
    fetchMock.mockResolvedValue(
      json(422, {
        message: "The given data was invalid.",
        errors: {
          contact: ["The contact field must be a valid email address or phone number."],
          timeline: ["The selected timeline is invalid. <script>alert(1)</script>"],
        },
      }),
    );
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Website belum dapat menerima 2 kolom.");
    const contact = screen.getByLabelText(/email atau nomor whatsapp/i);
    expect(contact).toHaveAttribute("aria-invalid", "true");
    expect(contact).toHaveAccessibleDescription(/belum dapat diterima website/);
    expect(screen.getByLabelText(/target waktu/i)).toHaveAttribute("aria-invalid", "true");
    // Server text is never shown: no English, no markup.
    expect(document.body).not.toHaveTextContent(/selected timeline|<script>/);
    expect(contact).toHaveValue("rina@example.com");
    expect(screen.getByLabelText(/ceritakan kebutuhan anda/i)).toHaveValue(
      "Kami butuh website profil dengan katalog produk.",
    );
    expect(alert).toHaveFocus();
  });

  it("explains a honeypot rejection without exposing it", async () => {
    const u = user();
    fetchMock.mockResolvedValue(
      json(422, { errors: { homepage: ["The submission could not be accepted."] } }),
    );
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Permintaan ini tidak dapat diterima website.");
    expect(alert).not.toHaveTextContent(/homepage|could not be accepted/i);
  });

  it.each([
    [{ "Retry-After": "90" }, "Coba lagi dalam sekitar 2 menit"],
    [{}, "Coba lagi beberapa saat lagi"],
  ])("explains a rate limit (%o) without a countdown", async (headers, text) => {
    const u = user();
    fetchMock.mockResolvedValue(json(429, { message: "Too Many Attempts." }, headers));
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Terlalu banyak percobaan");
    expect(alert).toHaveTextContent(text);
  });

  it.each([
    [413, "Permintaan terlalu besar untuk dikirim"],
    [503, "permintaan ini belum tercatat"],
    [404, "tidak dapat dikirim melalui website"],
  ])("explains a %i, keeps the form, and never switches channel by itself", async (code, text) => {
    const u = user();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    fetchMock.mockResolvedValue(json(code, { message: "x" }));
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(text);
    expect(alert).toHaveTextContent("Isian Anda tetap tersimpan di formulir ini.");
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^nama/i)).toHaveValue("Rina Wulandari");
    expect(sendButton()).toBeEnabled();
  });

  it.each([
    ["a network error", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["a 500", () => Promise.resolve(json(500, { message: "Server Error" }))],
  ])("treats %s as an unknown outcome and does not retry", async (_label, answer) => {
    const u = user();
    fetchMock.mockImplementation(answer);
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("mungkin sudah sampai ke server");
    expect(screen.queryByText(/INQ-/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/^nama/i)).toHaveValue("Rina Wulandari");
  });

  it("aborts the request when the form goes away and ignores a late answer", async () => {
    const u = user();
    const request = deferredFetch();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return request.pending;
    });
    const error = vi.spyOn(console, "error");
    const { unmount } = renderForm();
    await fillValid(u);
    await u.click(sendButton());
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => request.answer(json(201, { id: REFERENCE, status: "received" })));
    expect(error).not.toHaveBeenCalled();
  });

  it("still opens WhatsApp with the chosen number, without calling the API", async () => {
    const u = user();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderForm();
    await fillValid(u);
    await u.click(screen.getByRole("radio", { name: /\+62 812-3025-2499/ }));
    await u.click(screen.getByRole("button", { name: /kirim lewat whatsapp/i }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0]![0]).startsWith("https://wa.me/6281230252499?text=")).toBe(
      true,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still composes an email, without calling the API", async () => {
    const u = user();
    renderForm();
    await fillValid(u);
    await u.click(screen.getByRole("button", { name: /kirim lewat email/i }));
    const status = await receipt(/Aplikasi email dibuka/);
    const reopen = within(status).getByRole("link", { name: "Buka lagi" });
    expect(reopen.getAttribute("href")).toMatch(/^mailto:solveit\.team\.id@gmail\.com\?subject=/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("speaks English and sends the preselected service", async () => {
    const u = user();
    fetchMock.mockResolvedValue(json(201, { id: REFERENCE, status: "received" }));
    renderForm("/en/contact?service=aplikasi-web");
    expect(await screen.findByRole("radio", { name: "Web app" })).toBeChecked();
    expect(screen.getByText(/sent to the Solveit server for processing/)).toBeInTheDocument();
    await fillValid(u, true);
    await u.click(screen.getByRole("button", { name: /send through website/i }));
    const status = await receipt(/received and recorded by the website/);
    expect(status).toHaveTextContent(REFERENCE);
    expect(body().service).toBe("aplikasi-web");
  });
});
