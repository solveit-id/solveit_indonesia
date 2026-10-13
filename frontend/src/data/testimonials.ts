import type { Testimonial } from "~/types/testimonial";

/**
 * Client testimonials approved for publication. Empty on purpose: as of
 * 2026-10-13 no client has given written permission (PRODUCT.md, Evidence on
 * Hand). Add an entry only with the client's approval and its date; the home
 * page switches from the pledge to the quotes automatically.
 */
export const testimonials: Testimonial[] = [];

/**
 * Placeholders for the internal, noindex preview page. They describe the slot
 * instead of imitating a client, so they can never be mistaken for a quote.
 */
export const testimonialPlaceholders: Testimonial[] = [1, 2, 3].map((index) => ({
  id: `placeholder-${index}`,
  isDemo: true,
  person: {
    name: `Nama klien ${index}`,
    role: { id: "Peran, nama organisasi", en: "Role, organisation name" },
  },
  quote: {
    id:
      index === 2
        ? "Placeholder kutipan pendek, untuk menguji ritme baris."
        : "Placeholder kutipan klien. Di sini akan tampil testimoni yang sudah disetujui untuk dipublikasikan, kira-kira dua sampai tiga kalimat, agar ukuran huruf dan panjang baris bisa dinilai.",
    en:
      index === 2
        ? "Short placeholder quote, to test the line rhythm."
        : "Client quote placeholder. An approved testimonial of about two or three sentences will appear here, so the type size and line length can be judged.",
  },
  context: {
    id: "Placeholder konteks proyek, satu baris",
    en: "Project context placeholder, one line",
  },
  permission: { granted: false },
}));
