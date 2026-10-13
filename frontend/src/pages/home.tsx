import { Hero } from "~/components/sections/home/hero";
import { Manifesto } from "~/components/sections/home/manifesto";
import { Principles } from "~/components/sections/home/principles";
import { ProcessRail } from "~/components/sections/home/process-rail";
import { ServiceIndex } from "~/components/sections/home/service-index";
import { WorkShowcase } from "~/components/sections/home/work-showcase";
import { getMessages, localeFromPath, pathFor } from "~/i18n";
import { buildMeta, organizationSchema, websiteSchema } from "~/lib/seo";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const t = getMessages(locale).meta;
  return buildMeta({
    locale,
    title: t.homeTitle,
    absoluteTitle: true,
    description: t.homeDescription,
    path: pathFor("home", locale),
    jsonLd: [organizationSchema(locale), websiteSchema(locale)],
  });
};

export default function Home() {
  return (
    <>
      <Hero />
      <Manifesto />
      <ServiceIndex />
      <WorkShowcase />
      <Principles />
      <ProcessRail />
    </>
  );
}
