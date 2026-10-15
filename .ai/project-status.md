# Project status

Last updated: 2026-10-16 (B1.1 released on `main` as `88db528`; B2 on `frontend`, PR #22 to `staging` open, not merged; local MySQL 8.4 setup on `backend`, PR to `staging` open, not merged).

## In one paragraph

The public website (frontend) is built, bilingual (Indonesian at `/`, English at `/en/`), prerendered as static HTML, and released to `main` through six refinement rounds. The Laravel 13 backend exposes `POST /api/v1/inquiries` and `GET /up` on **PHP 8.5 (at least 8.5.7)** and **MySQL 8.4 LTS** (B1.1, released). Supported coding agents: **Claude Code and Codex** only. B2 adds the contact form's **Send through website** channel, built and tested but **disabled by default** (`VITE_INQUIRY_API_ENABLED=false`): the public build still composes WhatsApp or email messages and never calls the API. The API is **not deployed**; no domain or hosting exists. Admin dashboard, visitor analytics, and the GitHub integration boundary are designs only (`docs/architecture/`).

## Shipped (on `main`)

| Round | Release PR | Highlights |
|---|---|---|
| 1 | #2 | Company profile frontend: pages, design system, accessibility, prerender |
| 2 | #4 | Light/dark themes, Indonesian/English, navigation, contact channels, parallax, performance |
| 3 | #6 | Motion, premium interactions, the rule-based "Tanya Solveit" assistant, testimonial pledge |
| 4 | #8 | Branded loader, navbar morph, floating controls, portfolio detail |
| 5 | #10 | Compact navbar, demo labels, case study chapters and scrollspy, slice hover |
| 6 | #13 | Navbar logo morph fix, glass navbar, About storytelling and ecosystem map, shared FAQ, responsive case study preview, consultation selects, ecosystem naming proposal, owner's new vision text |
| B0, B1 | #18 (from #16, #17) | Laravel 13 backend foundation, Laravel Boost, `POST /api/v1/inquiries` with tests and Backend CI. Not deployed |
| B1.1 | #21 (from #20) | MySQL 8.4 LTS and PHP 8.5.7+, test database guard, Claude Code and Codex only, repository hygiene, Planned architecture documents. Release commit `88db528` |

Pages: `/`, `/tentang`, `/layanan`, `/proses`, `/portofolio`, five case studies, `/kontak`, 404, each mirrored under `/en/` with English slugs. Case studies are labelled demonstration concepts (`isDemo: true`, no results).

## B2: frontend inquiry API integration (PR #22, `frontend` to `staging`)

Status: Implemented and Verified with mocked API responses; **not enabled** in any build that ships; real HTTP integration with Laravel and MySQL **not verified locally**. Evidence: `docs/qa/qa-report.md`, section "B2". Contract and client behaviour: `docs/api/inquiries.md`, section "Klien frontend (B2)".

- **Flag and config** (`frontend/src/config/site.ts`): the channel is on only when `VITE_INQUIRY_API_ENABLED` is exactly `true` and `VITE_API_BASE_URL` is a bare HTTPS origin (plain HTTP only for loopback, no path or credentials). Then the endpoint is `<origin>/api/v1/inquiries`. Default builds have no channel, no honeypot, and no request.
- **Client** (`frontend/src/services/inquiry-api.ts`): one POST, no retry, 15 s timeout, abort on unmount. Only a `201` with a valid `INQ-` reference counts as received. 422/413/429/503 and other 4xx mean not stored; 5xx, malformed 2xx, network errors, and timeouts are an uncertain outcome.
- **Form** (`frontend/src/components/contact/inquiry-form.tsx`): third channel with ref-based double-submit guard. It shows the real reference or localized feedback, keeps the visitor's values, and never opens WhatsApp or email by itself. The privacy copy depends on the mode. Validation now matches `StoreInquiryRequest` (all seven fields, character lengths, plain-space phone pattern).
- **Tests**:
  - 125 unit and component tests (69 before).
  - Default-build e2e proves the disabled mode.
  - A second build proves the enabled mode: `playwright.api.config.ts`, `tests/e2e-api/`, `npm run test:e2e:api`, with mocked responses.
  - Both builds run in Frontend CI and Cross-browser QA.
- **Flaky WebKit test fixed (root cause confirmed)**:
  - The failure: `refinement.spec.ts` theme icon test, Cross-browser QA run 38723672210 attempt 1 (`webkit-mobile`).
  - Why it failed: `setTheme()` applies the theme inside the View Transition update callback, a frame or more after the click. The test read the icon transform right after `click()`. On touch devices that read could still see `none`. On pointer devices the hover rotation made it pass without checking the roll.
  - The fix waits for the theme and asserts the recorded transform transitions and the settled state. A reduced-motion check was added. Only the test changed.
  - Evidence: reproduced deterministically by delaying the callback; 40/40 local WebKit repeats pass.
- **Build dir**: `BUILD_DIR` (default `build`) lets the API-enabled variant build into `build/inquiry-api` without touching `build/client`.

## Local MySQL 8.4 environment (`backend`, PR to `staging`)

Status: Implemented and Verified on the owner machine. Evidence: `docs/qa/qa-report.md`, section "MySQL 8.4 lokal permanen". No application code changed.

- **Setup** (`backend/docker/mysql/`):
  - `compose.yaml` runs `mysql:8.4.11` as container `solveit-mysql` on `127.0.0.1:3307`, with the named volume `solveit-mysql-data` and `restart: unless-stopped`.
  - Passwords are Docker secrets in the ignored `secrets/` folder. `root` exists only inside the container.
  - `initdb/` creates `solveit_indonesia` (`solveit_dev`) and `solveit_indonesia_testing` (`solveit_test`) with escaped, database-only grants.
  - The steps and the daily commands, including backup, are in `backend/README.md`.
- **Owner machine**:
  - XAMPP MariaDB 10.4 on 3306 and PHP 8.5.7 are unchanged.
  - `backend/.env` now uses the container, changed with owner approval. The backup is `backend/.env.backup`, and the old SQLite file is unused.
  - `backend/.env.testing` exists.
- **Verified**:
  - Server: `VERSION()` 8.4.11, MySQL Community Server.
  - Migrations: run on the development database.
  - Tests: 109 tests, 275 assertions.
  - Laravel Boost `application-info` reports the `mysql` engine.
- **Real B2 smoke test** (no mocks), with the API-enabled build on `localhost:4174` against `php artisan serve`:
  - A CORS preflight passes.
  - A double click sent one POST, which returned `201` with a real `INQ-` reference.
  - Exactly one row was stored. Invalid input and the honeypot returned `422` and stored nothing.
  - The test row was removed afterwards. Real `429` and the browser display of a server `422` were not exercised.
- **Defaults changed**: `backend/.env.example` now uses `DB_PORT=3307` and adds `http://localhost:4174` to `CORS_ALLOWED_ORIGINS`. Backend CI sets its own `DB_PORT`.

## Branches

- `main`: `88db528` (release B1.1, PR #21). `staging`: `22f6853`, same tree as `main` (`4b71119`).
- `backend`: `88db528` plus the local MySQL setup (`backend/docker/mysql/`, docs). PR to `staging`, left unmerged for the owner's review. No backend file changed in B2.
- `frontend`: `88db528` plus B2: `fe6d272` (test), `b4748d9` (feat), `b843531` (docs), `09efbc0` (chore, verification sequences), plus this status update. PR #22 to `staging`, left unmerged for the owner's review.
- CI before B2 (on `88db528`): Frontend CI 38723671948 and Cross-browser QA 38723672210 green (WebKit 175 passed; WebKit iPhone 14 143 passed after one re-run of the flaky theme test, fixed in B2). Backend CI for B1.1 green on PHP 8.5.11 and MySQL 8.4.11.
- CI for PR #22 (all green):
  - Frontend CI run 38734922594 on `8eed02d`: default build e2e 488 passed; API build e2e 24 passed.
  - Cross-browser QA, no retries, run 38734781136 on `09efbc0` (push) and run 38734933837 on `8eed02d` (dispatch), each with the same result:
    - WebKit: 177 passed, 0 failed, 0 flaky.
    - WebKit iPhone 14: 145 passed, 0 failed, 0 flaky.
    - API build: 7 passed per project, with the email test skipped on WebKit.
  - PR #22 is mergeable. Later docs-only commits re-run the checks.

Check live state with `git fetch --prune && git branch -vv` and `gh pr list`; SHAs here go stale.

## Quality baseline

- Frontend (B2): lint, typecheck, unit tests 125/125, build pass.
  - E2E, default build: Chromium desktop 180, tablet 161, and Pixel 7 147 passed, 0 failed.
  - E2E, API build: Chromium 24, Firefox 8, and WebKit 14 passed (2 skipped).
  - axe: 0 violations.
  - Lighthouse mobile on `/kontak`: performance 100 and CLS 0, unchanged from `main`.
- Backend (unchanged in B2): 109 tests, 275 assertions on MySQL 8.4.11 and PHP 8.5.7; Pint, `composer validate --strict`, `check-platform-reqs`, `audit` clean.

## Blocked or owner action required

- **Local MySQL on the owner machine**: Done (section above). After a Windows restart Docker Desktop must be running; the container then starts by itself.
- **API activation** (owner decision): enabling `VITE_INQUIRY_API_ENABLED` in any shipped build needs approval of the privacy notice text, retention period, hosting, the production MySQL database, `CORS_ALLOWED_ORIGINS`, and who handles inquiries.
- **Merge PR #22** after review, then a `staging` to `main` release PR with owner approval.

## Open decisions (owner)

- Domain and hosting (MySQL 8.4 and PHP 8.5 are decided). They unlock canonical URLs, sitemap, final SEO/GEO, the production CORS origin, `TRUSTED_PROXIES`, and API deployment. The hosting must allow the document root `backend/public/`.
- Inquiry data: retention period, export and deletion procedure, privacy notice on the form, and whether a free CAPTCHA (Turnstile) is needed after launch. Backend idempotency (an idempotency key) before activation, so a visitor who retries after an uncertain outcome cannot create duplicates.
- Admin dashboard: frontend option (recommended: separate `admin/` app on a subdomain), roles, MFA scope, content workflow (static rebuild vs runtime data).
- Visitor analytics: legal and privacy review under UU PDP before any activation, retention, and whether to use a third-party service instead.
- GitHub integration lives in Solveit OpsHub; GitHub App permissions are verified at implementation time.
- How inquiries reach Solveit OpsHub (versioned event or webhook) once OpsHub exists.
- Product names other than Solveit OpsHub are proposals (`docs/product/product-naming.md`). No client has approved a testimonial or a real case study yet.

## Next task

1. Owner: review and merge PR #22 into `staging`, then approve a `staging` to `main` release PR. Fast-forward `frontend` and `backend` to the release.
2. Owner: review and merge the local MySQL PR (`backend` to `staging`). It conflicts with PR #22 in `.ai/project-status.md` (take the `backend` version, which already contains PR #22's text) and at the top of `docs/qa/qa-report.md` (keep both sections).
3. **B3, after owner decisions:** the admin foundation (`docs/architecture/admin-dashboard.md`, section 9). Optionally, backend idempotency for inquiries before the API is activated.
