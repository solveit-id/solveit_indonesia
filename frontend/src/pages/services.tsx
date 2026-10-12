import { useRef } from "react";
import { Link } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { FaqList } from "~/components/ui/faq-list";
import { PageIntro } from "~/components/ui/page-intro";
import { contactNav } from "~/data/navigation";
import { services, serviceFaq } from "~/data/services";
import { useReveal } from "~/hooks/use-reveal";
import { buildMeta, faqSchema, serviceSchemas } from "~/lib/seo";
import type { Route } from "./+types/services";

export const meta: Route.MetaFunction = () =>
  buildMeta({
    title: "Layanan Pembuatan Website, Aplikasi Web, dan Custom Software",
    description:
      "Jasa pembuatan website, aplikasi web, sistem informasi, custom software, serta dukungan teknis dan pemeliharaan dari Solveit Indonesia.",
    path: "/layanan",
    breadcrumbs: [{ name: "Layanan", path: "/layanan" }],
    jsonLd: [...serviceSchemas(services), faqSchema(serviceFaq)],
  });

export default function Services() {
  const scope = useRef<HTMLDivElement>(null);
  useReveal(scope);

  return (
    <div ref={scope}>
      <PageIntro
        breadcrumbs={[{ name: "Layanan" }]}
        title="Layanan pengembangan software untuk bisnis Indonesia."
        lede={
          <p>
            Solveit Indonesia menyediakan lima layanan: pengembangan website, aplikasi web, sistem
            informasi, custom software, serta dukungan teknis dan pemeliharaan. Semuanya dikerjakan
            oleh tim yang sama, dari konsultasi sampai sistem dipakai.
          </p>
        }
      >
        <nav aria-label="Daftar layanan" className="enter mt-10 [--enter-index:3]">
          <ul className="flex flex-wrap gap-2">
            {services.map((service) => (
              <li key={service.id}>
                <a
                  href={`#${service.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-[0.95rem] font-medium no-underline transition-colors hover:border-ink"
                >
                  {service.shortName}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageIntro>

      <div className="border-t border-line">
        {services.map((service) => (
          <section
            key={service.id}
            id={service.id}
            aria-labelledby={`${service.id}-title`}
            className="border-b border-line py-[clamp(4rem,8vw,7rem)]"
          >
            <div className="shell grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <div className="lg:sticky lg:top-28">
                  <h2
                    id={`${service.id}-title`}
                    data-reveal
                    className="max-w-[13ch] text-title font-wide"
                  >
                    {service.name}
                  </h2>
                  <p data-reveal className="mt-6 max-w-[42ch] text-lede text-ink-muted">
                    {service.summary}
                  </p>
                </div>
              </div>
              <div className="grid gap-10 lg:col-span-6 lg:col-start-7 lg:pt-3">
                <div data-reveal>
                  <h3 className="text-lg font-semibold">Cocok untuk</h3>
                  <p className="mt-3 text-ink-muted">{service.forWhom}</p>
                </div>
                <div data-reveal>
                  <h3 className="text-lg font-semibold">Yang Anda terima</h3>
                  <ul className="mt-4 grid gap-3">
                    {service.deliverables.map((item) => (
                      <li key={item} className="flex gap-3">
                        <Check
                          aria-hidden
                          weight="bold"
                          className="mt-1 size-4 shrink-0 text-accent-text"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div data-reveal>
                  <h3 className="text-lg font-semibold">Contoh pekerjaan</h3>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {service.examples.map((example) => (
                      <li
                        key={example}
                        className="rounded-full bg-paper-sunken px-3.5 py-1.5 text-sm font-medium"
                      >
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
                <div data-reveal>
                  <Link
                    to={`${contactNav.to}?layanan=${service.id}`}
                    className="inline-flex items-center gap-2 link-sweep font-semibold text-accent-text"
                  >
                    Konsultasikan {service.shortName.toLowerCase()}
                    <ArrowRight aria-hidden className="size-4" weight="bold" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section
        aria-labelledby="services-faq"
        className="shell grid gap-10 py-[var(--spacing-section)] lg:grid-cols-12"
      >
        <h2 id="services-faq" data-reveal className="max-w-[12ch] text-title lg:col-span-4">
          Pertanyaan yang sering muncul.
        </h2>
        <div data-reveal className="lg:col-span-7 lg:col-start-6">
          <FaqList items={serviceFaq} />
        </div>
      </section>
    </div>
  );
}
