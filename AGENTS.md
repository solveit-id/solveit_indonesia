# AGENTS.md

Shared instructions for every coding agent working in this repository (Claude Code, Codex, Cursor, and others). `CLAUDE.md` loads this file, so it is the single source of agent rules. Current project status and handoff notes live in [`.ai/`](.ai/README.md).

## Project

Solveit Indonesia company profile and portfolio. This repository holds only the website and its own backend; Solveit OpsHub and other Solveit systems live in separate repositories and integrate through API contracts or events, never a shared database (see `docs/architecture/integration-plan.md`).

- `frontend/`: React 19, TypeScript strict, Vite 8, React Router 7 (framework mode, static prerender), Tailwind CSS v4, GSAP. Built and released.
- `backend/`: reserved for Laravel 13 on PHP 8.5 (next phase, `backend` branch). Holds only a README; do not add fake endpoints.

## Read first

| File | What it holds |
|---|---|
| `docs/PRODUCT.md` | Confirmed product facts, the source of truth for content |
| `docs/DESIGN.md` | Design specification derived from the shipped code |
| `docs/design/design-system.md` | Tokens, components, motion rules |
| `docs/project-structure.md` | Where every folder and file belongs, and naming rules |
| `.ai/project-status.md` | What is done, what is next, open decisions |

`docs/PRODUCT.md` and `docs/DESIGN.md` stay at the top of `docs/` (design tooling resolves them there); every other document lives in a topic folder. The map is `docs/README.md`.

## Development environment

- Owner machine: Windows 11, Git Bash and PowerShell, Node 22.23 (`.nvmrc`: 22, `engines`: >=22.12), PHP 8.5.7, Composer 2.8.
- Git normalises text files to LF (`.gitattributes`); Windows working copies may show CRLF. Match the existing line ending when editing a file with scripts.
- Memory is limited: run Playwright one project at a time with `--workers=1`. WebKit (desktop and iPhone 14) runs on GitHub Actions through the **Cross-browser QA** workflow (`gh workflow run cross-browser-qa.yml -f ref=<full sha>`).

## Commands (run in `frontend/`)

`npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `npm run test:e2e` · `npm run format` / `format:check` · `npm run check` (lint + typecheck + test + build).

## Verification before a commit

1. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
2. UI changes: `npx playwright test --project=<desktop|tablet|mobile> --workers=1` (axe runs inside the suite). `PW_ALL_BROWSERS=1` adds `firefox`.
3. Report real output. Never weaken a test to make it pass.

## Rules

- Content integrity: never invent clients, testimonials, statistics, awards, results, addresses, release dates, or domains. Only confirmed contacts in `src/data/company.ts`. Demo case studies keep `isDemo: true`, empty `results`, and the visible demo label. Planned systems are never shown as launched.
- Forms must never claim a submission that did not happen.
- Logos: the originals are `frontend/public/brand/solveit-logo-full.svg` and `solveit-logo-icon.svg`; components use the verbatim paths in `src/components/brand/logo-paths.ts`. Never alter shapes and never keep a second copy elsewhere.
- Design: follow `docs/design/design-system.md` (tokens in `src/styles/app.css`, capsule controls, 33 degree diagonal, one accent). No em dashes in copy.
- Motion: use `useMotion` from `src/lib/motion.ts` (lazy GSAP, auto-revert); gate effects with `gsap.matchMedia()` and `motionQueries.motion`; animate transform/opacity/colour only; content visible by default.
- SEO: every page exports `meta` built with `buildMeta()` from `src/lib/seo.ts`. Final SEO/GEO work waits for the domain and hosting.
- Naming: Solveit OpsHub is established; Solveit Orbit and the six client-facing names are proposals (`docs/product/product-naming.md`). Do not rename the `solveit_opshub` repository or its identifiers.
- Structure: follow `docs/project-structure.md`; no loose files in the repository root, no duplicate assets, no secrets in Git.
- Handoff: at the end of a task, update `.ai/project-status.md` (state, branch SHAs, next step).
- Git: branches `frontend` and `backend` feed `staging` via PR, then `staging` to `main` via PR. Commit format `(type) short description`. No force push, no destructive reset, no `Co-authored-by` trailers or automatic attribution in commits or PRs.
