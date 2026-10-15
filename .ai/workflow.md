# Working without Claude Code tooling (Codex)

The project uses two coding agents: Claude Code and OpenAI Codex. Claude Code adds skills (`frontend-verify`, `backend-verify`, `impeccable`) and MCP servers (Playwright browser, Laravel Boost). Codex gets the same results with the steps below and gets Laravel Boost too: see Backend. Rules from [`../AGENTS.md`](../AGENTS.md) always apply.

## Setup

```bash
cd frontend
npm install
npx playwright install chromium   # add firefox webkit for cross-browser runs
npm run dev                        # http://localhost:5173
```

Optional variables are documented in `frontend/.env.example` and `docs/development/development-guide.md`. Never commit `.env*` other than `.env.example`.

### Backend setup

Needs PHP 8.5 (at least 8.5.7) with `pdo_mysql`, Composer 2, and a MySQL 8.4 server with two databases: `solveit_indonesia` (development) and `solveit_indonesia_testing` (tests), each with its own user whose grant names exactly that database (escaped underscores, see `backend/README.md`). MariaDB, including the XAMPP database server, is not MySQL and is not used. Server options, SQL, and troubleshooting: `backend/README.md` and `docs/development/development-guide.md`.

```bash
cd backend
composer install
cp .env.example .env && php artisan key:generate   # fill DB_* for the development database
php artisan migrate
php artisan boost:update --no-discover             # Boost skills for Claude Code and Codex
php artisan boost:install --mcp --no-interaction   # backend/.codex/config.toml for Codex (ignored by Git)
php artisan test                                   # testing database; credentials in backend/.env.testing
```

Laravel Boost is mandatory for backend work. **Start Codex in `backend/` for backend work**: Codex reads `AGENTS.md` from the repository root down to the working directory and skills from the working directory up, so `backend/AGENTS.md` and `backend/.agents/skills/` are only visible there, and it uses `backend/.codex/config.toml` (`php artisan boost:mcp`). From the repository root Codex reads `.codex/config.toml` (`php backend/artisan boost:mcp`). Trust the repository first, confirm with `codex mcp list`, and call `application-info` before relying on the tools.

## Making a change

1. Read the relevant docs first: content in `docs/PRODUCT.md`, visual rules in `docs/DESIGN.md` and `docs/design/design-system.md`, placement in `docs/project-structure.md`. Planned features (admin dashboard, visitor analytics, GitHub integration) are designs in `docs/architecture/`, not built.
2. Text lives in typed data, never hard-coded in many components: interface copy in `frontend/src/i18n/messages/{id,en}.ts`, page content in `frontend/src/data/` (locale text in `data/locales/{id,en}/`). Every string exists in both languages; TypeScript fails the build when one is missing.
3. Reuse existing primitives (`PageIntro`, `FaqList`, `ProjectCard`, `.btn`, `.field-input`, `.choice`) and tokens in `frontend/src/styles/app.css`. Icons come from `@phosphor-icons/react/dist/ssr/*`.
4. Motion goes through `useMotion` (`frontend/src/lib/motion.ts`); content must be visible without JavaScript and under reduced motion.

## Verifying the backend (replaces the `backend-verify` skill)

Run in `backend/` and report real output: `vendor/bin/pint --test`, `php artisan test` (only on `solveit_indonesia_testing`; the suite refuses another database, another environment, or a user with privileges beyond that database), `composer validate --strict`, `composer check-platform-reqs`, `composer audit`, `php artisan route:list --except-vendor` (expects `POST api/v1/inquiries`). After dependency or guideline changes: `php artisan boost:update --no-discover` and commit the `AGENTS.md` diff. **Backend CI** repeats these on PHP 8.5 (asserting at least 8.5.7) with a disposable MySQL 8.4 service, plus migrations up/down/up and an HTTP smoke test, for PRs that touch `backend/**`.

## Verifying the frontend (replaces the `frontend-verify` skill)

Run in `frontend/`, stop at the first failure, and report real output:

1. `npm run format:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build` (without `VITE_SITE_URL` it warns that the sitemap is skipped; expected)
6. `npx playwright test --project=desktop --workers=1`, then `tablet`, then `mobile` (axe is part of the suite). Add `PW_ALL_BROWSERS=1 ... --project=firefox` for Firefox.
7. WebKit: push the branch, then `gh workflow run cross-browser-qa.yml -f ref=<full 40-character sha>` and read the run's summary.
8. Performance, when a change can affect it: `npm run preview`, then Lighthouse mobile against `http://localhost:4173/`, median of 3, stating the preset.

Design review without the `impeccable` skill: compare screenshots at 1440, 820, and 390 px in light and dark themes and both languages against `docs/DESIGN.md`, and record findings in `docs/qa/qa-report.md`.

## Releasing

1. Commit on `frontend` (or `backend`) as `(type) short description`, for example `(fix) keep the compact header readable over dark sections`. No co-author trailers or tool attribution.
2. `git push origin frontend` (never force).
3. `gh pr create --base staging --head frontend` (or `--head backend`), wait for **Frontend CI** or **Backend CI** to pass, and merge only after the owner's review. Each CI runs only when its app folder or workflow changes; a docs-only PR shows no checks, so verify locally instead.
4. `gh pr create --base main --head staging`, wait for CI, merge only after the owner's approval.
5. Fast-forward the working branch (`frontend` or `backend`) to `origin/main` (`git merge --ff-only origin/main`) and push, so the next round starts from the released tree.
6. Update `.ai/project-status.md`.
