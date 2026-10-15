# Pengembangan Lokal

Frontend (`frontend/`) di bagian atas; backend Laravel (`backend/`) di bagian [Backend (Laravel)](#backend-laravel).

## Prasyarat

- Node.js 22.12 atau lebih baru (diuji dengan 22.23), npm 10
- Untuk e2e: browser Chromium Playwright (`npx playwright install chromium`)
- Opsional, hanya untuk membuat ulang subset font: Python 3 dengan `fonttools` dan `brotli`
- Backend: PHP 8.3 atau lebih baru (diuji dengan 8.5.7) dengan ekstensi `mbstring`, `intl`, `bcmath`, `pdo_sqlite`, `sqlite3`, `openssl`, `fileinfo`; Composer 2 (diuji dengan 2.8.12). Tidak butuh Docker, Redis, atau queue worker

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
| GitHub Actions: **Cross-browser QA** | Suite penuh di WebKit desktop dan WebKit iPhone 14 pada runner bersih (1 worker, tanpa retry, laporan sebagai artefak). Jalankan lewat tab Actions atau `gh workflow run cross-browser-qa.yml -f ref=<sha>` setelah workflow ada di `main`. CI reguler tetap hanya Chromium |
| `npm run format` / `format:check` | Prettier (dengan pengurutan kelas Tailwind) |
| `npm run check` | lint + typecheck + test + build |

## Environment

Salin `frontend/.env.example` menjadi `frontend/.env.local` bila perlu. Semua variabel opsional:

| Variabel | Kapan diisi |
|---|---|
| `VITE_SITE_URL` | Setelah domain dikonfirmasi. Mengaktifkan canonical, `og:url`, `og:image` absolut, BreadcrumbList, dan `sitemap.xml` |
| `VITE_API_BASE_URL` | Saat API backend di-deploy dan kanal `api` formulir dibangun (B2). Lokal: `http://localhost:8000` |
| `VITE_GOOGLE_SITE_VERIFICATION` | Token verifikasi Search Console |

Jangan commit file `.env*` selain `.env.example`.

## Aset

- Logo asli (satu-satunya salinan di repo) ada di `public/brand/`: `solveit-logo-full.svg` (logo lengkap: mark, wordmark, INDONESIA) dan `solveit-logo-icon.svg` (mark saja). Keduanya disajikan situs, dibaca `generate-brand-assets.mjs`, dan `solveit-logo-full.svg` menjadi logo JSON-LD. Path vektor untuk komponen React ada di `src/components/brand/logo-paths.ts` (disalin verbatim). Bila logo berubah, perbarui keduanya bersamaan.
- `node scripts/generate-brand-assets.mjs` membuat ulang `public/og/solveit-og.png`, `apple-touch-icon.png`, `icon-512.png`, dan `favicon-32.png` dari logo asli.
- `python scripts/subset-font.py` membuat ulang `src/assets/fonts/archivo-solveit.woff2` dari `@fontsource-variable/archivo`.

## Mengganti konten

Setiap teks ada dalam dua bahasa. TypeScript menolak build bila satu bahasa kehilangan kunci, dan `src/data/content.test.ts` memeriksa kelengkapan, panjang daftar, serta larangan em dash di kedua bahasa.

- Teks antarmuka (judul seksi, tombol, label formulir, pesan validasi, metadata SEO): `src/i18n/messages/id.ts` (mendefinisikan bentuk) dan `src/i18n/messages/en.ts`.
- Layanan, proses, FAQ: urutan di `src/data/services.ts` dan `src/data/process.ts`; teks di `src/data/locales/{id,en}/services.ts` dan `process.ts`.
- Kontak: `src/data/company.ts` (hanya data yang sudah dikonfirmasi: email, tiga WhatsApp, Instagram).
- Ekosistem (peta "Arah pengembangan" di Tentang Kami): `src/data/ecosystem.ts`, dengan teks peran per bahasa. Status hanya `current`, `design`, atau `planned`; jangan tambahkan status "tersedia" sebelum produk benar-benar diluncurkan. Nama produk masih usulan, lihat `docs/product/product-naming.md`.
- Pratinjau responsif studi kasus: `preview` di `src/data/projects.ts`. Konsep memakai `{ kind: "concept" }` (wireframe berlabel dari narasi). Untuk proyek nyata dengan izin publikasi, gunakan `{ kind: "screenshots", shots: { desktop, tablet, mobile } }` dengan file di `public/`; labelnya berganti otomatis menjadi "Pratinjau aplikasi nyata".
- Portofolio: fakta dasar (kunci, slug per bahasa, kategori, teknologi, sampul) di `src/data/projects.ts`; narasi di `src/data/locales/{id,en}/projects.ts`. Proyek nyata diberi `isDemo: false`; label demo hilang otomatis dan JSON-LD `CreativeWork` mulai dipublikasikan. `results` hanya boleh berisi hasil yang terverifikasi. Route, prerender, dan pasangan hreflang mengikuti data secara otomatis.
- Halaman atau bahasa baru: tambahkan path ke `pagePaths` di `src/i18n/config.ts` dan file halaman di `src/routes.ts`; untuk bahasa baru tambahkan juga ke `locales`, `localeMeta`, `messages`, dan `src/data/locales/`.

## Deployment

Hasil build adalah situs statis di `frontend/build/client`. Hosting harus:

1. Menyajikan `/path` dari `/path/index.html` (clean URL).
2. Menyajikan 404 dengan status 404 untuk path yang tidak ada (jangan fallback ke `index.html`): `en/404.html` untuk path di bawah `/en/`, `404.html` untuk yang lain. Cloudflare Pages melakukannya otomatis (404.html terdekat); di Netlify tambahkan aturan `/en/*  /en/404.html  404` di `_redirects`; di Nginx gunakan `error_page 404` per `location /en/`.
3. Mengaktifkan kompresi brotli/gzip dan cache panjang untuk `/assets/*` (nama file ber-hash).

Netlify, Cloudflare Pages, Vercel (output statis), atau Nginx memenuhi ini dengan konfigurasi standar.

## Backend (Laravel)

Ringkasan untuk pengembangan harian. Rincian environment, struktur, dan keamanan ada di `backend/README.md`; kontrak endpoint di `docs/api/`; aturan Laravel Boost di `docs/project-structure.md` bagian 9.

### Setup dari clone baru

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite        # PowerShell: New-Item database/database.sqlite
php artisan migrate
php artisan boost:update --no-discover   # salinan skill Boost untuk Claude Code, Codex, Cursor
php artisan test
php artisan serve                     # http://localhost:8000
```

Untuk mencoba bersama frontend: `npm run dev` di `frontend/` (origin `http://localhost:5173` sudah ada di `CORS_ALLOWED_ORIGINS` contoh). Frontend belum memanggil API sampai B2.

### Perintah

Jalankan dari `backend/`:

| Perintah | Fungsi |
|---|---|
| `php artisan test` | Semua tes, SQLite in-memory (tidak menyentuh `database/database.sqlite`) |
| `php artisan test --filter=<NamaTes>` | Tes tertentu |
| `vendor/bin/pint --test` / `vendor/bin/pint` | Cek / perbaiki gaya kode |
| `composer validate --strict` | Validasi `composer.json` dan lock |
| `composer audit` | Audit kerentanan dependensi |
| `php artisan route:list --except-vendor` | Daftar route; harus `POST api/v1/inquiries` |
| `php artisan migrate` / `migrate:status` | Migrasi database lokal |
| `composer run dev` | `serve` dan `queue:listen` bersamaan |

Jangan menjalankan `migrate:fresh`, `migrate:reset`, `migrate:rollback`, atau `db:wipe` pada database yang bukan milik Anda. CI menguji rollback pada file SQLite sekali pakai.

### CI

**Backend CI** (`.github/workflows/backend-ci.yml`) berjalan pada PR ke `staging` atau `main` dan push ke `backend` bila `backend/**`, `frontend/src/types/**`, atau workflow-nya berubah. Matriks PHP 8.3 dan 8.5: `composer validate --strict`, `composer install`, Pint, migrasi naik, turun, naik pada SQLite sekali pakai, `php artisan test`, cek route, `composer audit`, lalu `composer install --no-dev` yang harus tetap boot tanpa Boost. Tidak butuh rahasia. Frontend CI dan Cross-browser QA tidak berubah dan tidak dipicu oleh perubahan backend saja.

### Laravel Boost dan MCP untuk agent

Laravel Boost (`laravel/boost`, dev dependency) wajib untuk pekerjaan backend berbantuan AI. Server MCP-nya didaftarkan untuk sesi yang dimulai di **root repository**:

| Agent | File | Perintah | Langkah pertama |
|---|---|---|---|
| Claude Code | `.mcp.json` (bersama Playwright) | `php backend/artisan boost:mcp` | Sudah diizinkan lewat `enabledMcpjsonServers` di `.claude/settings.json` |
| Codex | `.codex/config.toml` | `php backend/artisan boost:mcp` | Percayai repository saat Codex menanyakannya; konfigurasi proyek tidak dimuat sebelum itu |
| Cursor | `.cursor/mcp.json` | `php ${workspaceFolder}/backend/artisan boost:mcp` | Aktifkan `laravel-boost` di pengaturan MCP Cursor (belum diuji di mesin ini) |

Untuk sesi yang dimulai di `backend/`, jalankan `php artisan boost:install --mcp --no-interaction` sekali; Boost menulis `backend/.mcp.json`, `backend/.codex/config.toml`, dan `backend/.cursor/mcp.json` (diabaikan Git) dengan `php artisan boost:mcp`.

Memeriksa bahwa MCP berfungsi:

```bash
claude mcp list          # dari root: "laravel-boost: php backend/artisan boost:mcp - Connected"
codex mcp list           # dari root, setelah repository dipercaya: laravel-boost terdaftar
php backend/artisan list boost
```

Di dalam sesi agent, panggil tool `application-info` (harus menyebut Laravel 13 dan PHP yang terpasang) dan `search-docs` (hasil berlabel `laravel/framework@13.x`). Server MCP dibaca saat sesi dimulai, jadi mulai ulang sesi setelah mengubah konfigurasi MCP.

Memperbarui sumber daya Boost: setelah `composer update`, setelah mengubah `backend/.ai/guidelines/` atau `backend/config/boost.php`, dan setelah clone baru, jalankan `php artisan boost:update --no-discover` lalu commit perubahan `backend/AGENTS.md`. Perintah ini tidak dipasang sebagai script Composer, karena tidak tersedia pada instalasi `--no-dev`.

### Environment backend

Lihat tabel di `backend/README.md`. Yang paling penting: `APP_DEBUG=false` di luar lokal, `CORS_ALLOWED_ORIGINS` berisi origin website yang persis, dan `TRUSTED_PROXIES` diisi bila API berada di belakang proxy atau CDN. `backend/.env` tidak pernah di-commit; agent tidak boleh membaca atau mencetaknya.

### Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| `claude mcp list` melaporkan `laravel-boost` gagal | Sesi tidak dimulai di root repository, atau `php` tidak ada di `PATH`. Jalankan `php backend/artisan boost:mcp` dari root: perintah itu harus menunggu input tanpa galat (hentikan dengan Ctrl+C) |
| `playwright` timeout di `claude mcp list` pada Windows | Unduhan `npx` pertama lebih lama dari batas health check 30 detik; servernya sendiri berjalan. Bila gagal di sesi, pakai `cmd /c npx -y @playwright/mcp@0.0.83` (lihat `CLAUDE.md`) |
| `codex mcp list` tidak menampilkan `laravel-boost` | Repository belum dipercaya di Codex, atau sesi dimulai di folder lain |
| `boost:update` meminta "set up Boost first" | `backend/boost.json` hilang; pulihkan dari Git |
| Galat `could not find driver` | Ekstensi `pdo_sqlite` belum aktif di `php.ini` |
| `composer install` gagal di PHP 8.3 karena Symfony | Lock dibuat tanpa `config.platform.php`; jangan hapus pengaturan itu dari `composer.json` |
| Agent tidak dapat membaca `.env.example` | Pola `deny` di `.claude/settings.json` terlalu lebar; lihat `docs/project-structure.md` bagian 6 |
| Skill Boost tidak muncul di agent | Jalankan `php artisan boost:update --no-discover`; salinan skill tidak di-commit |
