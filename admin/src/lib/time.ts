import { useSyncExternalStore } from "react";

/** The longest wait a rate-limit countdown shows; Laravel's limiters reset well inside it. */
export const MAX_RETRY_AFTER_SECONDS = 3600;
/** Used when a 429 arrives without a readable Retry-After. */
const DEFAULT_RETRY_AFTER_SECONDS = 60;

/** A one-second clock as an external store: every render reads the current second. */
const subscribeToClock = (onTick: () => void) => {
  const timer = window.setInterval(onTick, 1000);

  return () => window.clearInterval(timer);
};
const subscribeToNothing = () => () => undefined;
const currentSecond = () => Math.floor(Date.now() / 1000);

/**
 * Seconds left until `until` (a `Date.now()` value), never negative. Read from the clock at
 * every render, so the first value is already right: a dialog that opens with a countdown is
 * announced with the real time left, not a stale one. Ticks only while `until` is set.
 */
export function useSecondsUntil(until: number | null): number {
  const now = useSyncExternalStore(
    until === null ? subscribeToNothing : subscribeToClock,
    currentSecond,
    currentSecond,
  );

  return until === null ? 0 : Math.max(0, Math.ceil(until / 1000) - now);
}

/**
 * A 429's wait, bounded: what Laravel's Retry-After says, capped at an hour, or a minute when
 * the header is missing. Returns the `Date.now()` value at which a new attempt may start.
 */
export function retryAt(retryAfterSeconds: number | undefined, now: number = Date.now()): number {
  const seconds = Math.min(
    MAX_RETRY_AFTER_SECONDS,
    Math.max(1, retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS),
  );

  return now + seconds * 1000;
}

/** `m:ss` for a countdown. */
export function clockText(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Date and time in the reader's language and time zone, for values Laravel returns. */
export function formatDateTime(iso: string | null, locale: "id" | "en"): string | null {
  if (iso === null) {
    return null;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Time of day only, for deadlines inside the next hours. */
export function formatTime(iso: string | null, locale: "id" | "en"): string | null {
  if (iso === null) {
    return null;
  }

  const date = new Date(iso);

  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}
