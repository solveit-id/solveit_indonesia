import { company } from "~/data/company";
import { assistant as enAssistant } from "~/data/locales/en/assistant";
import { assistant as idAssistant } from "~/data/locales/id/assistant";
import { getMessages, type Locale, pathFor } from "~/i18n";
import type {
  AssistantCopy,
  AssistantEngine,
  AssistantInput,
  AssistantReply,
  AssistantTopic,
} from "~/types/assistant";
import type { FaqItem } from "~/types/content";
import { getProcessFaq, getProcessSteps, getServiceFaq, getServices } from "./content";
import { getProjects } from "./projects";

export const assistantTopics: AssistantTopic[] = [
  "services",
  "consultation",
  "portfolio",
  "process",
  "contact",
];

const copyByLocale: Record<Locale, AssistantCopy> = { id: idAssistant, en: enAssistant };

export const getAssistantCopy = (locale: Locale): AssistantCopy => copyByLocale[locale];

/** Lowercase, accents and punctuation removed, single spaces. */
export const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Keyword hits in `text`. Single words match a whole word or its start, so
 * Indonesian suffixes still count ("biayanya" matches "biaya"); phrases match
 * as a run of whole words.
 */
export const countHits = (text: string, keywords: string[]): number => {
  const words = text.split(" ");
  return keywords.filter((raw) => {
    const keyword = normalize(raw);
    if (!keyword) return false;
    if (keyword.includes(" ")) return ` ${text} `.includes(` ${keyword} `);
    return words.some((word) =>
      keyword.length <= 3 ? word === keyword : word.startsWith(keyword),
    );
  }).length;
};

/**
 * A hit on an FAQ keyword ("biaya", "how long") names the question itself, while
 * topic words ("website") only name its subject, so FAQ hits weigh more.
 */
const FAQ_WEIGHT = 2.5;

type Candidate =
  | { kind: "topic"; topic: AssistantTopic; score: number }
  | { kind: "faq"; item: FaqItem; page: "services" | "process"; score: number };

/** Best match for a free-text question, or null when nothing in the guide fits. */
export function matchQuestion(text: string, locale: Locale): Candidate | null {
  const copy = getAssistantCopy(locale);
  const query = normalize(text);
  if (!query) return null;
  const candidates: Candidate[] = [
    ...assistantTopics.map((topic) => ({
      kind: "topic" as const,
      topic,
      score: countHits(query, copy.topics[topic].keywords),
    })),
    ...getServiceFaq(locale).map((item, index) => ({
      kind: "faq" as const,
      item,
      page: "services" as const,
      score: countHits(query, copy.faqKeywords.serviceFaq[index] ?? []) * FAQ_WEIGHT,
    })),
    ...getProcessFaq(locale).map((item, index) => ({
      kind: "faq" as const,
      item,
      page: "process" as const,
      score: countHits(query, copy.faqKeywords.processFaq[index] ?? []) * FAQ_WEIGHT,
    })),
  ];
  const best = candidates.reduce<Candidate | null>(
    (top, candidate) => (candidate.score > (top?.score ?? 0) ? candidate : top),
    null,
  );
  return best && best.score > 0 ? best : null;
}

const isGreeting = (text: string, locale: Locale): boolean => {
  const query = normalize(text);
  const words = query.split(" ");
  return (
    words.length <= 3 &&
    getAssistantCopy(locale).greetings.some((greeting) => countHits(query, [greeting]) > 0)
  );
};

const others = (topic: AssistantTopic) => assistantTopics.filter((item) => item !== topic);

/** Topic answers, assembled from the same data the pages render. */
export function topicReply(topic: AssistantTopic, locale: Locale): AssistantReply {
  const copy = getAssistantCopy(locale);
  const t = getMessages(locale);
  const { intro, label } = copy.topics[topic];
  const page = (key: Parameters<typeof pathFor>[0]) => ({
    label: t.nav.labels[key],
    to: pathFor(key, locale),
  });
  const base = { source: "guide" as const, title: label, text: intro, followUps: others(topic) };

  switch (topic) {
    case "services":
      return {
        ...base,
        bullets: getServices(locale).map((service) => service.name),
        links: [page("services")],
      };
    case "consultation":
      return {
        ...base,
        bullets: t.contact.nextSteps,
        links: [{ label: copy.contactLabels.form, to: pathFor("contact", locale) }],
        escalate: true,
      };
    case "portfolio":
      return {
        ...base,
        bullets: getProjects(locale).map((project) => project.title),
        links: [page("portfolio")],
      };
    case "process":
      return {
        ...base,
        bullets: getProcessSteps(locale).map((step) => step.name),
        links: [page("process")],
      };
    case "contact":
      return {
        ...base,
        bullets: [
          `${copy.contactLabels.email}: ${company.email}`,
          ...company.whatsapp.map((number) => `${copy.contactLabels.whatsapp}: ${number.display}`),
          `${copy.contactLabels.instagram}: ${company.instagram.handle}`,
        ],
        links: [page("contact")],
        escalate: true,
      };
  }
}

/**
 * The local guide: answers topic picks and matches typed questions against
 * the site's own FAQ and topic vocabulary. No network, no storage, no
 * generated text. Unknown questions get an honest fallback and a hand-off to
 * the team.
 */
export const createGuideEngine = (locale: Locale): AssistantEngine => ({
  reply(input: AssistantInput): Promise<AssistantReply> {
    if (input.kind === "topic") return Promise.resolve(topicReply(input.topic, locale));
    const copy = getAssistantCopy(locale);
    const match = matchQuestion(input.text, locale);
    if (!match && isGreeting(input.text, locale))
      return Promise.resolve({
        source: "guide",
        text: copy.greetingReply,
        followUps: assistantTopics,
      });
    if (!match)
      return Promise.resolve({
        source: "fallback",
        text: copy.fallback,
        escalate: true,
        followUps: assistantTopics,
      });
    if (match.kind === "topic") return Promise.resolve(topicReply(match.topic, locale));
    const t = getMessages(locale);
    return Promise.resolve({
      source: "guide",
      title: match.item.question,
      text: match.item.answer,
      links: [{ label: t.nav.labels[match.page], to: pathFor(match.page, locale) }],
      followUps: ["consultation", "contact"],
    });
  },
});
