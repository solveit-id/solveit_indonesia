# Laporan QA

Semua angka di bawah adalah hasil eksekusi nyata di mesin pengembang (Windows 11, Node 22.23, Playwright 1.64 dengan Chromium 156, Firefox, dan WebKit, Lighthouse 13.5) terhadap build produksi yang disajikan oleh `scripts/serve.mjs` (clean URL, 404 per bahasa, kompresi brotli).

## B2: integrasi API inquiry di frontend (2026-10-15)

Cakupan: kanal **Kirim melalui website** di formulir kontak, di balik flag yang nonaktif secara default, dan perbaikan tes animasi tema yang flaky di WebKit. Baseline yang diverifikasi: `origin/main`, `origin/frontend`, `origin/backend` = `88db528` (rilis B1.1, PR #21), `origin/staging` `22f6853` dengan tree yang sama (`4b71119`); working tree bersih, tanpa stash atau worktree lain.

### Mode aktif dan nonaktif

Nilai `VITE_*` ditanam saat build, jadi mode aktif dibuktikan dengan build kedua (`playwright.api.config.ts`: `BUILD_DIR=build/inquiry-api`, port 4174, `VITE_INQUIRY_API_ENABLED=true`, `VITE_API_BASE_URL=http://127.0.0.1:65530`). Semua request ke origin itu dijawab `page.route`; tidak ada request yang keluar dan tidak ada data inquiry nyata. Build bawaan (dan Frontend CI) tetap membuktikan mode nonaktif: tes `the default build has no website channel and calls no API` memeriksa teks privasi lama, tidak ada tombol website atau honeypot, dan tidak ada request ke path `/api/` saat WhatsApp dibuka.

### Pemeriksaan otomatis (lokal, Windows 11, Node 22.23.1, Playwright 1.64)

| Pemeriksaan | Hasil |
|---|---|
| `npm run lint`, `npm run typecheck`, `npm run build` | Lulus |
| Prettier | Semua file yang akan di-commit lulus. `npm run format:check` lokal menandai `frontend/.impeccable/hook.cache.json`, cache hook desain yang dikecualikan lewat `.git/info/exclude` (tidak ada di checkout CI) |
| `npm test` | 15 file, 125 tes lulus (sebelumnya 69). Baru: `site.test.ts` (origin dan flag), `inquiry-api.test.ts` (request, 201 valid dan rusak, 422, honeypot, 413, 429 dengan/tanpa `Retry-After`, 503, 4xx/5xx lain, jaringan, timeout, abort, pembersihan timer dan listener, tanpa retry), `inquiry-form.api.test.tsx` (17 tes mode aktif, ID dan EN), paritas validasi di `inquiry.test.ts` |
| E2E build bawaan, Chromium desktop 1440 | 180 lulus, 5 dilewati, 0 gagal |
| E2E build bawaan, Chromium tablet 820 | 161 lulus, 24 dilewati, 0 gagal |
| E2E build bawaan, Pixel 7 | 147 lulus, 38 dilewati, 0 gagal |
| E2E build API, desktop + tablet + Pixel 7 | 24 lulus |
| E2E build API, Firefox | 8 lulus |
| E2E build API, WebKit desktop + iPhone 14 (lokal) | 14 lulus, 2 dilewati: tes email di WebKit, karena WebKit Playwright di Windows menyerahkan `mailto:` ke handler email sistem yang mengganti halaman (perilaku sama dengan kode lama; komposisi `mailto:` dites di unit test, Chromium, dan Firefox) |
| axe pada status penerimaan (build API, semua project) | 0 pelanggaran |

### Tes tema yang flaky di WebKit (diperbaiki, akar masalah terkonfirmasi)

Gejala: Cross-browser QA run 38723672210 percobaan 1, `webkit-mobile`, `refinement.spec.ts` "the theme icons roll through the button": `expect(moving).not.toBe("none")`, diterima `"none"`; lulus pada percobaan 2 tanpa perubahan kode.

Akar masalah: `setTheme()` (`src/lib/theme.ts`) menerapkan `data-theme` di dalam callback `document.startViewTransition()`, yang berjalan satu frame atau lebih setelah klik. Tes membaca `transform` ikon matahari tepat setelah `click()`, jadi kadang membaca keadaan sebelum tema berganti. Pada perangkat sentuh (`hover: none`) keadaan itu `none` sehingga gagal; pada perangkat pointer, rotasi hover matahari (`rotate(45deg)`) membuat asersi lulus walau tema belum berganti, jadi tes tidak pernah benar-benar memeriksa gulungan ikon di sana. Bukti (skrip diagnostik, 10 run per konfigurasi, callback ditunda 100 ms untuk meniru frame lambat di runner): pembacaan lama memberi `theme=light transform=none` di WebKit iPhone 14 dan Chromium Pixel 7, dan `theme=light transform=moved` di desktop; asersi baru lulus di keempatnya. Tanpa penundaan, keempat konfigurasi selalu membaca tema gelap (80/80), sesuai kegagalan yang hanya muncul di runner CI yang sibuk.

Perbaikan (hanya tes, aplikasi tidak berubah): tunggu `data-theme="dark"`, catat transisi ikon lewat `transitionrun` yang terjadi setelah tema gelap aktif (gulungan hover sebelumnya tidak terhitung), wajibkan transisi `transform` pada matahari dan bulan, lalu periksa keadaan akhir: matahari bergeser ke bawah sel (`DOMMatrix.f > 0`) dan transparan, bulan opasitas 1 dan tegak setelah pointer menjauh. Tes baru untuk reduced motion: hanya crossfade, tanpa transisi `transform`. Tidak ada timeout yang dinaikkan. Pengulangan lokal: WebKit desktop dan iPhone 14, 10 kali masing-masing untuk kedua tes, 40/40 lulus; Chromium desktop dan Pixel 7 lulus.

### Performa dan aksesibilitas

| Ukuran (gzip) | `main` `88db528` | B2 (build bawaan) |
|---|---|---|
| Chunk route kontak | 3,46 KB | 6,95 KB |
| Seluruh JS | 254,9 KB | 260,4 KB (+5,5 KB, sebagian besar teks dua bahasa) |
| HTML `/kontak` | 15.540 B | 15.559 B |

Lighthouse 13.5, preset mobile bawaan (simulasi throttling), `/kontak`, median 3 run, kedua build disajikan `scripts/serve.mjs`: performa 100 vs 100, LCP 1590 vs 1588 ms, TBT 9 vs 9 ms, CLS 0 vs 0, aksesibilitas 100 vs 100. Tidak ada request saat render atau prerender; request hanya setelah klik dan validasi lolos.

Review visual build API pada 1440, 820, dan 390 px, tema terang dan gelap: status idle, mengirim, diterima, dan tidak pasti. Satu perbaikan selama review: judul "Atau kirim sendiri lewat WhatsApp atau email" menjadi pemisah tenang bergaris agar pemilih nomor jelas milik WhatsApp. Umpan balik sebelumnya tetap tampil (redup) selama mengirim agar tombol tidak melompat, kecuali ringkasan kolom yang belum diisi karena isinya sudah tidak benar.

### Integrasi Laravel dan MySQL

**Tidak diverifikasi secara lokal.** Mesin pemilik belum punya MySQL 8.4 permanen, dan tugas ini tidak mengizinkan memasang layanan, membuat kredensial, atau membaca `.env`. Semua tes frontend memakai respons mock sesuai `docs/api/inquiries.md`; kontrak backend tetap dibuktikan oleh tes backend dan Backend CI (MySQL 8.4) yang tidak berubah. Uji HTTP nyata frontend ke Laravel dan MySQL perlu dilakukan setelah lingkungan sekali pakai diizinkan atau API di-deploy.

## B1.1: review akhir dan penyelarasan konfigurasi QA (2026-10-15)

Cakupan: temuan review PR #20, tanpa memperluas B1.1. Baseline yang diverifikasi: `origin/backend` = lokal `258dae4`, `origin/staging` `7e936b5`, `origin/main` dan `origin/frontend` `7729d17`; PR #20 open, mergeable, Backend CI run 38711417910 dan Frontend CI run 38711417888 lulus pada `258dae4`. Server uji: container `mysql:8.4` sekali pakai baru (MySQL 8.4.11, `127.0.0.1:3307`, tmpfs), dihapus di akhir sesi.

| Temuan | Tindakan | Bukti |
|---|---|---|
| `.claude/skills/backend-verify/SKILL.md` masih menyebut SQLite in-memory dan matriks PHP 8.3/8.5 | Ditulis ulang: PHP 8.5 minimal 8.5.7 dan `pdo_mysql`, tes hanya di `solveit_indonesia_testing` dengan pengaman, `check-platform-reqs`, migrasi di database pengembangan MySQL, CI PHP 8.5 + MySQL 8.4. Kali ini perubahan `.claude/` tidak ditolak (permintaan eksplisit pemilik) | Skill termuat ulang di sesi dengan deskripsi baru dan dipakai untuk verifikasi di bawah |
| `.claude/rules/backend.md` (path `backend/**`) | Dihapus. Keempat butirnya sudah ada di sumber yang dimuat pada pemicu yang sama: `backend/CLAUDE.md` (`@AGENTS.md`), blok Boost (search-docs, `make:*`, Pint, tes), dan guideline Solveit (endpoint dan `docs/api/`). Perilaku pemuatan: di sesi ini, membaca file di `backend/` memuat `backend/CLAUDE.md`, `backend/AGENTS.md`, dan aturan itu bersamaan, sesuai pemuatan on-demand `CLAUDE.md` bertingkat. `.claude/rules/frontend.md` tetap | `.claude/rules/` kini hanya `frontend.md`; root `CLAUDE.md` tetap benar |
| Pengaman tes hanya memeriksa substring `_testing` | `tests/Support/TestDatabaseGuard.php`, dipanggil dari `TestCase::setUpTraits()` sebelum `RefreshDatabase`, sekali per proses: `APP_ENV` `testing`; koneksi `mysql` dengan driver `mysql`; nama persis `solveit_indonesia_testing` tanpa `DB_URL`; `SELECT DATABASE()` dari server; `SHOW GRANTS FOR CURRENT_USER()` hanya `USAGE` global dan hak pada `` `solveit\_indonesia\_testing`.* ``. `phpunit.xml` kini juga mengunci `APP_ENV` dan `DB_DATABASE` di `$_SERVER` dan `$_ENV` | Lihat tabel uji di bawah |
| Grant contoh di README dan CI memakai `solveit_indonesia_testing.*` tanpa escape; di MySQL `_` adalah wildcard pada grant tingkat database, sehingga grant juga berlaku untuk nama lain yang mirip | README dan CI memakai `` `solveit\_indonesia\_testing`.* `` (juga untuk database pengembangan dan CI). Pengaman menolak grant tanpa escape | `SHOW GRANTS` di MySQL 8.4.11: grant tanpa escape tampil sebagai `` `solveit_indonesia_testing`.* ``, yang di-escape sebagai `` `solveit\_indonesia\_testing`.* ``. SQL CI yang dihasilkan heredoc diperiksa lokal; `actionlint` bersih |

### Uji pengaman terhadap server nyata

Tabel penanda dibuat di database pengembangan `solveit_indonesia` sebelum percobaan.

| Percobaan | Hasil |
|---|---|
| Pengguna dengan `ALL PRIVILEGES ON *.*` | Ditolak sebelum tes berjalan: "may only hold privileges on `` `solveit\_indonesia\_testing`.* ``; it also holds privileges on `*.*`" |
| Pengguna dengan grant tanpa escape | Ditolak ("… privileges on `` `solveit_indonesia_testing`.* ``") |
| `root` | Ditolak (hak `*.*`) |
| `DB_DATABASE=solveit_indonesia`, `APP_ENV=local`, `DB_URL=mysql://…/solveit_indonesia`, `DB_CONNECTION=sqlite` dari shell | Diabaikan karena dikunci; tes berjalan di `solveit_indonesia_testing` dan `MySqlDatabaseTest` lulus |
| Database pengembangan setelah semua percobaan | Tetap satu tabel penanda dengan barisnya; tidak ada file SQLite yang dibuat |

Tes regresi baru `tests/Feature/Support/TestDatabaseGuardTest.php` (15 kasus): koneksi nyata lolos dan memilih database tes; database pengembangan, nama yang hanya mengandung `_testing` (`shop_testing_backup`), `DB_URL`, dan koneksi SQLite ditolak sebelum terhubung; environment selain `testing` ditolak; sesi di database lain ditolak; grant yang benar diterima; tujuh grant tidak aman ditolak (hak global, hak dinamis global, database pengembangan, grant wildcard, pola `%`, role, proxy). Uji mutasi: pemeriksaan grant dimatikan, tepat tujuh kasus grant tidak aman gagal; file dipulihkan.

### Verifikasi (skill `backend-verify` yang diperbarui)

| Langkah | Hasil |
|---|---|
| PHP | `PHP 8.5.7 (cli) … ZTS`, `pdo_mysql` dimuat |
| Pint | Lulus |
| `php artisan test` (pengguna `solveit_test` dengan grant yang di-escape; kredensial lewat environment, bukan `.env.testing`, agar tidak membuat file kredensial di working copy) | **109 lulus, 275 assertion**, juga dengan `--order-by=random`. Sebelumnya 94 dan 249: plus 15 kasus pengaman |
| `composer validate --strict`, `check-platform-reqs` | Valid; `php 8.5.7 success` |
| `composer audit` | Tidak ada advisory |
| Route | `POST api/v1/inquiries`, `GET|HEAD up` |
| `migrate:status` (database pengembangan di container sekali pakai) | 4 migrasi `Ran` |
| `boost:update --no-discover` | Berhasil; `backend/AGENTS.md` berubah satu baris di blok Solveit |
| MCP | `claude mcp list`: `laravel-boost` Connected. `playwright` kali ini timeout 30 detik (cold start `npx` di Windows, dicatat di `CLAUDE.md`; tidak terkait perubahan ini). `application-info`: Laravel 13.36.0, PHP 8.5, `database_engine sqlite`, karena server MCP membaca `backend/.env` lokal pemilik yang belum dipindah ke MySQL |

### CI

Pada `856c6f3`: Backend CI run 38713920726 (pull_request) dan 38713906937 (push) lulus, `Tested PHP: 8.5.11`, `Tested MySQL: 8.4.11 (MySQL Community Server - GPL)`, `109 passed (275 assertions)`; pengguna tes CI dengan grant yang di-escape diterima pengaman. Frontend CI run 38713920741 lulus.

### Diff PR #20

Terhadap `origin/staging`: 0 file `frontend/`; gitleaks pada 37 file yang berubah tidak menemukan kebocoran; tidak ada `.env` selain `.env.example`, kunci, file database, log, cache, atau salinan agent lokal (`backend/.claude/`, `.agents/`, `.codex/`, `.mcp.json`). Satu-satunya nama yang cocok dengan pola sensitif adalah penghapusan `.cursor/mcp.json`. Teks mirip kata sandi hanya root kosong service container CI sekali pakai dan placeholder `<kata-sandi-root-lokal>` di README.

## B1.1: MySQL, PHP 8.5.7, konsolidasi agent, keamanan repository (2026-10-15)

Cakupan: branch `backend`, fast-forward dari `origin/staging` `7e936b5` (merge PR #19; tree sama dengan `fbb537e`). Tanpa perubahan aplikasi frontend, desain, atau konten. Mesin: Windows 11, PHP 8.5.7 ZTS (XAMPP, `C:\xampp\php\php.exe`, juga dipakai Composer 2.8.12), Docker 29.8.2, Claude Code 2.1.300, Codex CLI 0.160.0.

### Lingkungan database

| Pemeriksaan | Hasil |
|---|---|
| Server lokal yang ada | Port 3306 milik XAMPP: `mysqld --version` = **MariaDB 10.4.32**, bukan Oracle MySQL. Tidak dipakai dan tidak diubah |
| Server uji | Container Docker sekali pakai `mysql:8.4` (digest `sha256:24989179…`), hanya di `127.0.0.1:3307`, data di tmpfs: `SELECT VERSION()` = **8.4.11**, `@@version_comment` = `MySQL Community Server - GPL`, `sql_mode` berisi `STRICT_TRANS_TABLES`, `utf8mb4`, InnoDB |
| Database dan pengguna | `solveit_indonesia` (pengembangan, `solveit_dev` semua hak hanya di database ini), `solveit_indonesia_testing` (`solveit_test`), `solveit_app` (`SELECT, INSERT, UPDATE, DELETE` saja). Kata sandi acak di scratchpad sesi, tidak di repository |

### Tes sebelum refactor: suite lama di MySQL

Suite B1 dijalankan apa adanya terhadap MySQL: 89 lulus, 1 gagal (`test_tests_run_against_an_isolated_in_memory_database`, yang memang menegaskan SQLite). Dua tes kegagalan penyimpanan yang memakai `Schema::drop('inquiries')` **lulus, tetapi karena kebetulan**: di MySQL `DROP TABLE` melakukan commit implisit, transaksi `RefreshDatabase` putus, dan Laravel mendeteksi transaksi yang hilang lalu menjalankan `migrate:fresh` lagi sebelum tes berikutnya (`RefreshDatabase::beginDatabaseTransaction`, `RefreshDatabaseState::$migrated = false`). Biayanya migrasi ulang penuh dan ketergantungan pada efek samping; durasi suite sekitar 16 detik.

### Perubahan tes

| Perubahan | Alasan |
|---|---|
| `phpunit.xml`: `DB_CONNECTION=mysql` (dikunci di `<server>` dan `<env force>`), `DB_DATABASE=solveit_indonesia_testing` | Tes memakai MySQL, bukan SQLite in-memory. Ditemukan saat QA: `<env force="true">` saja tidak cukup, karena Laravel membaca `$_SERVER` lebih dulu; `DB_CONNECTION=sqlite` di shell masih memindahkan suite ke SQLite dan membuat file `backend/solveit_indonesia_testing` (dihapus). Setelah `<server>` ditambahkan, override itu diabaikan dan tidak ada file yang dibuat |
| `tests/TestCase.php`: menolak nama database tanpa `_testing` sebelum trait tes berjalan | Diverifikasi: `DB_DATABASE=solveit_indonesia` menghasilkan galat "Tests only run against a disposable database…" sebelum ada tabel yang dihapus |
| Tes kegagalan penyimpanan: `Schema::drop` diganti baris yang ditolak MySQL (`name` 121 karakter lewat event `creating`, SQLSTATE 22001 karena strict mode) | Tanpa DDL; transaksi tes utuh. Tes juga menegaskan `sqlstate` `22001`, tidak ada baris tersimpan, dan exception yang dilaporkan tanpa data pribadi |
| `tests/Feature/Actions/SubmitInquiryTest.php` (2 tes baru) | Tabrakan nomor referensi terhadap indeks `UNIQUE` sungguhan (galat 1062): dua tabrakan lalu sukses pada percobaan ketiga; tiga tabrakan menghasilkan `InquiryNotStoredException` (`sqlstate` `23000`, tanpa exception sebelumnya) dan tidak ada baris baru. Uji mutasi: `MAX_ATTEMPTS = 1` membuat keduanya gagal; dikembalikan |
| `tests/Feature/Database/MySqlDatabaseTest.php` (3 tes baru) | Server MySQL 8.4 atau lebih baru dan bukan MariaDB, database `_testing`; strict mode, `utf8mb4`, tabel `utf8mb4_unicode_ci` InnoDB; penghitung rate limit di cache store `database` (konfigurasi produksi) |
| Tes SQLite in-memory dihapus | Digantikan tes MySQL di atas |

Jumlah: **94 tes, 249 assertion** (sebelumnya 90 dan 230): minus 1 tes SQLite, plus 2 tes action, plus 3 tes MySQL; assertion bertambah dari tes baru dan pemeriksaan tambahan pada dua tes kegagalan penyimpanan.

### Hasil lokal (MySQL 8.4.11, PHP 8.5.7)

| Pemeriksaan | Hasil |
|---|---|
| `php artisan test` | 94 lulus, 249 assertion, sekitar 6 sampai 8 detik (sebelumnya sekitar 16 detik karena migrasi ulang). Dua kali berturut-turut, tiga kali `--order-by=random`, dan setiap tes baru sendiri-sendiri: semua lulus |
| Migrasi | Database pengembangan: naik 4, rollback 4, naik 4, `migrate:status` 4 `Ran`. `migrate:rollback` sebagai `solveit_app` ditolak (`SQLSTATE[42000] 1142 DROP command denied`) dan tidak mengubah apa pun |
| Skema | `SHOW CREATE TABLE inquiries`: `varchar` dengan panjang yang sama, `text`, `bigint unsigned`, `UNIQUE inquiries_public_id_unique`, index `status`, InnoDB, `utf8mb4_unicode_ci`. Migrasi tidak diubah |
| HTTP nyata sebagai `solveit_app` (`APP_ENV=production`, `APP_DEBUG=false`, `CACHE_STORE=database`) | `/up` `{"status":"ok"}`; lima `POST /api/v1/inquiries` `201`, keenam `429 Too Many Attempts.`; baris tersimpan dengan referensi `INQ-…` valid, status `received`, `created_at` terisi; tabel `cache` berisi penghitung |
| `vendor/bin/pint --test` | Lulus |
| `composer validate --strict` | Valid |
| `composer check-platform-reqs` | `php 8.5.7 success`, semua ekstensi terpenuhi |
| `composer audit` | Tidak ada advisory |
| `php artisan route:list --except-vendor` | `POST api/v1/inquiries`, `GET|HEAD up` |
| Instalasi `--no-dev` (salinan bersih) | Boot, route terdaftar, 0 perintah `boost:`, `laravel/boost`, `laravel/mcp`, `laravel/roster`, PHPUnit tidak terpasang, `config:cache` berhasil, `database.default` = `mysql` |

### PHP 8.5.7

- `php -v`: 8.5.7 ZTS; `composer --version` melaporkan PHP 8.5.7 dari `C:\xampp\php\php.exe`. Ekstensi: `pdo_mysql`, `mysqlnd`, `mbstring`, `intl`, `bcmath`, `openssl`, `fileinfo`, `ctype`, `tokenizer`, `xml`.
- `composer.json`: `"php": "^8.5.7"`, `config.platform.php` `8.5.7`. `composer update --lock --dry-run`: "Nothing to modify in lock file"; setelah dijalankan, diff `composer.lock` hanya `content-hash` dan dua baris platform. Tidak ada paket yang berubah: Laravel 13.36.0, Boost 2.10.3, MCP 1.0.2, PHPUnit 12.5.39, Pint 1.32.1, Symfony 7.4.x. Batas PHP paket-paket itu (`^8.3`, `>=8.2`, `^8.2`) semuanya menerima 8.5.7.
- `vendor/composer/platform_check.php` kini menolak `PHP_VERSION_ID < 80507`.

### Backend CI

`.github/workflows/backend-ci.yml` ditulis ulang: satu job PHP 8.5 dengan service container `mysql:8.4`. Langkah: kebijakan PHP (8.5, minimal 8.5.7, `pdo_mysql`, versi aktual ke ringkasan run), versi MySQL 8.4.x dan bukan MariaDB (ke ringkasan), dua database sekali pakai dan tiga pengguna dengan kata sandi acak yang disamarkan, `composer validate`, `install`, `check-platform-reqs`, Pint, migrasi naik-turun-naik sebagai pengguna migrasi, smoke test HTTP sebagai pengguna DML saja, tes, cek route, `composer audit`, instalasi `--no-dev`. `actionlint` 1.7.7: tidak ada temuan pada workflow ini.

Hasil di GitHub untuk `8991ebd` (PR #20): Backend CI run 38709084941 (PR) dan 38709043589 (push) **lulus**. Ringkasan run: `Tested PHP: 8.5.11` (patch terbaru runner, lolos syarat minimal 8.5.7; CI tidak mengklaim 8.5.7 persis) dan `Tested MySQL: 8.4.11 (MySQL Community Server - GPL)`. Migrasi naik-turun-naik 4 `Ran`, smoke test HTTP lulus, `Tests: 94 passed (249 assertions)`, route `POST api/v1/inquiries`, tidak ada advisory, instalasi `--no-dev` tanpa perintah Boost. Frontend CI run 38709084923 (dipicu perubahan izin workflow) lulus.

### Agent

| Pemeriksaan | Hasil |
|---|---|
| Cursor | `.cursor/mcp.json` dihapus dari Git; `cursor` dihapus dari `backend/boost.json`; salinan lokal `backend/.cursor/` (dibuat Boost: `mcp.json` dan tiga skill yang identik dengan salinan Claude) dihapus; `.cursor/` ditambahkan ke `.gitignore` (`/.cursor/` bawaan Laravel di `backend/.gitignore` dipertahankan). Rujukan Cursor yang tersisa hanya aturan ignore, catatan B1.1 ini, dan bagian sejarah laporan QA yang menurut aturan tidak ditulis ulang |
| `php artisan boost:update --no-discover` | "Boost guidelines and skills updated successfully". Diff `backend/AGENTS.md` hanya di blok Solveit (guideline MySQL dan tes); skill tetap untuk `.claude/skills/` dan `.agents/skills/` |
| Claude Code | `claude mcp list` dari root: `playwright` dan `laravel-boost` Connected. Skill Boost `laravel-best-practices` dan `testing-best-practices` muncul di sesi saat bekerja di `backend/` |
| Codex | Dengan `CODEX_HOME` sementara yang mempercayai root dan `backend/`: dari root `laravel-boost php backend/artisan boost:mcp enabled`, dari `backend/` `php artisan boost:mcp enabled`; tanpa kepercayaan tidak ada server. Dokumentasi Codex: `AGENTS.md` dibaca dari root turun ke folder kerja, skill dari folder kerja naik; maka Codex dimulai di `backend/` untuk pekerjaan backend. Pemanggilan tool dari sesi Codex yang login tidak diuji |
| Struktur | Tidak ada `frontend/AGENTS.md` (aturan frontend cukup di root `AGENTS.md` dan aturan path-scoped). Perubahan di `.claude/` (aturan dan skill Claude Code) ditolak oleh pengaman mode otomatis sesi ini sebagai modifikasi diri, jadi `.claude/rules/backend.md` (rangkap dengan `backend/CLAUDE.md`) dan teks SQLite di `.claude/skills/backend-verify/SKILL.md` menunggu pemilik |

### Keamanan repository

| Pemeriksaan | Hasil |
|---|---|
| Visibilitas | Repository **publik** (`gh api`), jadi riwayat diaudit penuh |
| gitleaks 8.24.3 (Docker), riwayat semua ref, `--redact` | 23 commit non-merge (42 total), sekitar 1,94 MB: **tidak ada kebocoran** |
| gitleaks pada pohon kerja yang akan di-commit (266 file terlacak dan baru, tanpa file yang diabaikan) | Tidak ada kebocoran |
| Nama file sensitif di seluruh riwayat (`.env`, kunci, `sqlite`, `.sql`, dump, `auth.json`, log) | Hanya `backend/.env.example` dan `frontend/.env.example` |
| `.gitignore` root | Ditambah kunci (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `auth.json`), file database dan dump (`*.sqlite`, `*.sqlite3`, `*.sql`, `*.sql.gz`, `*.dump`, `*.bak`), cache tes (`.phpunit.cache/`, `.phpunit.result.cache`, `.eslintcache`), `AGENTS.override.md`, `.cursor/`, `Desktop.ini`, `*.swp`, `*~`. `git ls-files -ci --exclude-standard` kosong; `.env.example`, lock file, `boost.json`, `.codex/config.toml`, `.claude/settings.json`, `.mcp.json` tidak diabaikan; contoh `.env`, `.env.testing`, `auth.json`, `*.pem`, `database.sqlite`, `dump.sql`, `laravel.log` diabaikan |
| Document root | `backend/public/` hanya berisi `index.php`, `.htaccess`, `robots.txt`, `favicon.ico`; dokumentasi mewajibkan document root `public/` |
| GitHub Actions | Ketiga workflow kini menyatakan `permissions: contents: read` (sebelumnya hanya Backend CI; izin bawaan repository tidak dapat dibaca dengan akses sesi ini). Tidak ada rahasia GitHub yang dipakai |
| CORS, proxy, data inquiry | Tidak berubah dan tetap dites: origin dari daftar, `X-Forwarded-For` hanya dari proxy tepercaya, exception penyimpanan tanpa data pribadi (kini juga di MySQL) |

### Keterbatasan

- Database lokal pemilik: `backend/.env` (tidak dibuka) masih memakai SQLite, dan mesin pemilik hanya punya MariaDB XAMPP. Verifikasi lokal di atas memakai container sekali pakai yang dihapus di akhir sesi; pemilik perlu menjalankan MySQL 8.4 sendiri (`backend/README.md`) dan memperbarui `.env` serta membuat `.env.testing`.
- Akses `gh` sesi ini tidak dapat membaca izin bawaan Actions dan proteksi branch repository.
- Frontend tidak diubah; suite browser tidak dijalankan ulang. Frontend CI akan berjalan pada PR karena file workflow-nya berubah.

## Backend B0 dan B1: integrasi `staging` ke `main` (2026-10-15)

Cakupan: audit setelah PR #16 (`backend` ke `staging`) di-merge pemilik sebagai `09d05a4`, dan satu perbaikan kecil sebelum PR `staging` ke `main`.

| Pemeriksaan | Hasil |
|---|---|
| Isi `origin/staging` | Tree `09d05a4` identik dengan tree `origin/backend` `079ee88` (`0bed1cc`); `origin/main` adalah ancestor `origin/staging` (tidak ada commit `main` yang hilang, tidak ada konflik) |
| Artefak | Backend Laravel 13, `laravel/boost` di `require-dev`, `boost.json`, `AGENTS.md`/`CLAUDE.md` backend, `config/boost.php`, guideline Solveit, API inquiry, migrasi, tes, Backend CI, `.mcp.json`/`.codex`/`.cursor`, `.claude/settings.json`, dokumen, dan `.ai/` ada di `origin/staging`. Salinan skill per agent sengaja tidak di-commit (dibuat `boost:update`) |
| Frontend | Tidak ada file `frontend/` yang berbeda dari `main`; logo di `frontend/public/brand/` identik; Frontend CI dan Cross-browser QA tidak berubah |

### Perbaikan: log setelah penyimpanan

Risiko: `SubmitInquiry` memanggil `Log::info()` setelah `save()` tanpa pengaman. Bila channel log gagal (Monolog melempar `UnexpectedValueException` saat file log tidak dapat dibuka), inquiry yang sudah tersimpan menjadi respons 500, dan pengunjung yang mengulang kiriman membuat duplikat.

- Tes regresi `test_failing_log_channel_still_returns_201_for_a_stored_inquiry` ditulis lebih dulu dan **gagal** sebelum perbaikan (exception keluar dari action sampai ke exception handler).
- Perbaikan satu baris: log dibungkus `rescue(..., report: false)` (tidak dilaporkan, karena pelaporan menulis ke log yang sama). Tes yang memastikan log hanya berisi nomor referensi tetap lulus.
- `php artisan test`: 90 lulus, 230 assertion. Pint lulus. Hasil Backend CI untuk perbaikan ini ada di PR-nya dan di `.ai/project-status.md`.

## Backend B0 dan B1: fondasi Laravel 13, Laravel Boost, API inquiry (2026-10-15)

Cakupan: fondasi backend di branch `backend` (fast-forward dari `main` `7e37a77`). Tanpa perubahan kode frontend, desain, atau konten. Mesin: Windows 11, PHP 8.5.7 (ZTS, XAMPP), Composer 2.8.12, Node 22.23.1, Claude Code CLI, Codex CLI 0.160.0. Cursor tidak terpasang.

### Fondasi Laravel

| Pemeriksaan | Hasil |
|---|---|
| Scaffolding | `composer create-project laravel/laravel:^13.0` di folder sementara di luar repository, lalu disalin ke `backend/` tanpa menimpa README. `php artisan --version`: **Laravel Framework 13.36.0** |
| Kompatibilitas PHP | Lock pertama memilih Symfony 8.1 (butuh PHP 8.4.1), bertentangan dengan `"php": "^8.3"`. Diperbaiki dengan `config.platform.php = 8.3.0`: 17 paket Symfony turun ke 7.4 LTS, `composer check-platform-reqs --lock` lulus |
| `composer validate --strict` | `./composer.json is valid` |
| `composer audit` | `No security vulnerability advisories found.` |
| `vendor/bin/pint --test` | Lulus |
| `php artisan route:list --except-vendor` | `POST api/v1/inquiries .. api.v1.inquiries.store`; ditambah `GET /up`. Rute penyajian file `storage/{path}` bawaan dimatikan (`serve => false`). `POST /api/api/v1/inquiries` menghasilkan 404 (dites lewat HTTP) |
| Migrasi | Database lokal: 4 migrasi `Ran`. File SQLite sekali pakai: naik 4, rollback 4, naik lagi 4 (sama dengan langkah CI) |
| Instalasi produksi | Salinan bersih: `composer install --no-dev` menghapus `laravel/boost`, `laravel/mcp`, `laravel/roster`; aplikasi boot, route terdaftar, 0 perintah `boost:`, `config:cache` berhasil |
| Clone bersih | File yang akan di-commit disalin ke folder kosong: `composer install`, `key:generate`, `migrate`, `boost:update --no-discover` membuat `AGENTS.md` identik byte dan skill untuk tiga agent; `php artisan test` 89/89 |

### Laravel Boost

| Pemeriksaan | Hasil |
|---|---|
| Paket | `laravel/boost` **v2.10.3** di `require-dev` (bersama `laravel/mcp`, `laravel/roster` sebagai dependensinya), tercatat di `composer.lock` |
| `php artisan list boost` | `boost:add-skill`, `boost:install`, `boost:list-skills`, `boost:mcp`, `boost:update` |
| `boost:install` | Non-interaktif dengan `boost.json` (agent `claude_code`, `codex`, `cursor`; `cloud: false`) dan `--guidelines --skills --mcp`: 8 guideline dan 3 skill (`infer-conventions`, `laravel-best-practices`, `testing-best-practices`) untuk ketiga agent, MCP untuk ketiganya, semua ✓ |
| Guideline | `deployments` (rekomendasi Laravel Cloud) dikecualikan karena hosting belum diputuskan. Guideline kustom `backend/.ai/guidelines/solveit.md` masuk di urutan pertama blok. Pengantar di luar blok `AGENTS.md` bertahan setelah `boost:update` |
| MCP dari root repository | Klien stdio MCP (handshake JSON-RPC) ke `php backend/artisan boost:mcp`: server `Laravel Boost`, protokol `2025-06-18`, 10 tool (`application-info`, `browser-logs`, `database-connections`, `database-query`, `database-schema`, `get-absolute-url`, `last-error`, `read-log-entries`, `record-rule`, `search-docs`) |
| Tool baca-saja | `application-info`: `php_version 8.5`, `laravel_version 13.36.0`, `database_engine sqlite` |
| Dokumentasi sesuai versi | `search-docs` (routing, rate limiting, CORS, trusted proxies, exception JSON, validasi enum, Form Request, testing database) mengembalikan hasil berlabel `laravel/framework@13.x`; dipakai untuk merancang route, limiter, CORS, proxy, render exception, dan tes |
| Claude Code | `claude mcp list` dari root: `laravel-boost: php backend/artisan boost:mcp - ✔ Connected`, scope "Project config (shared via .mcp.json)". Skill di `backend/.claude/skills/` ditemukan otomatis oleh sesi yang berjalan di root |
| Codex | Dengan `CODEX_HOME` sementara yang mempercayai repository: `codex mcp list` dari root menampilkan `laravel-boost php backend/artisan boost:mcp enabled`; dari `backend/` memakai konfigurasi buatan Boost (`php artisan boost:mcp`). Tanpa kepercayaan proyek, konfigurasi proyek tidak dimuat (perilaku Codex). Pemanggilan tool dari dalam sesi Codex **tidak diuji** (butuh sesi Codex yang login) |
| Cursor | `.cursor/mcp.json` dibuat, **tidak diverifikasi**: Cursor tidak terpasang |
| Playwright MCP | Entri tidak berubah (diff hanya menambah baris). `claude mcp list` melaporkan timeout 30 s untuk `npx` pada Windows, seperti catatan yang sudah ada di `CLAUDE.md`; server yang sama dijalankan langsung (`cmd /c npx -y @playwright/mcp@0.0.83`) menjawab handshake dalam sekitar 10 s dengan 25 tool, dan tool Playwright tersedia di sesi ini |

### API inquiry: tes otomatis

`php artisan test`: **89 lulus, 0 gagal, 227 assertion** (SQLite in-memory, `RefreshDatabase`).

| Area | Tes |
|---|---|
| Sukses | 201 dengan `{id, status}` persis, baris tersimpan dengan semua field, status `received`, timestamp; dua kiriman mendapat referensi berbeda; log hanya `Inquiry received.` dengan nomor referensi |
| Field opsional dan teks | `organization` tidak dikirim, `""`, atau spasi menjadi `null`; Unicode (aksen, aksara Jepang, emoji) tersimpan utuh; spasi di tepi dibuang |
| Validasi | Payload kosong (enam field wajib, pesan persis); format 422 Laravel persis; 13 batas panjang termasuk karakter multibyte (2/120 nama, 160 organisasi, 254 kontak, 20/5000 pesan); kontak email dan telepon; 7 nilai enum tidak valid (tidak dikenal, label, huruf besar, angka, array); tipe non-string |
| Aturan kontak (unit) | 8 nilai valid dan 14 tidak valid, termasuk batas 8 dan 18 karakter telepon, tab, dan baris baru |
| Kontrak frontend | Nilai enum backend sama persis dengan `ServiceId`, `BudgetRange`, `Timeline` yang dibaca dari `frontend/src/types/` |
| Referensi publik | Format `INQ-XXXX-XXXX-XXXX` Crockford; 5000 referensi unik; tidak berurutan; database menolak duplikat (`UniqueConstraintViolationException`) |
| Spam dan penyalahgunaan | Honeypot terisi: 422 dan tidak tersimpan; honeypot kosong: 201 dan tidak tersimpan sebagai kolom; batas per menit dan per jam (429, `Retry-After`, tidak tersimpan); percobaan yang ditolak ikut dihitung; `X-Forwarded-For` palsu tidak melewati batas tanpa proxy tepercaya, dan dihormati di belakang proxy tepercaya; body di atas batas: 413 |
| Mass assignment | `id`, `public_id`, `status`, `created_at` dari klien diabaikan |
| Kegagalan | Tabel dihapus di tengah tes: 503 tanpa referensi dan tanpa `received`; exception yang dilaporkan tidak memuat nama, kontak, atau pesan dan tidak membawa `QueryException`; galat tak terduga: 500 `Server Error` tanpa detail |
| Akses | `GET`/`PUT`/`DELETE` koleksi: 405; `GET`/`PATCH`/`DELETE` dengan referensi: 404; tidak ada data yang bocor dan baris tidak berubah. Respons galat dengan `APP_DEBUG=false` hanya berisi `message` |
| CORS | Origin terdaftar mendapat izin preflight tanpa credentials; origin lain tidak; tanpa konfigurasi tidak ada izin |
| Lainnya | `/up` 200 `{"status":"ok"}` tanpa cookie sesi, 503 `{"status":"down"}` tanpa detail saat pemeriksaan gagal; `/` 404; route bernama berada di `/api/v1/inquiries`; tes memakai SQLite `:memory:` |

### API inquiry: HTTP nyata

`php artisan serve` dengan database SQLite lokal: contoh `curl` di `docs/api/inquiries.md` mengembalikan `201 {"id":"INQ-ZVM2-M64Z-4VQM","status":"received"}` dengan `X-RateLimit-Limit: 5`; payload salah 422 dengan enam field; `GET` 405; `/up` 200 JSON tanpa `Set-Cookie`; `/api/api/v1/inquiries` 404. Dengan `CORS_ALLOWED_ORIGINS` terisi, preflight dari `http://localhost:5173` mendapat `Access-Control-Allow-Origin`, `Allow-Methods: GET, POST`, `Max-Age: 3600`; origin lain tidak. Catatan: `backend/.env` lokal dibuat sebelum variabel baru ada, jadi tanpa variabel itu CORS menolak semua origin (default aman); salin variabel baru dari `.env.example`.

### Temuan yang diperbaiki selama QA

| Temuan | Perbaikan |
|---|---|
| `"php": "^8.3"` tidak benar karena lock membutuhkan PHP 8.4.1 | `config.platform.php` 8.3.0, CI menguji 8.3 dan 8.5 |
| Halaman `/up` bawaan berjudul "Laravel" | `/up` JSON sendiri di luar grup `web` |
| Respons 429 menyertakan trace saat `APP_DEBUG=true` | Perilaku framework yang benar untuk lokal; tes memakai `APP_DEBUG=false` seperti produksi, dan dokumentasi mewajibkan `false` di luar lokal |
| Pesan `QueryException` memuat nilai SQL (data pribadi) bila dilaporkan | `InquiryNotStoredException` tanpa exception sebelumnya, hanya SQLSTATE |
| Rute `storage/{path}` bawaan aktif | Dimatikan untuk host API |
| Aturan `deny` `Read(./**/.env.*)` memblokir `.env.example` (pembacaan ditolak di sesi ini) | Pola diganti daftar file rahasia yang eksplisit; `.env.example` dapat dibaca, `.env` tetap ditolak |
| Guideline Boost "buat dokumentasi hanya bila diminta" dan rekomendasi Laravel Cloud bertentangan dengan aturan repository | Guideline kustom Solveit menyatakan prioritas; `deployments` dikecualikan |

### CI dan frontend

- **Backend CI** baru (`.github/workflows/backend-ci.yml`), run 38698395762 pada push `745a852`: **lulus** di PHP 8.3 dan 8.5 (setiap langkah: validate, install, Pint, migrasi naik-turun-naik, `Tests: 89 passed (227 assertions)`, cek route, `composer audit` tanpa advisory, instalasi `--no-dev` tanpa perintah Boost). Anotasi hanya pemberitahuan GitHub (aksi `@v4` berbasis Node 20, migrasi label `ubuntu-latest`), sama dengan workflow frontend yang sudah ada.
- Frontend tidak diubah (`git status frontend/` bersih, tidak ada file `frontend/` di diff). `npm run check` (lint, typecheck, unit test, build, dirangkai `&&`) keluar dengan kode 0; unit test 12 file, 69/69 lulus; build mem-prerender 22 halaman terindeks. `npm run format:check` hanya memperingatkan `frontend/.impeccable/hook.cache.json`, file cache lokal yang tidak dilacak Git (sama dengan catatan sebelumnya). E2E tidak dijalankan ulang karena tidak ada perubahan UI. Frontend CI tidak dipicu oleh PR ini (path `frontend/**` tidak berubah).

### Keterbatasan

- Codex: konfigurasi diverifikasi, pemanggilan tool dari sesi Codex tidak. Cursor: tidak diverifikasi sama sekali.
- Belum ada deployment, database produksi, domain, atau origin produksi; proteksi spam tambahan (CAPTCHA, firewall) menunggu keputusan deployment.
- Masa simpan, ekspor, dan penghapusan data inquiry belum diputuskan (`docs/api/inquiries.md`, Privasi).

## Kerapian struktur repository (2026-10-15)

Cakupan: permintaan pemilik setelah rilis putaran 6. Tanpa perubahan fitur, desain, atau motion.

| Perubahan | Bukti |
|---|---|
| Folder `brand/` di root dihapus | Kedua file identik byte (`cmp`) dengan salinan di `frontend/public/brand/`, yang kini menjadi satu-satunya salinan |
| Logo publik diberi nama jelas: `logo-solveit-primary.svg` menjadi `solveit-logo-full.svg`, `logo-solveit-icon.svg` menjadi `solveit-logo-icon.svg` | `git mv`; rujukan di `seo.ts` (logo JSON-LD), `generate-brand-assets.mjs`, `logo-paths.ts`, dan dokumen diperbarui. Build tidak lagi memuat nama lama (0 rujukan di `build/client`); JSON-LD menunjuk `/brand/solveit-logo-full.svg` |
| `PRODUCT.md` dan `DESIGN.md` pindah ke `docs/`; dokumen lain dikelompokkan ke `architecture/`, `design/`, `development/`, `product/`, `seo/`, `qa/`; peta di `docs/README.md` | `impeccable context` menemukan `docs\PRODUCT.md` dan `docs\DESIGN.md`. Uji terpisah: di subfolder `docs/` keduanya tidak ditemukan, jadi keduanya tetap di tingkat atas `docs/`. Keputusan "wajib di root" pada tabel putaran 6 digantikan oleh hasil ini |
| `CLAUDE.local.md` dan `.claude/settings.local.json` digabung lalu dihapus | Catatan lingkungan ke `AGENTS.md` (dimuat `CLAUDE.md`), catatan Playwright MCP ke `CLAUDE.md`, `enabledMcpjsonServers` ke `.claude/settings.json`. `allow` di file lokal kosong, jadi izin tidak berubah |
| `.ai/` (handoff agent), `docs/project-structure.md` (aturan struktur), `AGENTS.md` diperbarui | Semua tautan Markdown relatif dan path dokumen di 20 file Markdown diperiksa skrip: tidak ada yang rusak (sisa temuan hanya path yang sengaja disebut sebagai contoh, file yang diabaikan Git, atau folder backend yang direncanakan) |

Verifikasi: lint, typecheck, unit 69/69, build lulus; e2e Chromium desktop untuk SEO, halaman, dan axe: 51 lulus, 0 gagal. `format:check` hanya memperingatkan `frontend/.impeccable/hook.cache.json`, file cache lokal yang tidak dilacak Git.

## Putaran 6 (2026-10-14/15): morph logo, navbar kaca, slice CTA, Tentang Kami, FAQ, pratinjau responsif, formulir, penamaan ekosistem, kerapian repository

Cakupan: brief "Final experience refinement" fase 1 sampai 12. Baseline: `main` dan `frontend` pada `9338a2a`, `staging` `302542b`, `backend` `1c9ec51` (diverifikasi lokal dan remote sebelum mulai). Tanpa perubahan backend, tanpa dependensi baru, layar pemuatan tidak diubah, SEO/GEO final tetap ditunda ke fase deployment.

### Akar masalah yang diperbaiki

| Masalah | Penyebab (dibuktikan dengan frame yang dijeda lewat Web Animations API) | Perbaikan |
|---|---|---|
| Fragmen wordmark saat navbar meringkas/mengembang ("St", "eit", "NESIA", "IA", huruf "t" dan "o" terpotong) | (1) Lapisan wordmark dan INDONESIA berada **di atas** mark (urutan DOM), sehingga potongan huruf tergambar di atas kapsul. (2) Tepi `clip-path` wordmark mengikuti kotak pembatas mark, padahal siluet mark diagonal dan turun 15,4 persen, sehingga tepi clip memotong huruf di ruang kosong (240 sampai 360 ms). (3) INDONESIA memakai wipe clip sendiri (0,46 s) yang tidak terkait posisi mark. (4) Di ponsel tepi kanan clip menyapu ke kiri dengan fade tertunda 0,2 s | Mark ditumpuk di atas (`z-index`); wordmark dan INDONESIA tidak lagi di-clip, tetapi memudar utuh sambil bergeser sedikit (keluar 200/140 ms ease-out, kembali setelah mark lewat). Hanya transform dan opacity, jadi lebih ringan dari clip-path per frame. Filmstrip sebelum/sesudah di bukti visual |
| Halaman yang dimuat ulang di tengah scroll memutar morph saat GSAP tiba | Keadaan header baru ditulis setelah GSAP dimuat (lazy) | `useLayoutEffect` saat hydration menulis keadaan dari `scrollY` dengan `data-instant` (tanpa transisi) selama dua frame; logika ambang dipusatkan di `syncHeader` |
| Label pratinjau ikut terhitung sebagai label demo | Komponen baru memakai kelas `.demo-label` | Kelas sendiri `.preview-label` dengan tampilan yang sama; `.demo-label` tetap berarti "konsep demonstrasi" |
| Segmen terpilih pratinjau tidak terbaca saat di-hover | Aturan hover lebih spesifik dari `:checked` (tinta di atas tinta) | Hover tidak berlaku untuk segmen terpilih |

### Pemeriksaan otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Lulus (satu-satunya peringatan format: cache lokal `.impeccable/hook.cache.json`, tidak di-commit) |
| `npm test` (Vitest) | 69/69 lulus. Baru: `device-preview.test.ts` (kelas perangkat mengikuti breakpoint situs, skala tidak pernah melebihi panggung atau 1) dan uji kejujuran ekosistem di `content.test.ts` (hanya website berstatus berjalan, tidak ada status "tersedia", Orbit bukan aplikasi, nama OpsHub tetap) |
| `npm run build` | Lulus; 22 halaman terindeks + 404 per bahasa |
| E2E Chromium desktop 1440, 1 worker | 178 lulus, 0 gagal, 5 dilewati (183) |
| E2E Chromium tablet 820, 1 worker | 159 lulus, 0 gagal, 24 dilewati (183) |
| E2E Chromium Pixel 7, 1 worker | 145 lulus, 0 gagal, 38 dilewati (183) |
| E2E Firefox desktop, 1 worker | 177 lulus, 0 gagal, 6 dilewati (183). Firefox memakai jalur cadangan: FAQ membuka instan dan select memakai popup native |
| E2E WebKit desktop 1440, suite penuh, GitHub Actions, 1 worker, tanpa retry | 175 lulus, 0 gagal, 0 flaky, 8 dilewati (183), run [38609496831](https://github.com/solveit-id/solveit_indonesia/actions/runs/38609496831) pada `e8468df` |
| E2E WebKit iPhone 14, suite penuh, GitHub Actions, 1 worker, tanpa retry | 143 lulus, 0 gagal, 0 flaky, 40 dilewati (183), run yang sama |
| axe-core WCAG 2.0/2.1/2.2 A dan AA | 0 pelanggaran, 14 halaman x 2 tema, di desktop, tablet, ponsel, dan Firefox |

Run e2e penuh pertama dihentikan sistem karena memori mesin hampir habis (Chromium "Target crashed", lalu 141 kali "worker process exited unexpectedly"; bukan kegagalan asersi). Setelah memori dibebaskan, setiap project dijalankan ulang di latar depan dalam dua shard berurutan, 1 worker; angka di atas berasal dari run ulang itu. Tidak ada perlindungan memori atau tes yang dilonggarkan.

Cakupan e2e baru (`tests/e2e/experience.spec.ts`): frame morph yang dijeda di delapan titik untuk tiga arah, tanpa clip pada kata dan dengan mark selalu di atas; pembalikan cepat berakhir di keadaan yang benar; halaman yang dibuka di tengah scroll (deep link, discroll browser sebelum hydration) langsung compact tanpa satu pun transisi lockup berjalan dan tanpa `data-instant` tersisa; navigasi dari keadaan compact; backdrop blur dan kilau kapsul; slice CTA header tanpa perubahan ukuran; "Kenali kami" sebagai tautan semantik dengan garis yang tergambar saat fokus; slice "Pelajari prosesnya" dengan rail tetap tujuh langkah; teks visi identik, empat `dt`/`dd` nilai, frasa visi berubah warna maju dan kembali tanpa opacity di bawah 1; peta ekosistem di dua bahasa (8 bagian: 1 berjalan, 1 dirancang, 6 direncanakan; tanpa kata "tersedia sekarang" atau "diluncurkan"), penanda berbalik saat scroll ke atas tanpa menyembunyikan kartu; FAQ di empat halaman (klik, Enter, Space, klik cepat berulang, fokus tetap, jawaban tetap terbuka setelah scroll), satu sistem FAQ per halaman; pratinjau di 5 studi kasus x 2 bahasa berlabel ilustrasi, ganti perangkat mengubah bingkai dan tata letak (sidebar menjadi tombol menu), lebar dari keyboard (Home, panah) dengan `aria-valuetext`, seret tepi bingkai, bingkai 1440 px tidak membuat halaman scroll ke samping; kartu Permasalahan berbeda dari Konteks di dua tema; select mempertahankan nilai dan sumur caret tidak menangkap klik; tombol kirim ber-slice tetap `submit` dan formulir tidak lengkap tidak pernah dinyatakan terkirim; reduced motion. Kontrak yang sengaja berubah diperbarui di `refinement.spec.ts` (lipatan logo kini opacity, bukan inset clip; urutan bab dengan "Pratinjau responsif") dan `polish.spec.ts` (isi kaca 88 persen dan blur; daftar CTA slice yang baru; bab baru di urutan scrollspy).

### Lighthouse

Lighthouse 13.5, mobile default (Moto G Power teremulasi, simulated slow 4G, CPU 4x), Chromium 156 dari Playwright. **Berselang-seling** sebelum/sesudah per halaman, 3 run masing-masing, median; build produksi tanpa `VITE_SITE_URL` di kedua sisi, layar pemuatan penuh, server `scripts/serve.mjs` yang sama, satu browser pada satu waktu. "Sebelum" adalah `9338a2a`.

| Halaman | Performance sebelum / sesudah | LCP (s) | TBT (ms) | Speed Index (s) | CLS |
|---|---|---|---|---|---|
| `/` | 97 / **97** | 1,59 / 1,57 | 133 / 140 | 3,21 / 3,28 | 0 / 0 |
| `/tentang` | 99 / **98** | 1,58 / 1,58 | 77 / 126 | 2,72 / 2,91 | 0 / 0 |
| `/layanan` | 99 / **99** | 1,58 / 1,57 | 84 / 86 | 2,73 / 2,90 | 0 / 0 |
| `/portofolio/sistem-antrean-klinik` | 97 / **96** | 1,58 / 1,57 | 175 / 181 | 2,94 / 2,87 | 0 / 0 |
| `/kontak` | 99 / **99** | 1,59 / 1,56 | 96 / 90 | 2,60 / 2,62 | 0 / 0 |

Accessibility, Best Practices, dan SEO 100 di semua run. Performance tetap 96 sampai 99, LCP di bawah 1,6 s, CLS 0. **Trade-off yang tercatat:** TBT `/tentang` naik dari 77 ke 126 ms (ketiga run sesudah 114 sampai 147 ms, jadi bukan noise). Itu biaya penyiapan timeline scroll baru di halaman itu (frasa visi, sumbu, delapan garis nilai, peta ekosistem); Performance turun satu poin. Studi kasus dan Layanan berubah dalam rentang noise run tunggal. Ukuran (brotli): CSS 15,2 ke 17,9 KB, total JS 224,5 ke 229,0 KB (chunk studi kasus 12,4 ke 15,3 KB, Tentang 1,7 ke 2,5 KB), HTML Beranda 17,4 ke 17,5 KB, Tentang 12,8 ke 13,3 KB, studi kasus 18,9 ke 19,9 KB.

### Kerapian repository

Inventaris berkas terlacak, root, struktur frontend, dokumentasi, konfigurasi agen, aset merek, artefak, export, selector CSS, dan rujukan (impor, skrip, tes, dokumentasi, CI):

| Kandidat | Klasifikasi | Bukti | Tindakan |
|---|---|---|---|
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.gitattributes`, `.editorconfig`, `.github/`, `.claude/`, `.mcp.json`, `.nvmrc` | Wajib atau konvensional di root | Dibaca alat, CI, dan agen dari root | Tetap |
| `PRODUCT.md`, `DESIGN.md`, `.impeccable/` | Wajib di root | Plugin impeccable membaca keduanya dari root proyek | Tetap |
| `logo-solveit-icon.svg`, `logo-solveit-primary.svg` di root | Dapat dipindah | Identik byte dengan `frontend/public/brand/`; tidak dipakai build, hanya dirujuk dokumentasi | `git mv` ke `brand/`; README, PRODUCT, arsitektur, pengembangan, dan komentar `logo-paths.ts` diperbarui; geometri tidak berubah (`cmp` identik) |
| `frontend/src/assets/brand/*.svg` | Terbukti tidak dipakai | Tidak ada impor (Vite hanya membundel aset yang diimpor), tidak dirujuk skrip, tes, atau CI; salinan identik | Dihapus (`git rm`) |
| `getProjectBySlug` (`services/projects.ts`), `isLocale` (`i18n/config.ts`) | Terbukti tidak dipakai | Nol rujukan di kode, tes, skrip, dan dokumentasi; `getProjectBySlug` digantikan `getProjectByPath` di `47e6220` | Dihapus |
| Export yang hanya dipakai di berkasnya sendiri (mis. `LogoGradient`, `matchQuestion`) | Dipakai | Dirujuk di berkas yang sama | Tetap |
| Selector CSS | Semua dipakai | Pemindaian semua kelas di `app.css` terhadap `src/` | Tidak ada yang dihapus |
| Berkas tanpa impor (`root.tsx`, `entry.client.tsx`, `pages/*`, `layouts/*`, `test/setup.ts`) | Dipakai lewat konvensi | Entry framework dan modul route di `routes.ts` | Tetap |
| `.playwright-mcp/`, `.impeccable/review/`, `build/`, `test-results/` | Artefak lokal | Di-gitignore | Tidak disentuh |

### Bukti visual

Disimpan lokal di `.impeccable/review/round-6/` (di-gitignore seperti putaran sebelumnya):

| Bukti | Isi |
|---|---|
| `navbar-morph-collapse-desktop.png`, `navbar-morph-expand-desktop.png`, `navbar-morph-mobile.png` | Frame 0 sampai 700 ms sebelum/sesudah, desktop dan 390 px, kedua arah |
| `header-*-{light,dark}.png`, `nav-cta-hover-*.png` | Kapsul kaca di atas paper, tile navy, dan bidang cobalt footer di dua tema; slice CTA header |
| `before/*.png`, `after/*.png` | Tagline dan "Kenali kami", Visi, Nilai, peta ekosistem, FAQ terbuka, kartu Permasalahan, formulir, pada posisi yang sama |
| `preview-{desktop,tablet,mobile}-*.png`, `select-open-*.png`, `faq-*.png`, `about-*.png` | Pratinjau responsif per mode di desktop gelap/terang dan 390 px; popup select bergaya (Chromium); FAQ; Tentang |

Tidak ada error konsol pada sesi screenshot.

### Status

- **Lulus terverifikasi**: format, lint, typecheck, unit 69/69, build, e2e Chromium (desktop, tablet, Pixel 7) dan Firefox tanpa kegagalan, axe 0 pelanggaran, Lighthouse lima halaman sebelum/sesudah, bukti visual.
- **Lulus terverifikasi (lintas browser)**: suite penuh WebKit desktop dan WebKit iPhone 14 di GitHub Actions. Run pertama pada `ebc9a97` gagal di satu tes baru di kedua project: tes "muat ulang di tengah scroll" bergantung pada kapan router menyimpan posisi scroll sebelum reload, dan di runner WebKit halaman kembali di atas. Lokal (WebKit dan Chromium) posisi pulih dan header benar. Tes diganti dengan deep link yang discroll browser sebelum hydration di semua engine, dan kini juga memastikan tidak ada transisi lockup yang berjalan; tidak ada perubahan kode produk.
- **Keputusan pemilik** (diselesaikan 2026-10-15): visi resmi diganti dengan redaksi pemilik yang tidak lagi menyebut "melalui Solveit OpsHub"; lihat `docs/product/product-naming.md`.
- **Ditunda (fase deployment)**: optimasi SEO/GEO final, lihat `docs/seo/seo-geo.md`.

## Putaran 5 (2026-10-14): navbar compact, label demo, bab studi kasus, motion bab, Principles, CTA slice

Cakupan: sembilan masukan pengguna dari evaluasi langsung. Kapsul navbar compact yang lebih jelas dan morph yang menyatu, label demonstrasi, tata letak dan scrollspy bab studi kasus, motion Peta sistem / Alur utama / Yang akan diukur, komposisi "Cara kerja yang bisa Anda pegang.", dan hover slice pada tiga CTA. Juga keputusan batas sistem (website terpisah dari OpsHub) dan SEO/GEO final sebagai tugas fase deployment. Baseline: `main` pada `7443d4a`. Tanpa perubahan backend, tanpa dependensi baru, layar pemuatan tidak diubah.

### Akar masalah yang diperbaiki

| Masalah | Penyebab | Perbaikan |
|---|---|---|
| Kapsul compact menyatu dengan latar | Isi 86 persen `--paper` (warna yang sama dengan halaman) dan garis tepi `--line` 13 persen yang baru muncul 0,3 s setelah kapsul selesai menyusut | Tiga lapisan dengan geometri clip yang sama: rim `--capsule-rim` (20 persen) yang ikut berubah bentuk, isi porselen terangkat 94 persen 1 px di dalamnya, bayangan overlay tipis. Satu treatment, tanpa glow |
| Morph kurang terasa dan "patah" | Radius `round 9999px` langsung menjadi kapsul di awal transisi; garis tepi muncul terpisah; expo-out sangat depan | Radius 1,875 rem yang berinterpolasi dari 0, garis tepi bagian dari bentuk, satu `--morph` 0,7 s `cubic-bezier(0.22, 1, 0.36, 1)` untuk pelat, rim, logo |
| Bab aktif salah atau saling menimpa | Konteks dan Permasalahan sejajar (`md:grid-cols-2`) dengan dua ScrollTrigger `onToggle` independen pada posisi vertikal yang sama | Konteks dan Permasalahan bertumpuk; satu scrollspy deterministik (`src/lib/scrollspy.ts`) menghitung satu bab dari garis baca, offset dokumen tanpa transform, fallback dasar halaman, kunci klik rail sampai input pembaca. Baseline juga tidak menandai bab apa pun setelah Back ke dasar halaman; kini Pengukuran |
| Label demo kecil dan pucat | 13 px tinta redup, garis putus-putus 28 persen | 14 px, frasa utama tinta penuh 650, kapsul berongga 33 derajat, garis putus-putus tinta redup 62 persen, latar porselen terangkat, wrap seimbang |

### Pemeriksaan otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Lulus (satu-satunya peringatan format: cache lokal `.impeccable/hook.cache.json`, tidak di-commit) |
| `npm test` (Vitest) | 66/66 lulus. Baru: `lib/scrollspy.test.ts` (tanpa bab sebelum judul pertama, satu bab, bab panjang tetap aktif di sela, urutan baca untuk bab sejajar, fallback dasar halaman, garis baca di atas titik mendarat anchor) |
| `npm run build` | Lulus; 22 halaman terindeks + 404 per bahasa |
| E2E Chromium desktop 1440, 1 worker | 143 lulus, 0 gagal, 5 dilewati (148) |
| E2E Chromium tablet 820, 1 worker | 125 lulus, 0 gagal, 23 dilewati (148) |
| E2E Chromium Pixel 7, 1 worker | 111 lulus, 1 gagal, 36 dilewati (148); kegagalan itu tes alur yang menggulir terlalu pendek di ponsel (lihat bawah), lulus setelah diperbaiki |
| Ulang akhir pada build final (setelah perbaikan label demo): `polish`, `navigation`, `a11y` di desktop, tablet, Pixel 7 | 151 lulus, 0 gagal, 35 dilewati |
| E2E Firefox desktop, 1 worker | 142 lulus, 0 gagal, 6 dilewati (148) |
| E2E WebKit desktop 1440, suite penuh, GitHub Actions, 1 worker, tanpa retry | 140 lulus, 0 gagal, 0 flaky, 8 dilewati (148) |
| E2E WebKit iPhone 14, suite penuh, GitHub Actions, 1 worker, tanpa retry | 110 lulus, 0 gagal, 0 flaky, 38 dilewati (148) |
| axe-core WCAG 2.0/2.1/2.2 A dan AA | 0 pelanggaran, 14 halaman x 2 tema, di desktop, tablet, ponsel |
| Detektor impeccable | Hanya dua advisory lama (overshoot ikon tema yang sudah disetujui putaran 4); tidak ada temuan pada file yang diubah |

Cakupan e2e baru (`tests/e2e/polish.spec.ts`, 25 tes x project): kapsul compact di kedua tema (opasitas dan warna rim, isi 94 persen, radius 30 px, pelat tepat 1 px di dalam rim, bayangan, kembali penuh di atas), lewat ambang bolak-balik cepat lalu tenang, logo dan kontrol tetap fokus/klik saat compact; label demo di daftar, detail, dan studi kasus tetangga di dua bahasa (teks, kursor bawaan, bukan tombol, tidak keluar dari wadahnya); Konteks di atas Permasalahan; 5 studi kasus x 2 bahasa digulir maju dan mundur melewati delapan bab dengan tepat satu bab aktif dan urutan benar, tanpa bab di atas bab pertama; scroll roda pelan dicatat MutationObserver: tidak pernah dua bab, urutan hanya maju; klik rail (URL hash, fokus, bab aktif sebelum dan sesudah scroll halus selesai), hash langsung, Back, Forward, dan pergantian bahasa (bab aktif = bab di garis baca halaman baru); viewport pendek 620 px; motion peta sistem (kapsul terpentaskan lalu terbuka penuh, sinyal dan cincin kembali tersembunyi), alur maju dan mundur, rencana pengukuran tanpa angka atau persen; reduced motion (semua tampil, penanda alur menyala, tanpa transform); Principles (terpentaskan, terbuka, kursor bawaan, tanpa tautan, hover hanya di pointer halus, tile tidak terangkat); CTA slice (tepat tiga, tidak di header/switch/tutup, bidang masuk saat hover di pointer halus dan tetap di luar pada sentuh, ukuran tetap, warna label, fokus keyboard dengan cincin).

### Temuan yang diperbaiki selama QA

| Temuan | Sumber | Perbaikan |
|---|---|---|
| Judul "Permasalahan" menabrak kolom teks di kartu | Screenshot desktop | Override ukuran judul di `@layer components` kalah dari utilitas `text-title`; `ChapterHead` kini menerima `compact` (skala heading), kolom 5/7 |
| Konteks pendek hampir tidak pernah aktif | Screenshot + rail | Garis baca 30 persen menjadi 22 persen dari sisa tinggi layar |
| Peta sistem lebih dari 2,6 s | e2e | Langkah dipacu eksplisit 0,54 s per bagian (sekitar 2 s total) |
| Label demo keluar dari kartu studi kasus tetangga di ponsel | Screenshot 390 px | `white-space: nowrap` diganti `text-wrap: balance` |
| Tes: hash setelah dua scroll halus yang saling memotong; Back memulihkan posisi tautan di dasar halaman; alur ponsel butuh scroll lebih jauh; tes roda pelan habis waktu di WebKit | e2e | Tes menunggu scroll tenang, membandingkan dengan bab di garis baca (bukan bab tetap), menggulir ke ujung alur, dan anggaran 90 s untuk tes roda. Perilaku produk sama dengan baseline untuk pemulihan scroll |

### WebKit lintas browser (GitHub Actions)

Run lokal WebKit tidak bisa diselesaikan: mesin hanya punya 0,5 sampai 1,5 GB RAM bebas dari 15,4 GB, hydration WebKit butuh sekitar 7,5 s untuk **baseline maupun build baru** (diukur berdampingan), dan tes lama yang tidak tersentuh perubahan ini habis waktu. Satu-satunya hasil lokal adalah `polish.spec.ts` (24 lulus, 1 dilewati). Suite penuh lalu dijalankan di runner bersih lewat workflow baru `.github/workflows/cross-browser-qa.yml` (`workflow_dispatch`, dan sekali saat workflow itu berubah di `frontend`): Ubuntu, Playwright 1.64 WebKit, `PW_ALL_BROWSERS=1`, satu project setelah yang lain, 1 worker, `--retries=0` (flake terlihat sebagai gagal), build produksi dari commit yang sama lewat `webServer` konfigurasi Playwright. Laporan HTML dan JSON disimpan sebagai artefak 14 hari.

Run [38569534271](https://github.com/solveit-id/solveit_indonesia/actions/runs/38569534271) pada `11f1d57`, yang isi `frontend/`-nya identik dengan `89c5445` (commit sesudahnya hanya menambah workflow):

| Project | Lulus | Gagal | Flaky | Dilewati | Durasi |
|---|---|---|---|---|---|
| WebKit desktop 1440 | 140 | 0 | 0 | 8 | 4,6 menit |
| WebKit iPhone 14 | 110 | 0 | 0 | 38 | 4,0 menit |

Semua yang dilewati adalah kondisi `test.skip` di tes itu sendiri, bukan kegagalan: kontrol khusus ponsel di desktop, rail bab dan fitur khusus desktop di iPhone (rail tampil mulai 1024 px), dan fokus keyboard pada tombol slice di WebKit (WebKit tidak berpindah ke tombol dengan Tab secara bawaan; slice saat fokus diverifikasi di Chromium dan Firefox). Spesifikasi putaran ini (`polish.spec.ts`) di WebKit desktop: 24 lulus, 1 dilewati; di iPhone: 11 lulus, 14 dilewati (desktop saja), 0 gagal. Tidak ada perubahan kode atau tes yang dibutuhkan.

### Lighthouse

Lighthouse 13.5, mobile default (Moto G Power teremulasi, simulated slow 4G, CPU 4x), Chromium 156. **Berselang-seling** sebelum/sesudah per halaman, 3 run masing-masing, median; build produksi tanpa `VITE_SITE_URL` di kedua sisi, layar pemuatan penuh (muatan pertama di tab), server `scripts/serve.mjs` yang sama, satu browser pada satu waktu. "Sebelum" adalah `main` `7443d4a`. RAM bebas saat pengukuran sekitar 0,5 GB, sehingga Speed Index kedua sisi lebih tinggi dari putaran 4; pembanding yang adil adalah kolom sebelum di tabel ini.

| Halaman | Performance sebelum / sesudah | LCP (s) | TBT (ms) | Speed Index (s) | CLS |
|---|---|---|---|---|---|
| `/` | 94 / **96** | 1,59 / 1,60 | 232 / 176 | 3,98 / 3,74 | 0 / 0 |
| `/portofolio` | 98 / **98** | 1,60 / 1,59 | 72 / 81 | 3,78 / 3,78 | 0 / 0 |
| `/portofolio/sistem-antrean-klinik` | 98 / **97** | 1,58 / 1,60 | 122 / 141 | 3,11 / 3,04 | 0 / 0 |
| `/en` | 98 / **98** | 1,59 / 1,59 | 104 / 115 | 3,25 / 3,17 | 0 / 0 |

Accessibility, Best Practices, dan SEO 100 di semua run. Performance tetap 96 sampai 98, LCP di bawah 1,6 s, CLS 0. TBT berubah dalam rentang noise run tunggal (studi kasus +19 ms median; sebaran run sebelum 99 sampai 177 ms, sesudah 116 sampai 246 ms). Ukuran: CSS 14,2 ke 15,3 KB brotli, total JS 223,2 ke 224,5 KB, HTML Beranda 17,3 ke 17,5 KB, HTML studi kasus tetap 18,9 KB.

### Bukti visual

Disimpan lokal di `.impeccable/review/round-5/` (di-gitignore seperti putaran sebelumnya), diambil dari build final dan dari baseline yang sama-sama disajikan lokal:

| Bukti | Isi |
|---|---|
| `navbar-before-after.png` | Kapsul compact di atas Principles (paper), karya (sunken), dan bidang cobalt footer, terang dan gelap, sebelum lalu sesudah |
| `navbar-morph-filmstrip.png`, `navbar-tablet-mobile-after.png` | Morph normal ke compact (0 sampai 450 ms) dan kembali (90 sampai 750 ms); tablet dan ponsel |
| `case-context-before-after.png` | Konteks dan Permasalahan sejajar dengan rail menandai Permasalahan saat Konteks dibaca (sebelum) lalu bertumpuk dengan Konteks aktif (sesudah) |
| `case-chapters-after-desktop.png`, `case-chapters-after-mobile.png` | Peta sistem, alur, pengukuran di desktop dan ponsel, terang dan gelap |
| `badge-before-after.png`, `badge-mobile-after.png` | Label demo di detail (dua tema), kartu daftar, dan studi kasus tetangga EN di ponsel |
| `principles-before-after.png`, `principles-mobile-after.png` | Komposisi di tengah entrance dan akhir, hover portal di gelap; ponsel |
| `slice-cta-frames.png` | Slice CTA hero: diam, 120 ms, 260 ms, 700 ms, keluar 200 ms, fokus keyboard, gelap; "Lihat portofolio" terang/gelap; CTA bidang penutup |

Tidak ada error konsol pada sesi screenshot.

### Status

- **Lulus terverifikasi**: format, lint, typecheck, unit 66/66, build, e2e Chromium (desktop, tablet, Pixel 7) dan Firefox tanpa kegagalan, axe 0 pelanggaran, Lighthouse empat halaman sebelum/sesudah, bukti visual.
- **Lulus terverifikasi (lintas browser)**: suite penuh WebKit desktop dan WebKit iPhone 14 di GitHub Actions, lihat bagian "WebKit lintas browser" di atas.
- **Ditunda (fase deployment)**: optimasi SEO/GEO final, lihat `docs/seo/seo-geo.md`.

## Putaran 4 (2026-10-13): layar pemuatan bermerek, morph navbar, kontrol mengambang, detail portofolio

Cakupan: 16 masukan pengguna dari evaluasi langsung. Layar pemuatan fullscreen bermerek (membatalkan keputusan putaran 3, atas permintaan pengguna), tombol tema dan pemilih bahasa, header lebih lega dengan morph logo primer ke ikon, urutan menu baru, dock kembali ke atas dan asisten, audit kursor dan kontrol tutup merah, logo teknologi, desain ulang detail studi kasus, dan penghalusan motion. Baseline: `main` pada `1ea6eea`.

### Pemeriksaan otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Lulus. Satu-satunya peringatan format adalah cache lokal hook desain (`frontend/.impeccable/hook.cache.json`, di-exclude dari git) |
| `npm test` (Vitest) | 60/60 lulus. Baru: `lib/boot.test.ts` (urutan penuh lalu singkat dalam satu tab, exit begitu kapsul keempat mengunci, storage diblokir tetap penuh, reduced motion, batas 2,6 s, hook opt-out, `bootSettled`; setiap tes di dokumen terpisah) dan `data/technologies.test.ts` (setiap teknologi proyek terdeskripsi, hanya logo yang dibundel, REST API tanpa logo merek, judul "diusulkan"/"proposed") |
| `npm run build` | Lulus; 22 halaman terindeks + 404 per bahasa |
| E2E Chromium desktop 1440, 1 worker | 118 lulus, 0 gagal, 5 dilewati sesuai desain (123) |
| E2E Chromium tablet 820, 1 worker | 113 lulus, 0 gagal, 10 dilewati (123) |
| E2E Chromium Pixel 7, 1 worker | 100 lulus, 0 gagal, 23 dilewati (123) |
| E2E Firefox desktop, 1 worker | 117 lulus, 0 gagal, 6 dilewati (123) |
| E2E WebKit desktop, 1 worker | 116 lulus, 0 gagal, 7 dilewati (123) |
| E2E WebKit iPhone 14, 1 worker | 99 lulus, 0 gagal, 24 dilewati (123) |
| axe-core WCAG 2.0/2.1/2.2 A dan AA | 0 pelanggaran di 14 halaman x 2 tema di keenam project di atas |

Satu putaran regresi bersih pada kode final, dijalankan berurutan per project dengan 1 worker (memori bebas 1,1 sampai 2,5 GB). Dua run sebelumnya dihentikan sistem karena tekanan memori (satu run Lighthouse dan satu run e2e paralel yang worker-nya gagal mulai dengan `0xC0000142`); keduanya diulang dengan cara berurutan, bukan dengan mematikan perlindungan memori.

Cakupan e2e baru (`tests/e2e/refinement.spec.ts`): layar pemuatan (urutan penuh pada muatan pertama, singkat pada reload di tab yang sama dan lebih cepat dari yang penuh, penuh lagi di tab baru; menutupi paint pertama, ukuran layar penuh, `pointer-events: none`, judul halaman sudah ada di bawahnya, exit paling lambat 2,6 s setelah frame pertama entrance, hilang setelah sapuan; sekali per dokumen, tidak muncul pada navigasi klien; tema gelap dari frame pertama di route EN; reduced motion tanpa gerak kapsul; tanpa JavaScript tidak tampil; jaringan lambat tetap tampil lalu pergi), gulungan ikon tema dan `view-transition-name`, gulungan label bahasa berlawanan arah dan toggle ponsel, lipatan wordmark ke mark dan kembali (kedua varian lebar), area di luar kapsul header tetap bisa diklik, tombol kembali ke atas di samping peluncur dan tidak tertutup panel asisten, peluncur yang terbuka dipangkas, kontrol tutup merah, kursor (pointer, not-allowed, text), lima studi kasus x dua bahasa menampilkan setiap teknologi dengan logo dan nama tanpa tautan atau tombol, rail bab mengikuti pembaca dan urutan cerita. Urutan menu baru diuji di kedua bahasa.

Opt-out e2e: fixture menulis `window.__solveitBoot = "off"` sebelum skrip halaman berjalan, sehingga tes lain tidak menunggu sekitar 1,3 s per muatan; tes layar pemuatan memakai `bootLoader: true` dan melihat urutan yang sebenarnya.

### Temuan yang diperbaiki selama QA

| Temuan | Sumber | Perbaikan |
|---|---|---|
| TBT Beranda naik 440 ke 581 ms (run berurutan) | Lighthouse, `long-tasks` | Long task terbesar (sekitar 300 ms, juga di baseline) adalah semua setup GSAP yang berjalan beruntun saat GSAP pertama tiba. `useMotion` kini mengantrekan setup pada muatan pertama, satu per task, urutan tetap; setelah GSAP dimuat (navigasi klien) setup tetap sinkron sehingga entrance tidak berkedip. TBT Beranda menjadi 191 ms vs 255 ms baseline |
| Speed Index naik karena overlay menutupi halaman yang sudah terlukis | Lighthouse, filmstrip | Timeline dipadatkan dua kali (1,7 s ke 1,5 s ke sekitar 1,3 s total) tanpa membuang ketukan: kedatangan kapsul, wordmark, INDONESIA, sapuan 33 derajat. Sisa kenaikan dijelaskan di bawah |
| Overlay bisa tertahan bila main thread sibuk saat batas 2,6 s jatuh tempo (timer tidak bisa menyela long task) | Tes kontrak waktu di dalam halaman | Failsafe CSS: animasi `boot-failsafe` dengan delay 3,4 s yang dijalankan compositor, sama di keadaan `intro` dan `exit` sehingga tidak pernah mulai ulang |
| Ikon tema tetap miring setelah diketuk di layar sentuh (hover tersangkut) | e2e tablet/ponsel | Semua hover yang menggerakkan sesuatu hanya di `@media (hover: hover)` |
| Elemen `<header>` tetap menangkap klik di luar kapsul mengambang | e2e `elementFromPoint` | `pointer-events: none` pada header saat ringkas, kontrol di dalamnya tetap aktif |
| Ikon teknologi terlalu kecil dan pucat (MySQL tidak terbaca) | Screenshot | Sumur 2,5 rem, ikon 1,375 rem, warna tinta penuh |
| Path logo muncul tiga kali per halaman (header, overlay, footer) | Ukuran HTML | Satu sprite `<symbol>`/`<use>` bersama (`logo-sprite.tsx`); ikon teknologi juga satu sprite per studi kasus |
| WebKit melaporkan `cursor: auto` untuk tautan dan input teks | e2e WebKit | Kursor dinyatakan eksplisit di base layer (`a[href]` pointer, input teks dan textarea `text`) agar sama di semua mesin |
| Nilai clip-path diserialisasi `71.400002%` di WebKit | e2e WebKit iPhone | Tes membandingkan angka dengan pembulatan 0,1 |
| Dua tes yang mengunjungi 14 halaman melewati 30 s | Run penuh 16 worker | Diukur: 14 muatan tanpa JS sekitar 1,4 s pada build lama maupun baru (Pixel 7), jadi bukan regresi tetapi kepadatan worker. Lulus pada batas bawaan 30 s dengan 1 dan 2 worker; kenaikan batas waktu yang sempat dibuat dibatalkan |
| Overlay penuh menutupi halaman sekitar 1,3 s pada setiap muatan dokumen | Speed Index | Disetujui pemilik produk: urutan penuh hanya pada muatan pertama di tab (`sessionStorage`), versi singkat sekitar 0,6 s pada refresh berikutnya, dan exit dimulai begitu kapsul keempat mengunci. Terukur: penuh 1,29 s, singkat 0,58 s dari paint pertama sampai overlay hilang |

### Lighthouse

Lighthouse 13.5, mobile default (Moto G Power teremulasi, slow 4G, CPU 4x). **Run berselang-seling** tiga varian per halaman, 3 run masing-masing, median; semua build tanpa `VITE_SITE_URL`, disajikan satu proses Node dengan logika `scripts/serve.mjs`, satu browser pada satu waktu:

- **Sebelum**: `main` `1ea6eea`.
- **Penuh**: build final, muatan pertama di tab (urutan sekitar 1,3 s).
- **Singkat**: build final yang sama dengan pemeriksaan sesi dipaksa "sudah dilihat" pada salinan sementara, karena Lighthouse selalu membuka tab baru sehingga reload dalam sesi tidak bisa diulang langsung. Hanya satu ekspresi di skrip head yang diganti; kode produksi tidak berubah.

| Halaman | Performance sebelum / penuh / singkat | LCP (s) | TBT (ms) | Speed Index (s) | CLS |
|---|---|---|---|---|---|
| `/` | 96 / **97** / **98** | 1,59 / 1,58 / 1,57 | 196 / 153 / 147 | 2,96 / 3,21 / 2,89 | 0 |
| `/portofolio` | 99 / **98** / **98** | 1,57 / 1,57 / 1,57 | 92 / 109 / 79 | 2,71 / 3,25 / 3,08 | 0 |
| `/portofolio/sistem-antrean-klinik` | 99 / **98** / **98** | 1,57 / 1,58 / 1,58 | 101 / 135 / 130 | 2,56 / 2,78 / 2,89 | 0 |
| `/kontak` | 100 / **99** / **99** | 1,44 / 1,59 / 1,58 | 85 / 90 / 85 | 1,95 / 2,58 / 2,32 | 0 |
| `/en` | 97 / **97** / **98** | 1,45 / 1,58 / 1,58 | 193 / 152 / 101 | 2,72 / 3,09 / 2,87 | 0 |

Accessibility, Best Practices, dan SEO 100 pada ketiga varian di kelima halaman. Data mentah: `lh-f-*` (varian final), serta `lh-r2*`/`lh-r3*` dari putaran pengukuran sebelumnya di direktori kerja QA.

Riwayat optimasi selama putaran ini (run berurutan, lalu berselang-seling): build pertama menurunkan Beranda 87 ke 82 (TBT 440 ke 581 ms). Setelah setup GSAP diantrekan per task dan timeline dipadatkan, Beranda 94 ke 96 dan `/en` 93 ke 96 dengan TBT lebih rendah dari baseline. Exit begitu kapsul mengunci dan mode singkat menurunkan biaya Speed Index lagi (tabel di atas).

Accessibility, Best Practices, dan SEO 100 di semua halaman yang diukur, sebelum dan sesudah.

Trade-off layar pemuatan (dilaporkan apa adanya): Performance tetap 97 sampai 99, LCP di bawah 1,6 s, CLS 0, dan TBT setara atau lebih rendah dari baseline di sebagian besar halaman. **Speed Index naik** karena overlay menutupi halaman yang sudah terlukis: urutan penuh +0,22 sampai +0,63 s, versi singkat -0,07 sampai +0,38 s dibanding baseline. `/kontak` memiliki baseline paling cepat (FCP 0,84 s) sehingga kenaikannya paling terlihat (LCP 1,44 ke 1,59 s, tetap jauh di bawah 2,5 s). Alternatif yang belum diterapkan: overlay tidak penuh (logo merakit di tengah sementara konten sudah terlihat redup di bawahnya).

### Ukuran

| | Sebelum | Sesudah |
|---|---|---|
| CSS (transfer brotli) | 13 KB | 15 KB |
| HTML Beranda (brotli) | 17,0 KB | 17,6 KB |
| HTML studi kasus (brotli) | 13,1 KB | 19,3 KB (logo teknologi, sampul mini sebelumnya/berikutnya, struktur bab) |

### Review visual

Bukti disimpan lokal di `.impeccable/review/round-4/` (folder ini di-gitignore seperti review putaran sebelumnya), diambil dari build final lewat screencast CDP (paint nyata, tanpa jeda screenshot):

| Bukti | Isi |
|---|---|
| `loader-full-desktop.png`, `loader-full-mobile.png`, `loader-full-dark-en.png` | Muatan pertama: lembar porselen (atau gelap bila tema gelap dipilih, route EN), kapsul merakit, wordmark dan INDONESIA, sapuan 33 derajat dengan pita cobalt, lalu mark hero merakit di halaman |
| `loader-short-reload.png` | Reload di tab yang sama: logo terakit dalam sekitar 0,2 s, sapuan, halaman tampil. Timeline terukur: paint pertama 184 ms, exit 399 ms, selesai 760 ms |
| `loader-slow-network.png` | 1,6 Mbps, latensi 150 ms, CPU 4x: paint pertama 2,2 s, overlay tetap tampil penuh lalu pergi |
| `navbar-condense.png`, `navbar-expand.png` | Wordmark ditelan mark saat meringkas (sekitar 0,6 s) dan keluar lagi saat mengembang; kapsul pelat menyusut dan melebar mengikuti |
| `theme-toggle.png`, `language-switch.png` | Matahari dan bulan bergulir dua arah; thumb bahasa meregang dan label menggulung |
| `dock-assistant-open.png`, `assistant-close-hover.png` | Panel asisten di atas baris dock, tombol kembali ke atas terlihat di sampingnya, peluncur "Tutup" terpangkas; tombol X merah halus saat hover |
| `case-study-desktop-chapters.png`, `case-study-dark-technology.png`, `case-study-mobile-facts.png` | Bab studi kasus, logo teknologi di tema gelap, lembar fakta di ponsel |

Timeline urutan penuh terukur: paint pertama 248 ms, kapsul keempat mengunci dan exit 891 ms, selesai 1533 ms (1,29 s tertutup). Tidak ada error konsol pada sesi screenshot.

Status verifikasi:

- **Lulus terverifikasi**: format, lint, typecheck, unit 60/60, build, e2e enam project (663 lulus, 0 gagal), axe 0 pelanggaran, Lighthouse lima halaman x tiga varian, bukti visual di atas.
- **Gagal terverifikasi**: tidak ada pada kode final.
- **Terhambat lingkungan**: run paralel penuh (lebih dari 2 worker) tidak dapat dijalankan dengan memori mesin ini; diganti run berurutan 1 worker.
- **Tidak diuji**: Safari iOS dan Android fisik, pembaca layar nyata, angka lapangan (CrUX/INP) sebelum domain aktif.

### Keterbatasan

- Lighthouse adalah emulasi di mesin pengembang dengan memori terbatas; angka lapangan baru tersedia setelah domain aktif.
- Firefox dan WebKit diuji lewat build Playwright, bukan Safari iOS fisik; pembaca layar nyata belum diuji manual.
- Logo teknologi adalah merek milik pemiliknya (Simple Icons, CC0), dipakai hanya untuk mengidentifikasi teknologi yang diusulkan.

## Putaran 3 (2026-10-13): motion, interaksi premium, asisten, testimoni

Cakupan: tombol tema dan pemilih bahasa, header adaptif dengan urutan menu baru, tombol kembali ke atas, umpan balik pemuatan, Asisten Solveit (panduan otomatis), seksi cerita klien, kosakata motion, dan evaluasi Lenis. Baseline: `main` pada `d2b9956`.

### Pemeriksaan otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Lulus, 0 masalah |
| `npm test` (Vitest) | 50/50 lulus. Baru: mesin asisten (jawaban topik di kedua bahasa dengan tautan ke route nyata, hanya kontak terkonfirmasi, pencocokan FAQ, fallback jujur dengan eskalasi, tanpa harga, durasi, atau hasil karangan) dan integritas testimoni (hanya entri non-demo dengan izin bertanggal yang boleh tampil; daftar kosong sesuai PRODUCT.md; placeholder menyebut dirinya placeholder). Larangan em dash kini juga memeriksa kosakata asisten dan placeholder |
| `npm run build` | Lulus; 22 halaman terindeks, plus `/pratinjau/testimoni` (`noindex`, tidak masuk sitemap) dan 2 halaman 404 |
| `npm run test:e2e` (Chromium desktop 1440, tablet 820, Pixel 7) | 263 lulus, 0 gagal, 31 dilewati sesuai desain |
| `PW_ALL_BROWSERS=1` (Chromium x3, Firefox, WebKit desktop, WebKit iPhone 14), 4 worker | 523 lulus, 6 gagal pada run penuh. Diperiksa satu per satu: (1) WebKit tidak memfokuskan tautan saat diklik mouse, jadi asersi fokus pada pemilih bahasa diganti dengan kontrak sebenarnya (fokus tidak ditarik ke `<main>`); (2) lima tes yang mengunjungi setiap halaman melewati batas 30 detik di bawah beban paralel. Waktu hydration WebKit diukur sama dengan `main` (rata-rata 1,22 s vs 1,28 s per halaman), jadi batas kedua tes itu dinaikkan ke 90 detik seperti tes axe. Semua lulus saat dijalankan ulang |
| axe-core WCAG 2.0/2.1/2.2 A dan AA | 0 pelanggaran di 14 halaman x 2 tema, ditambah panel asisten yang terbuka |
| Detektor Impeccable | 0 temuan pada file UI yang berubah |

Cakupan e2e baru (`tests/e2e/interactions.spec.ts`): tombol tema ditekan lima kali beruntun, ukuran tetap, keadaan akhir dan ikon benar; pemilih bahasa menuju halaman setara, menjaga posisi scroll dan tidak menarik fokus, history back; toggle bahasa ponsel; umpan balik pemuatan (muatan pertama tanpa status, chunk ditahan 2,5 s menampilkan runner, chip, dan `role="status"`, navigasi yang chunk-nya sudah ada tidak menampilkan apa pun); tombol kembali ke atas (tersembunyi di atas, muncul, kembali ke 0, fokus ke `<main>`); Back memulihkan posisi scroll; header adaptif dengan histeresis dan tinggi tetap 72 px; asisten (topik, FAQ, fallback dengan tautan WhatsApp yang membawa pertanyaan, Escape, fokus kembali ke peluncur, halaman inert di ponsel, **tidak ada satu pun request ke luar origin**); scroll roda di panel tidak menggulir halaman; seksi cerita klien tanpa `blockquote` dan tanpa Review/AggregateRating; halaman pratinjau `noindex` dan bisa dinavigasi dengan keyboard; tanpa JavaScript konten dan navigasi bekerja dan tidak ada kontrol mengambang yang mati. Urutan menu diuji di kedua bahasa.

### Temuan yang diperbaiki selama QA

| Temuan | Sumber | Perbaikan |
|---|---|---|
| **Back tidak memulihkan posisi scroll** (selalu kembali ke 0). Sudah ada di `main` | Evaluasi Lenis, lalu jejak `scrollY` setelah Back | `html:focus-within { scroll-behavior: smooth }` membuat pemulihan scroll router menjadi scroll halus yang terputus. Aturan global dihapus; scroll halus diminta per aksi. Setelahnya Back kembali tepat ke 1800 px |
| Beranda: TBT naik dan Performance turun 3 poin setelah fitur baru | Lighthouse, 5 run berselang-seling | `styleLayout` naik dari 765 ke 1331 ms: loader kapsul di chip status selalu ada di DOM (opacity 0) dengan animasi tak berujung pada path SVG, yang tidak dikomposit. Animasi kini hanya berjalan saat chip sibuk. Beranda menjadi lebih cepat dari baseline (median 93 vs 86 pada run berselang-seling) |
| Kapsul header ringkas terlalu sempit di ponsel (kontrol 44 px menempel tepi kapsul) | Screenshot 390 px | Kapsul mengambang hanya mulai 768 px; di bawahnya permukaan penuh dan logo mengecil |
| Halaman pratinjau memakai label "Konsep demonstrasi, bukan proyek klien" | Screenshot | Label sendiri: "Placeholder tata letak, bukan testimoni" |
| Nama aksesibel peluncur tidak memuat teks yang terlihat (WCAG 2.5.3) | Review kode | Nama berasal dari label yang terlihat ("Tanya Solveit" / "Tutup"); kedua label berbagi satu sel grid agar lebar kapsul tetap |
| Dua landmark `region` dengan nama sama di seksi testimoni | e2e | Carousel menjadi `role="group"` dengan `aria-roledescription` |
| Pertanyaan "berapa biaya bikin website" dijawab dengan topik Layanan | Unit test | Kata kunci FAQ berbobot 2,5 kali kata kunci topik |

### Keputusan: overlay pemuatan layar penuh

Ditolak. Setiap halaman di-prerender dan terlukis sebelum JavaScript dimuat (bootstrap setelah FCP), LCP adalah judul halaman, dan sebagian besar navigasi klien selesai di bawah 150 ms. Overlay penuh hanya akan menutupi konten yang sudah siap atau menambah jeda buatan. Penggantinya diskalakan ke lama tunggu sebenarnya: tidak ada apa pun di bawah 150 ms, runner tak-tentu setelah 150 ms, chip bermerek "empat kapsul merakit diri" dengan pengumuman screen reader setelah 900 ms, dan chip "Memuat asisten" untuk chunk asisten. Tidak ada persentase.

### Keputusan: Lenis

Prototipe Lenis 1.3.11 (`autoRaf`, CSS resmi) disuntikkan ke build produksi yang sama dan dibandingkan dengan scroll native di Chromium desktop 1440 px, dua run per mode, setelah perbaikan pemulihan scroll di atas.

| Ukuran | Native | Lenis |
|---|---|---|
| Waktu main thread selama 24 langkah roda | 857 sampai 922 ms | 1008 sampai 1081 ms (sekitar +18 persen) |
| Frame di atas 25 ms dalam rentang yang sama | 65 | 119 sampai 123 |
| Scroll yang masih bergerak 150 ms setelah input berhenti | 0 px | 57 sampai 94 px |
| Main thread saat diam (3 s) | 211 sampai 222 ms | 217 sampai 226 ms |
| Pan portofolio ter-pin, tombol End, pemulihan saat Back | Bekerja | Bekerja |
| Roda di atas log asisten | Log bergulir 400 px, halaman diam | Log diam, **halaman bergulir 400 px** (butuh `data-lenis-prevent` di setiap area gulir) |

Keputusan: tetap native. Lenis menambah biaya main thread dan inersia tanpa manfaat bagi pengguna sentuh (mayoritas audiens di ponsel; Lenis tidak menghaluskan sentuhan secara default), membajak scroll bersarang, dan menimpa pengaturan scroll sistem pengunjung. Instalasi hanya dilakukan di folder sementara, bukan di proyek.

### Lighthouse

Metode sama dengan putaran 2: Lighthouse 13.5, mobile default (Moto G Power teremulasi, slow 4G, CPU 4x) dan `--preset=desktop`, **median 3 run per halaman**, build produksi tanpa `VITE_SITE_URL` di kedua sisi, server `scripts/serve.mjs` yang sama, mesin yang sama. "Sebelum" diukur ulang hari ini dari `main` (`d2b9956`); angkanya lebih rendah dari laporan putaran 2 karena TBT di mesin ini lebih tinggi hari ini, jadi pembanding yang adil adalah kolom "sebelum" di bawah, bukan putaran 2.

| Halaman | Mobile Perf sebelum | Mobile Perf sesudah | LCP sebelum / sesudah | TBT sebelum / sesudah | Desktop Perf sesudah | CLS |
|---|---|---|---|---|---|---|
| `/` | 89 | **95** | 1,62 / 1,45 s | 367 / 222 ms | 100 | 0 |
| `/portofolio` | 99 | 98 | 1,63 / 1,59 s | 87 / 139 ms | 100 | 0 |
| `/portofolio/sistem-antrean-klinik` | 99 | 98 | 1,62 / 1,58 s | 84 / 160 ms | 100 | 0 |
| `/kontak` | 100 | 99 | 1,47 / 1,45 s | 48 / 69 ms | 100 | 0 |
| `/en` | 86 | 90 | 1,64 / 1,60 s | 408 / 359 ms | 100 | 0 |

Accessibility, Best Practices, dan SEO 100 di semua halaman, kedua preset. Beranda juga diukur dengan 5 run berselang-seling sebelum/sesudah: median 86 vs 93, TBT 419 vs 271 ms. Selisih 1 poin pada Portofolio, studi kasus, dan Kontak berada di dalam sebaran run (misalnya studi kasus 98/98/94 sesudah, 99/89/99 sebelum). `/en` (90) tetap di bawah target 95 dengan sebaran besar (84 sampai 95); TBT-nya berasal dari hydration yang sudah ada di baseline, bukan dari fitur baru.

### Ukuran bundle

| | Sebelum | Sesudah |
|---|---|---|
| Seluruh JS (gzip, termasuk chunk lazy) | 226,8 KB | 241,6 KB |
| Di antaranya chunk asisten (lazy, hanya saat ada niat) | - | 6,6 KB |
| CSS (gzip) | 10,9 KB | 13,8 KB |

### Review visual

Satu putaran screenshot berbatch (desktop 1440 dan Pixel 7, terang dan gelap): hero, header ringkas, seksi cerita klien, asisten terbuka, jawaban FAQ, fallback, hover kontrol header, halaman pratinjau, bottom sheet ponsel, menu ponsel, dock yang menyingkir dari tombol kirim Kontak, dan chip pemuatan dengan chunk yang ditahan. Temuan di tabel di atas diperbaiki, lalu dikonfirmasi dengan satu putaran ulang.

### Keterbatasan

- Belum ada testimoni klien yang diizinkan; beranda menampilkan janji tertulis. Komponen kutipan hanya terlihat di `/pratinjau/testimoni` dengan placeholder.
- Asisten adalah panduan berbasis aturan dengan kosakata terbatas; pertanyaan di luar kosakata dialihkan ke tim. Integrasi AI menunggu backend Laravel.
- Lighthouse dan evaluasi Lenis adalah emulasi di mesin pengembang; angka lapangan (CrUX, INP) baru tersedia setelah domain aktif. Firefox dan WebKit diuji lewat build Playwright, bukan Safari iOS fisik; pembaca layar nyata belum diuji manual.
- View Transition tema membutuhkan dukungan browser (Chromium, Safari 18, Firefox 144 ke atas); browser lain berganti tema secara instan.

## Putaran 2 (2026-10-13): tema, dua bahasa, navigasi, kontak, parallax, performa

### Pemeriksaan otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run format:check` | Lulus |
| `npm run lint` (ESLint 9, typescript-eslint, react-hooks, jsx-a11y) | Lulus, 0 masalah |
| `npm run typecheck` (TS 6, strict) | Lulus |
| `npm test` (Vitest) | 39/39 lulus: kelengkapan dan kesetaraan konten dua bahasa, larangan em dash di semua teks, peta route dan pasangan slug, hreflang dan canonical (dengan domain tiruan), inquiry per bahasa dan nomor tujuan, perilaku formulir |
| `npm run build` | Lulus; 22 halaman terindeks (11 per bahasa) + 2 halaman 404 di-prerender |
| `npm run test:e2e` (Chromium: desktop 1440, tablet 820, Pixel 7) | Lulus; dijalankan ulang bersama mesin lain di bawah |
| `PW_ALL_BROWSERS=1 npm run test:e2e` (Chromium x3, Firefox, WebKit desktop, WebKit iPhone 14) | **466 lulus, 0 gagal**, 44 dilewati sesuai desain (tes khusus viewport) |
| axe-core WCAG 2.0/2.1/2.2 A dan AA | 0 pelanggaran di 14 halaman x 2 tema x 6 proyek browser |
| Detektor Impeccable (`impeccable detect`, CLI) | 0 temuan |

Cakupan e2e baru: tema terang default walau OS gelap, tema gelap dipulihkan sebelum paint (dicek saat `DOMContentLoaded`) dan bertahan setelah reload dan navigasi, tanpa error hydration; pergantian bahasa pada setiap jenis halaman (termasuk studi kasus, slug ke slug) dengan back/forward; preferensi bahasa hanya mengalihkan `/` bagi pengunjung yang pernah memilih Inggris, tidak pernah untuk konteks baru (crawler); 404 Inggris; `lang`, canonical, hreflang dua arah, dan `x-default` di 14 halaman; tautan halaman Inggris tetap di `/en`; urutan navigasi, indikator aktif (termasuk halaman bertingkat, hover, refresh), penanda menu seluler; menu WhatsApp (tiga nomor, `target`/`rel` aman, keyboard, Escape, klik di luar); Instagram di footer dan Kontak; parallax bergerak dan tetap bekerja setelah navigasi; mark Tentang terakit tepat di tengah; teks yang diketik sebelum hydration tetap terkirim dan tidak pernah masuk URL.

### Temuan yang diperbaiki selama QA

| Temuan | Sumber | Perbaikan |
|---|---|---|
| Overflow horizontal 0,67 px saat skala tampilan 150% (pin-spacer ScrollTrigger dibulatkan) | Inspeksi browser | `body { overflow-x: clip }` (tidak membuat scroll container, sticky tetap bekerja) |
| Error hydration saat stylesheet dipindah di `<head>` | Konsol produksi | Pendekatan dibatalkan; urutan `<head>` dibiarkan seperti dirender React |
| Formulir bisa dikirim secara native sebelum hydration, nama dan kontak masuk ke URL | Firefox/WebKit e2e | Tombol kirim nonaktif sampai hydration; `<noscript>` tetap menjelaskan kanal langsung |
| Teks yang diketik sebelum hydration hilang dari state React | Firefox/WebKit e2e | Formulir mengadopsi nilai DOM saat hydration (diuji dengan bundle yang ditahan) |
| Kapsul kontak aktif di tema gelap di bawah 4,5:1 (`#2a66ff`) | axe di Firefox | Logo Deep Cobalt di kedua tema |
| Chevron select berulang | Screenshot | Selektor `.field-input.field-select` |
| Peringatan GSAP target tidak ditemukan di Kontak | Konsol | Animasi mark footer hanya saat band CTA ada |

### Review desain

- **Impeccable critique** (mode tunggal, lihat `.impeccable/critique/`): 30/36 (83%, Good; heuristik 7 n/a untuk permukaan Persuade). Perbaikan yang langsung diterapkan: pemilih bahasa ringkas di header ponsel, bayangan panel Proses yang membuat porselen keruh (0,16 ke 0,07), dua temuan aksesibilitas dan formulir di atas. Overlay browser: `first-viewport-column-overflow` di Kontak (diterima: kolom kanan sticky), `shape-assembled-illustration` pada sampul generatif (diterima: sistem visual merek, berlabel konsep), satu sampel kontras rendah saat fade masuk (positif palsu, tidak terjadi saat diam).
- **Taste skill pre-flight**: nol em dash, satu aksen, satu sistem radius, navigasi satu baris, tanpa eyebrow selain "Error 404", tanpa listener scroll manual. Lede hero Inggris dipangkas ke 19 kata (batas 20).
- Screenshot representatif diperiksa untuk Beranda, Portofolio, studi kasus, Proses, Tentang, Layanan, dan Kontak, di desktop 1440 dan 1024 serta ponsel 390, di tema terang dan gelap, dalam kedua bahasa.

### Lighthouse

Preset: mobile = default Lighthouse 13.5 (Moto G Power teremulasi, simulated slow 4G, CPU 4x); desktop = `--preset=desktop`. **Median dari 3 run per halaman**, build produksi yang sama untuk semua halaman, mesin yang sama. "Sebelum" adalah `main` (commit `bb966f2`) yang diukur ulang dengan metode ini; angka putaran 1 adalah satu kali run.

| Halaman | Mobile Perf sebelum | Mobile Perf sesudah | LCP mobile sebelum | LCP mobile sesudah | FCP mobile sesudah | TBT mobile sesudah | Desktop Perf sebelum / sesudah | CLS |
|---|---|---|---|---|---|---|---|---|
| `/` | 84 | **98** | 3,48 s | **1,58 s** | 0,98 s | 156 ms | 98 / 100 | 0 |
| `/portofolio` | 91 | **99** | 3,00 s | **1,44 s** | 0,99 s | 80 ms | 98 / 100 | 0 |
| `/portofolio/sistem-antrean-klinik` | 89 | **99** | 3,16 s | **1,57 s** | 0,98 s | 121 ms | 98 / 100 | 0 |
| `/kontak` | 92 | **100** | 2,94 s | **1,45 s** | 1,01 s | 62 ms | 99 / 100 | 0 |
| `/en` (baru) | - | 97 | - | 1,58 s | 0,99 s | 174 ms | - / 100 | 0 |
| `/en/contact` (baru) | - | 100 | - | 1,43 s | 0,83 s | 25 ms | - / 100 | 0 |

Accessibility, Best Practices, dan SEO: 100 di semua halaman, kedua preset. LCP desktop 0,41 sampai 0,45 s.

Akar masalah sebelumnya, dari profil: sekitar 20 `modulepreload` JS diunduh dengan prioritas High sebelum stylesheet, sehingga FCP tersimulasi 2,4 sampai 2,9 s; dan judul hero masuk dari `opacity: 0`, sehingga elemen LCP salah (tombol Menu). Perbaikan dan buktinya:

| Langkah | Efek terukur |
|---|---|
| Judul halaman masuk dengan transform saja | Judul menjadi elemen LCP; di Chromium nyata LCP = FCP (144 ms lokal) |
| `fetchpriority="low"` pada modulepreload | FCP turun, tetapi LCP tersimulasi tidak membaik: modul tetap dimulai sebelum paint |
| Memindahkan stylesheet di `<head>` | Dibatalkan: memicu error hydration React 19 |
| Bootstrap disisipkan setelah `requestAnimationFrame` | Beranda 91 dan Kontak 94, tetapi Portofolio dan studi kasus turun (LCP 3,6 s): frame pertama di-raster lambat di mesin uji, sehingga JS masih mulai sebelum paint yang tampil |
| Bootstrap disisipkan setelah entri `first-contentful-paint` (cadangan 3 s) | Hasil akhir di tabel. Tidak ada fitur, tampilan, atau metadata yang dikorbankan; hydration mulai segera setelah konten tampil |

TBT mobile Beranda (156 ms) dan `/en` (174 ms) sedikit di atas baseline 140 ms karena hydration kini jatuh setelah FCP dan dihitung TBT; itu pekerjaan yang sama, dipindah ke belakang paint.

### Ukuran bundle

| | Sebelum | Sesudah |
|---|---|---|
| Seluruh JS (gzip, termasuk GSAP yang dimuat lazily) | 213 KB | 232 KB |
| CSS (gzip) | 9,4 KB | 11,1 KB |

Kenaikan terutama dari konten dua bahasa (teks Inggris ikut terbawa di chunk konten dan kamus, sekitar 9 KB gzip) dan komponen baru. Dengan bootstrap setelah first paint, JS tidak lagi berada di jalur render kritis.

### Keterbatasan

- Lighthouse mengukur emulasi di mesin pengembang; angka lapangan (CrUX, INP) baru tersedia setelah domain aktif.
- Firefox dan WebKit diuji lewat build Playwright, bukan Safari iOS atau Firefox Android fisik; pembaca layar nyata (NVDA, VoiceOver) belum diuji manual.
- Sebelum hydration (setelah first paint, biasanya beberapa milidetik, lebih lama di jaringan lambat) tombol tema, filter portofolio, dan tombol kirim formulir belum aktif. Tautan, pemilih layanan hero, dan menu WhatsApp tetap berfungsi sebagai HTML biasa.
- Konten portofolio tetap konsep demonstrasi sampai ada proyek klien yang boleh dipublikasikan.

## Putaran 1 (2026-10-12): build awal

| Pemeriksaan | Hasil |
|---|---|
| Lint, typecheck, unit (21/21), build (11 halaman + 404) | Lulus |
| e2e Chromium 3 viewport | 91 lulus, 11 dilewati |
| axe 7 halaman x 3 viewport | 0 pelanggaran |

Lighthouse saat itu (satu kali run): mobile Beranda 84 (LCP 3,4 s), Portofolio 91 (2,9 s), studi kasus 93 (2,6 s), Kontak 95 (2,4 s); desktop 99 sampai 100. Pengukuran ulang baseline yang sama dengan median 3 run ada di tabel putaran 2.
