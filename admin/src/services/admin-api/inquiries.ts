import type { AdminApiClient } from "./client";
import type { AdminEnvelope } from "./contracts";
import { unwrap } from "./envelope";
import type {
  AdminInquiry,
  AdminInquiryDetail,
  AdminInquiryFilters,
  AdminInquiryNote,
  AdminInquiryStatusChange,
  AdminRevealedContact,
  InquiryStatus,
} from "./inquiry-contracts";
import type { CursorPage } from "./owner-contracts";
import { type PageRequest, cursorPage, idSegment, pageQuery } from "./pagination";

/**
 * The inquiry endpoints of docs/api/admin-inquiries.md (B4a), for owner and admin. Laravel
 * authorizes every call (one `inquiries.*` permission per route); this module never decides
 * who may do what.
 *
 * Every write stays on the client's default 419 policy, `confirm`: nothing is resent after a
 * 419 and the screen asks the person first. Nothing retries by itself. Notes have no
 * idempotency key, so after an uncertain answer the screen reads the notes again before the
 * person sends anything. A status change is a compare and set on `expected_status`.
 *
 * The revealed contact exists in one response; it is returned to the caller and never stored,
 * logged, or cached here.
 */
export function createInquiryApi(client: AdminApiClient) {
  return {
    async listInquiries(
      filters: AdminInquiryFilters = {},
      page: PageRequest = {},
    ): Promise<CursorPage<AdminInquiry>> {
      const response = await client.request<CursorPage<AdminInquiry>>({
        method: "GET",
        path: "inquiries",
        query: {
          status: filters.status,
          service: filters.service,
          received_from: filters.received_from,
          received_to: filters.received_to,
          reference: filters.reference,
          ...pageQuery(page),
        },
        signal: page.signal,
      });

      return cursorPage(response);
    },

    async getInquiry(id: number, signal?: AbortSignal): Promise<AdminInquiryDetail> {
      const response = await client.request<AdminEnvelope<AdminInquiryDetail>>({
        method: "GET",
        path: `inquiries/${idSegment(id)}`,
        signal,
      });

      return unwrap(response, false);
    },

    async listStatusChanges(
      id: number,
      page: PageRequest = {},
    ): Promise<CursorPage<AdminInquiryStatusChange>> {
      const response = await client.request<CursorPage<AdminInquiryStatusChange>>({
        method: "GET",
        path: `inquiries/${idSegment(id)}/status-changes`,
        query: pageQuery(page),
        signal: page.signal,
      });

      return cursorPage(response);
    },

    async listNotes(id: number, page: PageRequest = {}): Promise<CursorPage<AdminInquiryNote>> {
      const response = await client.request<CursorPage<AdminInquiryNote>>({
        method: "GET",
        path: `inquiries/${idSegment(id)}/notes`,
        query: pageQuery(page),
        signal: page.signal,
      });

      return cursorPage(response);
    },

    /**
     * Compare and set: `expectedStatus` is the status the person saw when deciding. Laravel
     * answers 409 `status_changed` when someone moved it since, 409 `transition_not_allowed`
     * when the move is not allowed from the current status, and 200 without a change when it
     * already has `status`.
     */
    async changeStatus(
      id: number,
      change: { status: InquiryStatus; expectedStatus: InquiryStatus },
    ): Promise<AdminInquiryDetail> {
      const response = await client.request<AdminEnvelope<AdminInquiryDetail>>({
        method: "PUT",
        path: `inquiries/${idSegment(id)}/status`,
        body: { status: change.status, expected_status: change.expectedStatus },
      });

      return unwrap(response, true);
    },

    async addNote(id: number, body: string): Promise<AdminInquiryNote> {
      const response = await client.request<AdminEnvelope<AdminInquiryNote>>({
        method: "POST",
        path: `inquiries/${idSegment(id)}/notes`,
        body: { body },
      });

      return unwrap(response, true);
    },

    /**
     * Opening the full contact is recorded in the audit log, so Laravel requires the explicit
     * acknowledgement; the caller passes it only after the person ticked it. Also needs a
     * password confirmation from the last 15 minutes (423 otherwise).
     */
    async revealContact(
      id: number,
      acknowledgement: { acknowledgePersonalData: true },
    ): Promise<AdminRevealedContact> {
      const response = await client.request<AdminEnvelope<AdminRevealedContact>>({
        method: "POST",
        path: `inquiries/${idSegment(id)}/contact-reveal`,
        body: { acknowledge_personal_data: acknowledgement.acknowledgePersonalData },
      });

      return unwrap(response, true);
    },
  };
}

export type InquiryApi = ReturnType<typeof createInquiryApi>;
