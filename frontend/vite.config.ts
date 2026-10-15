import { fileURLToPath, URL } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Docker Desktop does not forward file events from Windows folders into containers, so the
    // Docker dev server (infra/docker/compose.dev.yaml) polls instead. Unset everywhere else.
    watch:
      process.env.SOLVEIT_WATCH_POLLING === "true"
        ? { usePolling: true, interval: 300 }
        : undefined,
  },
});
