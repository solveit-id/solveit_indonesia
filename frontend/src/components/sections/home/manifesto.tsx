import { useRef } from "react";
import { Link } from "react-router";
import { company } from "~/data/company";
import { useI18n } from "~/i18n";
import { motionQueries, useMotion } from "~/lib/motion";

/**
 * The tagline, read word by word as it scrolls into place. The scrub ties the
 * reveal to the reader's own pace instead of a timer.
 */
export function Manifesto() {
  const { t, path } = useI18n();
  const scope = useRef<HTMLElement>(null);
  const words = company.tagline.split(" ");

  useMotion(
    ({ gsap }) => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        // Words brighten from the faint ink to their final colour. Colour, not
        // opacity: every intermediate state keeps large-text contrast (3:1+).
        const words = gsap.utils.toArray<HTMLElement>("[data-word]");
        const faint = getComputedStyle(document.documentElement)
          .getPropertyValue("--ink-faint")
          .trim();
        const finals = words.map((word) => getComputedStyle(word).color);
        gsap.fromTo(
          words,
          { color: faint },
          {
            color: (index: number) => finals[index] ?? faint,
            stagger: 0.1,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-tagline]",
              start: "top 82%",
              end: "bottom 45%",
              scrub: 0.6,
            },
          },
        );
        return () => gsap.set(words, { clearProps: "color" });
      });
    },
    { scope },
  );

  return (
    <section
      ref={scope}
      aria-labelledby="manifesto-title"
      className="shell py-[var(--spacing-section)]"
    >
      <h2 id="manifesto-title" className="sr-only">
        {t.home.manifestoTitle}
      </h2>
      <p
        data-tagline
        lang="en"
        className="max-w-[22ch] text-[clamp(2.1rem,5.6vw,5rem)] leading-[1.02] font-bold tracking-[-0.035em] text-balance font-wide"
      >
        {words.map((word, index) => (
          <span key={index} data-word className={index >= 5 ? "text-accent-text" : undefined}>
            {word}
            {index < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
      <div className="mt-12 grid gap-8 md:mt-16 md:grid-cols-12">
        <p className="measure text-lede text-ink-muted md:col-span-7 md:col-start-6">
          {t.home.manifestoBody}{" "}
          <Link to={path("about")} className="font-semibold text-ink underline">
            {t.home.manifestoLink}
          </Link>
        </p>
      </div>
    </section>
  );
}
