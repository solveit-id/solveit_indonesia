---
paths:
  - "backend/**"
---

# Backend conventions

- Follow `backend/AGENTS.md` (Laravel Boost guidelines and Solveit backend rules). Use the `laravel-boost` MCP tools, especially `search-docs`, before relying on Laravel APIs.
- Endpoints live in `routes/api.php` under `v1` and are documented in `docs/api/` in the same commit.
- Create files with `php artisan make:* --no-interaction`; run `vendor/bin/pint` and the affected tests before finishing.
- Do not edit the `<laravel-boost-guidelines>` block by hand: change `backend/.ai/guidelines/` or `backend/config/boost.php`, then `php artisan boost:update --no-discover`.
