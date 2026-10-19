import type { AdminApiClient } from "./client";
import type { AdminRole } from "./contracts";
import { unwrap } from "./envelope";
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
import { type PageRequest, cursorPage, idSegment, pageQuery } from "./pagination";

export { ADMIN_PAGE_SIZE, type PageRequest } from "./pagination";

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
          subject_inquiry_id: filters.subject_inquiry_id,
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
