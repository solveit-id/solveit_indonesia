// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NOT_STORED = {
  message:
    "The inquiry could not be saved. Please try again later or contact us by WhatsApp or email.",
};

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
const keyOf = (call = 0) =>
  ((fetchMock.mock.calls[call]![1] as RequestInit).headers as Record<string, string>)[
    "Idempotency-Key"
  ];
const retryButton = () =>
  screen.queryByRole("button", { name: /kirim ulang permintaan yang sama/i });
const messageField = () => screen.getByLabelText(/ceritakan kebutuhan anda/i);

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
    [413, { message: "x" }, "Permintaan terlalu besar untuk dikirim"],
    [503, NOT_STORED, "permintaan ini belum tercatat"],
    [404, { message: "x" }, "tidak dapat dikirim melalui website"],
  ])(
    "explains a %i, keeps the form, and never switches channel by itself",
    async (code, reply, text) => {
      const u = user();
      const open = vi.spyOn(window, "open").mockReturnValue(null);
      fetchMock.mockResolvedValue(json(code, reply));
      renderForm();
      await fillValid(u);
      await u.click(sendButton());
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(text);
      expect(alert).toHaveTextContent("Isian Anda tetap tersimpan di formulir ini.");
      expect(open).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/^nama/i)).toHaveValue("Rina Wulandari");
      expect(sendButton()).toBeEnabled();
    },
  );

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

describe("InquiryForm idempotency and safe retry", () => {
  const accepted = (headers: Record<string, string> = {}) =>
    json(201, { id: REFERENCE, status: "received" }, headers);

  it("sends one cryptographic key per logical submission, never in the body", async () => {
    const u = user();
    const randomUUID = vi.spyOn(crypto, "randomUUID");
    fetchMock.mockResolvedValue(accepted());
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    await receipt(/diterima dan dicatat/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(keyOf()).toMatch(UUID_V4);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body())).not.toContain(keyOf());
  });

  it("recovers an uncertain outcome with the same key and shows the original reference", async () => {
    const u = user();
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(accepted({ "Idempotent-Replayed": "true" }));
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Kirim ulang untuk memeriksanya");
    // Nothing is retried by itself.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await u.click(retryButton()!);
    const status = await receipt(/diterima dan dicatat/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(keyOf(1)).toBe(keyOf(0));
    expect(body(1)).toEqual(body(0));
    expect(within(status).getByText(REFERENCE)).toBeInTheDocument();
    expect(status).toHaveTextContent("Percobaan sebelumnya ternyata sudah tercatat");
    expect(status).toHaveFocus();
    expect(screen.getAllByText(REFERENCE)).toHaveLength(1);
    expect(sendButton()).toBeDisabled();
  });

  it("treats a replay without the exposed header like any 201", async () => {
    const u = user();
    fetchMock.mockResolvedValueOnce(json(504, {})).mockResolvedValueOnce(accepted());
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    await screen.findByRole("alert");
    // The main button retries the unchanged content with the same key too.
    await u.click(sendButton());
    const status = await receipt(/diterima dan dicatat/);
    expect(keyOf(1)).toBe(keyOf(0));
    expect(status).not.toHaveTextContent("Percobaan sebelumnya");
  });

  it("uses a new key when the content changes after an uncertain result", async () => {
    const u = user();
    fetchMock.mockResolvedValue(json(502, {}));
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    const alert = await screen.findByRole("alert");
    expect(retryButton()).not.toBeNull();

    await u.type(messageField(), " Ditambah stok.");
    expect(alert).toHaveTextContent("Isian sudah berubah sejak percobaan tadi");
    expect(retryButton()).toBeNull();

    // Back to the exact earlier content: the attempt can be checked again.
    await u.type(messageField(), "{Backspace}".repeat(" Ditambah stok.".length));
    expect(retryButton()).not.toBeNull();
    await u.click(retryButton()!);
    await screen.findByRole("alert");
    expect(keyOf(1)).toBe(keyOf(0));

    // Surrounding spaces are not a change: Laravel trims them too.
    await u.type(screen.getByLabelText(/^nama/i), "  ");
    expect(retryButton()).not.toBeNull();

    await u.type(messageField(), " Ditambah stok.");
    await u.click(sendButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(keyOf(2)).not.toBe(keyOf(0));
    expect(body(2).message).toMatch(/Ditambah stok\.$/);
  });

  it("keeps the submitted snapshot when the visitor edits during the request", async () => {
    const u = user();
    const request = deferredFetch();
    fetchMock.mockReturnValueOnce(request.pending).mockResolvedValueOnce(json(500, {}));
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    await u.type(messageField(), " Ditambah stok.");
    expect(messageField()).toHaveValue(
      "Kami butuh website profil dengan katalog produk. Ditambah stok.",
    );
    await act(async () => request.answer(json(500, {})));
    const alert = await screen.findByRole("alert");
    expect(body(0).message).toBe("Kami butuh website profil dengan katalog produk.");
    // The edits are visible, flagged as unsent, and not tied to the old key.
    expect(alert).toHaveTextContent("Isian sudah berubah sejak percobaan tadi");
    expect(messageField()).toHaveValue(
      "Kami butuh website profil dengan katalog produk. Ditambah stok.",
    );
    await u.click(sendButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(keyOf(1)).not.toBe(keyOf(0));
    expect(body(1).message).toMatch(/Ditambah stok\.$/);
  });

  it("flags edits made during a request that then succeeds", async () => {
    const u = user();
    const request = deferredFetch();
    fetchMock.mockReturnValue(request.pending);
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    await u.type(messageField(), " Ditambah stok.");
    await act(async () => request.answer(accepted()));
    const status = await receipt(/diterima dan dicatat/);
    expect(status).toHaveTextContent("Perubahan setelah pengiriman ini belum terkirim");
    expect(sendButton()).toBeEnabled();
  });

  it("prevents a second POST from double clicks on the retry button", async () => {
    const u = user();
    const request = deferredFetch();
    fetchMock.mockResolvedValueOnce(json(500, {})).mockReturnValueOnce(request.pending);
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    await screen.findByRole("alert");
    await u.dblClick(retryButton()!);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retryButton()).toHaveAttribute("aria-disabled", "true");
    await act(async () => request.answer(accepted()));
    await receipt(/diterima dan dicatat/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [409, "bertabrakan dengan permintaan yang tercatat sebelumnya"],
    [400, "Website tidak dapat memproses kiriman ini"],
  ])("explains a %i, never as success, and retires the key", async (code, text) => {
    const u = user();
    fetchMock
      .mockResolvedValueOnce(json(code, { message: "Idempotency-Key details <b>x</b>" }))
      .mockResolvedValueOnce(accepted());
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(text);
    expect(alert).toHaveTextContent("Isian Anda tetap tersimpan di formulir ini.");
    expect(document.body).not.toHaveTextContent(/Idempotency|<b>/);
    expect(screen.queryByText(/INQ-/)).toBeNull();
    expect(retryButton()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Only the visitor starts the new submission, and it has a new key.
    await u.click(sendButton());
    await receipt(/diterima dan dicatat/);
    expect(keyOf(1)).toMatch(UUID_V4);
    expect(keyOf(1)).not.toBe(keyOf(0));
  });

  it("waits for Retry-After before asking again, then reuses the key", async () => {
    const u = user();
    const start = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(start);
    fetchMock
      .mockResolvedValueOnce(json(429, { message: "Too Many Attempts." }, { "Retry-After": "120" }))
      .mockResolvedValueOnce(accepted());
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("sekitar 2 menit");

    now.mockReturnValue(start + 61_000);
    await u.click(sendButton());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("sekitar 1 menit"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now.mockReturnValue(start + 121_000);
    await u.click(sendButton());
    await receipt(/diterima dan dicatat/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(keyOf(1)).toBe(keyOf(0));
  });

  it("treats a 503 that Laravel did not write as uncertain", async () => {
    const u = user();
    fetchMock.mockResolvedValue(
      new Response("<html>503 Service Temporarily Unavailable</html>", { status: 503 }),
    );
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Website belum memberi konfirmasi.");
    expect(alert).not.toHaveTextContent("belum tercatat");
    expect(retryButton()).not.toBeNull();
  });

  it("sends nothing when the browser cannot make a secure key", async () => {
    const u = user();
    vi.stubGlobal("crypto", {});
    renderForm();
    await fillValid(u);
    await u.click(sendButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Browser ini tidak dapat mengirim dengan aman");
    expect(fetchMock).not.toHaveBeenCalled();
    // WhatsApp still works without it.
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await u.click(screen.getByRole("button", { name: /kirim lewat whatsapp/i }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("makes no key for WhatsApp or email", async () => {
    const u = user();
    const randomUUID = vi.spyOn(crypto, "randomUUID");
    vi.spyOn(window, "open").mockReturnValue(null);
    renderForm();
    await fillValid(u);
    await u.click(screen.getByRole("button", { name: /kirim lewat whatsapp/i }));
    await u.click(screen.getByRole("button", { name: /kirim lewat email/i }));
    expect(randomUUID).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the key and the inquiry out of storage, cookies, the URL, and the console", async () => {
    const u = user();
    const levels = ["log", "info", "warn", "error", "debug"] as const;
    const consoles = levels.map((level) => vi.spyOn(console, level));
    const stored = vi.spyOn(Storage.prototype, "setItem");
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(accepted());
    const { container } = renderForm();
    await fillValid(u);
    await u.click(sendButton());
    await screen.findByRole("alert");
    await u.click(retryButton()!);
    await receipt(/diterima dan dicatat/);
    const key = keyOf();
    expect(stored).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
    expect(window.location.href).not.toContain(key);
    expect(window.location.href).not.toContain("Rina");
    expect(container.innerHTML).not.toContain(key);
    for (const spy of consoles) expect(spy).not.toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]![0])).toBe(ENDPOINT);
  });

  it("speaks English through an uncertain result and its replay", async () => {
    const u = user();
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(accepted({ "Idempotent-Replayed": "true" }));
    renderForm("/en/contact?service=website");
    await fillValid(u, true);
    await u.click(screen.getByRole("button", { name: /send through website/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The website has not confirmed your request.");
    expect(alert).toHaveTextContent("Retry to check");
    await u.click(screen.getByRole("button", { name: "Retry the same request" }));
    const status = await receipt(/received and recorded by the website/);
    expect(status).toHaveTextContent(REFERENCE);
    expect(status).toHaveTextContent("Your earlier attempt had already been recorded");
    expect(keyOf(1)).toBe(keyOf(0));
  });

  it("speaks English for a conflict", async () => {
    const u = user();
    fetchMock.mockResolvedValue(json(409, { message: "x" }));
    renderForm("/en/contact?service=website");
    await fillValid(u, true);
    await u.click(screen.getByRole("button", { name: /send through website/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "conflicts with a request recorded earlier",
    );
  });
});
