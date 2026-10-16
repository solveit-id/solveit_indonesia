import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import {
  contentSecurityPolicy,
  contentSecurityPolicyHeader,
  securityHeaders,
} from "./security-policy.ts";

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * The only website files the admin console reads: the brand tokens, the Archivo subset they
 * load, the original logo paths, and the favicon. Read in place, never copied
 * (docs/project-structure.md section 7.1); the dev server may serve nothing else outside admin/.
 */
export const sharedDesignSources = [
  fromHere("../frontend/src/styles/tokens.css"),
  fromHere("../frontend/src/assets/fonts/archivo-solveit.woff2"),
  fromHere("../frontend/src/components/brand/logo-paths.ts"),
  fromHere("../frontend/public/favicon.svg"),
];

/**
 * Laravel behind the same-origin proxy. Native: `php artisan serve` on 127.0.0.1:8000. Docker
 * (infra/docker/compose.dev.yaml): http://backend:8000. The proxy keeps the browser's Host
 * header (127.0.0.1:5174) and Origin untouched, which is exactly what the backend's
 * AdminRequestBoundary checks against ADMIN_URL; nothing is spoofed and CORS stays off.
 */
function apiTargetFor(mode: string): string {
  // SOLVEIT_* values are read here only; Vite exposes nothing but VITE_* to the browser.
  const target =
    loadEnv(mode, fromHere("."), "SOLVEIT_").SOLVEIT_ADMIN_API_TARGET ?? "http://127.0.0.1:8000";

  if (!/^https?:\/\/[^/]+$/.test(target)) {
    throw new Error("SOLVEIT_ADMIN_API_TARGET must be an origin such as http://127.0.0.1:8000");
  }

  return target;
}

/** Production builds carry the CSP in the HTML until the admin listener sends it (B3.2d). */
function productionContentSecurityPolicy(): Plugin {
  return {
    name: "solveit-admin-csp",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: contentSecurityPolicy },
        injectTo: "head-prepend",
      },
    ],
  };
}

export default defineConfig(({ command, mode }) => {
  const apiTarget = apiTargetFor(mode);

  return {
    plugins: [tailwindcss(), react(), productionContentSecurityPolicy()],
    define: {
      // Replaced as a literal at every use, so production builds drop the component reference
      // route, its link, and its chunk entirely (src/routes/paths.ts, scripts/check-build.mjs).
      __ADMIN_COMPONENT_REFERENCE__: JSON.stringify(command === "serve" || mode === "reference"),
    },
    resolve: {
      alias: {
        "~": fromHere("./src"),
        "@solveit/brand/logo-paths": fromHere("../frontend/src/components/brand/logo-paths.ts"),
      },
    },
    build: {
      target: "es2022",
      // Every asset stays a same-origin file (no data: URIs beyond the CSP's image exception).
      assetsInlineLimit: 0,
      modulePreload: { polyfill: false },
      sourcemap: false,
    },
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      headers: securityHeaders,
      fs: { strict: true, allow: [fromHere("."), ...sharedDesignSources] },
      proxy: {
        "/api/v1/admin": { target: apiTarget, changeOrigin: false, secure: true },
      },
      // Docker Desktop does not forward file events from Windows folders into containers, so the
      // Docker dev server (infra/docker/compose.dev.yaml) polls instead. Unset everywhere else.
      watch:
        process.env.SOLVEIT_WATCH_POLLING === "true"
          ? { usePolling: true, interval: 300 }
          : undefined,
    },
    preview: {
      host: "127.0.0.1",
      port: 4174,
      strictPort: true,
      headers: { ...securityHeaders, "Content-Security-Policy": contentSecurityPolicyHeader },
      proxy: {
        "/api/v1/admin": { target: apiTarget, changeOrigin: false, secure: true },
      },
    },
  };
});
