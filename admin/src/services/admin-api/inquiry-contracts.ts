/**
 * Types of the inquiry management API (B4a; docs/api/admin-inquiries.md), used by the B4b
 * screens only. Kept apart from contracts.ts so that nothing here reaches the initial
 * JavaScript: only inquiry code imports it, through the inquiry barrel (./inquiry.ts).
 */

/**
 * Workflow statuses (backend/app/Enums/InquiryStatus.php), agreed by the owner for B4b. Which
 * moves are allowed is Laravel's rule: the console reads `allowed_transitions` from the detail
 * and never keeps its own copy of the table.
 */
export const inquiryStatuses = ["received", "in-review", "contacted", "closed"] as const;

export type InquiryStatus = (typeof inquiryStatuses)[number];

/** The website form's choices (backend/app/Enums/Inquiry{Service,Budget,Timeline}.php). */
export const inquiryServices = [
  "website",
  "aplikasi-web",
  "sistem-informasi",
  "custom-software",
  "dukungan-teknis",
] as const;

export type InquiryService = (typeof inquiryServices)[number];

export const inquiryBudgets = [
  "belum-tahu",
  "di-bawah-10jt",
  "10-50jt",
  "50-150jt",
  "di-atas-150jt",
] as const;

export type InquiryBudget = (typeof inquiryBudgets)[number];

export const inquiryTimelines = ["fleksibel", "1-3-bulan", "segera"] as const;

export type InquiryTimeline = (typeof inquiryTimelines)[number];

/** The public reference the sender knows: `INQ-` and three groups of Crockford base32. */
export const INQUIRY_REFERENCE =
  /^INQ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/** A note is 1 to 2000 characters after trimming (admin-inquiries.md, Catatan internal). */
export const NOTE_MAX_LENGTH = 2000;

/** The contact as every list and detail returns it: its kind and a fixed-length mask. */
export interface MaskedContact {
  type: "email" | "phone";
  masked: string;
}

/** `GET inquiries` item. Never the message, the full contact, or the idempotency hash. */
export interface AdminInquiry {
  id: number;
  reference: string;
  status: InquiryStatus;
  name: string;
  organization: string | null;
  contact: MaskedContact;
  service: InquiryService;
  budget: InquiryBudget;
  timeline: InquiryTimeline;
  received_at: string | null;
  updated_at: string | null;
}

/** `GET inquiries/{id}` and the `PUT .../status` answer: the list fields and more. */
export interface AdminInquiryDetail extends AdminInquiry {
  /** Written by the visitor: may itself hold a phone number or an address (never masked). */
  message: string;
  allowed_transitions: InquiryStatus[];
  notes_count: number;
  status_changes_count: number;
}

/** Who wrote a history row or a note: account ID and display name, never an address. */
export interface InquiryActor {
  user_id: number | null;
  name: string | null;
}

/** `GET inquiries/{id}/status-changes` item, newest first. */
export interface AdminInquiryStatusChange {
  id: number;
  from_status: InquiryStatus;
  to_status: InquiryStatus;
  changed_by: InquiryActor;
  changed_at: string | null;
}

/** `GET inquiries/{id}/notes` item and `POST .../notes` 201: internal, append-only. */
export interface AdminInquiryNote {
  id: number;
  body: string;
  author: InquiryActor;
  created_at: string | null;
}

/**
 * `POST inquiries/{id}/contact-reveal` 200: the full contact, recorded in the audit log before
 * it was sent. Kept in the revealing component's memory only (admin-inquiries.md).
 */
export interface AdminRevealedContact {
  id: number;
  reference: string;
  contact: { type: "email" | "phone"; value: string };
  revealed_at: string;
}

/** Filters of `GET inquiries`, each on an indexed column. Dates are ISO 8601 instants. */
export interface AdminInquiryFilters {
  status?: InquiryStatus | undefined;
  service?: InquiryService | undefined;
  received_from?: string | undefined;
  received_to?: string | undefined;
  reference?: string | undefined;
}
