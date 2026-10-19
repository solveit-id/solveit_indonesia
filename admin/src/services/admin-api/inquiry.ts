/**
 * The inquiry management API (B4a; docs/api/admin-inquiries.md) on the console's one client.
 * Only inquiry screens and their components import this barrel, so this code and these types
 * travel in the lazy inquiry chunks (initial JavaScript budget, admin-dashboard.md section 8).
 */
import { createInquiryApi } from "./inquiries";
import { adminApi } from "./index";

export { createInquiryApi, type InquiryApi } from "./inquiries";
export * from "./inquiry-contracts";
export { ADMIN_PAGE_SIZE, type PageRequest } from "./pagination";
export type { CursorPage } from "./owner-contracts";

export const inquiryApi = createInquiryApi(adminApi);
