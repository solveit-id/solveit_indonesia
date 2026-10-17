import { useSyncExternalStore } from "react";
import { type AdminAccount, type VerifiedAccount, onAdminApiResponse } from "~/services/admin-api";

/**
 * What this tab knows about the signed-in account, in memory only. Laravel is the authority:
 * this store is filled only from a verified `GET me` (or the account Laravel returns when an
 * enrollment is confirmed), and emptied as soon as Laravel says the session is gone, the person
 * signs out, or another tab of the same browser signs out. Nothing here is ever written to
 * browser storage; a reload starts from `unknown` and asks Laravel again.
 */
export type SessionState =
  | { status: "unknown" }
  | {
      status: "signed-in";
      account: AdminAccount;
      /** `Date.now()` of the last successful `GET me`. */
      verifiedAt: number;
      serverClockOffsetMs: number;
    }
  | { status: "signed-out"; reason: SignOutReason };

/**
 * `signed-out`: this tab signed out. `elsewhere`: another tab of this browser did. `expired`:
 * Laravel answered 401 (idle, absolute limit, revoked, suspended, or reset).
 */
export type SignOutReason = "signed-out" | "elsewhere" | "expired";

let state: SessionState = { status: "unknown" };
/** `Date.now()` of the last response that kept the server session alive. */
let lastContactAt = 0;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export const getSessionState = (): SessionState => state;
export const getLastContactAt = (): number => lastContactAt;

export function useSessionState(): SessionState {
  return useSyncExternalStore(subscribe, getSessionState, getSessionState);
}

export function useLastContactAt(): number {
  return useSyncExternalStore(subscribe, getLastContactAt, getLastContactAt);
}

export function markVerified({ account, serverClockOffsetMs }: VerifiedAccount): void {
  const now = Date.now();
  state = { status: "signed-in", account, verifiedAt: now, serverClockOffsetMs };
  lastContactAt = now;
  notify();
}

export function markSignedOut(reason: SignOutReason, { broadcast = true } = {}): void {
  if (state.status === "signed-out" && state.reason === reason) {
    return;
  }

  const wasSignedIn = state.status === "signed-in";
  state = { status: "signed-out", reason };
  lastContactAt = 0;
  notify();

  if (broadcast && wasSignedIn && reason === "signed-out") {
    post({ type: "signed-out" });
  }
}

/** Back to `unknown` (tests, and a fresh start before asking Laravel again). */
export function resetSession(): void {
  state = { status: "unknown" };
  lastContactAt = 0;
  notify();
}

/**
 * Responses that reached a started session and so reset its idle timer on the server. 401
 * means it is gone; 403 and 404 can come from the boundary before a session starts; 419 means
 * the session token did not match; a 5xx says nothing reliable.
 */
const keepsSessionAlive = (status: number) =>
  status < 500 && status !== 401 && status !== 403 && status !== 404 && status !== 419;

function noteContact(at: number): void {
  if (state.status !== "signed-in" || at <= lastContactAt) {
    return;
  }

  lastContactAt = at;
  notify();
}

// ------------------------------------------------------------------- other tabs of this browser

/**
 * Tabs share the session cookie, so they share its fate. They tell each other two facts, never
 * data: "this tab reached Laravel at <time>" (so another tab does not warn about an idle
 * expiry that is not coming) and "this tab signed out" (so every tab drops its account view).
 */
type TabMessage = { type: "activity"; at: number } | { type: "signed-out" };

const CHANNEL = "solveit-admin-session";
const ACTIVITY_INTERVAL_MS = 15_000;

let channel: BroadcastChannel | null = null;
let lastPostedActivity = 0;

function post(message: TabMessage): void {
  try {
    channel?.postMessage(message);
  } catch {
    // A closed channel only means other tabs learn it on their next request.
  }
}

function onTabMessage(event: MessageEvent<unknown>): void {
  const message = event.data as Partial<TabMessage> | null;

  if (message?.type === "signed-out") {
    markSignedOut("elsewhere", { broadcast: false });
  } else if (message?.type === "activity" && typeof message.at === "number") {
    noteContact(Math.min(message.at, Date.now()));
  }
}

if (typeof BroadcastChannel !== "undefined") {
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.addEventListener("message", onTabMessage);
    // Node (the test runner) would otherwise stay alive for the channel; browsers lack unref.
    (channel as BroadcastChannel & { unref?: () => void }).unref?.();
  } catch {
    channel = null;
  }
}

onAdminApiResponse((status) => {
  if (state.status !== "signed-in") {
    return;
  }

  if (status === 401) {
    markSignedOut("expired");

    return;
  }

  if (keepsSessionAlive(status)) {
    const now = Date.now();
    noteContact(now);

    if (now - lastPostedActivity >= ACTIVITY_INTERVAL_MS) {
      lastPostedActivity = now;
      post({ type: "activity", at: now });
    }
  }
});
