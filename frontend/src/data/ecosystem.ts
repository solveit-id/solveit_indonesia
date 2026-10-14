import type { Locale } from "~/i18n/config";
import type { EcosystemPart } from "~/types/content";

/**
 * The connected Solveit ecosystem as the About page presents it. Every name
 * except the company's own website is a PROPOSED working name (see
 * docs/product-naming.md): not a registered trademark, not a launched
 * product. `status` has no "available" value on purpose, so nothing here can
 * be shown as live; add one only when a product actually ships.
 *
 * "Solveit Orbit" is the umbrella name for the ecosystem as a whole, never a
 * single application, so it is not an entry of its own. Solveit OpsHub keeps
 * its established name; its repository and identifiers are not renamed.
 */
type PartSpec = Omit<EcosystemPart, "role"> & { role: Record<Locale, string> };

const parts: readonly PartSpec[] = [
  {
    key: "website",
    name: "Website Solveit Indonesia",
    tier: "foundation",
    status: "current",
    role: {
      id: "Profil perusahaan, layanan, portofolio, dan jalur konsultasi. Fondasi pertama ekosistem.",
      en: "Company profile, services, portfolio, and the route to a consultation. The ecosystem's first building block.",
    },
  },
  {
    key: "opshub",
    name: "Solveit OpsHub",
    tier: "hub",
    status: "design",
    role: {
      id: "Pusat operasional internal: operasional tim, pemantauan, dan pemeliharaan proyek.",
      en: "The internal operations hub: team operations, monitoring, and project maintenance.",
    },
  },
  {
    key: "connect",
    name: "Solveit Connect",
    tier: "module",
    status: "planned",
    role: { id: "Akses dan komunikasi klien", en: "Client access and communication" },
  },
  {
    key: "scope",
    name: "Solveit Scope",
    tier: "module",
    status: "planned",
    role: {
      id: "Ruang lingkup, penawaran, dan proposal",
      en: "Scoping, quotations, and proposals",
    },
  },
  {
    key: "accord",
    name: "Solveit Accord",
    tier: "module",
    status: "planned",
    role: { id: "Kontrak dan perjanjian digital", en: "Contracts and digital agreements" },
  },
  {
    key: "ledger",
    name: "Solveit Ledger",
    tier: "module",
    status: "planned",
    role: { id: "Invoice dan catatan tagihan", en: "Invoices and billing records" },
  },
  {
    key: "pulse",
    name: "Solveit Pulse",
    tier: "module",
    status: "planned",
    role: { id: "Progres, milestone, dan revisi", en: "Progress, milestones, and revisions" },
  },
  {
    key: "care",
    name: "Solveit Care",
    tier: "module",
    status: "planned",
    role: { id: "Dukungan dan pemeliharaan", en: "Support and maintenance" },
  },
];

export const ecosystemParts = (locale: Locale): EcosystemPart[] =>
  parts.map((part) => ({ ...part, role: part.role[locale] }));
