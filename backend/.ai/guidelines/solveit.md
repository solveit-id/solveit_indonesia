# Solveit Indonesia Backend

These rules come from the repository and take precedence over the generic Laravel guidance that follows.

## Precedence and scope

- The repository root `AGENTS.md` applies first (content integrity, Git rules, handoff). This backend is only the API of the Solveit Indonesia company profile website. Solveit OpsHub, client portals, proposals, contracts, invoices, payments, and project tracking live in separate repositories and never in this application or its database.
- Documentation is part of done in this repository: update `docs/api/`, `docs/architecture/`, `docs/qa/qa-report.md`, and `.ai/project-status.md` when behaviour changes. This replaces the generic rule to create documentation only on request.
- The database is MySQL 8.4 LTS (Oracle MySQL, not MariaDB) for development, tests, and production; the runtime is PHP 8.5 (at least 8.5.7). Hosting is not decided: do not recommend a platform or add provider-specific configuration. The provider-independent Docker setup (development and production) lives in `../infra/docker/` and follows `docs/project-structure.md` section 11; the application must keep working without it (native PHP and any MySQL 8.4).

## Database and tests

- Write migrations and queries that work on MySQL 8.4 with `utf8mb4` and strict mode. Do not add SQLite-only behaviour or fall back to SQLite in tests.
- Tests run only on the disposable MySQL database `solveit_indonesia_testing` and use `RefreshDatabase`. `phpunit.xml` pins `APP_ENV`, the driver, and the database; `tests/Support/TestDatabaseGuard.php` (called from `tests/TestCase.php`) verifies the environment, the database the server selected, and that the user holds privileges only on that database. Never weaken the guard or point tests at a development, shared, or production database.
- Do not run DDL (`Schema::drop`, `ALTER`) inside a test to simulate failures: MySQL commits DDL implicitly, which breaks the test transaction. Make the database reject a row instead (see `InquiryControllerTest::makeTheDatabaseRejectTheNextInquiry`).
- Never run `migrate:fresh`, `migrate:reset`, `migrate:rollback`, `db:wipe`, or `DROP` outside a disposable database created for that purpose.

## API conventions

- Public JSON endpoints live in `routes/api.php` under `v1` (served at `/api/v1/...`). Contracts are documented in `docs/api/`; change the document in the same commit as the endpoint.
- Validation in Form Requests under `app/Http/Requests/Api/V1`, business operations in `app/Actions`, responses through API Resources. Enum values must match the frontend types; `tests/Unit/Enums/FrontendContractTest.php` enforces it.
- Never return 201 or a reference unless the row is stored. Never add a public endpoint that lists, reads, changes, or deletes inquiries.
- `POST /api/v1/inquiries` is idempotent per `Idempotency-Key` (B2.1): the UNIQUE `idempotency_key_hash` column decides, never a read-before-insert. Keep that contract (docs/api/inquiries.md, Idempotensi) and its multi-process tests (`tests/Feature/Actions/SubmitInquiryConcurrencyTest.php`).

## Admin API (B3.1a, B3.1b)

- Admin routes live only in `routes/admin.php` (served at `/api/v1/admin`, middleware group `admin`), the only routes with a session. Never add `web` or session middleware to `routes/api.php`, and never install Sanctum or apply `statefulApi()`: Sanctum forces `SameSite=Lax` and the admin is same-origin (`docs/architecture/admin-dashboard.md` 3.1).
- Fortify is used as a library only: keep `Fortify::ignoreRoutes()` (`App\Providers\FortifyServiceProvider`) and map controllers explicitly in `routes/admin.php`. Generic Fortify guidance about its own routes, views, registration, password reset, profile updates, passkeys, or disabling two-factor authentication does not apply; enabling any of them needs an owner decision.
- Every new admin route goes into one tier (public authentication, pre-activation, authenticated) and into `tests/Feature/Admin/AdminRouteCoverageTest.php`. Authenticated routes need `can:<permission>`; add an `AdminPermission` case only with the endpoint that needs it, and grant it by naming it in `AdminRole::permissions()` (never all cases). Owner writes also need `password.confirm` after `can:` and `throttle:admin-administration`. Roles stay `owner` and `admin` until the modules for other roles exist.
- Session, cookie, and password-confirmation policy is fixed in `config/session.php`, `config/auth.php`, and `config/admin.php`; do not move it to environment variables.
- Security events are written only through `App\Actions\Admin\RecordAdminAuditEvent` with allowlisted metadata. Never store or log passwords, TOTP codes or secrets, recovery codes, access-link tokens, session IDs, or request payloads. `admin_audit_events` is append-only (model guards and MySQL triggers); retention is pending an owner decision, so do not add pruning.
- Owner operations (`app/Actions/Admin/`) start with `ActiveOwners::lockForActor()` inside `DB::transaction(..., ActiveOwners::TRANSACTION_ATTEMPTS)`, write their audit event in the same transaction, and keep the multi-process tests in `tests/Feature/Admin/AdminAdministrationConcurrencyTest.php` passing. One open access link per account is enforced by MySQL (`admin_access_links.open_for_user_id` UNIQUE); never replace it with a read-before-write check. Access-link URLs appear only in the response that issued them, never in lists, audit rows, or logs.
- No default accounts or passwords: seeders create no users, factories use random passwords. Accounts come from `admin:bootstrap-owner` or owner invitations (B3.1b, delivered by hand, no email). Never run the bootstrap or reset commands against shared or production data; tests use synthetic addresses.
- Admin HTTP tests use `Tests\Support\InteractsWithAdminApi` (real cookies, Origin, CSRF, and TOTP), not `actingAs()`.

## Personal data

- Inquiries hold names, contacts, and messages. Never log them, include them in exception messages or context, or print them in agent output. Do not chain a `QueryException` into a reported exception: its message contains the SQL bindings.
- Use Boost database tools only against the local development or testing MySQL database of this project, never against shared or production data.
