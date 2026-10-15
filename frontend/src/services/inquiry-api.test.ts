import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InquiryPayload } from "~/types/inquiry";
import { emptyInquiry } from "./inquiry";
import { parseRetryAfter, submitInquiry } from "./inquiry-api";

const ENDPOINT = "https://api.example.test/api/v1/inquiries";

const payload: InquiryPayload = {
  ...emptyInquiry,
  name: "  Rina Pratiwi ",
  organization: "",
  contact: "rina@example.com",
  service: "sistem-informasi",
  budget: "10-50jt",
  timeline: "1-3-bulan",
  message: "Kami butuh sistem stok untuk tiga cabang toko.",
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("submitInquiry request", () => {
  it("POSTs the payload as JSON with an empty honeypot and no credentials", async () => {
    fetchMock.mockResolvedValue(json(201, { id: "INQ-7K3M-9QX2-HD4T", status: "received" }));
    await submitInquiry(ENDPOINT, payload, "");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(init.credentials).toBe("omit");
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Rina Pratiwi",
      organization: "",
      contact: "rina@example.com",
      service: "sistem-informasi",
      budget: "10-50jt",
      timeline: "1-3-bulan",
      message: "Kami butuh sistem stok untuk tiga cabang toko.",
      homepage: "",
    });
  });

  it("passes on whatever a bot typed into the honeypot", async () => {
    fetchMock.mockResolvedValue(json(422, { errors: { homepage: ["x"] } }));
    await submitInquiry(ENDPOINT, payload, "https://spam.example");
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(String(init.body)).homepage).toBe("https://spam.example");
  });
});

describe("submitInquiry outcomes", () => {
  it("accepts only a 201 with a well-formed reference", async () => {
    fetchMock.mockResolvedValue(json(201, { id: "INQ-7K3M-9QX2-HD4T", status: "received" }));
    expect(await submitInquiry(ENDPOINT, payload, "")).toEqual({
      kind: "accepted",
      reference: "INQ-7K3M-9QX2-HD4T",
    });
  });

  it.each([
    ["no body", ""],
    ["not JSON", "<html>ok</html>"],
    ["an array", "[]"],
    ["no id", JSON.stringify({ status: "received" })],
    ["a wrong status", JSON.stringify({ id: "INQ-7K3M-9QX2-HD4T", status: "queued" })],
    ["a malformed id", JSON.stringify({ id: "INQ-123", status: "received" })],
    [
      "an id with excluded letters",
      JSON.stringify({ id: "INQ-ILOU-9QX2-HD4T", status: "received" }),
    ],
    ["markup in the id", JSON.stringify({ id: "<b>INQ-7K3M-9QX2-HD4T</b>", status: "received" })],
  ])("treats a 201 with %s as uncertain, never as success", async (_label, body) => {
    fetchMock.mockResolvedValue(new Response(body, { status: 201 }));
    expect(await submitInquiry(ENDPOINT, payload, "")).toEqual({
      kind: "uncertain",
      cause: "malformed",
    });
  });

  it("maps Laravel validation errors to the form fields it recognises", async () => {
    fetchMock.mockResolvedValue(
      json(422, {
        message: "The name field must be at least 2 characters.",
        errors: {
          name: ["The name field must be at least 2 characters."],
          budget: ["The selected budget is invalid."],
          unknown: ["ignored"],
        },
      }),
    );
    expect(await submitInquiry(ENDPOINT, payload, "")).toEqual({
      kind: "invalid",
      fields: ["name", "budget"],
    });
  });

  it("reports a honeypot rejection as blocked", async () => {
    fetchMock.mockResolvedValue(
      json(422, {
        message: "The submission could not be accepted.",
        errors: { homepage: ["The submission could not be accepted."] },
      }),
    );
    expect(await submitInquiry(ENDPOINT, payload, "x")).toEqual({ kind: "blocked" });
  });

  it("treats a 422 without usable field errors as a refusal", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 422 }));
    expect(await submitInquiry(ENDPOINT, payload, "")).toEqual({ kind: "failed", status: 422 });
  });

  it("reads Retry-After on 429 and copes without it", async () => {
    fetchMock.mockResolvedValueOnce(
      json(429, { message: "Too Many Attempts." }, { "Retry-After": "42" }),
    );
    expect(await submitInquiry(ENDPOINT, payload, "")).toEqual({
      kind: "rate-limited",
      retryAfterSeconds: 42,
    });
    fetchMock.mockResolvedValueOnce(json(429, { message: "Too Many Attempts." }));
    expect(await submitInquiry(ENDPOINT, payload, "")).toEqual({
      kind: "rate-limited",
      retryAfterSeconds: null,
    });
  });

  it("separates 413 and 503 (not stored) from other refusals", async () => {
    fetchMock.mockResolvedValueOnce(json(413, { message: "The request body is too large." }));
    expect(await submitInquiry(ENDPOINT, payload, "")).toEqual({ kind: "too-large" });
    fetchMock.mockResolvedValueOnce(json(503, { message: "The inquiry could not be saved." }));
    expect(await submitInquiry(ENDPOINT, payload, "")).toEqual({ kind: "unavailable" });
    fetchMock.mockResolvedValueOnce(json(404, { message: "Not Found" }));
    expect(await submitInquiry(ENDPOINT, payload, "")).toEqual({ kind: "failed", status: 404 });
  });

  it.each([500, 502, 504, 200, 204])(
    "makes no assumption about storage on an unexpected %i",
    async (status) => {
      fetchMock.mockResolvedValue(
        new Response(status === 204 ? null : '{"message":"Server Error"}', { status }),
      );
      expect(await submitInquiry(ENDPOINT, payload, "")).toEqual({
        kind: "uncertain",
        cause: "server",
      });
    },
  );

  it("reports a network failure as uncertain and does not retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await submitInquiry(ENDPOINT, payload, "")).toEqual({
      kind: "uncertain",
      cause: "network",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("times out once, aborts the request, and does not retry", async () => {
    vi.useFakeTimers();
    let seen: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          seen = init.signal ?? undefined;
          seen?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const result = submitInquiry(ENDPOINT, payload, "", { timeoutMs: 5000 });
    await vi.advanceTimersByTimeAsync(4999);
    expect(seen?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual({ kind: "uncertain", cause: "timeout" });
    expect(seen?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("follows the caller's abort and cleans up its timer and listener", async () => {
    vi.useFakeTimers();
    const outer = new AbortController();
    const remove = vi.spyOn(outer.signal, "removeEventListener");
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        ),
    );
    const result = submitInquiry(ENDPOINT, payload, "", { signal: outer.signal });
    outer.abort();
    expect(await result).toEqual({ kind: "uncertain", cause: "aborted" });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer after a normal answer", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(json(201, { id: "INQ-7K3M-9QX2-HD4T", status: "received" }));
    await submitInquiry(ENDPOINT, payload, "");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("parseRetryAfter", () => {
  const now = Date.UTC(2026, 9, 15, 12, 0, 0);

  it("reads seconds and HTTP dates", () => {
    expect(parseRetryAfter("60", now)).toBe(60);
    expect(parseRetryAfter("0", now)).toBe(0);
    expect(parseRetryAfter("Thu, 15 Oct 2026 12:02:00 GMT", now)).toBe(120);
  });

  it("ignores missing, malformed, past, or implausible values", () => {
    for (const value of [null, "", "soon", "-5", "1.5", "999999", "Thu, 15 Oct 2026 11:00:00 GMT"])
      expect(parseRetryAfter(value, now), String(value)).toBeNull();
  });
});
