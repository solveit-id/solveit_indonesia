import { useId, useState } from "react";
import { DemoLabel } from "~/components/portfolio/demo-label";
import { QuoteMark, TestimonialQuotes } from "~/components/sections/testimonials";
import { testimonialPlaceholders } from "~/data/testimonials";
import { getMessages, type Locale, localeMeta, locales } from "~/i18n";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/testimonial-preview";

/** Internal review page for the testimonial component. Never indexed. */
const PREVIEW_PATH = "/pratinjau/testimoni";

export const meta: Route.MetaFunction = () => {
  const t = getMessages("id").testimonials;
  return buildMeta({
    locale: "id",
    title: t.previewTitle,
    description: t.previewNote,
    path: PREVIEW_PATH,
    noindex: true,
  });
};

export default function TestimonialPreview() {
  const t = getMessages("id").testimonials;
  const headingId = useId();
  const [locale, setLocale] = useState<Locale>("id");

  return (
    <div className="shell pt-36 pb-[var(--spacing-section)]">
      <h1 className="max-w-[18ch] text-display">{t.previewTitle}</h1>
      <p className="mt-6 measure text-lede text-ink-muted">{t.previewNote}</p>
      <DemoLabel className="mt-6" label={t.previewLabel} />

      <fieldset className="mt-10 flex flex-wrap items-center gap-3">
        <legend className="field-label mb-3">{t.previewLanguage}</legend>
        {locales.map((option) => (
          <label key={option} className="choice">
            <input
              type="radio"
              name="preview-locale"
              value={option}
              checked={locale === option}
              onChange={() => setLocale(option)}
            />
            <span>{localeMeta[option].name}</span>
          </label>
        ))}
      </fieldset>

      <section
        aria-labelledby={headingId}
        className="mt-16 grid gap-12 border-t border-line pt-16 lg:grid-cols-12"
      >
        <div className="lg:col-span-4">
          <QuoteMark className="w-28 sm:w-32 lg:w-44" />
        </div>
        <div className="lg:col-span-7 lg:col-start-6" lang={localeMeta[locale].htmlLang}>
          <h2 id={headingId} className="max-w-[16ch] text-title">
            {getMessages(locale).testimonials.regionLabel}
          </h2>
          <div className="mt-12">
            <TestimonialQuotes
              items={testimonialPlaceholders}
              locale={locale}
              headingId={headingId}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
