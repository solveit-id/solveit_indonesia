import type { Locale } from "~/i18n/config";

/**
 * A client testimonial. Only entries with written permission are ever
 * rendered on public pages (see `getPublishedTestimonials`), and none of them
 * produce Review or AggregateRating structured data.
 */
export interface Testimonial {
  id: string;
  /**
   * Layout placeholders for the internal preview page. Never published, and
   * their text must say it is a placeholder rather than imitate a quote.
   */
  isDemo: boolean;
  person: {
    name: string;
    /** Role and organisation as the client approved them, per language. */
    role: Record<Locale, string>;
  };
  quote: Record<Locale, string>;
  /** What the project was, in one line, per language. */
  context: Record<Locale, string>;
  /** Case study key, when the project has a published case study. */
  projectKey?: string;
  permission: {
    granted: boolean;
    /** ISO date (YYYY-MM-DD) of the written approval to publish. */
    date?: string;
  };
}
