/**
 * Types of the released admin API (B3.1a, B3.1b, B4a). Source of truth: docs/api/admin-auth.md,
 * docs/api/admin-users.md, and docs/api/admin-inquiries.md; change those documents and these
 * types together. Sign-in, access links, and own account (B3.2b); owner administration and the
 * audit reader (B3.2c); the inquiry types themselves live in inquiry-contracts.ts (B4b).
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

/** 409 carries a stable machine-readable code (admin-users.md, admin-inquiries.md). */
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
  // Inquiry status changes (B4a): the compare and set lost, or the move is not allowed.
  "status_changed",
  "transition_not_allowed",
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
  | "audit.view-all"
  // Inquiry handling (B4a), granted to both roles today (admin-inquiries.md, Izin dan peran).
  | "inquiries.view"
  | "inquiries.change-status"
  | "inquiries.add-note"
  | "inquiries.reveal-contact";

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
