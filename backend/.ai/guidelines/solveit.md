# Solveit Indonesia Backend

These rules come from the repository and take precedence over the generic Laravel guidance that follows.

## Precedence and scope

- The repository root `AGENTS.md` applies first (content integrity, Git rules, handoff). This backend is only the API of the Solveit Indonesia company profile website. Solveit OpsHub, client portals, proposals, contracts, invoices, payments, and project tracking live in separate repositories and never in this application or its database.
- Documentation is part of done in this repository: update `docs/api/`, `docs/architecture/`, `docs/qa/qa-report.md`, and `.ai/project-status.md` when behaviour changes. This replaces the generic rule to create documentation only on request.
- Hosting and the production database are not decided. Do not add deployment configuration or recommend a platform.

## API conventions

- Public JSON endpoints live in `routes/api.php` under `v1` (served at `/api/v1/...`). Contracts are documented in `docs/api/`; change the document in the same commit as the endpoint.
- Validation in Form Requests under `app/Http/Requests/Api/V1`, business operations in `app/Actions`, responses through API Resources. Enum values must match the frontend types; `tests/Unit/Enums/FrontendContractTest.php` enforces it.
- Never return 201 or a reference unless the row is stored. Never add a public endpoint that lists, reads, changes, or deletes inquiries.

## Personal data

- Inquiries hold names, contacts, and messages. Never log them, include them in exception messages or context, or print them in agent output. Do not chain a `QueryException` into a reported exception: its message contains the SQL bindings.
- Use Boost database tools only against the local SQLite database, never against shared or production data.
