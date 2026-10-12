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
});

describe("inquiry delivery", () => {
  it("composes a readable message with the chosen service", () => {
    const message = composeInquiryMessage(valid);
    expect(message).toContain("Nama: Rina Wulandari");
    expect(message).toContain("Layanan: Sistem Informasi");
    expect(message).toContain("Organisasi: Klinik Sehat Bersama");
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
});
