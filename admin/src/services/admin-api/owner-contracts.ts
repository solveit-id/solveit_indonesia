/**
 * Types of the owner administration API (B3.1b; docs/api/admin-users.md), used by the B3.2c
 * screens only. Kept apart from contracts.ts so that nothing here reaches the initial
 * JavaScript: only owner code imports it, through the owner barrel (./owner.ts).
 */
import type { AdminAccessLinkPurpose, AdminRole } from "./contracts";

/** Cursor pagination of the owner lists (admin-users.md, Daftar dan pagination). */
export interface CursorPage<T> {
  data: T[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: { path: string; per_page: number; next_cursor: string | null; prev_cursor: string | null };
}

/** Derived by Laravel from the account's columns (admin-users.md, `GET users`). */
export const adminAccountStatuses = [
  "pending",
  "active",
  "credential-reset-pending",
  "suspended",
] as const;

export type AdminAccountStatus = (typeof adminAccountStatuses)[number];

export const adminRoles = ["owner", "admin"] as const satisfies readonly AdminRole[];

/** `GET users` item. Never a password hash, TOTP secret, recovery codes, or session ID. */
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminAccountStatus;
  is_current_user: boolean;
  two_factor_confirmed: boolean;
  activated_at: string | null;
  suspended_at: string | null;
  last_login_at: string | null;
  created_at: string | null;
}

export const adminAccessLinkStatuses = [
  "pending",
  "redeemed",
  "completed",
  "expired",
  "revoked",
] as const;

export type AdminAccessLinkStatus = (typeof adminAccessLinkStatuses)[number];

/** An unfinished, unrevoked link of an account, by metadata only (never the token or URL). */
export interface AdminOpenAccessLink {
  id: number;
  purpose: AdminAccessLinkPurpose;
  status: AdminAccessLinkStatus;
  issued_by_user_id: number | null;
  created_at: string | null;
  expires_at: string;
  redeemed_at: string | null;
}

/** `GET users/{id}`: the list fields plus a session count and the open link. */
export interface AdminUserDetail extends AdminUser {
  active_sessions: number;
  open_access_link: AdminOpenAccessLink | null;
}

export interface AdminUserFilters {
  role?: AdminRole | undefined;
  status?: AdminAccountStatus | undefined;
}

/** `GET invitations` item: an activation link by its metadata, never its token or URL. */
export interface AdminInvitation {
  id: number;
  status: AdminAccessLinkStatus;
  account: { id: number; email: string; role: AdminRole | null; status: AdminAccountStatus } | null;
  /** `null`: issued on the server shell (owner bootstrap). */
  issued_by_user_id: number | null;
  created_at: string | null;
  expires_at: string;
  redeemed_at: string | null;
  completed_at: string | null;
  revoked_at: string | null;
}

export interface AdminInvitationFilters {
  status?: AdminAccessLinkStatus | undefined;
}

/** `POST invitations` body. Laravel normalises the address (lower case, trimmed). */
export interface AdminInvitationInput {
  email: string;
  role: AdminRole;
}

/**
 * The raw link of an invitation or an owner-issued reset. It exists in exactly one response,
 * the one that issued it: never in a list, a detail, the audit log, or Laravel's logs.
 */
export interface AdminIssuedLink {
  url: string;
  expires_at: string;
}

/** `POST invitations` 201. */
export interface AdminInvitationIssued {
  invitation: AdminInvitation;
  access_link: AdminIssuedLink;
}

/** `POST users/{id}/credential-reset` 201. */
export interface AdminCredentialResetIssued {
  account: AdminUserDetail;
  access_link: AdminIssuedLink & { id: number; purpose: "credential-reset" };
}

/** Stable values of `AdminAuditAction` (backend/app/Enums/AdminAuditAction.php). */
export const adminAuditActions = [
  "owner.bootstrap-issued",
  "owner.bootstrap-refused",
  "credentials.reset-issued",
  "access-link.redeemed",
  "access-link.rejected",
  "account.activated",
  "credentials.reset-completed",
  "mfa.enrollment-failed",
  "login.succeeded",
  "login.failed",
  "mfa.challenge-failed",
  "mfa.recovery-code-used",
  "mfa.recovery-codes-regenerated",
  "password.changed",
  "logout",
  "session.revoked",
  "session.others-revoked",
  "session.expired",
  "session.ended-inactive-account",
  "invitation.issued",
  "invitation.revoked",
  "account.role-changed",
  "account.suspended",
  "account.reactivated",
] as const;

export type AdminAuditAction = (typeof adminAuditActions)[number];

export const adminActorTypes = ["user", "cli", "anonymous"] as const;

export type AdminActorType = (typeof adminActorTypes)[number];

/** Metadata keys Laravel allows (`RecordAdminAuditEvent::ALLOWED_METADATA_KEYS`), scalars only. */
export type AdminAuditMetadata = Partial<
  Record<
    | "purpose"
    | "reason"
    | "from_role"
    | "to_role"
    | "email_fingerprint"
    | "recovery_codes_remaining"
    | "sessions_ended"
    | "access_link_id"
    | "access_links_revoked"
    | "account_created",
    string | number | boolean | null
  >
>;

/** `GET audit-events` item (owner only, read only). */
export interface AdminAuditEvent {
  id: number;
  occurred_at: string;
  /** A known action, or a newer value this console does not know yet (shown as written). */
  action: AdminAuditAction | (string & {});
  actor: { type: AdminActorType; user_id: number | null };
  subject: { type: "user" | "access-link" | (string & {}); id: number | null } | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: AdminAuditMetadata | null;
}

/** Allowlisted audit filters; dates are ISO 8601 instants, both bounds inclusive. */
export interface AdminAuditFilters {
  action?: AdminAuditAction | undefined;
  actor_type?: AdminActorType | undefined;
  actor_user_id?: number | undefined;
  subject_user_id?: number | undefined;
  occurred_from?: string | undefined;
  occurred_to?: string | undefined;
}
