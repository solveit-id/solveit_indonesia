import { useRef } from "react";
import { Link } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { BrandMark } from "~/components/brand/brand-mark";
import { Logo } from "~/components/brand/logo";
import { company } from "~/data/company";
import { contactNav, primaryNav } from "~/data/navigation";
import { services } from "~/data/services";
import { motionQueries, useMotion } from "~/lib/motion";
import { whatsappUrl } from "~/services/inquiry";

interface SiteFooterProps {
  /** The closing call to action is skipped on the contact page itself. */
  showCta: boolean;
}

export function SiteFooter({ showCta }: SiteFooterProps) {
  const ref = useRef<HTMLElement>(null);

  // The field rises over the page as it arrives: one clip-path wipe at the
  // logo's 33deg angle marks the hand-off from content to conversation.
  useMotion(
    ({ gsap }) => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.motion, () => {
        gsap.fromTo(
          "[data-footer-field]",
          { clipPath: "polygon(0% 18%, 100% 0%, 100% 100%, 0% 100%)" },
          {
            clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
            ease: "none",
            scrollTrigger: {
              trigger: ref.current,
              start: "top bottom",
              end: "top 35%",
              scrub: true,
            },
          },
        );
        gsap.from("[data-footer-mark] [data-capsule]", {
          x: (index: number) => [-60, -30, 40, 70][index] ?? 0,
          y: (index: number) => [-50, 40, -30, 60][index] ?? 0,
          autoAlpha: 0,
          stagger: 0.07,
          duration: 1.2,
          scrollTrigger: { trigger: "[data-footer-mark]", start: "top 85%", once: true },
        });
      });
    },
    { scope: ref },
  );

  return (
    <footer ref={ref} id="site-footer" className="relative">
      <div data-footer-field className="bg-field text-field-ink">
        {showCta && (
          <section
            aria-labelledby="footer-cta"
            className="relative shell overflow-hidden pt-[var(--spacing-section)] pb-20"
          >
            <div className="grid items-end gap-12 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <h2 id="footer-cta" className="max-w-[16ch] text-title">
                  Punya proses yang ingin dirapikan? Ceritakan ke kami.
                </h2>
                <p className="mt-6 measure text-lede text-field-ink-muted">
                  Konsultasi awal membantu memetakan kebutuhan, prioritas, dan langkah pertama yang
                  paling masuk akal untuk bisnis Anda.
                </p>
                <div className="mt-10 flex flex-wrap gap-3">
                  <Link to={contactNav.to} className="btn btn-on-field">
                    {contactNav.label}
                    <ArrowRight aria-hidden className="btn-icon size-4" weight="bold" />
                  </Link>
                </div>
              </div>
              <div data-footer-mark className="hidden justify-end lg:col-span-4 lg:flex">
                <BrandMark className="w-56 text-field-ink [&_path]:fill-current" />
              </div>
            </div>
          </section>
        )}

        <div className={showCta ? "shell" : "shell pt-20"}>
          <div className="grid gap-12 border-t border-field-line py-14 md:grid-cols-2 lg:grid-cols-12">
            <div className="flex flex-col gap-5 lg:col-span-4">
              <Logo variant="mono" className="w-40 text-field-ink" />
              <p className="max-w-[34ch] text-[0.95rem] text-field-ink-muted">{company.tagline}</p>
            </div>

            <nav aria-label="Navigasi kaki halaman" className="lg:col-span-2">
              <h2 className="text-sm font-semibold tracking-normal text-field-ink-muted">
                Jelajahi
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {[
                  { label: "Beranda", to: "/" },
                  ...primaryNav,
                  { label: "Kontak", to: "/kontak" },
                ].map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="link-sweep">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="lg:col-span-3">
              <h2 className="text-sm font-semibold tracking-normal text-field-ink-muted">
                Layanan
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {services.map((service) => (
                  <li key={service.id}>
                    <Link to={`/layanan#${service.id}`} className="link-sweep">
                      {service.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-3">
              <h2 className="text-sm font-semibold tracking-normal text-field-ink-muted">Kontak</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                <li>
                  <a href={`mailto:${company.email}`} className="link-sweep break-all">
                    {company.email}
                  </a>
                </li>
                {company.whatsapp.map((number) => (
                  <li key={number.e164}>
                    <a
                      href={whatsappUrl(number.e164)}
                      className="inline-flex items-center gap-1.5 link-sweep"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp {number.display}
                      <ArrowUpRight aria-hidden className="size-3.5" />
                      <span className="sr-only">(membuka tab baru)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-field-line py-6 text-sm text-field-ink-muted">
            <p>
              © {new Date().getFullYear()} {company.name}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
