/**
 * Confirmed company facts. Add only information the company has approved for
 * publication: no address or domain exists yet (see PRODUCT.md).
 */
export const company = {
  name: "Solveit Indonesia",
  legalName: "Solveit Indonesia",
  tagline: "We Don't Just Build Software. We Build Digital Solutions That Last.",
  description:
    "Solveit Indonesia adalah startup teknologi dan software house yang membangun website, aplikasi web, sistem informasi, dan custom software sesuai kebutuhan bisnis.",
  vision:
    "Membangun ekosistem layanan digital terintegrasi yang menemani pelanggan dari konsultasi, pemesanan, proposal, kontrak, dan invoice, hingga pengembangan, pelacakan progres dan revisi, serta pemeliharaan melalui Solveit OpsHub.",
  email: "solveit.team.id@gmail.com",
  whatsapp: [
    { display: "+62 877-5964-1358", e164: "6287759641358" },
    { display: "+62 812-3025-2499", e164: "6281230252499" },
    { display: "+62 823-3550-1778", e164: "6282335501778" },
  ],
  areaServed: "Indonesia",
  language: "id-ID",
} as const;

export type WhatsAppContact = (typeof company.whatsapp)[number];

export const primaryWhatsApp: WhatsAppContact = company.whatsapp[0];
