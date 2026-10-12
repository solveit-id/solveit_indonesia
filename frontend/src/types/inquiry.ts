import type { ServiceId } from "./content";

export type BudgetRange = "belum-tahu" | "di-bawah-10jt" | "10-50jt" | "50-150jt" | "di-atas-150jt";
export type Timeline = "fleksibel" | "1-3-bulan" | "segera";

/**
 * Project inquiry. Field names match the proposed `POST /api/v1/inquiries`
 * contract in docs/integration-plan.md so the form can switch to the API
 * without reshaping data.
 */
export interface InquiryPayload {
  name: string;
  organization: string;
  contact: string;
  service: ServiceId | "";
  budget: BudgetRange;
  timeline: Timeline;
  message: string;
}

export type InquiryErrors = Partial<Record<keyof InquiryPayload, string>>;
