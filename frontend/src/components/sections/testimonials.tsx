import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { type Locale, localeMeta, useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { motionQueries, useMotion } from "~/lib/motion";
import { getPublishedTestimonials } from "~/services/testimonials";
import type { Testimonial } from "~/types/testimonial";

/**
 * A quotation mark drawn as two logo capsules, long axis on the 33 degree
 * diagonal like the pieces of the mark itself.
 * Gradients stay inside the capsules, as everywhere in the system.
 */
export function QuoteMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 132 72"
      aria-hidden
      focusable="false"
      className={cn("block h-auto", className)}
    >
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#124edc" />
          <stop offset="1" stopColor="#178bff" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1136d6" />
          <stop offset="1" stopColor="#19b8f2" />
        </linearGradient>
      </defs>
      {/* Motion moves the groups, so the capsules keep their own rotation. */}
      <g data-quote-capsule="0">
        <rect
          x="20"
          y="6"
          width="30"
          height="60"
          rx="15"
          transform="rotate(57 35 36)"
          fill={`url(#${id}-a)`}
        />
      </g>
      <g data-quote-capsule="1">
        <rect
          x="82"
          y="6"
          width="30"
          height="60"
          rx="15"
          transform="rotate(57 97 36)"
          fill={`url(#${id}-b)`}
        />
      </g>
    </svg>
  );
}

const formatDate = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(localeMeta[locale].schemaLang, { dateStyle: "long" }).format(
    new Date(`${iso}T00:00:00`),
  );

/** How long the outgoing quote takes to leave before the next one enters. */
const LEAVE_MS = 200;

/**
 * Editorial testimonial display: one large quote at a time beside the capsule
 * quotation mark, moved by buttons, arrow keys, or a horizontal swipe. No
 * autoplay, so a quote never changes while someone is reading it.
 */
export function TestimonialQuotes({
  items,
  locale,
  headingId,
}: {
  items: Testimonial[];
  locale: Locale;
  /** The heading that names this region. */
  headingId: string;
}) {
  const { t } = useI18n();
  const copy = t.testimonials;
  const total = items.length;
  const [view, setView] = useState({ index: 0, leaving: false, direction: 1 as 1 | -1 });
  const stage = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const swipe = useRef<number | null>(null);

  const go = useCallback(
    (step: 1 | -1) => {
      if (total < 2) return;
      window.clearTimeout(timer.current);
      const reduce = matchMedia(motionQueries.reduce).matches;
      setView((current) => {
        const index = (current.index + step + total) % total;
        return reduce
          ? { index, leaving: false, direction: step }
          : { ...current, leaving: true, direction: step };
      });
      if (reduce) return;
      timer.current = window.setTimeout(() => {
        setView((current) => ({
          index: (current.index + step + total) % total,
          leaving: false,
          direction: step,
        }));
      }, LEAVE_MS);
    },
    [total],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Arrow keys move between quotes while focus is inside the carousel.
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      go(event.key === "ArrowRight" ? 1 : -1);
    };
    element.addEventListener("keydown", onKey);
    return () => element.removeEventListener("keydown", onKey);
  }, [go]);

  const item = items[view.index] ?? items[0];
  if (!item) return null;

  return (
    <div
      ref={stage}
      role="group"
      aria-roledescription="carousel"
      aria-labelledby={headingId}
      onPointerDown={(event) => (swipe.current = event.clientX)}
      onPointerUp={(event) => {
        const start = swipe.current;
        swipe.current = null;
        if (start === null || event.pointerType === "mouse") return;
        const distance = event.clientX - start;
        if (Math.abs(distance) > 48) go(distance < 0 ? 1 : -1);
      }}
      className="testimonial-stage touch-pan-y"
    >
      <div aria-live="polite">
        <figure
          key={item.id}
          role="group"
          aria-roledescription="slide"
          aria-label={copy.position(view.index + 1, total)}
          data-leaving={view.leaving || undefined}
          data-direction={view.direction}
          className="testimonial-slide"
        >
          <blockquote>
            <p className="testimonial-quote">{item.quote[locale]}</p>
          </blockquote>
          <figcaption className="mt-8 grid gap-1 border-t border-line pt-6">
            <span className="text-[1.0625rem] font-semibold text-ink">{item.person.name}</span>
            <span className="text-ink-muted">{item.person.role[locale]}</span>
            <span className="mt-2 text-[0.9375rem] text-ink-muted">
              <span className="font-semibold text-ink">{copy.project}: </span>
              {item.context[locale]}
            </span>
            {item.permission.date && (
              <span className="text-sm text-ink-muted">
                {copy.permission(formatDate(item.permission.date, locale))}
              </span>
            )}
          </figcaption>
        </figure>
      </div>

      {total > 1 && (
        <div className="mt-10 flex items-center gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={copy.previous}
            className="btn btn-secondary size-12 p-0"
          >
            <ArrowLeft aria-hidden weight="bold" className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={copy.next}
            className="btn btn-secondary size-12 p-0"
          >
            <ArrowRight aria-hidden weight="bold" className="size-4" />
          </button>
          <p aria-hidden className="ml-2 text-sm font-semibold text-ink-muted tabular-nums">
            {view.index + 1} / {total}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Honest empty state while no client has approved a testimonial: it says so,
 * and shows what every published story will carry, as empty dashed slots.
 */
function StoriesPledge({ headingId }: { headingId: string }) {
  const { t } = useI18n();
  const copy = t.testimonials;
  return (
    <div className="lg:col-span-7 lg:col-start-6">
      <h2 id={headingId} className="max-w-[16ch] text-title">
        {copy.title}
      </h2>
      <p className="mt-6 measure text-lede text-ink-muted">{copy.lede}</p>
      <p className="mt-12 font-semibold text-ink">{copy.includesTitle}</p>
      <ul className="mt-4 border-t border-line">
        {copy.includes.map((line) => (
          <li
            key={line}
            data-reveal
            className="flex items-center gap-5 border-b border-line py-4 text-ink-muted"
          >
            <span aria-hidden className="testimonial-slot" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Home page "client stories" slot. With approved testimonials it shows them;
 * until then it shows the pledge. Either way it never emits Review or
 * AggregateRating structured data.
 */
export function TestimonialSection() {
  const { locale } = useI18n();
  const scope = useRef<HTMLElement>(null);
  const headingId = useId();
  const published = getPublishedTestimonials();

  // The two capsules of the quotation mark slide together along their axis.
  useMotion(
    ({ gsap, ScrollTrigger }) => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        const capsules = gsap.utils.toArray<SVGGElement>("[data-quote-capsule]");
        if (capsules.length === 0) return;
        gsap.set(capsules, {
          opacity: 0,
          x: (i: number) => (i ? 26 : -26),
          y: (i: number) => (i ? -17 : 17),
        });
        ScrollTrigger.create({
          trigger: scope.current,
          start: "top 75%",
          once: true,
          onEnter: () =>
            gsap.to(capsules, { opacity: 1, x: 0, y: 0, duration: 1.1, stagger: 0.12 }),
        });
        const rows = gsap.utils.toArray<HTMLElement>("[data-reveal]");
        const below = rows.filter((row) => row.getBoundingClientRect().top > window.innerHeight);
        if (below.length === 0) return;
        gsap.set(below, { opacity: 0, x: -16 });
        ScrollTrigger.batch(below, {
          start: "top 90%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, x: 0, duration: 0.8, stagger: 0.08 }),
        });
      });
    },
    { scope },
  );

  return (
    <section
      ref={scope}
      aria-labelledby={headingId}
      className="border-t border-line py-[var(--spacing-section)]"
    >
      <div className="shell grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <QuoteMark className="w-28 sm:w-32 lg:sticky lg:top-32 lg:w-44" />
        </div>
        {published.length > 0 ? (
          <div className="lg:col-span-7 lg:col-start-6">
            <TestimonialHeading id={headingId} />
            <div className="mt-12">
              <TestimonialQuotes items={published} locale={locale} headingId={headingId} />
            </div>
          </div>
        ) : (
          <StoriesPledge headingId={headingId} />
        )}
      </div>
    </section>
  );
}

function TestimonialHeading({ id }: { id: string }) {
  const { t } = useI18n();
  return (
    <h2 id={id} className="max-w-[16ch] text-title">
      {t.testimonials.regionLabel}
    </h2>
  );
}
