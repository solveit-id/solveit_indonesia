import { company, primaryWhatsApp } from "~/data/company";
import { defaultLocale, getMessages, type Locale } from "~/i18n";
import { getService } from "~/services/content";
import type { BudgetRange, InquiryErrors, InquiryPayload, Timeline } from "~/types/inquiry";

/**
 * Inquiry delivery. There is no backend yet, so an inquiry is never "sent" by
 * this site: it is composed into a message the visitor sends themselves via
 * WhatsApp or email. When the Laravel API exists, add an `api` channel that
 * POSTs the same payload (docs/architecture/integration-plan.md).
 */
export type InquiryChannel = "whatsapp" | "email";

export const budgetValues: BudgetRange[] = [
  "belum-tahu",
  "di-bawah-10jt",
  "10-50jt",
  "50-150jt",
  "di-atas-150jt",
];

export const timelineValues: Timeline[] = ["fleksibel", "1-3-bulan", "segera"];

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

export function validateInquiry(
  payload: InquiryPayload,
  locale: Locale = defaultLocale,
): InquiryErrors {
  const messages = getMessages(locale).form.errors;
  const errors: InquiryErrors = {};
  if (payload.name.trim().length < 2) errors.name = messages.name;
  const contact = payload.contact.trim();
  if (!contact) errors.contact = messages.contactMissing;
  else if (!EMAIL.test(contact) && !PHONE.test(contact)) errors.contact = messages.contactInvalid;
  if (!payload.service) errors.service = messages.service;
  if (payload.message.trim().length < 20) errors.message = messages.message;
  return errors;
}

/** The message, written in the language of the page the visitor used. */
export function composeInquiryMessage(
  payload: InquiryPayload,
  locale: Locale = defaultLocale,
): string {
  const { form } = getMessages(locale);
  const labels = form.composed;
  const service = payload.service ? getService(locale, payload.service).name : "-";
  return [
    labels.greeting(company.name),
    "",
    `${labels.name}: ${payload.name.trim()}`,
    payload.organization.trim() ? `${labels.organization}: ${payload.organization.trim()}` : null,
    `${labels.contact}: ${payload.contact.trim()}`,
    `${labels.service}: ${service}`,
    `${labels.budget}: ${form.budgetOptions[payload.budget]}`,
    `${labels.timeline}: ${form.timelineOptions[payload.timeline]}`,
    "",
    labels.needs,
    payload.message.trim(),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export const whatsappUrl = (e164: string, text?: string): string =>
  `https://wa.me/${e164}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const emailUrl = (subject: string, body: string): string =>
  `mailto:${company.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const isConfirmedWhatsApp = (e164: string): boolean =>
  company.whatsapp.some((number) => number.e164 === e164);

interface DeliveryOptions {
  locale?: Locale;
  /** One of the confirmed WhatsApp numbers (E.164); anything else falls back to the first. */
  recipient?: string;
}

export function inquiryHref(
  channel: InquiryChannel,
  payload: InquiryPayload,
  { locale = defaultLocale, recipient = primaryWhatsApp.e164 }: DeliveryOptions = {},
): string {
  const message = composeInquiryMessage(payload, locale);
  if (channel === "whatsapp")
    return whatsappUrl(isConfirmedWhatsApp(recipient) ? recipient : primaryWhatsApp.e164, message);
  const labels = getMessages(locale).form.composed;
  const service = payload.service
    ? getService(locale, payload.service).shortName
    : labels.fallbackService;
  return emailUrl(labels.subject(service, payload.name.trim()), message);
}
