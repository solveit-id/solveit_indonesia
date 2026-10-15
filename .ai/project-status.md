# Project status

Last updated: 2026-10-16 (B2.2 frontend inquiry idempotency and safe retry, from `frontend` through `staging` to `main`; previous release B2.1 and Docker, merge commit `d22a079`, status follow-up `cf55c2f`).

## In one paragraph

The public website (frontend) is built, bilingual (Indonesian at `/`, English at `/en/`), prerendered as static HTML, and released to `main`. The Laravel 13 backend exposes `POST /api/v1/inquiries` and `GET /up` on **PHP 8.5 (at least 8.5.7)** and **MySQL 8.4 LTS**. Since B2.1 the inquiry endpoint is **idempotent per `Idempotency-Key`**, and since B2.2 the website client sends one key per logical submission and lets the visitor check an unconfirmed attempt with the same key. The contact form's **Send through website** channel (B2) is built but **disabled by default** (`VITE_INQUIRY_API_ENABLED=false`), so shipped builds never call the API. The repository now has a **full-Docker development environment** (`infra/docker/compose.dev.yaml`, reusing the existing MySQL container) and a **production-oriented Docker configuration** (`infra/docker/compose.prod.yaml`): production Docker configuration prepared and validated, **not publicly deployed**. No domain, hosting, certificate, or production database exists. Admin dashboard, visitor analytics, and the GitHub integration boundary are designs only (`docs/architecture/`). Supported coding agents: Claude Code and Codex.

## Shipped (on `main`)

| Round | Release PR | Highlights |
|---|---|---|
| 1 to 6 | #2, #4, #6, #8, #10, #13 | Company profile frontend: pages, design system, themes, ID/EN, motion, assistant, case studies, About storytelling |
| B0, B1 | #18 (from #16, #17) | Laravel 13 backend foundation, Laravel Boost, `POST /api/v1/inquiries`, Backend CI. Not deployed |
| B1.1 | #21 (from #20) | MySQL 8.4 LTS and PHP 8.5.7+, test database guard, Claude Code and Codex only. Release commit `88db528` |
| B2 and local MySQL | #24 (from #22, #23; status #25) | Frontend inquiry API channel behind a disabled flag; persistent local MySQL 8.4 container `solveit-mysql`. Release commit `6474647` (2026-10-15) |
| B2.1 and Docker | #27 (from #26) | Inquiry idempotency (backend), full-Docker development, production Docker configuration (not deployed), Docker CI, structure rules (`docs/project-structure.md` section 11). Release commit `d22a079` (2026-10-16) |

Pages: `/`, `/tentang`, `/layanan`, `/proses`, `/portofolio`, five case studies, `/kontak`, 404, each mirrored under `/en/`. Case studies are labelled demonstration concepts (`isDemo: true`, no results). B2 details and evidence: `docs/api/inquiries.md` (Klien frontend) and `docs/qa/qa-report.md` (sections B2 and MySQL 8.4 lokal permanen).

## B2.1: inquiry idempotency (backend)

Status: Implemented and Tested (locally, in the Docker dev container, and in Backend CI). Not deployed. Used by the website client since B2.2 (below). Contract: `docs/api/inquiries.md`, section Idempotensi (B2.1). Evidence: `docs/qa/qa-report.md`, section B2.1.

- Optional header `Idempotency-Key`: exactly one UUID v4 (any case). Malformed: `400` before validation. Missing: B1 behaviour, no duplicate protection.
- Same key and equivalent canonical payload: `201` with the original reference and `Idempotent-Replayed: true`, no new row. Same key, different content: `409`, nothing stored, no reference revealed. Different keys: independent inquiries.
- Storage: nullable `UNIQUE` column `inquiries.idempotency_key_hash` (SHA-256 of the key, never the key). The insert itself is the check; a losing concurrent insert waits on InnoDB, then replays or conflicts. No second copy or fingerprint of personal data: equivalence compares the stored row. Deadlocks are retried up to three times.
- Failed inserts (`503`) and rejected payloads (`422`) do not consume the key. Rate limiting still counts every retry. CORS allows the header only for the configured origins and exposes `Idempotent-Replayed`.
- Key lifecycle: the hash lives and dies with the inquiry row; no separate expiry (retention is an owner decision).
- Tests: 151 tests, 466 assertions (109 and 275 before), including five multi-process tests with independent MySQL connections and a mutation check that proved they fail without the key hash.

## B2.2: inquiry idempotency and safe retry (frontend)

Status: Implemented and Tested (unit, component, mocked E2E in Chromium and Firefox, and a real browser to Laravel to MySQL 8.4 smoke test with synthetic data). Not deployed; the channel stays **disabled by default** (`VITE_INQUIRY_API_ENABLED=false` in `.env.example`, default builds, and `compose.prod.yaml`). Design: `docs/api/inquiries.md`, section Penerapan di frontend (B2.2). Evidence: `docs/qa/qa-report.md`, section B2.2. Backend, CORS, and Docker unchanged.

- One `LogicalSubmission` (key from `crypto.randomUUID()` plus the canonical values sent with it) per website submission, in component memory only. Same canonical content reuses the key (also after edit and restore); other content gets a new key. No fallback generator: without Web Crypto (old browser, or plain HTTP to a LAN IP) nothing is sent and WhatsApp or email is suggested.
- Retired after `201`, `400`, `409`; kept after uncertain outcomes and after refusals that do not use up the key. No automatic retry at all: an uncertain result shows **Kirim ulang permintaan yang sama** / **Retry the same request** while the content is unchanged, and explains that changed content becomes a separate request.
- Only Laravel's exact `503` body counts as "not stored"; any other `503`, `502`, `504`, `5xx`, unreadable `201`, network error, or timeout is uncertain. `429` blocks new requests until `Retry-After` passes. `Idempotent-Replayed: true` adds one sentence to the normal receipt.
- Known limitation (deliberate): a reload, closed tab, or navigation forgets the key, so a resend after that can create a second inquiry. Persisting it would put personal data in browser storage.
- Tests: 178 unit and component tests (125 before), API-build E2E 15 per project (9 before), default E2E 488 unchanged. Bundle: +866 bytes gzip in total.

## Docker environments (`infra/docker/`)

Status: Development Implemented and Verified (owner machine and Docker CI). Production prepared and validated (local isolated smoke test and Docker CI), **not deployed**. Rules: `docs/project-structure.md` section 11. Guides: `docs/development/docker-development.md`, `docs/development/docker-production.md`.

- **Development** (`compose.dev.yaml`, project `solveit-indonesia`): `backend` (PHP 8.5.11, Composer 2.10.3, `artisan serve`, `127.0.0.1:8000`), `frontend` (Node 22.23.1, Vite with polling hot reload, `127.0.0.1:5173`), and MySQL **included unchanged** from `backend/docker/mysql/compose.yaml`. Identical config hash, so the existing `solveit-mysql` container and `solveit-mysql-data` volume are reused, never recreated (verified: same container ID and start time before and after). Onboarding: `bash infra/docker/scripts/setup-dev.sh` (creates only missing secrets and `.env` files, never overwrites). Native and Docker workflows share the same database and run side by side.
- **Production** (`compose.prod.yaml`): nginx gateway (only published service, loopback by default), static frontend (nginx, no Node), Laravel on PHP-FPM (`--no-dev`, www-data, read-only, secrets as files), explicit `migrate` one-off service with a separate DDL user, optional bundled MySQL 8.4 with a DML-only app user. `VITE_INQUIRY_API_ENABLED` is fixed to `false`. TLS is not configured (no domain).
- **Docker CI** (`.github/workflows/docker-ci.yml`): Compose and shellcheck validation, fresh-clone onboarding with backend and frontend tests inside containers, production build and `verify-production.sh` (33 checks) with random secrets. Never deploys or pushes images.
- Fixed during QA: a health endpoint reachable through Docker Desktop's port forwarding (moved to an unpublished port), and MySQL secrets created `600` that the MySQL image cannot read on Linux (now `644` files in a `700` folder; `backend/README.md` troubleshooting).

## Owner machine (verified 2026-10-16)

- XAMPP PHP 8.5.7 and MariaDB 10.4 on 3306: unchanged. `solveit-mysql` (`mysql:8.4.11`, `127.0.0.1:3307`) and `solveit-mysql-data`: unchanged, reused by the Docker dev project.
- The B2.1 migration ran on the development database (additive). New Docker volumes: `solveit-indonesia_backend-vendor`, `solveit-indonesia_composer-cache`, `solveit-indonesia_frontend-node-modules`. Dev `backend` and `frontend` containers exist but are stopped and do not auto-start, so ports 8000 and 5173 stay free for the native workflow.
- The isolated production smoke project (`solveit-prod-smoke`) was removed with its own volume; images `solveit-indonesia/{backend,frontend}:local` and `:dev` remain.

## Branches and CI

- B2.2 baseline: `main`, `frontend`, `backend` at `cf55c2f`, `staging` at `b6b429b` (same tree). B2.2 is developed on `frontend` and released through a `frontend` to `staging` PR and a `staging` to `main` release PR; the PR numbers, CI runs, and merge commits are in GitHub (`gh pr list --state merged --limit 5`).
- Previous release (B2.1 and Docker): PR #26 (`backend` to `staging`) merged as `7b232f9`; release PR #27 (`staging` to `main`) merged as `d22a079`. `main` has no commit missing from `staging`, and `6474647` is an ancestor of `d22a079`.
- After the release `main`, `frontend`, and `backend` were at `d22a079` and `staging` at `7b232f9`, all with tree `fca31d4` (fast-forward pushes, no force). This status update follows as a docs-only PR.
- Commits in the release: `dcd653e` (feat, idempotency), `6418370` (chore, Docker development), `97c4be5` (feat, Docker production), `6c39e6f` (test, Docker CI), `73c2a1e`, `a126fbe`, `fc12e92`, `fe58a3d` (fixes found by Docker CI and QA), `3202aab` (docs).
- CI on PR #26 head `3202aab` (all green):
  - Backend CI 38806467946: PHP 8.5.11, MySQL 8.4.11, 151 tests, 466 assertions, no advisories.
  - Frontend CI 38806468013: 125 unit tests, default E2E 488 passed, API-build E2E 24 passed.
  - Docker CI 38806467997: Compose and scripts, fresh-clone development onboarding (PHP 8.5.11, Node v22.23.1, 151 tests in the container), production images with all smoke checks passing.
- CI on release PR #27 (all green): Backend CI 38807594540, Frontend CI 38807594554, Docker CI 38807594773.
- Earlier Docker CI runs 38805164238, 38805322828, and 38805741991 failed and led to the fixes listed in `docs/qa/qa-report.md` (B2.1 section).

Check live state with `git fetch --prune && git branch -vv` and `gh pr list`; SHAs here go stale.

## Quality baseline

- Frontend (B2.2, local): Prettier, ESLint, typecheck, build clean; 178 unit and component tests; default E2E 488 passed (desktop 180, tablet 161, mobile 147); API-build E2E 15 passed each on desktop, tablet, mobile, and Firefox, with axe on the new states. Lighthouse not rerun (less than 1 KB gzip added, contact page only). WebKit through the Cross-browser QA workflow on the PR head.
- Backend (unchanged since B2.1): 151 tests, 466 assertions on MySQL 8.4.11 (native PHP 8.5.7 and container PHP 8.5.11); Pint, `composer validate --strict`, `check-platform-reqs`, `audit` clean (`COMPOSER_IPRESOLVE=4` locally).

## Blocked or owner action required

- **API activation** (owner decision): enabling `VITE_INQUIRY_API_ENABLED` in any shipped build needs approval of the privacy notice text, retention period, hosting, the production MySQL database, `CORS_ALLOWED_ORIGINS`, and who handles inquiries. B2.2 (client idempotency) is done, so nothing technical on the client side blocks it.
- **Production deployment** (owner decision): hosting provider, domain, TLS, production database (bundled or managed), backup storage. The Docker setup is ready to be tried on an approved Docker-capable host; nothing has been deployed.
- **Security hardening (pending, owner approval)**: on the owner machine, `backend/docker/mysql/secrets/` and `backend/.env` inherit the D: drive ACL (`Authenticated Users` and `CodexSandboxUsers` can read). Change ACLs only after an effective-permissions audit, a decision about the Codex sandbox group, and specific owner approval. Not changed in this task.

## Open decisions (owner)

- Domain and hosting (MySQL 8.4 and PHP 8.5 are decided; Docker is a supported option, not a requirement). They unlock canonical URLs, sitemap, final SEO/GEO, the production CORS origin, `TRUSTED_PROXIES` or the gateway's `set_real_ip_from`, TLS, and API deployment.
- Inquiry data: retention period (also ends the life of idempotency keys), export and deletion procedure, privacy notice on the form, and whether a free CAPTCHA (Turnstile) is needed after launch.
- Admin dashboard: frontend option (recommended: separate `admin/` app on a subdomain), roles, MFA scope, content workflow. Visitor-submitted inquiry fields should stay unchanged (idempotency compares them).
- Visitor analytics: legal and privacy review under UU PDP before any activation.
- GitHub integration lives in Solveit OpsHub. How inquiries reach OpsHub (versioned event or webhook) once it exists.
- Product names other than Solveit OpsHub are proposals (`docs/product/product-naming.md`). No client has approved a testimonial or a real case study yet.

## Next task

1. **Inquiry privacy and operational readiness** (owner decisions above: privacy notice text on the form, retention period, who handles inquiries, hosting and domain), then a first deployment on the approved host using `docs/development/docker-production.md` or a non-Docker host, with `CORS_ALLOWED_ORIGINS` set to the real website origin and a staging build that enables the channel.
2. **B3**: secure admin authentication and dashboard foundation (`docs/architecture/admin-dashboard.md`, section 9).
