import type { AdminResponse } from "./client";
import type { AdminEnvelope } from "./contracts";
import { AdminApiError } from "./errors";

export const invalid = (status: number, isWrite: boolean) =>
  new AdminApiError({
    kind: "invalid-response",
    status,
    outcome: isWrite ? "uncertain" : "not-applicable",
  });

/** The `data` member of a success body, or an `invalid-response` error when it is missing. */
export function unwrap<T>(response: AdminResponse<AdminEnvelope<T>>, isWrite: boolean): T {
  const body: unknown = response.data;

  if (typeof body !== "object" || body === null || !("data" in body)) {
    throw invalid(response.status, isWrite);
  }

  return (body as AdminEnvelope<T>).data;
}
