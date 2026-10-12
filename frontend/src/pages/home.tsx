import { Hero } from "~/components/sections/home/hero";
import { Manifesto } from "~/components/sections/home/manifesto";
import { Principles } from "~/components/sections/home/principles";
import { ProcessRail } from "~/components/sections/home/process-rail";
import { ServiceIndex } from "~/components/sections/home/service-index";
import { WorkShowcase } from "~/components/sections/home/work-showcase";
import { company } from "~/data/company";
import { buildMeta, organizationSchema, websiteSchema } from "~/lib/seo";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () =>
  buildMeta({
    title: `${company.name} | Software House: Website, Aplikasi Web, dan Sistem Informasi`,
    absoluteTitle: true,
    description:
      "Solveit Indonesia adalah software house yang membangun website, aplikasi web, sistem informasi, dan custom software untuk UMKM, startup, dan perusahaan di Indonesia.",
    path: "/",
    jsonLd: [organizationSchema(), websiteSchema()],
  });

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
