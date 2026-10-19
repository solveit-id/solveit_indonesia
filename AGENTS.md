# AGENTS.md

Shared instructions for the two coding agents used in this repository: Claude Code and OpenAI Codex. `CLAUDE.md` loads this file, so it is the single source of agent rules. Current project status and handoff notes live in [`.ai/`](.ai/README.md).

## Project

Solveit Indonesia company profile and portfolio. This repository holds only the website and its own backend; Solveit OpsHub and other Solveit systems live in separate repositories and integrate through API contracts or events, never a shared database (see `docs/architecture/integration-plan.md`).

- `frontend/`: React 19, TypeScript strict, Vite 8, React Router 7 (framework mode, static prerender), Tailwind CSS v4, GSAP. Built and released.
- `admin/`: separate admin console, React 19, TypeScript strict, Vite 8, React Router 7 data mode, Tailwind CSS v4, GSAP (lazy chunk), developed on the `admin` branch, not deployed. Foundation (B3.2a, PR #38), B3.2b (PR #41, `02f3859`: sign-in with password and mandatory TOTP, access-link activation and credential reset, own account and security, session gate and idle warning), B3.2c (PR #43, `c0ecde9`: the owner administration workspace on the B3.1b API), and B3.2d (PR #45, `eb31fae`: the production admin image and the private admin listener `admin-gateway`, Compose profile `admin`, loopback by default, TLS optional in the listener, validated with synthetic data and a throwaway certificate) are released to `main`, **not deployed**; no admin hostname, certificate, or account exists anywhere. The console does not call the B4a inquiry API yet (B4b). It reads four website design files in place (`docs/project-structure.md` 7.1); never copy them. Motion and UI rules for every admin phase: `docs/design/design-system.md`, Konsol admin.
- `backend/`: Laravel 13 JSON API on PHP 8.5 (at least 8.5.7) and MySQL 8.4 LTS, `backend` branch. Built: `POST /api/v1/inquiries` (idempotent per `Idempotency-Key` since B2.1), `GET /up`, the B3.1a admin identity API under `/api/v1/admin` (access-link activation, mandatory TOTP, database sessions, roles `owner` and `admin`, append-only audit log), the B3.1b owner-only user administration and audit reader (invitations shown once with no email, role changes, suspension, owner-issued credential reset, cursor-paginated audit log), and on the `backend` branch the B4a inquiry management API for owner and admin (masked contacts, status workflow with compare and set and history, append-only internal notes, deliberate password-confirmed contact reveal recorded in the audit log, submitted fields locked by a MySQL trigger; no export or deletion; contracts in `docs/api/`). No admin account exists anywhere, and neither the admin application nor its listener (B3.2d, released) is deployed. Not deployed; the shipped frontend does not call it (the B2 website channel is behind `VITE_INQUIRY_API_ENABLED`, off by default; since B2.2 every website submission carries an `Idempotency-Key`). Add only endpoints that really work, never fake ones.
- `infra/docker/`: full-Docker development (`compose.dev.yaml`, includes the existing MySQL Compose file) and a provider-independent production setup (`compose.prod.yaml`, plus the private admin listener under profile `admin` and the optional `compose.prod.admin-tls.yaml`). Production is prepared and validated, **not deployed**. Placement rules: `docs/project-structure.md` section 11; guides in `docs/development/docker-*.md`.
- Planned, not built: deploying the admin console (B3.2d prepared the infrastructure only; hostname, TLS, exposure, and hosting wait for the owner), the B4b inquiry screens in the console, inquiry export, deletion, and retention (owner decisions), first-party visitor analytics, GitHub integration boundary (`docs/architecture/`). Never describe them as available.

## Read first

| File | What it holds |
|---|---|
| `docs/PRODUCT.md` | Confirmed product facts, the source of truth for content |
| `docs/DESIGN.md` | Design specification derived from the shipped code |
| `docs/design/design-system.md` | Tokens, components, motion rules |
| `docs/project-structure.md` | Where every folder and file belongs, and naming rules |
| `.ai/project-status.md` | What is done, what is next, open decisions |
| `backend/AGENTS.md` | Laravel Boost guidelines for backend work (generated; read before touching `backend/`) |
| `docs/api/` | Contracts of the endpoints that exist |

`docs/PRODUCT.md` and `docs/DESIGN.md` stay at the top of `docs/` (design tooling resolves them there); every other document lives in a topic folder. The map is `docs/README.md`.

## Development environment

- Owner machine: Windows 11, Git Bash and PowerShell, Node 22.23 (`.nvmrc`: 22, `engines`: >=22.12), PHP 8.5.7 (XAMPP), Composer 2.8. The XAMPP database is MariaDB 10.4, which is not MySQL: never use it for this project. Run MySQL 8.4 separately: the Docker container `solveit-mysql` from `backend/docker/mysql/compose.yaml` on `127.0.0.1:3307` (`backend/README.md`). `mysql --version` there reports the XAMPP MariaDB client, not the server; check the server with `php artisan db:show`. The Docker development project (`infra/docker/compose.dev.yaml`, project `solveit-indonesia`) reuses that same container and volume; never run `docker compose down -v` on it or `docker volume rm solveit-mysql-data`.
- Git normalises text files to LF (`.gitattributes`); Windows working copies may show CRLF. Match the existing line ending when editing a file with scripts.
- Memory is limited: run Playwright one project at a time with `--workers=1`. WebKit (desktop and iPhone 14) runs on GitHub Actions through the **Cross-browser QA** workflow (`gh workflow run cross-browser-qa.yml -f ref=<full sha>`).

## Commands

Frontend (run in `frontend/`): `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `npm run test:e2e` · `npm run format` / `format:check` · `npm run check` (lint + typecheck + test + build).

Admin (run in `admin/`): `npm run dev` (http://127.0.0.1:5174, never localhost) · `npm run check` (format, lint, typecheck, test, build, build checks) · `npm run build:reference` then `npx playwright test --project=<desktop|tablet|mobile> --workers=1` (mocked API) · `npm run build` then `npm run test:integration -- --project=<desktop|tablet|mobile>` (real Laravel and MySQL on the testing database; needs `backend/` set up and `solveit-mysql` running; never alongside `php artisan test`). Guide: `admin/README.md`.

Docker (run from the repository root): `bash infra/docker/scripts/setup-dev.sh` (once) · `docker compose -f infra/docker/compose.dev.yaml up -d` · `... exec backend php artisan test` · `... exec frontend npm test`. Production images and smoke test: `docs/development/docker-production.md` (isolated project name, synthetic data only).

Backend (run in `backend/`): `php artisan test` · `vendor/bin/pint --test` (fix with `vendor/bin/pint`) · `composer validate --strict` · `composer audit` · `php artisan route:list --except-vendor` · `php artisan migrate` · `php artisan boost:update --no-discover`. Setup from a fresh clone: `backend/README.md`.

## Laravel backend and Laravel Boost

- **The official Laravel Boost package (`laravel/boost`, in `require-dev`) is mandatory for any work on the Laravel backend.** Read `backend/AGENTS.md` (Boost guidelines plus Solveit backend rules) and use the `laravel-boost` MCP tools, above all `search-docs` for Laravel 13 APIs and `application-info`, before writing framework-dependent code. Activate the Boost skills (`laravel-best-practices`, `testing-best-practices`) when they apply.
- MCP from the repository root: `php backend/artisan boost:mcp`, registered in `.mcp.json` (Claude Code) and `.codex/config.toml` (Codex, after trusting the repository). Claude Code: start at the repository root; it loads `backend/CLAUDE.md` and the Boost skills when it works under `backend/`. Codex: start **in `backend/`** for backend work, because Codex reads `AGENTS.md` only from the root down to the working directory and skills only from the working directory up; there it uses `backend/.codex/config.toml` and `backend/.agents/skills/` (both generated, see `docs/project-structure.md` section 9). If the server does not appear, restart the session; never report MCP tools that did not respond.
- Use Boost database and log tools only on this project's local development or testing MySQL database. Never print `.env` values, tokens, or inquiry contents (names, contacts, messages).
- Tests run only on the disposable MySQL database `solveit_indonesia_testing`, as a user with privileges on that database only (verified by `backend/tests/Support/TestDatabaseGuard.php`); never run `migrate:fresh`, `rollback`, `db:wipe`, or `DROP` elsewhere. The real-browser harness (`backend/tests/E2E/`, used by `admin/tests/integration`) uses the same database and runs the same guard before every command and every HTTP request; it creates synthetic `@example.test` accounts only through the real commands and API.
- `backend/.ai/` holds Boost sources (guidelines, skills, rules) for the Laravel app; the root `.ai/` holds repository handoff. Do not mix them. Full standard: `docs/project-structure.md` section 9.
- Endpoints never return success unless the data is stored, and inquiries never get a public read, update, or delete endpoint. Out of scope for this repository: OpsHub, client portal, proposals, contracts, invoices, payments, project tracking.

## Verification before a commit

1. Frontend changes: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. UI changes also: `npx playwright test --project=<desktop|tablet|mobile> --workers=1` (axe runs inside the suite). `PW_ALL_BROWSERS=1` adds `firefox`. A change to `frontend/src/styles/tokens.css` or another shared design file also needs the admin checks.
2. Admin changes: `npm run check` in `admin/`, then `npm run build:reference` and the Playwright projects one at a time with `--workers=1`, then `npm run build` and `npm run test:integration` one project at a time. Auth or backend admin changes need the integration suite too (**Admin integration** workflow in CI).
3. Backend changes: `vendor/bin/pint --test`, `php artisan test` (MySQL testing database), `composer validate --strict`, `composer audit`; after dependency or guideline changes, `php artisan boost:update --no-discover` and commit the resulting `backend/AGENTS.md`.
4. Docker changes (`infra/**`): `docker compose -f infra/docker/compose.dev.yaml config --quiet`, rebuild the affected image, and the checks in `docs/development/docker-*.md` (production: `test-safety-guards.sh`, `verify-production.sh`, `verify-admin.sh`, the production admin browser test, `drill-backup-restore.sh`, only on an explicitly named throwaway project with synthetic data; `check-synthetic-stack.sh` refuses anything else, never weaken it); **Docker CI** repeats them on a clean runner.
5. Report real output. Never weaken a test to make it pass.

## Rules

- Content integrity: never invent clients, testimonials, statistics, awards, results, addresses, release dates, or domains. Only confirmed contacts in `src/data/company.ts`. Demo case studies keep `isDemo: true`, empty `results`, and the visible demo label. Planned systems are never shown as launched.
- Forms must never claim a submission that did not happen.
- Logos: the originals are `frontend/public/brand/solveit-logo-full.svg` and `solveit-logo-icon.svg`; components use the verbatim paths in `src/components/brand/logo-paths.ts`. Never alter shapes and never keep a second copy elsewhere.
- Design: follow `docs/design/design-system.md` (brand tokens in `frontend/src/styles/tokens.css`, shared with the admin; website layout tokens in `src/styles/app.css`; capsule controls, 33 degree diagonal, one accent). No em dashes in copy.
- Motion: use `useMotion` from `src/lib/motion.ts` (lazy GSAP, auto-revert); gate effects with `gsap.matchMedia()` and `motionQueries.motion`; animate transform/opacity/colour only; content visible by default.
- SEO: every page exports `meta` built with `buildMeta()` from `src/lib/seo.ts`. Final SEO/GEO work waits for the domain and hosting.
- Naming: Solveit OpsHub is established; Solveit Orbit and the six client-facing names are proposals (`docs/product/product-naming.md`). Do not rename the `solveit_opshub` repository or its identifiers.
- Structure: follow `docs/project-structure.md`; no loose files in the repository root, no duplicate assets, no secrets in Git (keys, `.env*` other than `.env.example`, `*.env` other than `*.env.example`, Docker `secrets/` folders, database dumps; see `.gitignore`).
- Infrastructure: never delete or recreate the `solveit-mysql` container or `solveit-mysql-data` volume, never change XAMPP, never publish MySQL or PHP-FPM beyond loopback, never deploy publicly or create production databases or certificates without the owner. Production migrations run only as the explicit `migrate` service.
- Agents: only Claude Code and Codex are supported. Do not add configuration for other agents.
- Handoff: at the end of a task, update `.ai/project-status.md` (state, branch SHAs, next step).
- Git: branches `frontend`, `backend`, and `admin` feed `staging` via PR, then `staging` to `main` via PR. Commit format `(type) short description`. No force push, no destructive reset, no `Co-authored-by` trailers or automatic attribution in commits or PRs.
