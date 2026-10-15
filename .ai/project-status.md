# Project status

Last updated: 2026-10-15 (B1.1 on `backend`, PR #20 to `staging` open; not yet on `main`).

## In one paragraph

The public website (frontend) is built, bilingual (Indonesian at `/`, English at `/en/`), prerendered as static HTML, and released to `main` through six refinement rounds. The Laravel 13 backend exposes `POST /api/v1/inquiries` and `GET /up`. B1.1 standardized it on **MySQL 8.4 LTS** and **PHP 8.5 (at least 8.5.7)**, limited agent tooling to **Claude Code and Codex**, hardened repository hygiene, and added design documents for the admin dashboard, visitor analytics, and the GitHub integration boundary (Planned, nothing built). The API is **not deployed and the frontend does not call it yet**: the contact form still composes a WhatsApp or email message. No domain or hosting exists.

## Shipped (on `main`)

| Round | Release PR | Highlights |
|---|---|---|
| 1 | #2 | Company profile frontend: pages, design system, accessibility, prerender |
| 2 | #4 | Light/dark themes, Indonesian/English, navigation, contact channels, parallax, performance |
| 3 | #6 | Motion, premium interactions, the rule-based "Tanya Solveit" assistant, testimonial pledge |
| 4 | #8 | Branded loader, navbar morph, floating controls, portfolio detail |
| 5 | #10 | Compact navbar, demo labels, case study chapters and scrollspy, slice hover |
| 6 | #13 | Navbar logo morph fix, glass navbar, About storytelling and ecosystem map, shared FAQ, responsive case study preview, consultation selects, ecosystem naming proposal, owner's new vision text |
| B0, B1 | #18 (from #16, #17) | Laravel 13 backend foundation, Laravel Boost, `POST /api/v1/inquiries` with tests and Backend CI; post-save logging fix (#17). Not deployed |

Pages: `/`, `/tentang`, `/layanan`, `/proses`, `/portofolio`, five case studies, `/kontak`, 404, each mirrored under `/en/` with English slugs. Case studies are labelled demonstration concepts (`isDemo: true`, no results).

## B1.1 (PR #20, `backend` to `staging`)

Status key: Implemented and Verified unless stated otherwise. Evidence: `docs/qa/qa-report.md`, section "B1.1".

- **MySQL 8.4 LTS** (owner decision): `.env.example` and `config/database.php` default to MySQL; tests run on a disposable `solveit_indonesia_testing` database (driver pinned in `phpunit.xml`, name guarded in `tests/TestCase.php`); storage failures are injected as rows MySQL rejects instead of `Schema::drop` (DDL commits implicitly on MySQL); new tests for reference collisions and MySQL settings. Verified locally on MySQL 8.4.11 (disposable Docker container): 94 tests, 249 assertions; HTTP smoke test as a DML-only user. Schema unchanged.
- **PHP 8.5.7** (owner decision): `"php": "^8.5.7"`, `config.platform.php` 8.5.7; no package version changed. Local PHP 8.5.7.
- **Backend CI**: PHP 8.5 (asserts at least 8.5.7, records the patch; the runner had 8.5.11) with a `mysql:8.4` service (asserts 8.4.x, not MariaDB; 8.4.11), least-privilege users with masked random passwords, migrations up/down/up, HTTP smoke test, tests, audit, `--no-dev` boot. Green; see Branches.
- **Agents**: Cursor removed (`.cursor/mcp.json`, `cursor` in `boost.json`, local copies); Boost regenerated. Claude Code: `laravel-boost` and `playwright` Connected. Codex: config discovery verified for the root and `backend/`; start Codex in `backend/` for backend work (`AGENTS.md` is read root-down, skills cwd-up). Tool calls from a logged-in Codex session not verified.
- **Repository security**: `.gitignore` covers keys, database files and dumps, test caches, `.cursor/`; all workflows use `permissions: contents: read`; gitleaks on all refs and the working tree found no leaks. The repository is public.
- **Planned (design only)**: `docs/architecture/admin-dashboard.md`, `visitor-analytics.md`, `github-integration.md`. No admin UI, auth, analytics, tracking, GitHub App, or repository action exists.

## Branches

- `main`: `7729d17` (release B0 and B1, PR #18).
- `staging`: `7e936b5` (merge of PR #19, handoff docs).
- `backend`: `8991ebd`, three B1.1 commits on top of `7e936b5` (`f19be27` feat, `7b27794` chore, `8991ebd` docs) plus this status update; PR #20 to `staging`.
- `frontend`: `7729d17`; no frontend application file changed in B1.1.
- CI for `8991ebd` (PR #20 and push): **green**. Backend CI runs 38709084941 (PR) and 38709043589 (push): `Tested PHP: 8.5.11`, `Tested MySQL: 8.4.11 (MySQL Community Server - GPL)`, 94 tests and 249 assertions passed, migrations up/down/up, HTTP smoke test, no audit advisories, `--no-dev` boot without Boost. Frontend CI run 38709084923 (triggered by the workflow permission change): pass. PR #20 mergeable, no review yet. The status-only commit after it touches no CI path, so it triggers no new run.

Check live state with `git fetch --prune && git branch -vv` and `gh pr list`; SHAs here go stale.

## Quality baseline

- Frontend (round 6, unchanged): lint, typecheck, unit tests 69/69, build pass; E2E Chromium desktop/tablet/Pixel 7, Firefox, WebKit desktop/iPhone 14 with 0 failures; axe 0 violations. Lighthouse mobile 96 to 99 performance.
- Backend: 94 tests, 249 assertions on MySQL 8.4.11 and PHP 8.5.7; Pint, `composer validate --strict`, `check-platform-reqs`, `audit` clean.

## Blocked or owner action required

- **Local MySQL on the owner machine** (Blocked until done): XAMPP runs MariaDB 10.4, not MySQL, and the existing `backend/.env` still selects SQLite. Run MySQL 8.4 (Docker or MySQL Community Server; `backend/README.md`, Database MySQL), create both databases and users, update `backend/.env`, and create `backend/.env.testing`. Until then `php artisan test` cannot run on that machine (the old local `database/database.sqlite` is unused and can be deleted by the owner).
- **`.claude/` changes** (Owner decision required; the agent's auto mode blocks self-modification): replace `.claude/skills/backend-verify/SKILL.md` (still says SQLite in-memory and PHP 8.3/8.5) with the MySQL version described in the B1.1 QA section; consider deleting `.claude/rules/backend.md`, which repeats `backend/CLAUDE.md` and `backend/AGENTS.md`.
- **Merge PR #20** after review, then a `staging` to `main` release PR with owner approval.

## Open decisions (owner)

- Domain and hosting (MySQL 8.4 and PHP 8.5 are decided). They unlock canonical URLs, sitemap, final SEO/GEO, the production CORS origin, `TRUSTED_PROXIES`, and API deployment. The hosting must allow the document root `backend/public/`.
- Inquiry data: retention period, export and deletion procedure, privacy notice on the form, and whether a free CAPTCHA (Turnstile) is needed after launch.
- Admin dashboard: frontend option (recommended: separate `admin/` app on a subdomain), roles, MFA scope, content workflow (static rebuild vs runtime data).
- Visitor analytics: legal and privacy review under UU PDP before any activation, retention, and whether to use a third-party service instead.
- GitHub integration lives in Solveit OpsHub; GitHub App permissions are verified at implementation time.
- How inquiries reach Solveit OpsHub (versioned event or webhook) once OpsHub exists.
- Product names other than Solveit OpsHub are proposals (`docs/product/product-naming.md`). No client has approved a testimonial or a real case study yet.

## Next task

1. Owner: review and merge PR #20 into `staging`, then open and approve `staging` to `main`; set up local MySQL 8.4 as above.
2. **B2: frontend inquiry API integration** on the `frontend` branch, after fast-forwarding it to the release that contains B1.1:
   1. Add an `api` channel to `frontend/src/services/inquiry.ts` that POSTs the existing `InquiryPayload` to `${VITE_API_BASE_URL}/api/v1/inquiries` with an empty hidden `homepage` honeypot field.
   2. Show the `INQ-...` reference only from a real `201`; map `422` errors to `InquiryErrors`; on `429`, `503`, network errors, or when `VITE_API_BASE_URL` is unset, keep the WhatsApp and email channels as the path forward. Never claim a submission that did not happen.
   3. Add unit and e2e tests (mocked API) in both languages, and record results in `docs/qa/qa-report.md`.
3. Then the admin foundation (`docs/architecture/admin-dashboard.md`, section 9), after the owner decisions above.
