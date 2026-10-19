import type { AdminResponse } from "./client";
import { invalid } from "./envelope";
import type { CursorPage } from "./owner-contracts";

/**
 * Laravel's cursor pagination as every admin list uses it (admin-users.md, Daftar dan
 * pagination; admin-inquiries.md): owner lists (B3.2c) and inquiry lists (B4b) share these
 * helpers, so neither client pulls the other into its lazy chunk.
 */

/** A cursor page as Laravel returns it, or `invalid-response` when its shape is wrong. */
export function cursorPage<T>(response: AdminResponse<CursorPage<T>>): CursorPage<T> {
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

/** Page size of the admin lists; Laravel accepts 1 to 100 (default 25). */
export const ADMIN_PAGE_SIZE = 25;

export interface PageRequest {
  /** `meta.next_cursor` of the previous page, exactly as Laravel returned it. */
  cursor?: string | null | undefined;
  perPage?: number | undefined;
  signal?: AbortSignal | undefined;
}

/** A record ID in a path: a positive integer, nothing else. */
export function idSegment(id: number): string {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new TypeError("Admin record IDs are positive integers.");
  }

  return String(id);
}

export function pageQuery(page: PageRequest): Record<string, string | number | undefined> {
  return {
    per_page: page.perPage ?? ADMIN_PAGE_SIZE,
    cursor: page.cursor ?? undefined,
  };
}
