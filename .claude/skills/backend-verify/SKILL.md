---
name: backend-verify
description: Run the verification sequence for the Solveit Laravel backend (PHP 8.5.7+ and pdo_mysql, Pint, PHPUnit on the isolated MySQL 8.4 testing database, Composer validation, platform check and audit, route and migration checks, Laravel Boost MCP) and report real results. Use before committing backend changes or when asked to verify, test, or QA the API.
---

Run from `backend/` and report the actual output of each step; stop at the first failure and fix it. Never print `.env` or `.env.testing` values, credentials, or inquiry data. Setup and grants: `backend/README.md` (Database MySQL).

1. `php -v` reports PHP 8.5, at least 8.5.7, and `php -m` lists `pdo_mysql`
2. `vendor/bin/pint --test` (fix with `vendor/bin/pint`)
3. `php artisan test` runs only on the disposable MySQL 8.4 database `solveit_indonesia_testing` (Oracle MySQL, never MariaDB), with credentials from `.env.testing`. The suite pins the database in `phpunit.xml` and `tests/Support/TestDatabaseGuard.php` refuses to run unless `APP_ENV=testing`, the server selected exactly that database, and the user holds privileges only on `` `solveit\_indonesia\_testing` ``. If the guard refuses, fix the setup; never weaken the guard or point tests at a development, shared, or production database
4. `composer validate --strict` and `composer check-platform-reqs`
5. `composer audit`
6. `php artisan route:list --except-vendor` must show `POST api/v1/inquiries` (no `api/api` prefix)
7. `php artisan migrate:status` on the local development MySQL database (never `migrate:fresh`, `reset`, `rollback`, `db:wipe`, or `DROP` outside a disposable database)
8. After dependency, `config/boost.php`, or `.ai/guidelines/` changes: `php artisan boost:update --no-discover`, then review and commit the `AGENTS.md` diff
9. MCP: `claude mcp list` from the repository root shows `laravel-boost` Connected; in the session, `application-info` reports Laravel 13 and PHP 8.5

CI (`.github/workflows/backend-ci.yml`) repeats steps 1 to 6 on PHP 8.5 (asserting at least 8.5.7 and recording the patch) with a disposable `mysql:8.4` service container, runs migrations up, down, and up, an HTTP smoke test as a user without DDL rights, and checks a `composer install --no-dev` boot.
