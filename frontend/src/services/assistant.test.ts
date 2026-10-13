import { describe, expect, it } from "vitest";
import { company } from "~/data/company";
import { locales } from "~/i18n/config";
import { localizedRoutes } from "~/i18n/paths";
import type { AssistantReply } from "~/types/assistant";
import {
  assistantTopics,
  countHits,
  createGuideEngine,
  getAssistantCopy,
  normalize,
} from "./assistant";
import { getProcessFaq, getServiceFaq } from "./content";

const ask = (text: string, locale: "id" | "en") =>
  createGuideEngine(locale).reply({ kind: "text", text });

const allText = (reply: AssistantReply) =>
  [reply.title, reply.text, ...(reply.bullets ?? []), ...(reply.links ?? []).map((l) => l.label)]
    .filter(Boolean)
    .join(" ");

describe("Solveit Assistant guide", () => {
  it("answers every topic in both languages with links to real pages", async () => {
    const routes = new Set(localizedRoutes());
    for (const locale of locales) {
      const engine = createGuideEngine(locale);
      for (const topic of assistantTopics) {
        const reply = await engine.reply({ kind: "topic", topic });
        expect(reply.source).toBe("guide");
        expect(reply.text.length).toBeGreaterThan(20);
        expect(reply.links?.length).toBeGreaterThan(0);
        for (const link of reply.links ?? []) expect(routes.has(link.to)).toBe(true);
        expect(reply.followUps).not.toContain(topic);
      }
    }
  });

  it("lists only the confirmed contact channels", async () => {
    const reply = await createGuideEngine("id").reply({ kind: "topic", topic: "contact" });
    const text = allText(reply);
    expect(text).toContain(company.email);
    for (const number of company.whatsapp) expect(text).toContain(number.display);
    expect(text).toContain(company.instagram.handle);
    expect(reply.escalate).toBe(true);
  });

  it("matches typed questions to the published FAQ, in both languages", async () => {
    expect((await ask("Berapa biayanya bikin website?", "id")).text).toBe(
      getServiceFaq("id")[0]!.answer,
    );
    expect((await ask("Berapa lama prosesnya?", "id")).text).toBe(getProcessFaq("id")[0]!.answer);
    expect((await ask("Can I request a revision?", "en")).text).toBe(
      getProcessFaq("en")[2]!.answer,
    );
    expect((await ask("How much does a website cost?", "en")).text).toBe(
      getServiceFaq("en")[0]!.answer,
    );
  });

  it("routes broad questions to a topic", async () => {
    expect((await ask("nomor whatsapp?", "id")).title).toBe("Kontak");
    expect((await ask("show me your portfolio", "en")).title).toBe("Portfolio");
  });

  it("greets, and falls back honestly with a hand-off when it cannot answer", async () => {
    expect((await ask("halo", "id")).followUps).toEqual(assistantTopics);
    const unknown = await ask("qwerty zxcv", "en");
    expect(unknown.source).toBe("fallback");
    expect(unknown.escalate).toBe(true);
  });

  it("never invents prices, durations, or results", async () => {
    for (const locale of locales) {
      const engine = createGuideEngine(locale);
      for (const topic of assistantTopics) {
        const text = allText(await engine.reply({ kind: "topic", topic }));
        expect(text).not.toMatch(/Rp\s?\d|\$\s?\d|\d+\s?(hari|minggu|days|weeks)/i);
      }
    }
  });

  it("keeps the vocabulary aligned with the FAQ lists", () => {
    for (const locale of locales) {
      const copy = getAssistantCopy(locale);
      expect(copy.faqKeywords.serviceFaq).toHaveLength(getServiceFaq(locale).length);
      expect(copy.faqKeywords.processFaq).toHaveLength(getProcessFaq(locale).length);
    }
  });

  it("matches words by prefix and phrases as whole words", () => {
    expect(countHits(normalize("Biayanya berapa?"), ["biaya"])).toBe(1);
    expect(countHits(normalize("how long will it take"), ["how long"])).toBe(1);
    expect(countHits(normalize("whatever"), ["wa"])).toBe(0);
  });
});
