# Solveit Indonesia Backend

These rules come from the repository and take precedence over the generic Laravel guidance that follows.

## Precedence and scope

- The repository root `AGENTS.md` applies first (content integrity, Git rules, handoff). This backend is only the API of the Solveit Indonesia company profile website. Solveit OpsHub, client portals, proposals, contracts, invoices, payments, and project tracking live in separate repositories and never in this application or its database.
- Documentation is part of done in this repository: update `docs/api/`, `docs/architecture/`, `docs/qa/qa-report.md`, and `.ai/project-status.md` when behaviour changes. This replaces the generic rule to create documentation only on request.
- The database is MySQL 8.4 LTS (Oracle MySQL, not MariaDB) for development, tests, and production; the runtime is PHP 8.5 (at least 8.5.7). Hosting is not decided: do not add deployment configuration or recommend a platform.

## Database and tests

- Write migrations and queries that work on MySQL 8.4 with `utf8mb4` and strict mode. Do not add SQLite-only behaviour or fall back to SQLite in tests.
- Tests run on a disposable MySQL database whose name contains `_testing` (`phpunit.xml`, guarded in `tests/TestCase.php`) and use `RefreshDatabase`. Never point tests at a development, shared, or production database.
- Do not run DDL (`Schema::drop`, `ALTER`) inside a test to simulate failures: MySQL commits DDL implicitly, which breaks the test transaction. Make the database reject a row instead (see `InquiryControllerTest::makeTheDatabaseRejectTheNextInquiry`).
- Never run `migrate:fresh`, `migrate:reset`, `migrate:rollback`, `db:wipe`, or `DROP` outside a disposable database created for that purpose.

## API conventions

- Public JSON endpoints live in `routes/api.php` under `v1` (served at `/api/v1/...`). Contracts are documented in `docs/api/`; change the document in the same commit as the endpoint.
- Validation in Form Requests under `app/Http/Requests/Api/V1`, business operations in `app/Actions`, responses through API Resources. Enum values must match the frontend types; `tests/Unit/Enums/FrontendContractTest.php` enforces it.
- Never return 201 or a reference unless the row is stored. Never add a public endpoint that lists, reads, changes, or deletes inquiries.

## Personal data

- Inquiries hold names, contacts, and messages. Never log them, include them in exception messages or context, or print them in agent output. Do not chain a `QueryException` into a reported exception: its message contains the SQL bindings.
- Use Boost database tools only against the local development or testing MySQL database of this project, never against shared or production data.
