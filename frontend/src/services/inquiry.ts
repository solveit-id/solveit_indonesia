import { company, primaryWhatsApp } from "~/data/company";
import { isServiceId } from "~/data/services";
import { defaultLocale, getMessages, type Locale } from "~/i18n";
import { getService } from "~/services/content";
import type { BudgetRange, InquiryErrors, InquiryPayload, Timeline } from "~/types/inquiry";

/**
 * Inquiry delivery. WhatsApp and email are composed into a message the
 * visitor sends themselves; this site sends nothing for them. The `api`
 * channel POSTs the same payload to the Laravel API (src/services/inquiry-api.ts)
 * and exists only when the build enables it (`siteConfig.inquiryApiUrl`).
 */
export type ComposedChannel = "whatsapp" | "email";
export type InquiryChannel = ComposedChannel | "api";

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
// Plain spaces only, like the server (backend/app/Rules/EmailOrPhone.php).
const PHONE = /^\+?[0-9][0-9 -]{7,16}$/;

/**
 * Limits of `POST /api/v1/inquiries` (StoreInquiryRequest). Lengths count
 * Unicode characters after trimming, as Laravel does, not UTF-16 units.
 */
export const inquiryLimits = {
  name: { min: 2, max: 120 },
  organization: { max: 160 },
  contact: { max: 254 },
  message: { min: 20, max: 5000 },
} as const;

const chars = (value: string) => [...value.trim()].length;

/** Field order used for summaries and focus: the order of the form. */
export const inquiryFields: (keyof InquiryPayload)[] = [
  "name",
  "organization",
  "contact",
  "service",
  "budget",
  "timeline",
  "message",
];

export function validateInquiry(
  payload: InquiryPayload,
  locale: Locale = defaultLocale,
): InquiryErrors {
  const messages = getMessages(locale).form.errors;
  const errors: InquiryErrors = {};
  const name = chars(payload.name);
  if (name < inquiryLimits.name.min) errors.name = messages.name;
  else if (name > inquiryLimits.name.max) errors.name = messages.nameTooLong;
  if (chars(payload.organization) > inquiryLimits.organization.max)
    errors.organization = messages.organizationTooLong;
  const contact = payload.contact.trim();
  if (!contact) errors.contact = messages.contactMissing;
  else if (chars(contact) > inquiryLimits.contact.max) errors.contact = messages.contactTooLong;
  else if (!EMAIL.test(contact) && !PHONE.test(contact)) errors.contact = messages.contactInvalid;
  if (!isServiceId(payload.service)) errors.service = messages.service;
  if (!budgetValues.includes(payload.budget)) errors.budget = messages.budget;
  if (!timelineValues.includes(payload.timeline)) errors.timeline = messages.timeline;
  const message = chars(payload.message);
  if (message < inquiryLimits.message.min) errors.message = messages.message;
  else if (message > inquiryLimits.message.max) errors.message = messages.messageTooLong;
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
  channel: ComposedChannel,
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
