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

// Every page ships as prerendered HTML. Paint it first, then hydrate: waiting
// one frame keeps hydration and animation setup off the critical render path
// (FCP/LCP) without changing what the visitor sees.
requestAnimationFrame(() => setTimeout(hydrate, 0));
