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
| `npm run test:e2e` | Playwright di 3 viewport (desktop 1440, tablet 820, Pixel 7), termasuk axe di kedua tema dan kedua bahasa |
| `PW_ALL_BROWSERS=1 npm run test:e2e` | Menambahkan Firefox dan WebKit desktop (butuh `npx playwright install firefox webkit`) |
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

Setiap teks ada dalam dua bahasa. TypeScript menolak build bila satu bahasa kehilangan kunci, dan `src/data/content.test.ts` memeriksa kelengkapan, panjang daftar, serta larangan em dash di kedua bahasa.

- Teks antarmuka (judul seksi, tombol, label formulir, pesan validasi, metadata SEO): `src/i18n/messages/id.ts` (mendefinisikan bentuk) dan `src/i18n/messages/en.ts`.
- Layanan, proses, FAQ: urutan di `src/data/services.ts` dan `src/data/process.ts`; teks di `src/data/locales/{id,en}/services.ts` dan `process.ts`.
- Kontak: `src/data/company.ts` (hanya data yang sudah dikonfirmasi: email, tiga WhatsApp, Instagram).
- Portofolio: fakta dasar (kunci, slug per bahasa, kategori, teknologi, sampul) di `src/data/projects.ts`; narasi di `src/data/locales/{id,en}/projects.ts`. Proyek nyata diberi `isDemo: false`; label demo hilang otomatis dan JSON-LD `CreativeWork` mulai dipublikasikan. `results` hanya boleh berisi hasil yang terverifikasi. Route, prerender, dan pasangan hreflang mengikuti data secara otomatis.
- Halaman atau bahasa baru: tambahkan path ke `pagePaths` di `src/i18n/config.ts` dan file halaman di `src/routes.ts`; untuk bahasa baru tambahkan juga ke `locales`, `localeMeta`, `messages`, dan `src/data/locales/`.

## Deployment

Hasil build adalah situs statis di `frontend/build/client`. Hosting harus:

1. Menyajikan `/path` dari `/path/index.html` (clean URL).
2. Menyajikan 404 dengan status 404 untuk path yang tidak ada (jangan fallback ke `index.html`): `en/404.html` untuk path di bawah `/en/`, `404.html` untuk yang lain. Cloudflare Pages melakukannya otomatis (404.html terdekat); di Netlify tambahkan aturan `/en/*  /en/404.html  404` di `_redirects`; di Nginx gunakan `error_page 404` per `location /en/`.
3. Mengaktifkan kompresi brotli/gzip dan cache panjang untuk `/assets/*` (nama file ber-hash).

Netlify, Cloudflare Pages, Vercel (output statis), atau Nginx memenuhi ini dengan konfigurasi standar.
