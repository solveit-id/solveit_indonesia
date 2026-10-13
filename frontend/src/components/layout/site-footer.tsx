import { useRef } from "react";
import { Link, useLocation } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { BrandMark } from "~/components/brand/brand-mark";
import { Logo } from "~/components/brand/logo";
import { InstagramLink } from "~/components/contact/instagram-link";
import { WhatsAppMenu } from "~/components/contact/whatsapp-contacts";
import { rememberLocale } from "~/components/layout/language-switch";
import { company } from "~/data/company";
import { sitemapNav } from "~/data/navigation";
import { localeMeta, locales, useI18n } from "~/i18n";
import { alternatePath } from "~/i18n/paths";
import { motionQueries, useMotion } from "~/lib/motion";
import { getServices } from "~/services/content";

interface SiteFooterProps {
  /** The closing call to action is skipped on the contact page itself. */
  showCta: boolean;
}

export function SiteFooter({ showCta }: SiteFooterProps) {
  const ref = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const { t, locale, path } = useI18n();

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
        // The closing band (and its mark) is absent on the contact page.
        if (!showCta) return;
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
    { scope: ref, dependencies: [showCta] },
  );

  return (
    <footer ref={ref} id="site-footer" className="relative overflow-x-clip">
      <div data-footer-field className="bg-field text-field-ink">
        {showCta && (
          <section
            aria-labelledby="footer-cta"
            className="relative shell pt-[var(--spacing-section)] pb-20"
          >
            <div className="grid items-end gap-12 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <h2 id="footer-cta" className="max-w-[16ch] text-title">
                  {t.footer.ctaTitle}
                </h2>
                <p className="mt-6 measure text-lede text-field-ink-muted">{t.footer.ctaLede}</p>
                <div className="mt-10 flex flex-wrap gap-3">
                  <Link to={path("contact")} className="btn btn-on-field">
                    {t.common.consult}
                    <ArrowRight aria-hidden className="btn-icon size-4" weight="bold" />
                  </Link>
                  <WhatsAppMenu tone="field" placement="top" />
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
              <p lang="en" className="max-w-[34ch] text-[0.95rem] text-field-ink-muted">
                {company.tagline}
              </p>
            </div>

            <nav aria-label={t.nav.footer} className="lg:col-span-2">
              <h2 className="text-sm font-semibold tracking-normal text-field-ink-muted">
                {t.footer.explore}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {sitemapNav.map((key) => (
                  <li key={key}>
                    <Link to={path(key)} className="link-sweep">
                      {t.nav.labels[key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="lg:col-span-3">
              <h2 className="text-sm font-semibold tracking-normal text-field-ink-muted">
                {t.footer.services}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {getServices(locale).map((service) => (
                  <li key={service.id}>
                    <Link to={`${path("services")}#${service.id}`} className="link-sweep">
                      {service.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-3">
              <h2 className="text-sm font-semibold tracking-normal text-field-ink-muted">
                {t.footer.contact}
              </h2>
              <ul className="mt-4 flex flex-col items-start gap-2.5">
                <li>
                  <a href={`mailto:${company.email}`} className="link-sweep break-all">
                    {company.email}
                  </a>
                </li>
                <li>
                  <WhatsAppMenu tone="link" placement="top" />
                </li>
                <li>
                  <InstagramLink />
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom padding keeps the last line clear of the floating controls. */}
          <div className="flex flex-col gap-4 border-t border-field-line pt-6 pb-24 text-sm text-field-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {company.name}
            </p>
            <nav aria-label={t.footer.languages}>
              <ul className="flex items-center gap-4">
                {locales.map((option) => (
                  <li key={option}>
                    <Link
                      to={alternatePath(pathname, option)}
                      hrefLang={localeMeta[option].htmlLang}
                      lang={localeMeta[option].htmlLang}
                      aria-current={option === locale ? "true" : undefined}
                      onClick={() => rememberLocale(option)}
                      className="link-sweep aria-[current=true]:text-field-ink"
                    >
                      {localeMeta[option].name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
