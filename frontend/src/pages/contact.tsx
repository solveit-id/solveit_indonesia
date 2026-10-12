import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { InquiryForm } from "~/components/contact/inquiry-form";
import { PageIntro } from "~/components/ui/page-intro";
import { company } from "~/data/company";
import { buildMeta, organizationSchema } from "~/lib/seo";
import { whatsappUrl } from "~/services/inquiry";
import type { Route } from "./+types/contact";

export const meta: Route.MetaFunction = () =>
  buildMeta({
    title: "Kontak dan Konsultasi",
    description:
      "Mulai konsultasi dengan Solveit Indonesia untuk website, aplikasi web, sistem informasi, atau custom software. Hubungi kami lewat WhatsApp atau email.",
    path: "/kontak",
    breadcrumbs: [{ name: "Kontak", path: "/kontak" }],
    jsonLd: [organizationSchema()],
  });

const nextSteps = [
  "Kami membaca kebutuhan Anda dan membalas lewat kanal yang Anda pilih.",
  "Kita menjadwalkan sesi konsultasi untuk memperjelas tujuan dan batasan.",
  "Anda menerima ringkasan kebutuhan dan rekomendasi langkah pertama.",
];

export default function Contact() {
  return (
    <>
      <PageIntro
        breadcrumbs={[{ name: "Kontak" }]}
        title="Mulai konsultasi."
        lede={
          <p>
            Ceritakan kebutuhan Anda melalui formulir di bawah, atau hubungi kami langsung lewat
            WhatsApp dan email. Konsultasi awal membantu menentukan apakah website, aplikasi web,
            sistem informasi, atau custom software yang paling tepat.
          </p>
        }
      />

      <div className="shell grid gap-16 pb-[var(--spacing-section)] lg:grid-cols-12">
        <section aria-labelledby="form-title" className="lg:col-span-7">
          <h2 id="form-title" className="text-heading font-wide">
            Formulir permintaan proyek
          </h2>
          <div className="mt-8">
            <noscript>
              <p className="mb-8 rounded-[var(--radius-field)] border border-line-strong p-5">
                Formulir ini membutuhkan JavaScript untuk menyusun pesan. Anda tetap bisa
                menghubungi kami langsung lewat email atau WhatsApp di samping.
              </p>
            </noscript>
            <InquiryForm />
          </div>
        </section>

        <aside aria-label="Kontak langsung" className="lg:col-span-4 lg:col-start-9">
          <div className="grid gap-10 lg:sticky lg:top-28">
            <div>
              <h2 className="text-heading font-wide">Kontak langsung</h2>
              <ul className="mt-6 grid gap-3">
                <li>
                  <a
                    href={`mailto:${company.email}`}
                    className="flex flex-col rounded-[var(--radius-field)] border border-line p-5 no-underline transition-colors hover:border-ink"
                  >
                    <span className="text-sm text-ink-muted">Email</span>
                    <span className="mt-1 font-semibold break-all">{company.email}</span>
                  </a>
                </li>
                {company.whatsapp.map((number) => (
                  <li key={number.e164}>
                    <a
                      href={whatsappUrl(number.e164)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-4 rounded-[var(--radius-field)] border border-line p-5 no-underline transition-colors hover:border-ink"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm text-ink-muted">WhatsApp</span>
                        <span className="mt-1 font-semibold">{number.display}</span>
                      </span>
                      <ArrowUpRight aria-hidden className="size-4 shrink-0" />
                      <span className="sr-only">(membuka tab baru)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-heading font-wide">Setelah Anda menghubungi kami</h2>
              <ol className="mt-6 grid gap-5">
                {nextSteps.map((step, index) => (
                  <li key={step} className="grid grid-cols-[2.25rem_1fr] gap-4">
                    <span
                      aria-hidden
                      className="grid size-9 place-items-center rounded-full bg-paper-sunken text-sm font-bold"
                    >
                      {index + 1}
                    </span>
                    <span className="pt-1.5 text-ink-muted">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
