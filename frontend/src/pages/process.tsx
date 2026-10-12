import { useRef } from "react";
import { FaqList } from "~/components/ui/faq-list";
import { PageIntro } from "~/components/ui/page-intro";
import { processFaq, processSteps } from "~/data/process";
import { useReveal } from "~/hooks/use-reveal";
import { motionQueries, useMotion } from "~/lib/motion";
import { buildMeta, faqSchema } from "~/lib/seo";
import type { Route } from "./+types/process";

export const meta: Route.MetaFunction = () =>
  buildMeta({
    title: "Proses Kerja Pengembangan Software",
    description:
      "Tujuh langkah proses kerja Solveit Indonesia: konsultasi, analisis kebutuhan, desain, pengembangan, pengujian, implementasi, dan dukungan.",
    path: "/proses",
    breadcrumbs: [{ name: "Proses Kerja", path: "/proses" }],
    jsonLd: [faqSchema(processFaq)],
  });

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
  const scope = useRef<HTMLDivElement>(null);
  useReveal(scope);

  // Steps stack with CSS sticky positioning (works without JS); motion only
  // recedes the step underneath as the next one slides over it.
  useMotion(
    ({ gsap, ScrollTrigger }) => {
      const mm = gsap.matchMedia();
      mm.add(`${motionQueries.motion} and (min-width: 768px)`, () => {
        const panels = gsap.utils.toArray<HTMLElement>("[data-stack-panel]");
        panels.forEach((panel, index) => {
          const next = panels[index + 1];
          if (!next) return;
          gsap.to(panel, {
            scale: 0.94,
            filter: "brightness(0.96)",
            ease: "none",
            scrollTrigger: {
              trigger: next,
              start: "top bottom",
              end: "top 30%",
              scrub: true,
            },
          });
        });
        ScrollTrigger.refresh();
      });
    },
    { scope },
  );

  return (
    <div ref={scope}>
      <PageIntro
        breadcrumbs={[{ name: "Proses Kerja" }]}
        title="Proses kerja dalam tujuh langkah yang jelas."
        lede={
          <p>
            Setiap proyek di Solveit Indonesia melewati konsultasi, analisis kebutuhan, desain,
            pengembangan, pengujian, implementasi, dan dukungan. Di setiap langkah, Anda tahu apa
            yang dikerjakan, apa peran Anda, dan apa yang Anda terima.
          </p>
        }
      />

      <ol aria-label="Tahapan proses kerja" className="shell pb-[var(--spacing-section)]">
        {processSteps.map((step, index) => {
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
                className={`grid gap-8 rounded-[var(--radius-panel)] p-8 md:min-h-[24rem] md:grid-cols-12 md:p-12 ${tone.panel}`}
              >
                <div className="flex flex-col justify-between gap-8 md:col-span-6">
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
                <div className="flex flex-col justify-end gap-6 md:col-span-6">
                  <p className="text-lede">{step.description}</p>
                  <dl className={`grid gap-5 border-t pt-6 sm:grid-cols-2 ${tone.rule}`}>
                    <div>
                      <dt className={`text-sm font-semibold ${tone.muted}`}>Peran Anda</dt>
                      <dd className="mt-1.5">{step.clientRole}</dd>
                    </div>
                    <div>
                      <dt className={`text-sm font-semibold ${tone.muted}`}>Anda menerima</dt>
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
            Tentang proses dan revisi.
          </h2>
          <div data-reveal className="lg:col-span-7 lg:col-start-6">
            <FaqList items={processFaq} />
          </div>
        </div>
      </section>
    </div>
  );
}
