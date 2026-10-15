---
name: backend-verify
description: Run the verification sequence for the Solveit Laravel backend (Pint, PHPUnit, Composer validation and audit, route and migration checks, Laravel Boost MCP) and report real results. Use before committing backend changes or when asked to verify, test, or QA the API.
---

Run from `backend/` and report the actual output of each step; stop at the first failure and fix it. Never print `.env` values or inquiry data.

1. `vendor/bin/pint --test` (fix with `vendor/bin/pint`)
2. `php artisan test` (SQLite in-memory; never point tests at a real database)
3. `composer validate --strict`
4. `composer audit`
5. `php artisan route:list --except-vendor` must show `POST api/v1/inquiries` (no `api/api` prefix)
6. `php artisan migrate:status` on the local SQLite database (never `migrate:fresh`, `reset`, `rollback`, or `db:wipe` outside a throwaway database)
7. After dependency, `config/boost.php`, or `.ai/guidelines/` changes: `php artisan boost:update --no-discover`, then review and commit the `AGENTS.md` diff
8. MCP: `claude mcp list` from the repository root shows `laravel-boost` Connected; in the session, `application-info` reports Laravel 13

CI (`.github/workflows/backend-ci.yml`) repeats steps 1 to 5 on PHP 8.3 and 8.5, runs migrations up, down, and up, and checks a `composer install --no-dev` boot.
