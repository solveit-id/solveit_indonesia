import { company, primaryWhatsApp } from "~/data/company";
import { serviceById } from "~/data/services";
import type { BudgetRange, InquiryErrors, InquiryPayload, Timeline } from "~/types/inquiry";

/**
 * Inquiry delivery. There is no backend yet, so an inquiry is never "sent" by
 * this site: it is composed into a message the visitor sends themselves via
 * WhatsApp or email. When the Laravel API exists, add an `api` channel that
 * POSTs the same payload (docs/integration-plan.md).
 */
export type InquiryChannel = "whatsapp" | "email";

export const budgetOptions: { value: BudgetRange; label: string }[] = [
  { value: "belum-tahu", label: "Belum tahu" },
  { value: "di-bawah-10jt", label: "Di bawah Rp10 juta" },
  { value: "10-50jt", label: "Rp10 sampai 50 juta" },
  { value: "50-150jt", label: "Rp50 sampai 150 juta" },
  { value: "di-atas-150jt", label: "Di atas Rp150 juta" },
];

export const timelineOptions: { value: Timeline; label: string }[] = [
  { value: "fleksibel", label: "Fleksibel" },
  { value: "1-3-bulan", label: "Dalam 1 sampai 3 bulan" },
  { value: "segera", label: "Secepatnya" },
];

export const emptyInquiry: InquiryPayload = {
  name: "",
  organization: "",
  contact: "",
  service: "",
  budget: "belum-tahu",
  timeline: "fleksibel",
  message: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9\s-]{7,16}$/;

export function validateInquiry(payload: InquiryPayload): InquiryErrors {
  const errors: InquiryErrors = {};
  if (payload.name.trim().length < 2) errors.name = "Tulis nama Anda, minimal 2 karakter.";
  const contact = payload.contact.trim();
  if (!contact) errors.contact = "Tulis email atau nomor WhatsApp agar kami bisa membalas.";
  else if (!EMAIL.test(contact) && !PHONE.test(contact))
    errors.contact = "Gunakan alamat email yang valid atau nomor telepon, misalnya 0812 3456 7890.";
  if (!payload.service)
    errors.service = "Pilih jenis layanan yang paling mendekati kebutuhan Anda.";
  if (payload.message.trim().length < 20)
    errors.message =
      "Ceritakan kebutuhan Anda minimal dalam 20 karakter, agar kami bisa menyiapkan konsultasi.";
  return errors;
}

const labelOf = <T extends string>(options: { value: T; label: string }[], value: T) =>
  options.find((option) => option.value === value)?.label ?? value;

export function composeInquiryMessage(payload: InquiryPayload): string {
  const service = payload.service ? serviceById(payload.service).name : "-";
  return [
    `Halo ${company.name}, saya ingin berkonsultasi.`,
    "",
    `Nama: ${payload.name.trim()}`,
    payload.organization.trim() ? `Organisasi: ${payload.organization.trim()}` : null,
    `Kontak: ${payload.contact.trim()}`,
    `Layanan: ${service}`,
    `Perkiraan anggaran: ${labelOf(budgetOptions, payload.budget)}`,
    `Target waktu: ${labelOf(timelineOptions, payload.timeline)}`,
    "",
    "Kebutuhan:",
    payload.message.trim(),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export const whatsappUrl = (e164: string, text?: string): string =>
  `https://wa.me/${e164}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const emailUrl = (subject: string, body: string): string =>
  `mailto:${company.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export function inquiryHref(channel: InquiryChannel, payload: InquiryPayload): string {
  const message = composeInquiryMessage(payload);
  if (channel === "whatsapp") return whatsappUrl(primaryWhatsApp.e164, message);
  const service = payload.service ? serviceById(payload.service).shortName : "proyek";
  return emailUrl(`Konsultasi ${service}: ${payload.name.trim()}`, message);
}
