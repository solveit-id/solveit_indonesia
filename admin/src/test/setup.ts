import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Files that opt into `@vitest-environment node` (the API client) have no DOM to reset.
const hasDom = typeof document !== "undefined";

if (hasDom) {
  // findBy and waitFor wait up to 5 s instead of 1 s: a cold run in the Docker dev container
  // (bind-mounted sources, first transform) can take longer to render a lazy route. Only the
  // waiting changes, never what a test asserts.
  const { configure } = await import("@testing-library/react");
  configure({ asyncUtilTimeout: 5000 });
}

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
