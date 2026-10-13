import type { PageKey } from "~/i18n/config";

/**
 * Header order follows a prospective client's journey: what Solveit builds,
 * proof of how it thinks, how an engagement runs, who the company is, then
 * the conversation. "Kontak" closes the order as the primary capsule button
 * ("Mulai konsultasi"), so the header never shows two links to one page.
 */
export const primaryNav: PageKey[] = ["home", "services", "portfolio", "process", "about"];

/** Footer and 404 list every page, contact included, in the same order. */
export const sitemapNav: PageKey[] = [...primaryNav, "contact"];
