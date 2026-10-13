import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { InquiryForm } from "~/components/contact/inquiry-form";
import { InstagramLink } from "~/components/contact/instagram-link";
import { WhatsAppList } from "~/components/contact/whatsapp-contacts";
import { PageIntro } from "~/components/ui/page-intro";
import { company } from "~/data/company";
import { getMessages, localeFromPath, pathFor, useI18n } from "~/i18n";
import { buildMeta, organizationSchema } from "~/lib/seo";
import type { Route } from "./+types/contact";

export const meta: Route.MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const t = getMessages(locale);
  return buildMeta({
    locale,
    title: t.meta.contactTitle,
    description: t.meta.contactDescription,
    path: pathFor("contact", locale),
    breadcrumbs: [{ name: t.nav.labels.contact, path: pathFor("contact", locale) }],
    jsonLd: [organizationSchema(locale)],
  });
};

export default function Contact() {
  const { t } = useI18n();
  const copy = t.contact;

  return (
    <>
      <PageIntro
        breadcrumbs={[{ name: t.nav.labels.contact }]}
        title={copy.title}
        lede={<p>{copy.lede}</p>}
      />

      <div className="shell grid gap-x-16 gap-y-20 pb-[var(--spacing-section)] lg:grid-cols-12">
        <section aria-labelledby="form-title" className="min-w-0 lg:col-span-7">
          <h2 id="form-title" className="text-heading font-wide">
            {copy.formTitle}
          </h2>
          <div className="mt-6">
            <noscript>
              <p className="mb-8 rounded-[var(--radius-field)] border border-line-strong p-5">
                {copy.noscript}
              </p>
            </noscript>
            <InquiryForm />
          </div>
        </section>

        <aside aria-labelledby="direct-title" className="lg:col-span-4 lg:col-start-9">
          <div className="grid gap-12 lg:sticky lg:top-28">
            <div>
              <h2 id="direct-title" className="text-heading font-wide">
                {copy.directTitle}
              </h2>
              <div className="mt-6 grid gap-3">
                <WhatsAppList />
                <a href={`mailto:${company.email}`} className="contact-card group/card">
                  <EnvelopeSimple
                    aria-hidden
                    weight="bold"
                    className="size-5 shrink-0 text-accent-text"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm text-ink-muted">{copy.email}</span>
                    <span className="font-semibold break-all">{company.email}</span>
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    weight="bold"
                    className="ml-auto size-4 shrink-0 text-ink-muted transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5"
                  />
                </a>
                <InstagramLink variant="card" />
              </div>
            </div>
            <div>
              <h2 className="text-heading font-wide">{copy.nextTitle}</h2>
              <ol className="mt-6 grid gap-5">
                {copy.nextSteps.map((step, index) => (
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
