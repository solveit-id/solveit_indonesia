# Solveit Indonesia

> We Don't Just Build Software. We Build Digital Solutions That Last.

Monorepo website company profile dan portofolio Solveit Indonesia, sekaligus fondasi ekosistem Solveit OpsHub.

| Folder | Isi |
|---|---|
| [`frontend/`](frontend) | React + TypeScript + Vite + React Router (prerender statis) + Tailwind CSS v4 + GSAP |
| [`backend/`](backend) | Dicadangkan untuk Laravel 13 / PHP 8.5 (fase berikutnya) |
| [`docs/`](docs) | Arsitektur, pengembangan lokal, design system, SEO/GEO, rencana integrasi, laporan QA |

## Mulai cepat

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run check      # lint + typecheck + test + build
npm run test:e2e   # Playwright (desktop, tablet, mobile) + axe
```

Detail: [docs/development.md](docs/development.md).

## Alur Git

`frontend` / `backend` → PR ke `staging` → PR ke `main`. Format commit: `(type) deskripsi singkat`.

Aset merek asli: `logo-solveit-primary.svg`, `logo-solveit-icon.svg`.
