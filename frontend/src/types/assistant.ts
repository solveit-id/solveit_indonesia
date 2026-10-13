/**
 * Contract between the assistant interface and whatever answers it. Today a
 * local, rule-based guide answers from the site's own verified content; a
 * later phase can put an AI service behind the same interface (called through
 * the Laravel API, never with a key in the browser).
 */
export type AssistantTopic = "services" | "consultation" | "portfolio" | "process" | "contact";

export type AssistantInput =
  { kind: "topic"; topic: AssistantTopic } | { kind: "text"; text: string };

export interface AssistantLink {
  label: string;
  to: string;
}

export interface AssistantReply {
  /** What produced the answer, so the UI can be honest about its source. */
  source: "guide" | "fallback";
  title?: string;
  text: string;
  bullets?: string[];
  links?: AssistantLink[];
  /** Offer WhatsApp and email, carrying the visitor's question if there was one. */
  escalate?: boolean;
  /** Topics to suggest next. */
  followUps: AssistantTopic[];
}

export interface AssistantEngine {
  reply(input: AssistantInput): Promise<AssistantReply>;
}

/** Localized wording and matching vocabulary for the local guide. */
export interface AssistantCopy {
  topics: Record<AssistantTopic, { label: string; intro: string; keywords: string[] }>;
  /** Keywords per FAQ entry, in the order of the service and process FAQs. */
  faqKeywords: { serviceFaq: string[][]; processFaq: string[][] };
  greetings: string[];
  greetingReply: string;
  fallback: string;
  contactLabels: { email: string; whatsapp: string; instagram: string; form: string };
}
