import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

function hydrate() {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <HydratedRouter />
      </StrictMode>,
    );
  });
}

// Every page ships as prerendered HTML. In production builds this module is
// only requested after first contentful paint (scripts/postbuild.mjs); the
// extra frame here also keeps hydration off the critical path in development.
requestAnimationFrame(() => setTimeout(hydrate, 0));
