import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";
import { projects } from "./data/projects";
import { locales, type PageKey, pagePaths } from "./i18n/config";
import { projectPath } from "./i18n/paths";

const files: Record<PageKey, string> = {
  home: "pages/home.tsx",
  services: "pages/services.tsx",
  portfolio: "pages/portfolio.tsx",
  process: "pages/process.tsx",
  about: "pages/about.tsx",
  contact: "pages/contact.tsx",
};

// One route per page and language: `/layanan` and `/en/services` share a
// module but have distinct ids, and the page reads its language from the URL.
const pages = locales.flatMap((locale) =>
  (Object.keys(files) as PageKey[]).map((key) => {
    const path = pagePaths[key][locale];
    const id = `${key}-${locale}`;
    return path === "/" ? index(files[key], { id }) : route(path.slice(1), files[key], { id });
  }),
);

// One explicit route per case study (not `portofolio/:slug`): unknown slugs
// then fall through to the splat routes, so the static 404 pages hydrate on
// exactly the route they were rendered for. When case studies come from the
// API, switch to a `:slug` route with a clientLoader (docs/architecture/integration-plan.md).
const caseStudies = locales.flatMap((locale) =>
  projects.map((project) =>
    route(projectPath(project, locale).slice(1), "pages/project.tsx", {
      id: `project-${locale}-${project.key}`,
    }),
  ),
);

export default [
  layout("layouts/site-layout.tsx", [
    ...pages,
    ...caseStudies,
    // Internal, noindex review page for the testimonial component (placeholders only).
    route("pratinjau/testimoni", "pages/testimonial-preview.tsx", { id: "testimonial-preview" }),
    route("en/*", "pages/not-found.tsx", { id: "not-found-en" }),
    route("*", "pages/not-found.tsx", { id: "not-found-id" }),
  ]),
] satisfies RouteConfig;
