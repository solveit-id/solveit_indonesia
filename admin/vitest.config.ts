import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Tests see the production navigation (no component reference).
  define: { __ADMIN_COMPONENT_REFERENCE__: "false" },
  resolve: {
    alias: {
      "~": fromHere("./src"),
      "@solveit/brand/logo-paths": fromHere("../frontend/src/components/brand/logo-paths.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 15000,
  },
});
