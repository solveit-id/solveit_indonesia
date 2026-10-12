# Pengembangan Lokal

## Prasyarat

- Node.js 22.12 atau lebih baru (diuji dengan 22.23), npm 10
- Untuk e2e: browser Chromium Playwright (`npx playwright install chromium`)
- Opsional, hanya untuk membuat ulang subset font: Python 3 dengan `fonttools` dan `brotli`

## Perintah

Jalankan dari `frontend/`:

| Perintah | Fungsi |
|---|---|
| `npm install` | Instal dependensi |
| `npm run dev` | Server pengembangan di http://localhost:5173 |
| `npm run build` | Build produksi + prerender ke `build/client`, lalu `postbuild` |
| `npm run preview` | Sajikan `build/client` di http://localhost:4173 (clean URL, 404 asli, kompresi) |
| `npm run lint` | ESLint (TypeScript, React Hooks, jsx-a11y) |
| `npm run typecheck` | Typegen React Router + `tsc` |
| `npm test` | Unit dan component test (Vitest) |
| `npm run test:e2e` | Playwright di 3 viewport (desktop 1440, tablet 820, Pixel 7), termasuk axe |
| `npm run format` / `format:check` | Prettier (dengan pengurutan kelas Tailwind) |
| `npm run check` | lint + typecheck + test + build |

## Environment

Salin `frontend/.env.example` menjadi `frontend/.env.local` bila perlu. Semua variabel opsional:

| Variabel | Kapan diisi |
|---|---|
| `VITE_SITE_URL` | Setelah domain dikonfirmasi. Mengaktifkan canonical, `og:url`, `og:image` absolut, BreadcrumbList, dan `sitemap.xml` |
| `VITE_API_BASE_URL` | Saat Laravel API tersedia (fase berikutnya) |
| `VITE_GOOGLE_SITE_VERIFICATION` | Token verifikasi Search Console |

Jangan commit file `.env*` selain `.env.example`.

## Aset

- Logo asli ada di root repo; salinannya di `frontend/public/brand/` dan `frontend/src/assets/brand/`. Path vektor untuk komponen React ada di `src/components/brand/logo-paths.ts` (disalin verbatim).
- `node scripts/generate-brand-assets.mjs` membuat ulang `public/og/solveit-og.png`, `apple-touch-icon.png`, `icon-512.png`, dan `favicon-32.png` dari logo asli.
- `python scripts/subset-font.py` membuat ulang `src/assets/fonts/archivo-solveit.woff2` dari `@fontsource-variable/archivo`.

## Mengganti konten

- Layanan, proses, FAQ: `src/data/services.ts`, `src/data/process.ts`.
- Kontak: `src/data/company.ts` (hanya data yang sudah dikonfirmasi).
- Portofolio: `src/data/projects.ts`. Proyek nyata diberi `isDemo: false`; label demo hilang otomatis dan JSON-LD `CreativeWork` mulai dipublikasikan. `results` hanya boleh berisi hasil yang terverifikasi. Route dan prerender mengikuti data secara otomatis.

## Deployment

Hasil build adalah situs statis di `frontend/build/client`. Hosting harus:

1. Menyajikan `/path` dari `/path/index.html` (clean URL).
2. Menyajikan `404.html` dengan status 404 untuk path yang tidak ada (jangan fallback ke `index.html`).
3. Mengaktifkan kompresi brotli/gzip dan cache panjang untuk `/assets/*` (nama file ber-hash).

Netlify, Cloudflare Pages, Vercel (output statis), atau Nginx memenuhi ini dengan konfigurasi standar.
