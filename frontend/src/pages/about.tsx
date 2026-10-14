import { useRef, useState } from "react";
import { BrandMark } from "~/components/brand/brand-mark";
import { EcosystemRoadmap } from "~/components/sections/about/ecosystem-roadmap";
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

  /*
   * Vision and values, tied to the reader's scroll in both directions (scrub),
   * so nothing ever hides again on the way back up: the vision is read phrase
   * by phrase as each brightens from the faint ink, while a cobalt axis draws
   * down beside it; each value's rule draws across and its marker turns onto
   * the logo's 33deg axis. Colour, never opacity, so every intermediate frame
   * keeps large-text contrast. Without motion everything rests in its end state.
   */
  useMotion(
    ({ gsap }) => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        const phrases = gsap.utils.toArray<HTMLElement>("[data-phrase]");
        const faint = getComputedStyle(document.documentElement)
          .getPropertyValue("--ink-faint")
          .trim();
        const finals = phrases.map((phrase) => getComputedStyle(phrase).color);
        const vision = {
          trigger: "[data-vision]",
          start: "top 75%",
          end: "bottom 45%",
          scrub: 0.5,
        };
        gsap.fromTo(
          phrases,
          { color: faint },
          {
            color: (index: number) => finals[index] ?? faint,
            stagger: 0.5,
            ease: "none",
            scrollTrigger: { ...vision },
          },
        );
        gsap.fromTo(
          "[data-vision-axis]",
          { scaleY: 0 },
          { scaleY: 1, ease: "none", scrollTrigger: { ...vision } },
        );
        // The tip rests at the end of the axis and travels down with the fill.
        const axis = document.querySelector<HTMLElement>("[data-vision-axis]");
        gsap.fromTo(
          "[data-vision-tip]",
          { y: () => -(axis?.offsetHeight ?? 0) },
          { y: 0, ease: "none", scrollTrigger: { ...vision, invalidateOnRefresh: true } },
        );
        for (const row of gsap.utils.toArray<HTMLElement>("[data-value]")) {
          const scrub = { trigger: row, start: "top 88%", end: "top 55%", scrub: 0.5 };
          gsap.fromTo(
            row.querySelector("[data-value-rule]"),
            { scaleX: 0 },
            { scaleX: 1, ease: "none", scrollTrigger: scrub },
          );
          gsap.fromTo(
            row.querySelector("[data-value-mark]"),
            { rotate: 0, scaleX: 0.4 },
            { rotate: -33, scaleX: 1, ease: "none", scrollTrigger: scrub },
          );
        }
        return () => gsap.set(phrases, { clearProps: "color" });
      });
    },
    { scope },
  );

  // The vision as phrases (split after each comma), so it can be read in
  // steps. The text itself is unchanged and stays one sentence.
  const phrases = t.company.vision.split(/(?<=,)\s+/);

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
        <div data-vision className="shell grid gap-10 lg:grid-cols-12">
          <div className="vision-head lg:col-span-3">
            <h2 id="vision-title" className="text-heading font-wide">
              {copy.visionTitle}
            </h2>
            <span aria-hidden className="vision-axis">
              <span data-vision-axis className="vision-axis-fill" />
              <span data-vision-tip className="vision-axis-tip" />
            </span>
          </div>
          <p className="vision-text lg:col-span-9">
            {phrases.map((phrase, index) => (
              <span key={index} data-phrase>
                {phrase}
                {index < phrases.length - 1 ? " " : ""}
              </span>
            ))}
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
        <dl className="values mt-14 lg:mt-20">
          {copy.values.map((value, index) => (
            <div key={value.name} data-value className="value-row">
              <span aria-hidden data-value-rule className="value-rule" />
              <span aria-hidden className="value-index">
                <span data-value-mark className="value-mark" />
                {String(index + 1).padStart(2, "0")}
              </span>
              <dt className="value-name">{value.name}</dt>
              <dd className="value-text">{value.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="roadmap-title"
        className="border-t border-line py-[var(--spacing-section)]"
      >
        <div className="shell">
          <EcosystemRoadmap
            intro={
              <>
                <h2 id="roadmap-title" data-reveal className="max-w-[20ch] text-title">
                  {copy.roadmapTitle}
                </h2>
                <p data-reveal className="measure text-ink-muted">
                  {copy.roadmapText}
                </p>
              </>
            }
          />
        </div>
      </section>
    </div>
  );
}
