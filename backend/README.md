# Backend: Laravel API website Solveit Indonesia

Laravel 13 REST API milik website company profile Solveit Indonesia. Saat ini berisi fondasi API (B0) dan endpoint inquiry (B1). Solveit OpsHub, portal klien, proposal, kontrak, invoice, dan sistem Solveit lain **tidak** dibangun di sini; mereka punya repository dan database sendiri (`docs/architecture/integration-plan.md`).

| | |
|---|---|
| Framework | Laravel 13 (diuji dengan 13.36.0), PHPUnit 12, Pint |
| PHP | `^8.3` (minimum Laravel 13). Tim memakai 8.5; CI menguji 8.3 dan 8.5 |
| Composer | 2.x |
| Database lokal dan tes | SQLite (`database/database.sqlite` untuk lokal, `:memory:` untuk tes) |
| Database produksi | Belum ditentukan, begitu juga hosting |
| Endpoint | `POST /api/v1/inquiries`, `GET /up`. Kontrak: `docs/api/` |
| Alat AI wajib | [Laravel Boost](https://laravel.com/docs/13.x/boost) (`laravel/boost`, dev dependency) |

`composer.json` mengunci `config.platform.php` ke `8.3.0` agar `composer.lock` tetap dapat dipasang di PHP 8.3 (Symfony 7.4 LTS). Tanpa itu, resolusi di PHP 8.5 memilih Symfony 8 yang butuh PHP 8.4, sehingga batas `^8.3` di `composer.json` menjadi tidak benar.

## Mulai dari clone baru

Butuh PHP 8.3+ dengan ekstensi `mbstring`, `intl`, `bcmath`, `pdo_sqlite`, `sqlite3`, `openssl`, `fileinfo`, dan Composer 2.

```bash
cd backend
composer install
cp .env.example .env            # lalu sesuaikan bila perlu; .env tidak pernah di-commit
php artisan key:generate
touch database/database.sqlite  # PowerShell: New-Item database/database.sqlite
php artisan migrate
php artisan boost:update --no-discover   # membuat skill agent dari boost.json
php artisan test
php artisan serve               # http://localhost:8000
```

`composer run setup` menjalankan langkah instal sampai migrasi sekaligus. `composer run dev` menjalankan server dan queue listener bersamaan.

### Scaffolding Laravel di folder yang sudah berisi

Jangan menjalankan `composer create-project laravel/laravel backend` di folder yang sudah berisi file (folder ini dulu hanya berisi README). Cara yang dipakai dan aman:

1. `composer create-project laravel/laravel:^13.0 <folder-sementara>` di luar repository.
2. Salin isinya ke `backend/` kecuali `README.md`, lalu buang yang tidak dipakai API ini (`package.json`, `vite.config.js`, `resources/css`, `resources/js`, view `welcome`).
3. Aktifkan route API lewat `withRouting(api: ...)` di `bootstrap/app.php`. `php artisan install:api` sengaja tidak dipakai karena selalu memasang Sanctum, sedangkan autentikasi admin belum masuk lingkup. Sanctum dipasang pada fase admin.

## Environment

Semua variabel terdokumentasi di `.env.example`. Yang khusus proyek ini:

| Variabel | Default | Fungsi |
|---|---|---|
| `APP_DEBUG` | `true` di contoh | **Wajib `false` di luar lokal**: mode debug menambahkan stack trace ke respons galat |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Origin browser yang boleh memanggil `/api/*`. Kosong: tidak ada |
| `TRUSTED_PROXIES` | kosong | IP atau CIDR load balancer/CDN; tanpa itu `X-Forwarded-For` diabaikan |
| `INQUIRY_RATE_LIMIT_PER_MINUTE` / `_PER_HOUR` | `5` / `20` | Batas kiriman inquiry per IP |
| `INQUIRY_MAX_BODY_BYTES` | `65536` | Batas body; di atasnya `413` |
| `CACHE_STORE` | `database` | Juga menyimpan penghitung rate limit; tidak butuh Redis |

Nilai dibaca lewat `config/` (`config/cors.php`, `config/trustedproxy.php`, `config/inquiries.php`), tidak pernah lewat `env()` di kode, sehingga `php artisan config:cache` aman.

## Struktur

Struktur bawaan Laravel tanpa folder dasar baru. Yang ditambahkan untuk API ini:

```text
app/
├── Actions/SubmitInquiry.php                    Menyimpan inquiry, membuat nomor referensi, menangani galat database
├── Enums/Inquiry{Service,Budget,Timeline,Status}.php   Nilai yang sama dengan tipe frontend
├── Exceptions/InquiryNotStoredException.php     503 tanpa data pribadi di log
├── Http/Controllers/Api/V1/InquiryController.php
├── Http/Controllers/HealthCheckController.php   GET /up dalam JSON
├── Http/Middleware/LimitRequestBodySize.php     413 di atas batas body
├── Http/Requests/Api/V1/StoreInquiryRequest.php Validasi dan honeypot
├── Http/Resources/InquiryResource.php           { id, status }
├── Models/Inquiry.php
└── Rules/EmailOrPhone.php                       Format kontak yang sama dengan frontend
config/{cors,trustedproxy,inquiries,boost}.php
routes/api.php                                   /api/v1/...
tests/Feature/...                                Endpoint, health check, constraint database
tests/Unit/...                                   Aturan kontak, nomor referensi, kontrak enum dengan frontend
```

## Perintah

| Perintah | Fungsi |
|---|---|
| `php artisan test` | Semua tes (SQLite in-memory dari `phpunit.xml`, tidak menyentuh database lokal) |
| `php artisan test --filter=InquiryControllerTest` | Tes endpoint saja |
| `vendor/bin/pint --test` / `vendor/bin/pint` | Cek / perbaiki gaya kode (`composer run lint` = cek) |
| `composer validate --strict` | Validasi `composer.json` dan lock |
| `composer audit` | Audit keamanan dependensi |
| `php artisan route:list --except-vendor` | Harus menampilkan `POST api/v1/inquiries` |
| `php artisan migrate` / `migrate:status` | Migrasi database lokal |

Jangan menjalankan `migrate:fresh`, `migrate:reset`, `db:wipe`, atau `migrate:rollback` pada database yang bukan milik Anda sendiri. CI menguji rollback pada file SQLite sekali pakai.

## Laravel Boost

Boost wajib untuk pengembangan berbantuan AI di backend ini. Aturan lengkap (lokasi file, apa yang di-commit, MCP dari root repository, verifikasi, pembaruan) ada di `docs/project-structure.md` bagian **Official Laravel Boost & AI Agent Development Standards**. Ringkasnya:

- Dipasang dengan `composer require laravel/boost --dev` (tercatat di `require-dev`, versi 2.10.3 di lock) lalu `php artisan boost:install`.
- Agent yang dikonfigurasi (`boost.json`): Claude Code, Codex, Cursor. Fitur: guideline, skill, MCP. Integrasi Laravel Cloud, Sail, dan Nightwatch tidak dipakai.
- Guideline bersama ada di `AGENTS.md` folder ini (dibuat Boost; `CLAUDE.md` hanya `@AGENTS.md`). Aturan khusus Solveit ada di `.ai/guidelines/solveit.md` dan masuk ke blok guideline saat `boost:update`.
- MCP dari root repository: `php backend/artisan boost:mcp` (root `.mcp.json`, `.codex/config.toml`, `.cursor/mcp.json`). Dari folder ini: `php artisan boost:mcp`.
- Setelah `composer update` atau perubahan `.ai/guidelines/`: `php artisan boost:update --no-discover`, lalu commit perubahan `AGENTS.md`.

## Development dan produksi

- Pengembangan dan CI: `composer install` (dengan dev dependency, termasuk Boost).
- Produksi: `composer install --no-dev --optimize-autoloader`. Boost, PHPUnit, Pint, dan Pail tidak terpasang; aplikasi tetap berjalan (diverifikasi di CI). `config/boost.php` tetap ada tetapi tidak dibaca tanpa paketnya. Tidak ada script Composer yang memanggil perintah Boost, sehingga instalasi `--no-dev` tidak gagal. Boost juga menonaktifkan dirinya di luar environment `local` kecuali `APP_DEBUG=true`.
- Deployment, database produksi, dan domain belum diputuskan. Daftar periksa keamanan saat deployment ada di `docs/api/inquiries.md` (Privasi).

## Keamanan

- Validasi seluruhnya di server (`StoreInquiryRequest`); mass assignment dibatasi `#[Fillable]`; `public_id` dan `status` diisi server.
- Rate limit per IP, honeypot, batas body 64 KB, CORS dengan daftar origin, proxy tepercaya lewat konfigurasi.
- Respons galat tanpa detail internal saat `APP_DEBUG=false`; kegagalan penyimpanan menjadi 503, tidak pernah 201.
- Tidak ada data pribadi di log. Rute penyajian file bawaan disk `local` dimatikan (`config/filesystems.php`).
- Rahasia hanya di `.env`; Git hanya menyimpan `.env.example`.
