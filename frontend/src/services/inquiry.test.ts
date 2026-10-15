import { describe, expect, it } from "vitest";
import { company, primaryWhatsApp } from "~/data/company";
import type { InquiryPayload } from "~/types/inquiry";
import { composeInquiryMessage, emptyInquiry, inquiryHref, validateInquiry } from "./inquiry";

const valid: InquiryPayload = {
  ...emptyInquiry,
  name: "Rina Wulandari",
  organization: "Klinik Sehat Bersama",
  contact: "0812 3456 7890",
  service: "sistem-informasi",
  message: "Kami butuh sistem antrean untuk tiga poli dengan layar panggilan.",
};

describe("validateInquiry", () => {
  it("accepts a complete inquiry", () => {
    expect(validateInquiry(valid)).toEqual({});
  });

  it("reports each missing required field", () => {
    const errors = validateInquiry(emptyInquiry);
    expect(Object.keys(errors).sort()).toEqual(["contact", "message", "name", "service"]);
  });

  it("accepts an email or a phone number as contact", () => {
    expect(validateInquiry({ ...valid, contact: "rina@example.com" }).contact).toBeUndefined();
    expect(validateInquiry({ ...valid, contact: "+62 812-3456-7890" }).contact).toBeUndefined();
    expect(validateInquiry({ ...valid, contact: "bukan kontak" }).contact).toBeDefined();
  });

  it("matches the server's length limits after trimming", () => {
    const text = (length: number, char = "a") => char.repeat(length);
    expect(validateInquiry({ ...valid, name: " A " }).name).toBeDefined();
    expect(validateInquiry({ ...valid, name: text(2) }).name).toBeUndefined();
    expect(validateInquiry({ ...valid, name: text(120) }).name).toBeUndefined();
    expect(validateInquiry({ ...valid, name: text(121) }).name).toMatch(/maksimal 120/);
    expect(validateInquiry({ ...valid, organization: text(160) }).organization).toBeUndefined();
    expect(validateInquiry({ ...valid, organization: text(161) }).organization).toMatch(/160/);
    expect(validateInquiry({ ...valid, message: text(19) }).message).toBeDefined();
    expect(validateInquiry({ ...valid, message: text(5000) }).message).toBeUndefined();
    expect(validateInquiry({ ...valid, message: text(5001) }).message).toMatch(/5\.000/);
    const longEmail = `${text(250)}@a.co`;
    expect(validateInquiry({ ...valid, contact: longEmail }).contact).toMatch(/254/);
  });

  it("counts characters, not UTF-16 units, like Laravel", () => {
    // 5000 emoji are 10000 UTF-16 units but 5000 characters: allowed.
    expect(validateInquiry({ ...valid, message: "🙂".repeat(5000) }).message).toBeUndefined();
    expect(validateInquiry({ ...valid, message: "🙂".repeat(5001) }).message).toBeDefined();
    expect(validateInquiry({ ...valid, name: "🙂".repeat(2) }).name).toBeUndefined();
  });

  it("accepts phone numbers with plain spaces only, as the server does", () => {
    expect(validateInquiry({ ...valid, contact: "0812 3456 7890" }).contact).toBeUndefined();
    expect(validateInquiry({ ...valid, contact: "0812\t3456\t7890" }).contact).toBeDefined();
    expect(validateInquiry({ ...valid, contact: "0812345" }).contact).toBeDefined();
  });

  it("rejects values outside the enums", () => {
    const errors = validateInquiry({
      ...valid,
      service: "Sistem Informasi" as InquiryPayload["service"],
      budget: "murah" as InquiryPayload["budget"],
      timeline: "besok" as InquiryPayload["timeline"],
    });
    expect(Object.keys(errors).sort()).toEqual(["budget", "service", "timeline"]);
  });

  it("explains errors in the page language", () => {
    expect(validateInquiry(emptyInquiry, "en").name).toBe(
      "Enter your name, at least 2 characters.",
    );
    expect(validateInquiry(emptyInquiry, "id").name).toBe("Tulis nama Anda, minimal 2 karakter.");
  });
});

describe("inquiry delivery", () => {
  it("composes a readable message with the chosen service", () => {
    const message = composeInquiryMessage(valid);
    expect(message).toContain("Nama: Rina Wulandari");
    expect(message).toContain("Layanan: Sistem Informasi");
    expect(message).toContain("Organisasi: Klinik Sehat Bersama");
  });

  it("composes the English message from English labels", () => {
    const message = composeInquiryMessage(valid, "en");
    expect(message).toContain("Name: Rina Wulandari");
    expect(message).toContain("Service: Information Systems");
    expect(message).toContain("Estimated budget: Not sure yet");
  });

  it("omits the organisation line when it is empty", () => {
    expect(composeInquiryMessage({ ...valid, organization: "" })).not.toContain("Organisasi:");
  });

  it("targets the confirmed WhatsApp number and email", () => {
    expect(
      inquiryHref("whatsapp", valid).startsWith(`https://wa.me/${primaryWhatsApp.e164}?text=`),
    ).toBe(true);
    expect(inquiryHref("email", valid).startsWith(`mailto:${company.email}?subject=`)).toBe(true);
  });

  it("sends to the chosen number with the same message", () => {
    const [, second, third] = company.whatsapp;
    const a = inquiryHref("whatsapp", valid, { recipient: second!.e164 });
    const b = inquiryHref("whatsapp", valid, { recipient: third!.e164 });
    expect(a.startsWith(`https://wa.me/${second!.e164}?text=`)).toBe(true);
    expect(b.startsWith(`https://wa.me/${third!.e164}?text=`)).toBe(true);
    expect(a.split("?text=")[1]).toBe(b.split("?text=")[1]);
  });

  it("never sends to a number that is not confirmed", () => {
    expect(inquiryHref("whatsapp", valid, { recipient: "6280000000000" })).toContain(
      `https://wa.me/${primaryWhatsApp.e164}?`,
    );
  });
});
