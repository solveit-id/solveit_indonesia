# Solveit Indonesia

> We Don't Just Build Software. We Build Digital Solutions That Last.

Repository website company profile dan portofolio Solveit Indonesia: frontend dan backend/API milik website ini saja. Solveit OpsHub dan sistem Solveit lain dibangun di repository terpisah dan terhubung lewat kontrak API atau event (lihat [docs/architecture/integration-plan.md](docs/architecture/integration-plan.md)).

| Folder | Isi |
|---|---|
| [`frontend/`](frontend) | React + TypeScript + Vite + React Router (prerender statis) + Tailwind CSS v4 + GSAP |
| [`backend/`](backend) | Laravel 13 API (PHP 8.5 minimal 8.5.7, MySQL 8.4 LTS): endpoint inquiry, belum di-deploy. Laravel Boost untuk Claude Code dan Codex |
| [`docs/`](docs) | Fakta produk, spesifikasi desain, arsitektur, panduan pengembangan, SEO/GEO, laporan QA, aturan struktur proyek. Peta: [docs/README.md](docs/README.md) |
| [`.ai/`](.ai) | Handoff antar-agent (Claude Code dan Codex): status proyek dan alur kerja |

## Mulai cepat

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run check      # lint + typecheck + test + build
npm run test:e2e   # Playwright (desktop, tablet, mobile) + axe
```

```bash
cd backend
composer install && cp .env.example .env && php artisan key:generate
php artisan migrate   # butuh MySQL 8.4, lihat backend/README.md
php artisan test      # PHPUnit pada database MySQL solveit_indonesia_testing
```

Detail: [docs/development/development-guide.md](docs/development/development-guide.md) dan [backend/README.md](backend/README.md).

## Alur Git

`frontend` / `backend` → PR ke `staging` → PR ke `main`. Format commit: `(type) deskripsi singkat`.

Logo asli: `frontend/public/brand/solveit-logo-full.svg` (logo lengkap) dan `frontend/public/brand/solveit-logo-icon.svg` (mark). Aturan struktur folder: [docs/project-structure.md](docs/project-structure.md).
