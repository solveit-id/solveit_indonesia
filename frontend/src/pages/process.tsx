import { useRef } from "react";
import { FaqList } from "~/components/ui/faq-list";
import { PageIntro } from "~/components/ui/page-intro";
import { useReveal } from "~/hooks/use-reveal";
import { getMessages, localeFromPath, pathFor, useI18n } from "~/i18n";
import { motionQueries, useMotion } from "~/lib/motion";
import { buildMeta, faqSchema } from "~/lib/seo";
import { getProcessFaq, getProcessSteps } from "~/services/content";
import type { Route } from "./+types/process";

export const meta: Route.MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const t = getMessages(locale);
  return buildMeta({
    locale,
    title: t.meta.processTitle,
    description: t.meta.processDescription,
    path: pathFor("process", locale),
    breadcrumbs: [{ name: t.nav.labels.process, path: pathFor("process", locale) }],
    jsonLd: [faqSchema(getProcessFaq(locale), locale)],
  });
};

const tones = [
  { panel: "bg-accent text-accent-ink", muted: "text-[#dfe7ff]", rule: "border-[#f4f7ff]/30" },
  {
    panel: "border border-line bg-paper-raised text-ink",
    muted: "text-ink-muted",
    rule: "border-line",
  },
  { panel: "bg-[#082a56] text-[#e9effa]", muted: "text-[#c3d0e4]", rule: "border-[#e9effa]/25" },
];

export default function Process() {
  const { t, locale } = useI18n();
  const copy = t.process;
  const steps = getProcessSteps(locale);
  const scope = useRef<HTMLDivElement>(null);
  useReveal(scope);

  // Steps stack with CSS sticky positioning (works without JS); motion only
  // recedes the step underneath as the next one slides over it. Scale and a
  // shade layer's opacity are composited, unlike a scrubbed CSS filter.
  useMotion(
    ({ gsap }) => {
      const mm = gsap.matchMedia();
      mm.add(`${motionQueries.motion} and ${motionQueries.tablet}`, () => {
        const panels = gsap.utils.toArray<HTMLElement>("[data-stack-panel]");
        panels.forEach((panel, index) => {
          const next = panels[index + 1];
          if (!next) return;
          gsap
            .timeline({
              defaults: { ease: "none" },
              scrollTrigger: { trigger: next, start: "top bottom", end: "top 30%", scrub: true },
            })
            .to(panel, { scale: 0.94 }, 0)
            .to(panel.querySelector("[data-stack-shade]"), { opacity: 0.07 }, 0);
        });
      });
    },
    { scope },
  );

  return (
    <div ref={scope}>
      <PageIntro
        breadcrumbs={[{ name: t.nav.labels.process }]}
        title={copy.title}
        lede={<p>{copy.lede}</p>}
      />

      <ol aria-label={copy.listLabel} className="shell pb-[var(--spacing-section)]">
        {steps.map((step, index) => {
          const tone = tones[index % tones.length]!;
          return (
            <li
              key={step.id}
              data-stack-panel
              className="mb-6 origin-top md:sticky"
              style={{ top: `calc(6rem + ${index * 0.85}rem)` }}
            >
              <article
                aria-labelledby={`step-${step.id}`}
                className={`relative grid gap-8 overflow-hidden rounded-[var(--radius-panel)] p-8 md:min-h-[24rem] md:grid-cols-12 md:p-12 ${tone.panel}`}
              >
                <span
                  aria-hidden
                  data-stack-shade
                  className="pointer-events-none absolute inset-0 bg-[#030a18] opacity-0"
                />
                <div className="relative flex flex-col justify-between gap-8 md:col-span-6">
                  <span
                    aria-hidden
                    className="text-[clamp(3.5rem,8vw,6rem)] leading-none font-bold tracking-[-0.05em] font-wide opacity-90"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 id={`step-${step.id}`} className="text-title font-wide">
                    {step.name}
                  </h2>
                </div>
                <div className="relative flex flex-col justify-end gap-6 md:col-span-6">
                  <p className="text-lede">{step.description}</p>
                  <dl className={`grid gap-5 border-t pt-6 sm:grid-cols-2 ${tone.rule}`}>
                    <div>
                      <dt className={`text-sm font-semibold ${tone.muted}`}>{copy.yourRole}</dt>
                      <dd className="mt-1.5">{step.clientRole}</dd>
                    </div>
                    <div>
                      <dt className={`text-sm font-semibold ${tone.muted}`}>{copy.youReceive}</dt>
                      <dd className="mt-1.5">{step.output}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            </li>
          );
        })}
      </ol>

      <section aria-labelledby="process-faq" className="border-t border-line">
        <div className="shell grid gap-10 py-[var(--spacing-section)] lg:grid-cols-12">
          <h2 id="process-faq" data-reveal className="max-w-[12ch] text-title lg:col-span-4">
            {copy.faqTitle}
          </h2>
          <div data-reveal className="lg:col-span-7 lg:col-start-6">
            <FaqList items={getProcessFaq(locale)} />
          </div>
        </div>
      </section>
    </div>
  );
}
