import type { Config } from "@react-router/dev/config";
import { localizedRoutes } from "./src/i18n/paths";

export default {
  appDirectory: "src",
  // Static prerendering: every public page in both languages ships as real
  // HTML with its own metadata. No server runtime is required for this phase.
  ssr: false,
  prerender: () => [
    ...localizedRoutes(),
    // Noindex review page; skipped by the sitemap (scripts/postbuild.mjs).
    "/pratinjau/testimoni",
    // Rendered by the splat routes; moved to 404.html and en/404.html by
    // scripts/postbuild.mjs.
    "/404",
    "/en/404",
  ],
} satisfies Config;
