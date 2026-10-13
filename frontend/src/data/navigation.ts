import type { PageKey } from "~/i18n/config";

/**
 * Header order: who Solveit is, what it builds, how an engagement runs, then
 * the work that shows it. "Kontak" closes the order as the primary capsule
 * button ("Mulai konsultasi"), so the header never shows two links to one page.
 */
export const primaryNav: PageKey[] = ["home", "about", "services", "process", "portfolio"];

/** Footer and 404 list every page, contact included, in the same order. */
export const sitemapNav: PageKey[] = [...primaryNav, "contact"];
