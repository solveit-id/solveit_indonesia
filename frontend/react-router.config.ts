import type { Config } from "@react-router/dev/config";
import { staticRoutes } from "./src/data/navigation";
import { getProjectSlugs } from "./src/services/projects";

export default {
  appDirectory: "src",
  // Static prerendering: every public page ships as real HTML with its own
  // metadata. No server runtime is required for this phase.
  ssr: false,
  prerender: () => [
    ...staticRoutes,
    ...getProjectSlugs().map((slug) => `/portofolio/${slug}`),
    // Rendered by the splat route; copied to 404.html by scripts/postbuild.mjs.
    "/404",
  ],
} satisfies Config;
