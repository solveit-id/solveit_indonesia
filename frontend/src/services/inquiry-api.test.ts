import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InquiryPayload } from "~/types/inquiry";
import { emptyInquiry } from "./inquiry";
import {
  createIdempotencyKey,
  type InquirySubmitResult,
  isIdempotencyKey,
  keepsSubmission,
  type LogicalSubmission,
  nextSubmission,
  parseRetryAfter,
  submitInquiry,
} from "./inquiry-api";

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

const KEY = "3f2b8a4e-9c1d-4e7f-a6b5-0d9c8e7f6a5b";
const submission: LogicalSubmission = { key: KEY, sent: payload };
/** Laravel's 503 body when the database refused the row (InquiryNotStoredException). */
const NOT_STORED = {
  message:
    "The inquiry could not be saved. Please try again later or contact us by WhatsApp or email.",
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
  it("POSTs the payload as JSON with its key, an empty honeypot, and no credentials", async () => {
    fetchMock.mockResolvedValue(json(201, { id: "INQ-7K3M-9QX2-HD4T", status: "received" }));
    await submitInquiry(ENDPOINT, submission, "");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": KEY,
    });
    expect(init.credentials).toBe("omit");
    expect(init.mode).toBe("cors");
    expect(init.cache).toBe("no-store");
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

  it("keeps the key out of the URL and the body", async () => {
    fetchMock.mockResolvedValue(json(201, { id: "INQ-7K3M-9QX2-HD4T", status: "received" }));
    await submitInquiry(ENDPOINT, submission, "");
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).not.toContain(KEY);
    expect(String(init.body)).not.toContain(KEY);
  });

  it.each([
    ["an empty key", ""],
    ["a timestamp", String(Date.UTC(2026, 9, 16))],
    ["a UUID version 1", "3f2b8a4e-9c1d-1e7f-a6b5-0d9c8e7f6a5b"],
    ["a wrong variant", "3f2b8a4e-9c1d-4e7f-c6b5-0d9c8e7f6a5b"],
    ["two keys", `${KEY}, ${KEY}`],
  ])("never sends with %s", async (_label, key) => {
    expect(await submitInquiry(ENDPOINT, { key, sent: payload }, "")).toEqual({ kind: "no-key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes on whatever a bot typed into the honeypot", async () => {
    fetchMock.mockResolvedValue(json(422, { errors: { homepage: ["x"] } }));
    await submitInquiry(ENDPOINT, submission, "https://spam.example");
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(String(init.body)).homepage).toBe("https://spam.example");
  });
});

describe("submitInquiry outcomes", () => {
  it("accepts only a 201 with a well-formed reference", async () => {
    fetchMock.mockResolvedValue(json(201, { id: "INQ-7K3M-9QX2-HD4T", status: "received" }));
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({
      kind: "accepted",
      reference: "INQ-7K3M-9QX2-HD4T",
      replayed: false,
    });
  });

  it("recognises a replayed 201 when CORS exposes the header", async () => {
    fetchMock.mockResolvedValue(
      json(
        201,
        { id: "INQ-7K3M-9QX2-HD4T", status: "received" },
        { "Idempotent-Replayed": "true" },
      ),
    );
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({
      kind: "accepted",
      reference: "INQ-7K3M-9QX2-HD4T",
      replayed: true,
    });
  });

  it("still validates the body of a replayed 201", async () => {
    fetchMock.mockResolvedValue(
      json(201, { id: "INQ-123", status: "received" }, { "Idempotent-Replayed": "true" }),
    );
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({
      kind: "uncertain",
      cause: "malformed",
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
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({
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
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({
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
    expect(await submitInquiry(ENDPOINT, submission, "x")).toEqual({ kind: "blocked" });
  });

  it("treats a 422 without usable field errors as a refusal", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 422 }));
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({ kind: "failed", status: 422 });
  });

  it("reads Retry-After on 429 and copes without it", async () => {
    fetchMock.mockResolvedValueOnce(
      json(429, { message: "Too Many Attempts." }, { "Retry-After": "42" }),
    );
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({
      kind: "rate-limited",
      retryAfterSeconds: 42,
    });
    fetchMock.mockResolvedValueOnce(json(429, { message: "Too Many Attempts." }));
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({
      kind: "rate-limited",
      retryAfterSeconds: null,
    });
  });

  it("separates 413 and Laravel's 503 (not stored) from other refusals", async () => {
    fetchMock.mockResolvedValueOnce(json(413, { message: "The request body is too large." }));
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({ kind: "too-large" });
    fetchMock.mockResolvedValueOnce(json(503, NOT_STORED));
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({ kind: "unavailable" });
    fetchMock.mockResolvedValueOnce(json(404, { message: "Not Found" }));
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({ kind: "failed", status: 404 });
  });

  it.each([
    ["a gateway page", "<html><body>503 Service Temporarily Unavailable</body></html>"],
    ["maintenance mode", JSON.stringify({ message: "Service Unavailable" })],
    ["a shortened message", JSON.stringify({ message: "The inquiry could not be saved." })],
    ["no body", ""],
  ])("treats a 503 with %s as uncertain, not as proof of no storage", async (_label, text) => {
    fetchMock.mockResolvedValue(new Response(text, { status: 503 }));
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({
      kind: "uncertain",
      cause: "server",
    });
  });

  it("treats a 503 whose body cannot be read as uncertain", async () => {
    const body = new ReadableStream({ pull: (stream) => stream.error(new TypeError("reset")) });
    fetchMock.mockResolvedValue(new Response(body, { status: 503 }));
    expect((await submitInquiry(ENDPOINT, submission, "")).kind).toBe("uncertain");
  });

  it("reports a refused key (400) and a key conflict (409), never as success", async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, { message: "The Idempotency-Key header must be a single UUID (version 4)." }),
    );
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({ kind: "key-rejected" });
    fetchMock.mockResolvedValueOnce(
      json(409, {
        message:
          "This Idempotency-Key was already used for a different inquiry. Send a new submission with a new key.",
      }),
    );
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({ kind: "conflict" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([500, 502, 504, 200, 204])(
    "makes no assumption about storage on an unexpected %i",
    async (status) => {
      fetchMock.mockResolvedValue(
        new Response(status === 204 ? null : '{"message":"Server Error"}', { status }),
      );
      expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({
        kind: "uncertain",
        cause: "server",
      });
    },
  );

  it("reports a network failure as uncertain and does not retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await submitInquiry(ENDPOINT, submission, "")).toEqual({
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
    const result = submitInquiry(ENDPOINT, submission, "", { timeoutMs: 5000 });
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
    const result = submitInquiry(ENDPOINT, submission, "", { signal: outer.signal });
    outer.abort();
    expect(await result).toEqual({ kind: "uncertain", cause: "aborted" });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer after a normal answer", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(json(201, { id: "INQ-7K3M-9QX2-HD4T", status: "received" }));
    await submitInquiry(ENDPOINT, submission, "");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("idempotency keys", () => {
  it("come from crypto.randomUUID as canonical UUID version 4", () => {
    const keys = new Set(Array.from({ length: 50 }, () => createIdempotencyKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(isIdempotencyKey(key!), String(key)).toBe(true);
  });

  it("never fall back to a weaker generator", () => {
    const random = vi.spyOn(Math, "random");
    vi.stubGlobal("crypto", undefined);
    expect(createIdempotencyKey()).toBeNull();
    vi.stubGlobal("crypto", {});
    expect(createIdempotencyKey()).toBeNull();
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new DOMException("insecure", "SecurityError");
      },
    });
    expect(createIdempotencyKey()).toBeNull();
    vi.stubGlobal("crypto", { randomUUID: () => "not-a-uuid" });
    expect(createIdempotencyKey()).toBeNull();
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it("are not written to the console", async () => {
    const levels = ["log", "info", "warn", "error", "debug"] as const;
    const spies = levels.map((level) => vi.spyOn(console, level));
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await submitInquiry(ENDPOINT, submission, "");
    fetchMock.mockResolvedValue(json(409, { message: "conflict" }));
    await submitInquiry(ENDPOINT, submission, "");
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    for (const spy of spies) spy.mockRestore();
  });
});

describe("logical submissions", () => {
  let count = 0;
  const keys = () => `00000000-0000-4000-8000-${String(++count).padStart(12, "0")}`;

  it("start with a new key and the canonical values", () => {
    const next = nextSubmission(null, payload, keys)!;
    expect(isIdempotencyKey(next.key)).toBe(true);
    expect(next.sent.name).toBe("Rina Pratiwi");
  });

  it("keep the key for the same content, also when only surrounding spaces differ", () => {
    const first = nextSubmission(null, payload, keys)!;
    expect(nextSubmission(first, payload, keys)).toBe(first);
    const padded = { ...payload, name: "Rina Pratiwi", message: ` ${payload.message}\n` };
    expect(nextSubmission(first, padded, keys)).toBe(first);
  });

  it("get a new key for different content, including a change of case or option", () => {
    const first = nextSubmission(null, payload, keys)!;
    const changes: Partial<InquiryPayload>[] = [
      { name: "rina pratiwi" },
      { organization: "Toko Sinar Jaya" },
      { contact: "+62 877-5964-1358" },
      { service: "website" },
      { budget: "50-150jt" },
      { timeline: "segera" },
      { message: `${payload.message} Ditambah gudang.` },
    ];
    for (const change of changes) {
      const next = nextSubmission(first, { ...payload, ...change }, keys)!;
      expect(next.key, JSON.stringify(change)).not.toBe(first.key);
      expect(next.sent).toEqual(expect.objectContaining(change));
    }
  });

  it("do not depend on field order or object identity", () => {
    const first = nextSubmission(null, payload, keys)!;
    const reordered = Object.fromEntries(
      Object.entries({ ...payload }).reverse(),
    ) as unknown as InquiryPayload;
    expect(nextSubmission(first, reordered, keys)).toBe(first);
  });

  it("are not created without a secure key", () => {
    expect(nextSubmission(null, payload, () => null)).toBeNull();
  });

  it("snapshot the values, so later edits cannot change what the key was sent with", () => {
    const live = { ...payload };
    const first = nextSubmission(null, live, keys)!;
    live.message = "Sesuatu yang lain sama sekali, cukup panjang.";
    expect(first.sent.message).toBe(payload.message);
  });

  it.each<[InquirySubmitResult, boolean]>([
    [{ kind: "accepted", reference: "INQ-7K3M-9QX2-HD4T", replayed: false }, false],
    [{ kind: "key-rejected" }, false],
    [{ kind: "conflict" }, false],
    [{ kind: "uncertain", cause: "timeout" }, true],
    [{ kind: "uncertain", cause: "network" }, true],
    [{ kind: "uncertain", cause: "aborted" }, true],
    [{ kind: "uncertain", cause: "server" }, true],
    [{ kind: "uncertain", cause: "malformed" }, true],
    [{ kind: "rate-limited", retryAfterSeconds: 60 }, true],
    [{ kind: "unavailable" }, true],
    [{ kind: "invalid", fields: ["name"] }, true],
  ])("after %o are kept: %s", (result, kept) => {
    expect(keepsSubmission(result)).toBe(kept);
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
