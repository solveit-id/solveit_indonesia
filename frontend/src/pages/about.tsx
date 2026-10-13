import { useRef, useState } from "react";
import { BrandMark } from "~/components/brand/brand-mark";
import { PageIntro } from "~/components/ui/page-intro";
import { useReveal } from "~/hooks/use-reveal";
import { getMessages, localeFromPath, pathFor, useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { motionQueries, useMotion } from "~/lib/motion";
import { buildMeta, organizationSchema } from "~/lib/seo";
import type { Route } from "./+types/about";

export const meta: Route.MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const t = getMessages(locale);
  return buildMeta({
    locale,
    title: t.meta.aboutTitle,
    description: t.meta.aboutDescription,
    path: pathFor("about", locale),
    breadcrumbs: [{ name: t.nav.labels.about, path: pathFor("about", locale) }],
    jsonLd: [organizationSchema(locale)],
  });
};

// Static class strings so Tailwind can see them: dim every capsule but one.
const dimOthers = [
  "[&_[data-capsule]:not([data-capsule='0'])]:opacity-20",
  "[&_[data-capsule]:not([data-capsule='1'])]:opacity-20",
  "[&_[data-capsule]:not([data-capsule='2'])]:opacity-20",
  "[&_[data-capsule]:not([data-capsule='3'])]:opacity-20",
];

// Scroll depth per capsule (px at the section's edges), along the 33deg axis.
// They differ, so the pieces travel at their own pace and meet as the logo
// exactly when the section is centred in the viewport.
const DEPTH = [-150, 90, -90, 150];
const AXIS = { x: Math.cos((33 * Math.PI) / 180), y: -Math.sin((33 * Math.PI) / 180) };

export default function About() {
  const { t } = useI18n();
  const copy = t.about;
  const scope = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<number | null>(null);
  useReveal(scope);

  /*
   * Storytelling parallax: the four capsules drift apart at different depths
   * and lock into the exact logo as the section reaches the middle of the
   * screen, the "four parts that lock together" told by scrolling. Lighter
   * travel on small screens; static (already assembled) without motion.
   */
  useMotion(
    ({ gsap }) => {
      const mm = gsap.matchMedia();
      mm.add({ motion: motionQueries.motion, desktop: motionQueries.tablet }, (context) => {
        const { motion, desktop } = context.conditions as Record<string, boolean>;
        if (!motion) return;
        const scale = desktop ? 1 : 0.45;
        const capsules = gsap.utils.toArray<SVGPathElement>(
          "[data-philosophy-mark] [data-capsule]",
        );
        const offset = (index: number, sign: number) => (DEPTH[index] ?? 0) * scale * sign;
        gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: "[data-philosophy]",
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          })
          .fromTo(
            capsules,
            {
              x: (index: number) => offset(index, 1) * AXIS.x,
              y: (index: number) => offset(index, 1) * AXIS.y,
            },
            { x: 0, y: 0, duration: 1 },
          )
          .to(capsules, {
            x: (index: number) => offset(index, -0.5) * AXIS.x,
            y: (index: number) => offset(index, -0.5) * AXIS.y,
            duration: 1,
          });
      });
    },
    { scope },
  );

  return (
    <div ref={scope}>
      <PageIntro
        breadcrumbs={[{ name: t.nav.labels.about }]}
        title={copy.title}
        lede={
          <p>
            {t.company.description} {copy.ledeTail}
          </p>
        }
      />

      <section
        aria-labelledby="vision-title"
        className="border-t border-line py-[var(--spacing-section)]"
      >
        <div className="shell grid gap-10 lg:grid-cols-12">
          <h2 id="vision-title" data-reveal className="text-heading font-wide lg:col-span-3">
            {copy.visionTitle}
          </h2>
          <p
            data-reveal
            className="text-[clamp(1.6rem,3.2vw,2.7rem)] leading-[1.18] font-semibold tracking-[-0.025em] font-wide lg:col-span-9"
          >
            {t.company.vision}
          </p>
        </div>
      </section>

      <section
        data-philosophy
        aria-labelledby="philosophy-title"
        className="overflow-x-clip bg-paper-sunken py-[var(--spacing-section)]"
      >
        <div className="shell grid items-center gap-14 lg:grid-cols-12">
          <div
            data-philosophy-mark
            className="mx-auto w-[min(70vw,22rem)] lg:col-span-5 lg:w-full lg:max-w-[26rem]"
          >
            <BrandMark
              className={cn(
                "w-full [&_[data-capsule]]:transition-opacity [&_[data-capsule]]:duration-500",
                focus !== null && dimOthers[focus],
              )}
              title={copy.markTitle}
            />
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <h2 id="philosophy-title" data-reveal className="max-w-[14ch] text-title">
              {copy.philosophyTitle}
            </h2>
            <p data-reveal className="mt-6 measure text-ink-muted">
              {copy.philosophyText}
            </p>
            <ol className="mt-10 border-t border-line">
              {copy.principles.map((item, index) => (
                <li key={item.name} data-reveal className="border-b border-line">
                  <button
                    type="button"
                    onPointerEnter={() => setFocus(index)}
                    onPointerLeave={() => setFocus(null)}
                    onFocus={() => setFocus(index)}
                    onBlur={() => setFocus(null)}
                    className="group/principle grid w-full gap-1 py-5 text-left sm:grid-cols-[10rem_1fr] sm:gap-6"
                    aria-describedby={`principle-${index}`}
                  >
                    <span className="text-lg font-bold font-wide transition-colors duration-300 group-hover/principle:text-accent-text">
                      {item.name}
                    </span>
                    <span id={`principle-${index}`} className="text-ink-muted">
                      {item.text}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="values-title" className="shell py-[var(--spacing-section)]">
        <h2 id="values-title" data-reveal className="max-w-[16ch] text-title">
          {copy.valuesTitle}
        </h2>
        <dl className="mt-14 grid gap-x-12 gap-y-14 md:grid-cols-2 lg:mt-20">
          {copy.values.map((value) => (
            <div key={value.name} data-reveal className="border-t-2 border-ink pt-6">
              <dt className="text-heading font-bold tracking-[-0.025em] font-wide">{value.name}</dt>
              <dd className="mt-4 measure text-ink-muted">{value.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="roadmap-title"
        className="border-t border-line py-[var(--spacing-section)]"
      >
        <div className="shell">
          <h2 id="roadmap-title" data-reveal className="max-w-[18ch] text-title">
            {copy.roadmapTitle}
          </h2>
          <p data-reveal className="mt-6 measure text-ink-muted">
            {copy.roadmapText}
          </p>
          <ol className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {copy.roadmap.map((stage, index) => {
              const current = index === 0;
              return (
                <li
                  key={stage}
                  data-reveal
                  className={cn(
                    "flex min-h-36 flex-col justify-between gap-6 rounded-[var(--radius-panel)] p-7",
                    current ? "bg-accent text-accent-ink" : "border border-line bg-paper-raised",
                  )}
                >
                  <span className="text-xl font-bold tracking-[-0.02em] font-wide">{stage}</span>
                  <span
                    className={cn(
                      "self-start rounded-full px-3 py-1 text-sm font-semibold",
                      current ? "bg-[#f4f7ff] text-[#1136d6]" : "bg-paper-sunken text-ink-muted",
                    )}
                  >
                    {current ? copy.statusCurrent : copy.statusPlanned}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </div>
  );
}
