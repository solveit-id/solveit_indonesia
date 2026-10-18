import type { AdminApiClient, AdminResponse } from "./client";
import type { AdminRole } from "./contracts";
import { invalid, unwrap } from "./envelope";
import type {
  AdminAuditEvent,
  AdminAuditFilters,
  AdminCredentialResetIssued,
  AdminInvitation,
  AdminInvitationFilters,
  AdminInvitationInput,
  AdminInvitationIssued,
  AdminUser,
  AdminUserDetail,
  AdminUserFilters,
  CursorPage,
} from "./owner-contracts";
import type { AdminEnvelope } from "./contracts";

/**
 * The owner endpoints of docs/api/admin-users.md (B3.1b): accounts, invitations, role changes,
 * suspension, credential resets, and the audit reader. Laravel authorizes every call (one
 * permission per route, owner only); this module never decides who may do what.
 *
 * Every write here is sensitive and stays on the client's default 419 policy, `confirm`: after
 * a 419 nothing is resent and the screen asks the person first. Every write may also answer
 * 423 (password confirmation older than 15 minutes); the screen then confirms the password and
 * asks again before sending the write once more. Nothing retries by itself.
 *
 * The raw link in an invitation or reset response exists in that one response only. It is
 * returned to the caller and never stored, logged, or cached here.
 */

/** A cursor page as Laravel returns it, or `invalid-response` when its shape is wrong. */
function cursorPage<T>(response: AdminResponse<CursorPage<T>>): CursorPage<T> {
  const body: unknown = response.data;
  const page = body as Partial<CursorPage<T>> | null;

  if (
    typeof page !== "object" ||
    page === null ||
    !Array.isArray(page.data) ||
    typeof page.meta !== "object" ||
    page.meta === null
  ) {
    throw invalid(response.status, false);
  }

  return page as CursorPage<T>;
}

/** Page size of the owner lists; Laravel accepts 1 to 100 (default 25). */
export const ADMIN_PAGE_SIZE = 25;

export interface PageRequest {
  /** `meta.next_cursor` of the previous page, exactly as Laravel returned it. */
  cursor?: string | null | undefined;
  perPage?: number | undefined;
  signal?: AbortSignal | undefined;
}

/** An account or invitation ID in a path: a positive integer, nothing else. */
function idSegment(id: number): string {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new TypeError("Admin record IDs are positive integers.");
  }

  return String(id);
}

function pageQuery(page: PageRequest): Record<string, string | number | undefined> {
  return {
    per_page: page.perPage ?? ADMIN_PAGE_SIZE,
    cursor: page.cursor ?? undefined,
  };
}

export function createAdministrationApi(client: AdminApiClient) {
  return {
    async listUsers(
      filters: AdminUserFilters = {},
      page: PageRequest = {},
    ): Promise<CursorPage<AdminUser>> {
      const response = await client.request<CursorPage<AdminUser>>({
        method: "GET",
        path: "users",
        query: { role: filters.role, status: filters.status, ...pageQuery(page) },
        signal: page.signal,
      });

      return cursorPage(response);
    },

    async getUser(id: number, signal?: AbortSignal): Promise<AdminUserDetail> {
      const response = await client.request<AdminEnvelope<AdminUserDetail>>({
        method: "GET",
        path: `users/${idSegment(id)}`,
        signal,
      });

      return unwrap(response, false);
    },

    async changeRole(id: number, role: AdminRole): Promise<AdminUserDetail> {
      const response = await client.request<AdminEnvelope<AdminUserDetail>>({
        method: "PUT",
        path: `users/${idSegment(id)}/role`,
        body: { role },
      });

      return unwrap(response, true);
    },

    async suspend(id: number): Promise<AdminUserDetail> {
      const response = await client.request<AdminEnvelope<AdminUserDetail>>({
        method: "POST",
        path: `users/${idSegment(id)}/suspension`,
      });

      return unwrap(response, true);
    },

    async reactivate(id: number): Promise<AdminUserDetail> {
      const response = await client.request<AdminEnvelope<AdminUserDetail>>({
        method: "DELETE",
        path: `users/${idSegment(id)}/suspension`,
      });

      return unwrap(response, true);
    },

    /**
     * The account loses access at once (authenticator, recovery codes, and sessions end), so
     * Laravel requires the explicit acknowledgement; the caller passes it only after the person
     * ticked it.
     */
    async resetCredentials(
      id: number,
      acknowledgement: { acknowledgeAccessLoss: true },
    ): Promise<AdminCredentialResetIssued> {
      const response = await client.request<AdminEnvelope<AdminCredentialResetIssued>>({
        method: "POST",
        path: `users/${idSegment(id)}/credential-reset`,
        body: { acknowledge_access_loss: acknowledgement.acknowledgeAccessLoss },
      });

      return unwrap(response, true);
    },

    async listInvitations(
      filters: AdminInvitationFilters = {},
      page: PageRequest = {},
    ): Promise<CursorPage<AdminInvitation>> {
      const response = await client.request<CursorPage<AdminInvitation>>({
        method: "GET",
        path: "invitations",
        query: { status: filters.status, ...pageQuery(page) },
        signal: page.signal,
      });

      return cursorPage(response);
    },

    async invite(input: AdminInvitationInput): Promise<AdminInvitationIssued> {
      const response = await client.request<AdminEnvelope<AdminInvitationIssued>>({
        method: "POST",
        path: "invitations",
        body: { email: input.email, role: input.role },
      });

      return unwrap(response, true);
    },

    async revokeInvitation(id: number): Promise<AdminInvitation> {
      const response = await client.request<AdminEnvelope<AdminInvitation>>({
        method: "DELETE",
        path: `invitations/${idSegment(id)}`,
      });

      return unwrap(response, true);
    },

    async listAuditEvents(
      filters: AdminAuditFilters = {},
      page: PageRequest = {},
    ): Promise<CursorPage<AdminAuditEvent>> {
      const response = await client.request<CursorPage<AdminAuditEvent>>({
        method: "GET",
        path: "audit-events",
        query: {
          action: filters.action,
          actor_type: filters.actor_type,
          actor_user_id: filters.actor_user_id,
          subject_user_id: filters.subject_user_id,
          occurred_from: filters.occurred_from,
          occurred_to: filters.occurred_to,
          ...pageQuery(page),
        },
        signal: page.signal,
      });

      return cursorPage(response);
    },
  };
}

export type AdministrationApi = ReturnType<typeof createAdministrationApi>;
