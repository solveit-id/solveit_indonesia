import { useRef } from "react";
import { Form, Link } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { BrandMark } from "~/components/brand/brand-mark";
import { contactNav } from "~/data/navigation";
import { services } from "~/data/services";
import { isLiteDevice } from "~/lib/device";
import { motionQueries, useMotion } from "~/lib/motion";

// Unit vector along the logo's capsule axis (33deg, rising to the right).
const AXIS = { x: Math.cos((33 * Math.PI) / 180), y: -Math.sin((33 * Math.PI) / 180) };
// Each capsule slides in along its own axis, alternating sides.
const ASSEMBLY = [190, -230, 240, -200];

const pickable = services.filter((service) => service.id !== "dukungan-teknis");

export function Hero() {
  const scope = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useMotion(
    ({ gsap }) => {
      const mm = gsap.matchMedia();
      mm.add(
        { motion: motionQueries.motion, finePointer: motionQueries.finePointer },
        (context) => {
          const { motion, finePointer } = context.conditions as Record<string, boolean>;
          if (!motion) return;
          const capsules = gsap.utils.toArray<SVGPathElement>("[data-capsule]");
          gsap.set("[data-hero-stage]", { opacity: 1 });

          gsap
            .timeline({ delay: 0.15 })
            .from("[data-lattice]", { autoAlpha: 0, scale: 0.94, duration: 1.6 }, 0)
            .from(
              capsules,
              {
                x: (index: number) => (ASSEMBLY[index] ?? 0) * AXIS.x,
                y: (index: number) => (ASSEMBLY[index] ?? 0) * AXIS.y,
                autoAlpha: 0,
                duration: 1.5,
                stagger: 0.11,
                ease: "expo.out",
              },
              0.1,
            )
            .from("[data-stage-caption]", { autoAlpha: 0, y: 12, duration: 0.8 }, 1.1);

          // Pieces drift apart a little as the hero leaves: the solution is
          // made of parts, which the rest of the page explains. Percent-based
          // offsets compose with the x/y assembly instead of fighting it.
          gsap.to(capsules, {
            xPercent: (index: number) => (index % 2 ? -1 : 1) * 12 * AXIS.x,
            yPercent: (index: number) => (index % 2 ? -1 : 1) * 12 * AXIS.y,
            ease: "none",
            scrollTrigger: {
              trigger: scope.current,
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          });

          if (!finePointer || isLiteDevice() || !stage.current) return;
          const layers = gsap.utils.toArray<HTMLElement>("[data-depth]");
          const movers = layers.map((layer) => ({
            x: gsap.quickTo(layer, "x", { duration: 0.9, ease: "power3.out" }),
            y: gsap.quickTo(layer, "y", { duration: 0.9, ease: "power3.out" }),
            depth: Number(layer.dataset.depth),
          }));
          const onMove = (event: PointerEvent) => {
            const nx = event.clientX / window.innerWidth - 0.5;
            const ny = event.clientY / window.innerHeight - 0.5;
            for (const mover of movers) {
              mover.x(nx * mover.depth);
              mover.y(ny * mover.depth);
            }
          };
          window.addEventListener("pointermove", onMove, { passive: true });
          return () => window.removeEventListener("pointermove", onMove);
        },
      );
    },
    { scope },
  );

  return (
    <section
      ref={scope}
      aria-labelledby="hero-title"
      className="relative overflow-hidden pt-[4.5rem]"
    >
      <div className="shell grid min-h-[calc(100dvh-4.5rem)] items-center gap-y-10 py-10 lg:grid-cols-12 lg:gap-x-10 lg:py-16">
        <div className="relative z-10 lg:col-span-7">
          <h1
            id="hero-title"
            className="enter max-w-[15ch] text-display font-wide [--enter-index:0]"
          >
            Solusi digital yang dibangun untuk <span className="text-accent-text">bertahan.</span>
          </h1>
          <p className="enter mt-6 measure text-lede text-ink-muted [--enter-index:1] md:mt-8">
            Solveit Indonesia merancang website, aplikasi web, sistem informasi, dan custom software
            untuk bisnis yang ingin tumbuh dengan rapi.
          </p>

          <Form
            method="get"
            action={contactNav.to}
            className="enter mt-9 [--enter-index:2] md:mt-11"
          >
            <fieldset>
              <legend className="text-[0.95rem] font-semibold text-ink">
                Apa yang ingin Anda bangun?
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {pickable.map((service, index) => (
                  <label key={service.id} className="choice">
                    <input
                      type="radio"
                      name="layanan"
                      value={service.id}
                      defaultChecked={index === 0}
                    />
                    <span>{service.shortName}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
              <button type="submit" className="btn btn-primary">
                {contactNav.label}
                <ArrowRight aria-hidden className="btn-icon size-4" weight="bold" />
              </button>
              <Link to="/portofolio" className="link-sweep font-semibold text-ink">
                Lihat portofolio
              </Link>
            </div>
          </Form>
        </div>

        <div
          ref={stage}
          data-hero-stage
          className="relative order-first mx-auto w-[min(44vw,11rem)] lg:order-none lg:col-span-5 lg:w-full lg:max-w-[30rem]"
        >
          <div data-lattice data-depth="8" aria-hidden className="absolute -inset-[18%] opacity-75">
            <Lattice />
          </div>
          <div data-depth="26" className="relative">
            <BrandMark
              className="w-full"
              title="Ikon Solveit: empat kapsul yang membentuk huruf S"
            />
          </div>
          <p data-stage-caption className="mt-6 hidden text-center text-sm text-ink-muted lg:block">
            Empat bagian, satu solusi.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Faint precision grid of capsule outlines on the logo's 33deg axis. */
function Lattice() {
  const cells: { x: number; y: number }[] = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) cells.push({ x: col * 96 + (row % 2) * 48, y: row * 64 });
  }
  return (
    <svg viewBox="-40 -40 520 470" className="h-full w-full" focusable="false">
      {cells.map((cell, index) => (
        <rect
          key={index}
          x={cell.x - 34}
          y={cell.y - 11}
          width={68}
          height={22}
          rx={11}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth={1}
          transform={`rotate(-33 ${cell.x} ${cell.y})`}
        />
      ))}
    </svg>
  );
}
