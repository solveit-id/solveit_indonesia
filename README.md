# Solveit Indonesia

> We Don't Just Build Software. We Build Digital Solutions That Last.

Repository website company profile dan portofolio Solveit Indonesia: frontend dan backend/API milik website ini saja. Solveit OpsHub dan sistem Solveit lain dibangun di repository terpisah dan terhubung lewat kontrak API atau event (lihat [docs/architecture/integration-plan.md](docs/architecture/integration-plan.md)).

| Folder | Isi |
|---|---|
| [`frontend/`](frontend) | React + TypeScript + Vite + React Router (prerender statis) + Tailwind CSS v4 + GSAP |
| [`backend/`](backend) | Dicadangkan untuk Laravel 13 / PHP 8.5 (fase berikutnya) |
| [`docs/`](docs) | Fakta produk, spesifikasi desain, arsitektur, panduan pengembangan, SEO/GEO, laporan QA, aturan struktur proyek. Peta: [docs/README.md](docs/README.md) |
| [`.ai/`](.ai) | Handoff untuk agent lain (Codex, Cursor, dan lainnya): status proyek dan alur kerja |

## Mulai cepat

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run check      # lint + typecheck + test + build
npm run test:e2e   # Playwright (desktop, tablet, mobile) + axe
```

Detail: [docs/development/development-guide.md](docs/development/development-guide.md).

## Alur Git

`frontend` / `backend` → PR ke `staging` → PR ke `main`. Format commit: `(type) deskripsi singkat`.

Logo asli: `frontend/public/brand/solveit-logo-full.svg` (logo lengkap) dan `frontend/public/brand/solveit-logo-icon.svg` (mark). Aturan struktur folder: [docs/project-structure.md](docs/project-structure.md).
