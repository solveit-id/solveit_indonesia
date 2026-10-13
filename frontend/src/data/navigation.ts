import type { PageKey } from "~/i18n/config";

/**
 * Header order: who Solveit is, what it builds, proof of how it thinks, and
 * how an engagement runs. "Kontak" closes the order as the primary capsule
 * button ("Mulai konsultasi"), so the header never shows two links to one page.
 */
export const primaryNav: PageKey[] = ["home", "about", "services", "portfolio", "process"];

/** Footer and 404 list every page, contact included, in the same order. */
export const sitemapNav: PageKey[] = [...primaryNav, "contact"];
