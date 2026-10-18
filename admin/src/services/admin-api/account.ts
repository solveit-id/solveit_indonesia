import type { AdminApiClient } from "./client";
import {
  type AdminAccessLinkInspection,
  type AdminAccessLinkRedemption,
  type AdminAccessLinkRedemptionInput,
  type AdminAccount,
  type AdminEnrollmentConfirmation,
  type AdminEnvelope,
  type AdminLoginResult,
  type AdminPasswordChangeInput,
  type AdminRecoveryCodes,
  type AdminSessionSummary,
  type AdminSessionsEnded,
  type AdminTwoFactorAnswer,
  EXPIRED_SIGN_IN_MESSAGE,
} from "./contracts";
import { unwrap } from "./envelope";
import { AdminApiError } from "./errors";

/**
 * The B3.2b endpoints of docs/api/admin-auth.md: sign-in, access links, and the signed-in
 * account's own security. Each call states its 419 policy on purpose. Only the five
 * authentication steps in `automaticReplayAllowlist` (client.ts) are resent after a 419;
 * redeeming or confirming an access link and every change to the account's own security stay
 * `confirm`, so the screen asks the person before anything is sent again.
 *
 * Every value passed in (passwords, codes, tokens) goes into the request body only. Nothing
 * here stores, logs, or returns it.
 */

/** `GET me` with the server's clock, so a deadline from Laravel is read in Laravel's time. */
export interface VerifiedAccount {
  account: AdminAccount;
  /** Milliseconds to add to `Date.now()` to get the server's time (0 when unknown). */
  serverClockOffsetMs: number;
}

/** Difference between the server's `Date` header and this device's clock, bounded to a day. */
export function serverClockOffset(headers: Headers, now: number = Date.now()): number {
  const date = Date.parse(headers.get("Date") ?? "");

  if (Number.isNaN(date)) {
    return 0;
  }

  const offset = date - now;

  return Math.abs(offset) > 86_400_000 ? 0 : offset;
}

/** True for the challenge's "sign in again" answer: the pending sign-in no longer exists. */
export function isExpiredSignIn(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    error.kind === "validation" &&
    (error.fieldErrors.code ?? []).includes(EXPIRED_SIGN_IN_MESSAGE)
  );
}

export function createAccountApi(client: AdminApiClient) {
  return {
    async me(signal?: AbortSignal): Promise<VerifiedAccount> {
      const response = await client.request<AdminEnvelope<AdminAccount>>({
        method: "GET",
        path: "me",
        signal,
      });

      return {
        account: unwrap(response, false),
        serverClockOffsetMs: serverClockOffset(response.headers),
      };
    },

    async login(email: string, password: string): Promise<AdminLoginResult> {
      const response = await client.request<AdminLoginResult>({
        method: "POST",
        path: "auth/login",
        body: { email, password },
        replay: "automatic",
      });

      return response.data;
    },

    async answerChallenge(answer: AdminTwoFactorAnswer): Promise<void> {
      await client.request({
        method: "POST",
        path: "auth/two-factor-challenge",
        body: answer,
        replay: "automatic",
      });
    },

    async logout(): Promise<void> {
      await client.request({ method: "POST", path: "auth/logout", replay: "automatic" });
    },

    async confirmPassword(password: string): Promise<void> {
      await client.request({
        method: "POST",
        path: "auth/confirm-password",
        body: { password },
        replay: "automatic",
      });
    },

    async inspectAccessLink(
      token: string,
      signal?: AbortSignal,
    ): Promise<AdminAccessLinkInspection> {
      const response = await client.request<AdminEnvelope<AdminAccessLinkInspection>>({
        method: "POST",
        path: "access-links/inspect",
        body: { token },
        replay: "automatic",
        signal,
      });

      return unwrap(response, true);
    },

    async redeemAccessLink(
      input: AdminAccessLinkRedemptionInput,
    ): Promise<AdminAccessLinkRedemption> {
      const response = await client.request<AdminEnvelope<AdminAccessLinkRedemption>>({
        method: "POST",
        path: "access-links/redeem",
        body: input,
      });

      return unwrap(response, true);
    },

    async confirmEnrollment(code: string): Promise<AdminEnrollmentConfirmation> {
      const response = await client.request<AdminEnvelope<AdminEnrollmentConfirmation>>({
        method: "POST",
        path: "access-links/confirm",
        body: { code },
      });

      return unwrap(response, true);
    },

    async changePassword(input: AdminPasswordChangeInput): Promise<AdminSessionsEnded> {
      const response = await client.request<AdminEnvelope<AdminSessionsEnded>>({
        method: "PUT",
        path: "me/password",
        body: input,
      });

      return unwrap(response, true);
    },

    async regenerateRecoveryCodes(): Promise<AdminRecoveryCodes> {
      const response = await client.request<AdminEnvelope<AdminRecoveryCodes>>({
        method: "POST",
        path: "me/two-factor-recovery-codes",
      });

      return unwrap(response, true);
    },

    async listSessions(signal?: AbortSignal): Promise<AdminSessionSummary[]> {
      const response = await client.request<AdminEnvelope<AdminSessionSummary[]>>({
        method: "GET",
        path: "me/sessions",
        signal,
      });

      return unwrap(response, false);
    },

    async endSession(handle: string): Promise<void> {
      await client.request({ method: "DELETE", path: `me/sessions/${handle}` });
    },

    async endOtherSessions(): Promise<AdminSessionsEnded> {
      const response = await client.request<AdminEnvelope<AdminSessionsEnded>>({
        method: "DELETE",
        path: "me/sessions",
      });

      return unwrap(response, true);
    },
  };
}

export type AccountApi = ReturnType<typeof createAccountApi>;
