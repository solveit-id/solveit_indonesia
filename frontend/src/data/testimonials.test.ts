import { describe, expect, it } from "vitest";
import { getPublishedTestimonials, isPublishable } from "~/services/testimonials";
import { testimonialPlaceholders, testimonials } from "./testimonials";

describe("testimonial integrity", () => {
  it("publishes only real testimonials with dated written permission", () => {
    for (const item of getPublishedTestimonials()) {
      expect(item.isDemo).toBe(false);
      expect(item.permission.granted).toBe(true);
      expect(item.permission.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.quote.id.trim()).not.toBe("");
      expect(item.quote.en.trim()).not.toBe("");
    }
  });

  it("matches PRODUCT.md: no client has approved a testimonial yet", () => {
    // Update this expectation together with PRODUCT.md when one is approved.
    expect(testimonials).toEqual([]);
    expect(getPublishedTestimonials()).toEqual([]);
  });

  it("keeps preview placeholders unpublishable and self-describing", () => {
    expect(testimonialPlaceholders.length).toBeGreaterThan(1);
    for (const item of testimonialPlaceholders) {
      expect(item.isDemo).toBe(true);
      expect(isPublishable(item)).toBe(false);
      expect(item.quote.id.toLowerCase()).toContain("placeholder");
      expect(item.quote.en.toLowerCase()).toContain("placeholder");
    }
  });
});
