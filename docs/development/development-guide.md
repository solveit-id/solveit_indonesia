# Pengembangan Lokal

Frontend (`frontend/`) di bagian atas; backend Laravel (`backend/`) di bagian [Backend (Laravel)](#backend-laravel). Dokumen ini menjelaskan alur **native** (alat terpasang di komputer). Alternatifnya, seluruh lingkungan di Docker tanpa PHP, Node, atau MySQL di host: `docker-development.md`.

## Prasyarat

- Node.js 22.12 atau lebih baru (diuji dengan 22.23), npm 10
- Untuk e2e: browser Chromium Playwright (`npx playwright install chromium`)
- Opsional, hanya untuk membuat ulang subset font: Python 3 dengan `fonttools` dan `brotli`
- Backend: PHP 8.5, minimal 8.5.7 (diuji dengan 8.5.7) dengan ekstensi `pdo_mysql`, `mbstring`, `intl`, `bcmath`, `openssl`, `fileinfo`; Composer 2 (diuji dengan 2.8.12); server **MySQL 8.4 LTS** (Oracle MySQL, bukan MariaDB; diuji dengan 8.4.11). Tidak butuh Redis atau queue worker. Docker dipakai untuk MySQL 8.4 lokal (cara yang disarankan) dan, bila ingin, untuk seluruh lingkungan (`docker-development.md`)

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
| `npm run test:e2e:api` | Playwright untuk build kedua dengan kanal API inquiry aktif (`playwright.api.config.ts`, `tests/e2e-api/`, port 4174, output `build/inquiry-api/client`). Semua respons API di-mock dengan `page.route` (termasuk mock berstatus yang meniru idempotensi B2.1: menyimpan per kunci, replay, `409`, dan respons yang hilang setelah tersimpan); tidak ada request yang keluar. Nilai `VITE_*` ditanam saat build, jadi mode aktif dan nonaktif hanya bisa dibuktikan dengan dua build |
| `PW_ALL_BROWSERS=1 npm run test:e2e` | Menambahkan Firefox dan WebKit desktop (butuh `npx playwright install firefox webkit`) |
| GitHub Actions: **Cross-browser QA** | Suite penuh di WebKit desktop dan WebKit iPhone 14 pada runner bersih (1 worker, tanpa retry, laporan sebagai artefak). Jalankan lewat tab Actions atau `gh workflow run cross-browser-qa.yml -f ref=<sha>` setelah workflow ada di `main`. CI reguler tetap hanya Chromium |
| `npm run format` / `format:check` | Prettier (dengan pengurutan kelas Tailwind) |
| `npm run check` | lint + typecheck + test + build |

## Environment

Salin `frontend/.env.example` menjadi `frontend/.env.local` bila perlu. Semua variabel opsional:

| Variabel | Kapan diisi |
|---|---|
| `VITE_SITE_URL` | Setelah domain dikonfirmasi. Mengaktifkan canonical, `og:url`, `og:image` absolut, BreadcrumbList, dan `sitemap.xml` |
| `VITE_API_BASE_URL` | Origin API Laravel saja (skema, host, port opsional; tanpa path, query, atau kredensial). HTTPS wajib, kecuali `http://localhost`, `http://127.0.0.1`, atau `http://[::1]` untuk pengembangan. Nilai yang tidak valid dianggap kosong. Lokal: `http://localhost:8000` |
| `VITE_INQUIRY_API_ENABLED` | Kanal **Kirim melalui website** hanya aktif bila nilainya persis `true` **dan** `VITE_API_BASE_URL` valid; formulir lalu mengirim ke `<origin>/api/v1/inquiries`. Default `false`. Jangan diaktifkan di produksi sebelum pemilik menyetujui pemberitahuan privasi, masa simpan, hosting, database, dan penanganan operasional (`docs/api/inquiries.md`). Nilai ini publik (ditanam di bundle): jangan pernah menaruh rahasia atau kredensial Laravel di variabel `VITE_*` |
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

Netlify, Cloudflare Pages, Vercel (output statis), atau Nginx memenuhi ini dengan konfigurasi standar. Image Docker produksi frontend (`infra/docker/frontend/Dockerfile`, nginx dengan `infra/docker/nginx/frontend.conf`) sudah menerapkan ketiganya dan diuji; deployment Docker lengkap bersama API ada di `docker-production.md` (disiapkan, belum di-deploy).

## Konsol admin (`admin/`, B3.2a)

Aplikasi terpisah dengan build dan CI sendiri; panduan lengkap di `admin/README.md`. Ringkas: `cd admin && npm install && npm run dev`, lalu buka **`http://127.0.0.1:5174`** (bukan `localhost`: `ADMIN_URL` backend default-nya persis origin itu). Server dev mem-proxy hanya `/api/v1/admin` ke Laravel (`php artisan serve` di 127.0.0.1:8000, atau `SOLVEIT_ADMIN_API_TARGET`), dengan header `Host` dan `Origin` browser apa adanya; tidak ada CORS. Website (5173) dan admin (5174) dapat berjalan bersamaan. Pemeriksaan: `npm run check`, lalu `npm run build:reference` dan Playwright per project dengan `--workers=1`. Admin membaca token merek, font, path logo, dan favicon dari `frontend/` di tempat (`docs/project-structure.md` 7.1), jadi perubahan pada file itu juga dicek oleh Admin CI.

## Backend (Laravel)

Ringkasan untuk pengembangan harian. Rincian environment, struktur, dan keamanan ada di `backend/README.md`; kontrak endpoint di `docs/api/`; aturan Laravel Boost di `docs/project-structure.md` bagian 9.

### Setup dari clone baru

Siapkan dulu MySQL 8.4 dengan database `solveit_indonesia` (pengembangan) dan `solveit_indonesia_testing` (tes), masing-masing dengan pengguna sendiri. Cara yang disarankan: container Docker `solveit-mysql` dari `backend/docker/mysql/compose.yaml` (MySQL 8.4.11 di `127.0.0.1:3307`, volume `solveit-mysql-data`, kata sandi sebagai Docker secret); langkah, perintah harian, backup, dan SQL untuk server non-Docker ada di `backend/README.md` bagian Database MySQL. Database MariaDB bawaan XAMPP tidak dipakai dan tidak diubah.

```bash
cd backend
composer install
cp .env.example .env                  # isi DB_* untuk database pengembangan
php artisan key:generate
php artisan migrate
php artisan boost:update --no-discover   # salinan skill Boost untuk Claude Code dan Codex
php artisan test                      # database solveit_indonesia_testing (kredensial di .env.testing)
php artisan serve                     # http://localhost:8000
```

Frontend tanpa variabel (`npm run dev`, build bawaan) tidak memanggil API. Untuk mencoba kanal **Kirim melalui website** terhadap Laravel dan MySQL lokal (B2):

```bash
# backend/: origin http://localhost:4174 sudah ada di CORS_ALLOWED_ORIGINS contoh
php artisan serve --host=127.0.0.1 --port=8000
# frontend/: build varian ke folder sendiri, lalu sajikan di port 4174
BUILD_DIR=build/inquiry-api-local VITE_INQUIRY_API_ENABLED=true VITE_API_BASE_URL=http://127.0.0.1:8000 npm run build
BUILD_DIR=build/inquiry-api-local PORT=4174 node scripts/serve.mjs
```

Buka `http://localhost:4174/kontak` dan kirim data sintetis saja: kiriman tersimpan di database pengembangan dan dihitung rate limit (5 per menit per IP). Buka lewat `localhost` atau `127.0.0.1`: kunci idempotensi (B2.2) dibuat dengan `crypto.randomUUID()`, yang hanya tersedia di secure context, jadi dari alamat IP LAN lewat HTTP (misalnya ponsel di jaringan yang sama) kanal website menolak mengirim dan menyarankan WhatsApp atau email. `npm run build` biasa membersihkan seluruh `build/`, termasuk folder varian ini. Jangan memakai variabel ini untuk build yang dirilis.

### Perintah

Jalankan dari `backend/`:

| Perintah | Fungsi |
|---|---|
| `php artisan test` | Semua tes, hanya pada database MySQL sekali pakai `solveit_indonesia_testing` (nama dikunci di `phpunit.xml`; pengaman menolak environment, database, atau hak pengguna yang lain) |
| `php artisan test --filter=<NamaTes>` | Tes tertentu |
| `vendor/bin/pint --test` / `vendor/bin/pint` | Cek / perbaiki gaya kode |
| `composer validate --strict` | Validasi `composer.json` dan lock |
| `composer audit` | Audit kerentanan dependensi |
| `php artisan route:list --except-vendor` | Daftar route; harus `POST api/v1/inquiries` |
| `php artisan migrate` / `migrate:status` | Migrasi database lokal |
| `composer run dev` | `serve` dan `queue:listen` bersamaan |

Jangan menjalankan `migrate:fresh`, `migrate:reset`, `migrate:rollback`, `db:wipe`, atau `DROP` selain pada database sekali pakai yang memang dibuat untuk itu. CI menguji rollback pada database MySQL sekali pakai.

### CI

**Backend CI** (`.github/workflows/backend-ci.yml`) berjalan pada PR ke `staging` atau `main` dan push ke `backend` bila `backend/**`, `frontend/src/types/**`, atau workflow-nya berubah. Satu job, PHP 8.5 dan service container MySQL 8.4 yang hanya hidup selama job:

1. Kebijakan PHP: seri 8.5, minimal 8.5.7, `pdo_mysql` ada; versi yang benar-benar diuji ditulis ke ringkasan run.
2. Versi MySQL dipastikan 8.4.x dan bukan MariaDB, juga ditulis ke ringkasan. Dua database sekali pakai (`solveit_indonesia_ci` untuk migrasi dan smoke test, `solveit_indonesia_testing` untuk tes) dengan pengguna terpisah: migrasi (semua hak di database CI), aplikasi (`SELECT, INSERT, UPDATE, DELETE` saja), tes. Kata sandi dibuat acak per run dan disamarkan di log; tidak ada kredensial di repository.
3. `composer validate --strict`, `composer install`, `composer check-platform-reqs`, Pint.
4. Migrasi naik, turun, naik sebagai pengguna migrasi.
5. Smoke test HTTP nyata (`php artisan serve`, `APP_ENV=production`, `APP_DEBUG=false`) sebagai pengguna aplikasi tanpa hak DDL: `/up` dan `POST /api/v1/inquiries` harus `201` dengan nomor referensi, dan barisnya ada di MySQL.
6. `php artisan test`, cek route, `composer audit`, lalu `composer install --no-dev` yang harus tetap boot tanpa Boost.

Tidak butuh rahasia GitHub. Frontend CI dan Cross-browser QA tidak dipicu oleh perubahan backend saja.

**Docker CI** (`.github/workflows/docker-ci.yml`) berjalan pada PR ke `staging` atau `main`, push ke `backend`, dan manual, bila `infra/**`, `backend/**`, `frontend/**`, atau workflow-nya berubah. Tiga job: (1) shellcheck dan validasi file Compose (termasuk bukti bahwa proyek pengembangan memakai definisi MySQL yang sama dan bahwa hanya gateway produksi yang mempublikasikan port, di loopback); (2) onboarding pengembangan dari clone baru dengan `setup-dev.sh`, versi PHP, Node, Laravel, dan MySQL di container, `/up` dan dev server, tes backend dan frontend di container, dan restart tanpa kehilangan data; (3) build image produksi, migrasi eksplisit, dan `infra/docker/scripts/verify-production.sh` dengan rahasia acak per run. Tidak ada image yang di-push dan tidak ada deployment.

### Laravel Boost dan MCP untuk agent

Laravel Boost (`laravel/boost`, dev dependency) wajib untuk pekerjaan backend berbantuan AI. Tim hanya memakai **Claude Code** dan **Codex**; konfigurasi agent lain tidak disediakan.

| Agent | Mulai sesi di | File MCP | Perintah | Langkah pertama |
|---|---|---|---|---|
| Claude Code | Root repository | `.mcp.json` (bersama Playwright) | `php backend/artisan boost:mcp` | Sudah diizinkan lewat `enabledMcpjsonServers` di `.claude/settings.json`. `backend/CLAUDE.md` dan skill di `backend/.claude/skills/` dimuat saat Claude bekerja di `backend/` |
| Codex, pekerjaan backend | `backend/` | `backend/.codex/config.toml` (dibuat `boost:install --mcp`) | `php artisan boost:mcp` | Percayai repository dan `backend/`. Codex membaca `AGENTS.md` dari root **turun** ke folder kerja dan skill dari folder kerja **naik**, jadi `backend/AGENTS.md` dan `backend/.agents/skills/` hanya terbaca bila sesi dimulai di `backend/` |
| Codex, pekerjaan lain | Root repository | `.codex/config.toml` | `php backend/artisan boost:mcp` | Percayai repository; konfigurasi proyek tidak dimuat sebelum itu |

Setelah clone, jalankan sekali di `backend/`: `php artisan boost:update --no-discover` (skill) dan `php artisan boost:install --mcp --no-interaction` (menulis `backend/.mcp.json` dan `backend/.codex/config.toml`, diabaikan Git).

Memeriksa bahwa MCP berfungsi:

```bash
claude mcp list          # dari root: "laravel-boost: php backend/artisan boost:mcp - Connected"
codex mcp list           # setelah dipercaya; dari root: php backend/artisan boost:mcp, dari backend/: php artisan boost:mcp
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
| `codex mcp list` tidak menampilkan `laravel-boost` | Repository (atau `backend/`) belum dipercaya di Codex, atau `backend/.codex/config.toml` belum dibuat (`php artisan boost:install --mcp --no-interaction`) |
| `boost:update` meminta "set up Boost first" | `backend/boost.json` hilang; pulihkan dari Git |
| Galat `could not find driver` | Ekstensi `pdo_mysql` belum aktif di `php.ini` (`extension=pdo_mysql`) |
| `SQLSTATE[HY000] [2002]` saat tes | MySQL tidak berjalan, atau host/port di `.env.testing` salah (Docker contoh: port 3307) |
| `SQLSTATE[HY000] [1045]` atau `[1044]` | Pengguna atau kata sandi salah, atau pengguna tidak punya hak pada database itu. Tes memakai `solveit_test` pada `solveit_indonesia_testing` |
| Tes berhenti dengan "The test database user may only hold privileges on …" | Pengguna di `.env.testing` punya hak di luar database tes (misalnya `root`, `GRANT ... ON *.*`, database lain, atau grant tanpa escape `solveit_indonesia_testing.*`). Pakai pengguna `solveit_test` dengan grant persis di `backend/README.md`; jangan melemahkan pengaman |
| Tes berhenti dengan "selected … instead of solveit_indonesia_testing" atau "Tests only run …" | Koneksi tidak sampai ke database tes yang diharapkan (misalnya `DB_URL` di `.env.testing`). Hapus `DB_URL` dan periksa host serta port |
| `mysql --version` menampilkan MariaDB | Itu klien XAMPP di `PATH`, bukan server yang dipakai Laravel. Periksa server lewat `php artisan db:show` (harus `MySQL 8.4.x`) |
| Port 3307 sudah dipakai | Ganti port host di `backend/docker/mysql/compose.yaml` serta `DB_PORT` di `.env` dan `.env.testing`; jangan menghentikan layanan proyek lain |
| Versi MySQL terdeteksi MariaDB | Tes `MySqlDatabaseTest` gagal: server yang dipakai adalah MariaDB (misalnya XAMPP). Jalankan MySQL 8.4 terpisah |
| Composer menolak PHP | `composer.json` mewajibkan PHP 8.5.7 atau lebih baru; perbarui PHP. Jangan menurunkan `config.platform.php` |
| Agent tidak dapat membaca `.env.example` | Pola `deny` di `.claude/settings.json` terlalu lebar; lihat `docs/project-structure.md` bagian 6 |
| Skill Boost tidak muncul di agent | Jalankan `php artisan boost:update --no-discover`; salinan skill tidak di-commit |
