import { useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { services } from "~/data/services";
import { useReveal } from "~/hooks/use-reveal";
import { cn } from "~/lib/cn";
import { motionQueries, useMotion } from "~/lib/motion";

/**
 * Index and preview: a typographic list of services; pointing at (or focusing)
 * a row brings its detail into the sticky preview on large screens.
 */
export function ServiceIndex() {
  const scope = useRef<HTMLElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const current = services[active]!;

  useReveal(scope);

  useMotion(
    ({ gsap }) => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        gsap.from("[data-preview-item]", { autoAlpha: 0, y: 14, stagger: 0.05, duration: 0.6 });
      });
    },
    { scope: preview, dependencies: [active] },
  );

  return (
    <section
      ref={scope}
      aria-labelledby="services-title"
      className="border-t border-line py-[var(--spacing-section)]"
    >
      <div className="shell">
        <h2 id="services-title" data-reveal className="max-w-[18ch] text-title">
          Satu tim untuk website sampai sistem yang kompleks.
        </h2>

        <div className="mt-14 grid gap-12 lg:mt-20 lg:grid-cols-12">
          <ol className="lg:col-span-7">
            {services.map((service, index) => (
              <li key={service.id} data-reveal className="border-t border-line last:border-b">
                <Link
                  to={`/layanan#${service.id}`}
                  onPointerEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  className="group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 py-6 no-underline md:py-7"
                >
                  <span
                    className={cn(
                      "text-heading font-bold tracking-[-0.03em] font-wide transition-colors duration-300",
                      active === index ? "text-ink" : "text-ink-muted lg:text-ink-faint",
                      "group-hover:text-ink",
                    )}
                  >
                    {service.name}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-11 place-items-center rounded-full border transition-[background-color,border-color,color,transform] duration-500 ease-[var(--ease-out-expo)]",
                      active === index
                        ? "rotate-0 border-accent bg-accent text-accent-ink"
                        : "-rotate-45 border-line-strong text-ink",
                    )}
                  >
                    <ArrowUpRight className="size-4" weight="bold" />
                  </span>
                  <span className="col-span-2 max-w-[56ch] text-[0.98rem] text-ink-muted lg:hidden">
                    {service.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          <div className="hidden lg:col-span-5 lg:block">
            <div
              ref={preview}
              aria-live="polite"
              className="sticky top-28 rounded-[var(--radius-panel)] border border-line bg-paper-raised p-9"
            >
              <p data-preview-item className="text-lede text-ink">
                {current.summary}
              </p>
              <p data-preview-item className="mt-6 text-[0.98rem] text-ink-muted">
                {current.forWhom}
              </p>
              <ul data-preview-item className="mt-8 flex flex-wrap gap-2" aria-label="Contoh">
                {current.examples.map((example) => (
                  <li
                    key={example}
                    className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm font-medium"
                  >
                    {example}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
