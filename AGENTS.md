# AGENTS.md

Shared instructions for every coding agent working in this repository.

## Project

Solveit Indonesia company profile and portfolio, the first piece of the Solveit OpsHub ecosystem. Product facts live in `PRODUCT.md`; architecture, design, SEO, and integration docs live in `docs/`.

- `frontend/`: React 19, TypeScript strict, Vite 8, React Router 7 (framework mode, static prerender), Tailwind CSS v4, GSAP.
- `backend/`: reserved for Laravel 13 on PHP 8.5 (next phase, `backend` branch). Do not add fake endpoints.

## Commands (run in `frontend/`)

`npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `npm run test:e2e` · `npm run check` (lint + typecheck + test + build).

## Rules

- Content integrity: never invent clients, testimonials, statistics, awards, results, addresses, or domains. Only confirmed contacts in `src/data/company.ts`. Demo case studies keep `isDemo: true`, empty `results`, and the visible demo label.
- Forms must never claim a submission that did not happen.
- Logos: use the original SVG paths (`src/components/brand/logo-paths.ts`); never alter shapes.
- Design: follow `docs/design-system.md` (tokens in `src/styles/app.css`, capsule controls, 33 degree diagonal, one accent). No em dashes in copy.
- Motion: use `useMotion` from `src/lib/motion.ts` (lazy GSAP, auto-revert); gate effects with `gsap.matchMedia()` and `motionQueries.motion`; animate transform/opacity/colour only; content visible by default.
- SEO: every page exports `meta` built with `buildMeta()` from `src/lib/seo.ts`.
- Git: branches `frontend` and `backend` feed `staging` via PR, then `staging` to `main` via PR. Commit format `(type) short description`. No force push, no `Co-authored-by` trailers.
