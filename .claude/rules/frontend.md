---
paths:
  - "frontend/src/**"
---

# Frontend conventions

- Imports use the `~/` alias for `src/`. Route modules live in `src/pages/` and are registered in `src/routes.ts`.
- New content goes in typed data files (`src/data/`) behind `src/services/`, never hard-coded in many components.
- Reuse `PageIntro`, `FaqList`, `ProjectCard`, `.btn`, `.field-input`, and `.choice` before writing new primitives.
- Icons come from `@phosphor-icons/react/dist/ssr/*` only.
- Any element hidden for an entrance must be visible without JavaScript and under reduced motion.
