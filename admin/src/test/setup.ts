import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Files that opt into `@vitest-environment node` (the API client) have no DOM to reset.
const hasDom = typeof document !== "undefined";

afterEach(async () => {
  if (!hasDom) {
    return;
  }

  const { cleanup } = await import("@testing-library/react");
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.lang = "id";
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();

    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
});
