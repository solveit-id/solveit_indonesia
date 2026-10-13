/**
 * Confirmed company facts. Add only information the company has approved for
 * publication: no address or domain exists yet (see PRODUCT.md). Translated
 * descriptions live in `src/data/locales/`.
 */
export const company = {
  name: "Solveit Indonesia",
  legalName: "Solveit Indonesia",
  /** Official tagline, English in every language. */
  tagline: "We Don't Just Build Software. We Build Digital Solutions That Last.",
  email: "solveit.team.id@gmail.com",
  /**
   * Three confirmed numbers. No owner, department, or service hours are
   * confirmed for any of them, so the UI shows them as equal options.
   */
  whatsapp: [
    { display: "+62 877-5964-1358", e164: "6287759641358" },
    { display: "+62 812-3025-2499", e164: "6281230252499" },
    { display: "+62 823-3550-1778", e164: "6282335501778" },
  ],
  /** Official Instagram account, confirmed 2026-10-12. */
  instagram: { handle: "@solveit.id", url: "https://www.instagram.com/solveit.id/" },
  areaServed: "Indonesia",
} as const;

export type WhatsAppContact = (typeof company.whatsapp)[number];

export const primaryWhatsApp: WhatsAppContact = company.whatsapp[0];
