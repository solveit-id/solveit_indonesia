import type { MetaDescriptor } from "react-router";
import { absoluteUrl, siteConfig } from "~/config/site";
import { company } from "~/data/company";
import type { FaqItem, Project, Service } from "~/types/content";

type JsonLd = Record<string, unknown>;

export interface PageSeo {
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

const formatTelephone = (e164: string) =>
  `+${e164.slice(0, 2)}-${e164.slice(2, 5)}-${e164.slice(5, 9)}-${e164.slice(9)}`;

export const organizationSchema = (): JsonLd =>
  compact({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId(),
    name: company.name,
    url: absoluteUrl("/") ?? undefined,
    logo: absoluteUrl("/brand/logo-solveit-primary.svg") ?? undefined,
    description: company.description,
    slogan: company.tagline,
    email: company.email,
    areaServed: { "@type": "Country", name: company.areaServed },
    knowsLanguage: company.language,
    contactPoint: company.whatsapp.map((number) => ({
      "@type": "ContactPoint",
      telephone: formatTelephone(number.e164),
      email: company.email,
      contactType: "customer service",
      areaServed: "ID",
      availableLanguage: ["Indonesian"],
    })),
  });

export const websiteSchema = (): JsonLd =>
  compact({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: company.name,
    url: absoluteUrl("/") ?? undefined,
    inLanguage: company.language,
    publisher: organizationId()
      ? { "@id": organizationId() }
      : { "@type": "Organization", name: company.name },
  });

export const serviceSchemas = (items: Service[]): JsonLd[] =>
  items.map((service) =>
    compact({
      "@context": "https://schema.org",
      "@type": "Service",
      name: service.name,
      serviceType: service.name,
      description: service.summary,
      url: absoluteUrl(`/layanan#${service.id}`) ?? undefined,
      areaServed: { "@type": "Country", name: company.areaServed },
      provider: organizationId()
        ? { "@id": organizationId() }
        : { "@type": "Organization", name: company.name },
    }),
  );

export const faqSchema = (items: FaqItem[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
});

/** Structured data is only published for real work, never for demo concepts. */
export const creativeWorkSchema = (project: Project): JsonLd | null => {
  if (project.isDemo) return null;
  return compact({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    abstract: project.summary,
    url: absoluteUrl(`/portofolio/${project.slug}`) ?? undefined,
    dateCreated: project.year ? String(project.year) : undefined,
    creator: { "@type": "Organization", name: company.name },
    keywords: project.technologies.join(", "),
  });
};

/** BreadcrumbList needs absolute item URLs, so it is emitted only with a domain. */
const breadcrumbSchema = (items: { name: string; path: string }[]): JsonLd | null => {
  if (!siteConfig.siteUrl) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Beranda", path: "/" }, ...items].map((item, index) => ({
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

  const meta: MetaDescriptor[] = [
    { title },
    { name: "description", content: seo.description },
    { property: "og:site_name", content: company.name },
    { property: "og:locale", content: siteConfig.locale },
    { property: "og:type", content: seo.ogType ?? "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: seo.description },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: seo.description },
  ];

  if (seo.noindex) meta.push({ name: "robots", content: "noindex, follow" });
  if (canonical && !seo.noindex) {
    meta.push({ tagName: "link", rel: "canonical", href: canonical });
    meta.push({ property: "og:url", content: canonical });
  }
  if (image) {
    meta.push(
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: `${company.name}: ${company.tagline}` },
      { name: "twitter:image", content: image },
    );
  }
  if (siteConfig.googleSiteVerification && seo.path === "/") {
    meta.push({ name: "google-site-verification", content: siteConfig.googleSiteVerification });
  }

  const schemas = [...(seo.jsonLd ?? [])];
  const breadcrumbs = seo.breadcrumbs ? breadcrumbSchema(seo.breadcrumbs) : null;
  if (breadcrumbs) schemas.push(breadcrumbs);
  for (const schema of schemas) meta.push({ "script:ld+json": schema });

  return meta;
};
