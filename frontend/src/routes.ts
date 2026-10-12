import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";
import { getProjectSlugs } from "./services/projects";

export default [
  layout("layouts/site-layout.tsx", [
    index("pages/home.tsx"),
    route("tentang", "pages/about.tsx"),
    route("layanan", "pages/services.tsx"),
    route("portofolio", "pages/portfolio.tsx"),
    // One explicit route per case study (not `portofolio/:slug`): unknown slugs
    // then fall through to the splat route, so the static 404.html hydrates on
    // exactly the route it was rendered for. When case studies come from the
    // API, switch to a `:slug` route with a clientLoader (docs/integration-plan.md).
    ...getProjectSlugs().map((slug) =>
      route(`portofolio/${slug}`, "pages/project.tsx", { id: `project-${slug}` }),
    ),
    route("proses", "pages/process.tsx"),
    route("kontak", "pages/contact.tsx"),
    route("*", "pages/not-found.tsx"),
  ]),
] satisfies RouteConfig;
