/**
 * Types of the released admin API (B3.1a and B3.1b). Source of truth: docs/api/admin-auth.md
 * and docs/api/admin-users.md; change those documents and these types together. Only shapes
 * the client needs now are listed; screens add theirs in B3.2b and B3.2c.
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

/** Cursor pagination of the owner lists (admin-users.md, Daftar dan pagination). */
export interface CursorPage<T> {
  data: T[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: { path: string; per_page: number; next_cursor: string | null; prev_cursor: string | null };
}
