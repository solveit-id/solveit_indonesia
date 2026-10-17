/**
 * Types of the released admin API (B3.1a and B3.1b). Source of truth: docs/api/admin-auth.md
 * and docs/api/admin-users.md; change those documents and these types together. Only shapes
 * the client needs now are listed: sign-in, access links, and own account (B3.2b); the owner
 * administration screens add theirs in B3.2c.
 */

/** Base path of every admin endpoint, always relative to the admin origin (same origin). */
export const ADMIN_API_BASE = "/api/v1/admin";

/** Body of every admin error response: `{"message": "..."}`. */
export interface AdminErrorBody {
  message: string;
}

/** 422: Laravel validation format. */
export interface AdminValidationErrorBody extends AdminErrorBody {
  errors: Record<string, string[]>;
}

/** 409 from account operations carries a stable machine-readable code (admin-users.md). */
export interface AdminConflictBody extends AdminErrorBody {
  code: AdminConflictCode;
}

export const adminConflictCodes = [
  "own_account",
  "last_active_owner",
  "not_activated",
  "suspended",
  "not_admin_account",
  "account_exists",
  "invitation_pending",
  "invitation_completed",
] as const;

export type AdminConflictCode = (typeof adminConflictCodes)[number];

export type AdminRole = "owner" | "admin";

export type AdminPermission =
  | "account.manage-own"
  | "users.view"
  | "users.invite"
  | "users.change-role"
  | "users.suspend"
  | "users.reset-credentials"
  | "audit.view-all";

/** `GET me` (admin-auth.md). Never contains a password hash, TOTP secret, or recovery codes. */
export interface AdminAccount {
  id: number;
  name: string;
  email: string;
  role: AdminRole | null;
  permissions: AdminPermission[];
  two_factor: { confirmed_at: string | null; recovery_codes_remaining: number };
  session: {
    signed_in_at: string | null;
    absolute_expires_at: string | null;
    idle_timeout_minutes: number;
  };
}

/** Every response that carries data wraps it in `data` (admin-auth.md, Format). */
export interface AdminEnvelope<T> {
  data: T;
}

/** `POST auth/login` 200: the password was right; the TOTP challenge follows within 5 minutes. */
export interface AdminLoginResult {
  two_factor: true;
}

/** `POST auth/two-factor-challenge` body: a six-digit TOTP code or one recovery code. */
export type AdminTwoFactorAnswer = { code: string } | { recovery_code: string };

/**
 * The exact `errors.code` message of the TOTP challenge when the pending sign-in is gone
 * (more than 5 minutes, no password step, the session was lost, or the account changed).
 * It is not a wrong code: the person starts again at the password (admin-auth.md).
 */
export const EXPIRED_SIGN_IN_MESSAGE = "The sign-in attempt has expired. Sign in again.";

export type AdminAccessLinkPurpose = "activation" | "credential-reset";

/** `POST access-links/inspect` 200. The address is masked by Laravel. */
export interface AdminAccessLinkInspection {
  purpose: AdminAccessLinkPurpose;
  email: string;
  requires_name: boolean;
  expires_at: string;
}

/** `POST access-links/redeem` body; `name` only for `activation`. */
export interface AdminAccessLinkRedemptionInput {
  token: string;
  name?: string;
  password: string;
  password_confirmation: string;
}

/** `POST access-links/redeem` 200: the only response that carries the new TOTP secret. */
export interface AdminAccessLinkRedemption {
  two_factor: { qr_code_svg: string; setup_key: string };
  confirm_before: string;
}

/** `POST access-links/confirm` 200: the only response that carries these recovery codes. */
export interface AdminEnrollmentConfirmation {
  recovery_codes: string[];
  account: AdminAccount;
}

/** `PUT me/password` body. */
export interface AdminPasswordChangeInput {
  current_password: string;
  password: string;
  password_confirmation: string;
}

/** `PUT me/password` 200 and `DELETE me/sessions` 200. */
export interface AdminSessionsEnded {
  other_sessions_ended: number;
}

/** `POST me/two-factor-recovery-codes` 200: the new codes, shown once. */
export interface AdminRecoveryCodes {
  recovery_codes: string[];
}

/** `GET me/sessions` item. `id` is an opaque HMAC handle, never the session ID itself. */
export interface AdminSessionSummary {
  id: string;
  current: boolean;
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: string;
}

/** Cursor pagination of the owner lists (admin-users.md, Daftar dan pagination). */
export interface CursorPage<T> {
  data: T[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: { path: string; per_page: number; next_cursor: string | null; prev_cursor: string | null };
}
