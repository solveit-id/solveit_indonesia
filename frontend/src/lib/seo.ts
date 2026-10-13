import type { MetaDescriptor } from "react-router";
import { absoluteUrl, siteConfig } from "~/config/site";
import { company } from "~/data/company";
import { defaultLocale, type Locale, localeMeta, locales, pathFor } from "~/i18n/config";
import { getMessages } from "~/i18n";
import { alternatesFor } from "~/i18n/paths";
import type { FaqItem, Project, Service } from "~/types/content";

type JsonLd = Record<string, unknown>;

export interface PageSeo {
  locale: Locale;
  /** Page-specific title; the brand suffix is added automatically. */
  title: string;
  description: string;
  path: string;
  /** Use the full title verbatim (home page). */
  absoluteTitle?: boolean;
  noindex?: boolean;
  ogType?: "website" | "article";
  breadcrumbs?: { name: string; path: string }[];
  jsonLd?: JsonLd[];
}

export const formatTitle = (seo: Pick<PageSeo, "title" | "absoluteTitle">): string =>
  seo.absoluteTitle ? seo.title : `${seo.title} | ${company.name}`;

/** Removes `undefined` keys so JSON-LD never carries empty properties. */
const compact = (value: JsonLd): JsonLd =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

const organizationId = () =>
  siteConfig.siteUrl ? `${siteConfig.siteUrl}/#organization` : undefined;

const organizationRef = () =>
  organizationId() ? { "@id": organizationId() } : { "@type": "Organization", name: company.name };

const formatTelephone = (e164: string) =>
  `+${e164.slice(0, 2)}-${e164.slice(2, 5)}-${e164.slice(5, 9)}-${e164.slice(9)}`;

export const organizationSchema = (locale: Locale = defaultLocale): JsonLd =>
  compact({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId(),
    name: company.name,
    url: absoluteUrl(pathFor("home", locale)) ?? undefined,
    logo: absoluteUrl("/brand/logo-solveit-primary.svg") ?? undefined,
    description: getMessages(locale).company.description,
    slogan: company.tagline,
    email: company.email,
    sameAs: [company.instagram.url],
    areaServed: { "@type": "Country", name: company.areaServed },
    knowsLanguage: locales.map((item) => localeMeta[item].schemaLang),
    contactPoint: company.whatsapp.map((number) => ({
      "@type": "ContactPoint",
      telephone: formatTelephone(number.e164),
      email: company.email,
      contactType: "customer service",
      areaServed: "ID",
      availableLanguage: ["Indonesian", "English"],
    })),
  });

export const websiteSchema = (locale: Locale = defaultLocale): JsonLd =>
  compact({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: company.name,
    url: absoluteUrl(pathFor("home", locale)) ?? undefined,
    inLanguage: localeMeta[locale].schemaLang,
    publisher: organizationRef(),
  });

export const serviceSchemas = (items: Service[], locale: Locale = defaultLocale): JsonLd[] =>
  items.map((service) =>
    compact({
      "@context": "https://schema.org",
      "@type": "Service",
      name: service.name,
      serviceType: service.name,
      description: service.summary,
      url: absoluteUrl(`${pathFor("services", locale)}#${service.id}`) ?? undefined,
      areaServed: { "@type": "Country", name: company.areaServed },
      provider: organizationRef(),
    }),
  );

export const faqSchema = (items: FaqItem[], locale: Locale = defaultLocale): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  inLanguage: localeMeta[locale].schemaLang,
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
});

/** Structured data is only published for real work, never for demo concepts. */
export const creativeWorkSchema = (
  project: Project,
  locale: Locale = defaultLocale,
): JsonLd | null => {
  if (project.isDemo) return null;
  return compact({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    abstract: project.summary,
    inLanguage: localeMeta[locale].schemaLang,
    url: absoluteUrl(`${pathFor("portfolio", locale)}/${project.slug}`) ?? undefined,
    dateCreated: project.year ? String(project.year) : undefined,
    creator: { "@type": "Organization", name: company.name },
    keywords: project.technologies.join(", "),
  });
};

/** BreadcrumbList needs absolute item URLs, so it is emitted only with a domain. */
const breadcrumbSchema = (
  items: { name: string; path: string }[],
  locale: Locale,
): JsonLd | null => {
  if (!siteConfig.siteUrl) return null;
  const home = { name: getMessages(locale).nav.labels.home, path: pathFor("home", locale) };
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [home, ...items].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
};

export const buildMeta = (seo: PageSeo): MetaDescriptor[] => {
  const title = formatTitle(seo);
  const canonical = absoluteUrl(seo.path);
  const image = absoluteUrl(siteConfig.defaultOgImage);
  const { ogLocale } = localeMeta[seo.locale];

  const meta: MetaDescriptor[] = [
    { title },
    { name: "description", content: seo.description },
    { property: "og:site_name", content: company.name },
    { property: "og:locale", content: ogLocale },
    ...locales
      .filter((locale) => locale !== seo.locale)
      .map((locale) => ({ property: "og:locale:alternate", content: localeMeta[locale].ogLocale })),
    { property: "og:type", content: seo.ogType ?? "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: seo.description },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: seo.description },
  ];

  if (seo.noindex) meta.push({ name: "robots", content: "noindex, follow" });
  if (canonical && !seo.noindex) {
    // Self-referencing canonical per language, plus reciprocal hreflang for
    // every translation and x-default pointing at the Indonesian original.
    meta.push({ tagName: "link", rel: "canonical", href: canonical });
    meta.push({ property: "og:url", content: canonical });
    const alternates = alternatesFor(seo.path);
    if (alternates) {
      for (const locale of locales) {
        meta.push({
          tagName: "link",
          rel: "alternate",
          hrefLang: localeMeta[locale].htmlLang,
          href: absoluteUrl(alternates[locale]),
        });
      }
      meta.push({
        tagName: "link",
        rel: "alternate",
        hrefLang: "x-default",
        href: absoluteUrl(alternates[defaultLocale]),
      });
    }
  }
  if (image) {
    meta.push(
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: getMessages(seo.locale).meta.ogImageAlt },
      { name: "twitter:image", content: image },
    );
  }
  if (siteConfig.googleSiteVerification && seo.path === pathFor("home", seo.locale)) {
    meta.push({ name: "google-site-verification", content: siteConfig.googleSiteVerification });
  }

  const schemas = [...(seo.jsonLd ?? [])];
  const breadcrumbs = seo.breadcrumbs ? breadcrumbSchema(seo.breadcrumbs, seo.locale) : null;
  if (breadcrumbs) schemas.push(breadcrumbs);
  for (const schema of schemas) meta.push({ "script:ld+json": schema });

  return meta;
};
