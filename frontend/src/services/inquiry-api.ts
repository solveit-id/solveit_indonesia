import { inquiryFields } from "~/services/inquiry";
import type { InquiryPayload } from "~/types/inquiry";

/**
 * Client for `POST /api/v1/inquiries` (contract: docs/api/inquiries.md).
 *
 * It sends exactly one request and never retries: the endpoint is not
 * idempotent, so a second attempt could store the inquiry twice. Only a
 * `201` carrying a well-formed reference counts as received. Every other
 * outcome says whether the inquiry was certainly not stored, or whether that
 * is unknown. Nothing here logs or reports what the visitor typed.
 */
export type InquirySubmitResult =
  | { kind: "accepted"; reference: string }
  /** 422 naming form fields; nothing was stored. */
  | { kind: "invalid"; fields: (keyof InquiryPayload)[] }
  /** 422 from the honeypot; nothing was stored. */
  | { kind: "blocked" }
  | { kind: "rate-limited"; retryAfterSeconds: number | null }
  | { kind: "too-large" }
  /** 503: the server could not store it. */
  | { kind: "unavailable" }
  /** Another 4xx: the request was refused, nothing was stored. */
  | { kind: "failed"; status: number }
  /** The inquiry may or may not have been stored. */
  | { kind: "uncertain"; cause: "timeout" | "network" | "aborted" | "server" | "malformed" };

export const INQUIRY_TIMEOUT_MS = 15_000;

/** `INQ-` and three groups of four Crockford base32 characters. */
const REFERENCE = /^INQ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const MAX_RETRY_AFTER = 24 * 60 * 60;

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
    return isRecord(body) &&
      body.status === "received" &&
      typeof body.id === "string" &&
      REFERENCE.test(body.id)
      ? { kind: "accepted", reference: body.id }
      : { kind: "uncertain", cause: "malformed" };
  }
  if (status === 422) return fieldsFrom(parse(await response.text().catch(() => "")));
  if (status === 429)
    return {
      kind: "rate-limited",
      retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
    };
  if (status === 413) return { kind: "too-large" };
  if (status === 503) return { kind: "unavailable" };
  if (status >= 400 && status < 500) return { kind: "failed", status };
  // 500 and any other status: the server may have stored it before failing.
  return { kind: "uncertain", cause: "server" };
}

interface SubmitOptions {
  /** Aborts the request, e.g. when the form unmounts. */
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function submitInquiry(
  endpoint: string,
  payload: InquiryPayload,
  homepage: string,
  { signal, timeoutMs = INQUIRY_TIMEOUT_MS }: SubmitOptions = {},
): Promise<InquirySubmitResult> {
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
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name.trim(),
        organization: payload.organization.trim(),
        contact: payload.contact.trim(),
        service: payload.service,
        budget: payload.budget,
        timeline: payload.timeline,
        message: payload.message.trim(),
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
