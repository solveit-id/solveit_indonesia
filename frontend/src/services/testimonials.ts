import { testimonials } from "~/data/testimonials";
import type { Testimonial } from "~/types/testimonial";

/** A testimonial may appear on a public page only with dated written permission. */
export const isPublishable = (item: Testimonial): boolean =>
  !item.isDemo && item.permission.granted && Boolean(item.permission.date);

/**
 * Testimonials for public pages. Reads the typed local dataset today; the
 * Laravel API can replace it later with the same signature and the same rule.
 */
export const getPublishedTestimonials = (): Testimonial[] => testimonials.filter(isPublishable);
