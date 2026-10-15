import { canonicalInquiry, inquiryFields, sameInquiry } from "~/services/inquiry";
import type { InquiryPayload } from "~/types/inquiry";

/**
 * Client for `POST /api/v1/inquiries` (contract: docs/api/inquiries.md).
 *
 * Every request carries an `Idempotency-Key` that belongs to one logical
 * submission (see `nextSubmission`). It sends exactly one request and never
 * retries by itself: a retry is always the visitor's choice, and it reuses
 * the key only for unchanged content, so the server answers it with the
 * original reference instead of storing the inquiry twice. Only a `201`
 * carrying a well-formed reference counts as received. Every other outcome
 * says whether the inquiry was certainly not stored, or whether that is
 * unknown. Nothing here logs or reports the key or what the visitor typed.
 */
export type InquirySubmitResult =
  /** `replayed`: the server answered from an inquiry stored by an earlier attempt. */
  | { kind: "accepted"; reference: string; replayed: boolean }
  /** 422 naming form fields; nothing was stored. */
  | { kind: "invalid"; fields: (keyof InquiryPayload)[] }
  /** 422 from the honeypot; nothing was stored. */
  | { kind: "blocked" }
  | { kind: "rate-limited"; retryAfterSeconds: number | null }
  | { kind: "too-large" }
  /** 503 with Laravel's documented body: the server could not store it. */
  | { kind: "unavailable" }
  /** 400: the key was refused (Laravel's only 400) or a gateway refused the request; nothing was stored. */
  | { kind: "key-rejected" }
  /** 409: the key already belongs to a different stored inquiry; this content was not stored. */
  | { kind: "conflict" }
  /** No usable key, so nothing was sent. */
  | { kind: "no-key" }
  /** Another 4xx: the request was refused, nothing was stored. */
  | { kind: "failed"; status: number }
  /** The inquiry may or may not have been stored. */
  | { kind: "uncertain"; cause: "timeout" | "network" | "aborted" | "server" | "malformed" };

export const INQUIRY_TIMEOUT_MS = 15_000;

/** `INQ-` and three groups of four Crockford base32 characters. */
const REFERENCE = /^INQ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
/** The canonical UUID version 4 the server accepts. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Body of the 503 Laravel sends when the database refused the row (InquiryNotStoredException). */
const NOT_STORED_MESSAGE =
  "The inquiry could not be saved. Please try again later or contact us by WhatsApp or email.";
const MAX_RETRY_AFTER = 24 * 60 * 60;

export const isIdempotencyKey = (value: string): boolean => UUID_V4.test(value);

/**
 * A new idempotency key from the browser's cryptographic generator, or `null`
 * when it is unavailable (an old browser, or a page that is not a secure
 * context). There is deliberately no fallback: a guessable key would let a
 * retry collide with someone else's inquiry, so without one nothing is sent.
 */
export function createIdempotencyKey(): string | null {
  try {
    const key = globalThis.crypto?.randomUUID?.();
    return typeof key === "string" && isIdempotencyKey(key) ? key : null;
  } catch {
    return null;
  }
}

/**
 * One logical submission: the key and the canonical values sent with it. The
 * pair lives only in memory (a reload forgets it) and the values never
 * change after the key is made, so a key is never sent with other content.
 */
export interface LogicalSubmission {
  readonly key: string;
  readonly sent: InquiryPayload;
}

/**
 * The submission to send for `values`: the held one when its canonical
 * content is the same (a retry, also after the visitor edited and then
 * restored the form), otherwise a new one with a new key. `null` when no
 * secure key can be made.
 */
export function nextSubmission(
  held: LogicalSubmission | null,
  values: InquiryPayload,
  createKey: () => string | null = createIdempotencyKey,
): LogicalSubmission | null {
  if (held && sameInquiry(held.sent, values)) return held;
  const key = createKey();
  return key ? { key, sent: canonicalInquiry(values) } : null;
}

/**
 * Whether the submission should be kept after `result`, so that sending the
 * same content again reuses its key. Kept after every outcome where the
 * inquiry may be stored, and after refusals that do not use up the key
 * (reusing it is harmless there). Retired once received, and after `400` or
 * `409`, where the key itself is the problem.
 */
export const keepsSubmission = (result: InquirySubmitResult): boolean =>
  result.kind !== "accepted" && result.kind !== "key-rejected" && result.kind !== "conflict";

/** `Retry-After` as seconds (delta or HTTP date), or `null` when absent or implausible. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  const header = (value ?? "").trim();
  if (!header) return null;
  const seconds = /^\d+$/.test(header)
    ? Number(header)
    : Math.ceil((Date.parse(header) - now) / 1000);
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= MAX_RETRY_AFTER ? seconds : null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const fieldsFrom = (body: unknown): InquirySubmitResult => {
  const errors = isRecord(body) && isRecord(body.errors) ? body.errors : {};
  if ("homepage" in errors) return { kind: "blocked" };
  const fields = inquiryFields.filter((key) => {
    const list = errors[key];
    return Array.isArray(list) && list.length > 0;
  });
  return fields.length > 0 ? { kind: "invalid", fields } : { kind: "failed", status: 422 };
};

async function interpret(response: Response): Promise<InquirySubmitResult> {
  const { status } = response;
  if (status === 201) {
    // Reading the body can still fail (timeout, dropped connection): the
    // caller turns that into an uncertain outcome, never a success.
    const body = parse(await response.text());
    if (
      !isRecord(body) ||
      body.status !== "received" ||
      typeof body.id !== "string" ||
      !REFERENCE.test(body.id)
    )
      return { kind: "uncertain", cause: "malformed" };
    // Readable only when CORS exposes it; without it a replay looks like a 201.
    const replayed = (response.headers.get("Idempotent-Replayed") ?? "").trim() === "true";
    return { kind: "accepted", reference: body.id, replayed };
  }
  if (status === 422) return fieldsFrom(parse(await response.text().catch(() => "")));
  if (status === 429)
    return {
      kind: "rate-limited",
      retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
    };
  if (status === 413) return { kind: "too-large" };
  if (status === 400) return { kind: "key-rejected" };
  if (status === 409) return { kind: "conflict" };
  if (status === 503) {
    // Only Laravel's own answer proves nothing was stored. A gateway or proxy
    // 503 (or one whose body cannot be read) may follow a stored inquiry.
    const body = parse(await response.text().catch(() => ""));
    return isRecord(body) && body.message === NOT_STORED_MESSAGE
      ? { kind: "unavailable" }
      : { kind: "uncertain", cause: "server" };
  }
  if (status >= 400 && status < 500) return { kind: "failed", status };
  // 500, 502, 504, and any other status: the server may have stored it before failing.
  return { kind: "uncertain", cause: "server" };
}

interface SubmitOptions {
  /** Aborts the request, e.g. when the form unmounts. */
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function submitInquiry(
  endpoint: string,
  submission: LogicalSubmission,
  homepage: string,
  { signal, timeoutMs = INQUIRY_TIMEOUT_MS }: SubmitOptions = {},
): Promise<InquirySubmitResult> {
  // Never send without protection against duplicates.
  if (!isIdempotencyKey(submission.key)) return { kind: "no-key" };

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forward = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", forward, { once: true });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": submission.key,
      },
      body: JSON.stringify({
        ...canonicalInquiry(submission.sent),
        // Honeypot: always empty for people (docs/api/inquiries.md).
        homepage,
      }),
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    return await interpret(response);
  } catch {
    return {
      kind: "uncertain",
      cause: timedOut ? "timeout" : signal?.aborted ? "aborted" : "network",
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forward);
  }
}
