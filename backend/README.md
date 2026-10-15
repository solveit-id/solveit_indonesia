# Backend: Laravel API website Solveit Indonesia

Laravel 13 REST API milik website company profile Solveit Indonesia. Saat ini berisi fondasi API (B0), endpoint inquiry (B1), dan standardisasi MySQL serta PHP 8.5 (B1.1). Solveit OpsHub, portal klien, proposal, kontrak, invoice, dan sistem Solveit lain **tidak** dibangun di sini; mereka punya repository dan database sendiri (`docs/architecture/integration-plan.md`).

| | |
|---|---|
| Framework | Laravel 13 (diuji dengan 13.36.0), PHPUnit 12, Pint |
| PHP | Seri 8.5, minimum **8.5.7** (`"php": "^8.5.7"`). CI memakai patch 8.5 terbaru dan memastikan minimal 8.5.7 |
| Composer | 2.x |
| Database | **MySQL 8.4 LTS** (Oracle MySQL, bukan MariaDB) untuk pengembangan, tes, dan target produksi. `utf8mb4`, collation `utf8mb4_unicode_ci`, strict mode, InnoDB |
| Hosting | Belum ditentukan |
| Endpoint | `POST /api/v1/inquiries`, `GET /up`. Kontrak: `docs/api/` |
| Alat AI wajib | [Laravel Boost](https://laravel.com/docs/13.x/boost) (`laravel/boost`, dev dependency) untuk Claude Code dan Codex |

`composer.json` mengunci `config.platform.php` ke `8.5.7`, sama dengan versi minimum, agar `composer update` di mesin dengan patch 8.5 yang lebih baru tidak memilih paket yang membutuhkan lebih dari minimum. Pemeriksaan platform Composer (`vendor/composer/platform_check.php`) menolak PHP di bawah 8.5.7 saat runtime. Patch keamanan 8.5 yang lebih baru tetap boleh dan dianjurkan; tidak ada penguncian ke satu patch. Paket Symfony tetap di 7.4 LTS: kompatibel dengan PHP 8.5 dan didukung lebih lama daripada 8.x.

## Mulai dari clone baru

Butuh PHP 8.5.7 atau lebih baru di seri 8.5 dengan ekstensi `pdo_mysql`, `mbstring`, `intl`, `bcmath`, `openssl`, `fileinfo`, Composer 2, dan server MySQL 8.4 dengan dua database (lihat [Database MySQL](#database-mysql)).

```bash
cd backend
composer install
cp .env.example .env            # isi DB_* untuk database pengembangan; .env tidak pernah di-commit
php artisan key:generate
php artisan migrate             # ke database pengembangan solveit_indonesia
php artisan boost:update --no-discover   # membuat skill agent dari boost.json
php artisan test                # ke database tes solveit_indonesia_testing
php artisan serve               # http://localhost:8000
```

`composer run setup` menjalankan langkah instal sampai migrasi sekaligus (database MySQL harus sudah ada). `composer run dev` menjalankan server dan queue listener bersamaan.

### Scaffolding Laravel di folder yang sudah berisi

Jangan menjalankan `composer create-project laravel/laravel backend` di folder yang sudah berisi file (folder ini dulu hanya berisi README). Cara yang dipakai dan aman:

1. `composer create-project laravel/laravel:^13.0 <folder-sementara>` di luar repository.
2. Salin isinya ke `backend/` kecuali `README.md`, lalu buang yang tidak dipakai API ini (`package.json`, `vite.config.js`, `resources/css`, `resources/js`, view `welcome`).
3. Aktifkan route API lewat `withRouting(api: ...)` di `bootstrap/app.php`. `php artisan install:api` sengaja tidak dipakai karena selalu memasang Sanctum, sedangkan autentikasi admin belum masuk lingkup. Sanctum dipasang pada fase admin.

## Database MySQL

Standar proyek: MySQL 8.4 LTS. MariaDB bukan pengganti (versi, perilaku, dan dukungannya berbeda). Server database bawaan XAMPP (MariaDB) tidak dipakai untuk proyek ini dan konfigurasinya tidak diubah.

### Dua database, peran terpisah

| Database | Dipakai oleh | Pengguna dan hak |
|---|---|---|
| `solveit_indonesia` | Pengembangan lokal (`.env`) | Lokal: `solveit_dev` dengan semua hak **hanya** pada database ini. Produksi: pengguna migrasi (DDL) terpisah dari pengguna aplikasi (`SELECT, INSERT, UPDATE, DELETE` saja) |
| `solveit_indonesia_testing` | `php artisan test` (`phpunit.xml`) | `solveit_test` dengan semua hak hanya pada database ini. Tes menghapus dan membuat ulang semua tabel |

Jangan memakai pengguna `root`, database proyek lain, atau database bersama.

### Server lokal

Cara yang disarankan adalah Docker lewat `docker/mysql/compose.yaml`. Hanya untuk pengembangan: produksi tidak memakai Docker. Server database XAMPP dan milik proyek lain tidak diubah.

| | |
|---|---|
| Image | `mysql:8.4.11` (Oracle MySQL 8.4 LTS, dikunci ke patch; bukan `latest`, bukan MariaDB) |
| Container | `solveit-mysql`, proyek Compose `solveit-indonesia` |
| Port | `127.0.0.1:3307` (hanya loopback; 3306 tetap milik MariaDB XAMPP) |
| Data | Volume bernama `solveit-mysql-data` (bukan bind mount Windows) |
| Restart | `unless-stopped`: hidup lagi bersama Docker Desktop, kecuali dihentikan manual |
| Kata sandi | Docker secret dari `docker/mysql/secrets/` (diabaikan Git), tidak lewat variabel environment atau argumen perintah. `root` hanya ada di dalam container |

Sekali, dari `backend/docker/mysql/` di Git Bash:

```bash
mkdir -p secrets
for name in mysql_root_password solveit_dev_password solveit_test_password; do
  [ -e "secrets/$name" ] || php -r 'echo bin2hex(random_bytes(24));' > "secrets/$name"
done
docker compose up -d
docker compose ps     # tunggu sampai (healthy)
```

Pada start pertama (volume masih kosong) `initdb/10-solveit-databases.sh` membuat kedua database dan kedua pengguna dengan grant yang sama seperti SQL di bawah. Lalu isi `backend/.env`: `DB_CONNECTION=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT=3307`, `DB_DATABASE=solveit_indonesia`, `DB_USERNAME=solveit_dev`, dan `DB_PASSWORD` dengan isi `docker/mysql/secrets/solveit_dev_password`. Buat `.env.testing` seperti di [Kredensial tes](#kredensial-tes), lalu `php artisan migrate` dan `php artisan test`.

Perintah harian, dari `backend/docker/mysql/`:

| Tugas | Perintah |
|---|---|
| Menyalakan | `docker compose up -d` |
| Menghentikan hanya container ini (data tetap) | `docker compose stop` |
| Restart | `docker compose restart` |
| Status dan health | `docker compose ps` |
| Log server | `docker compose logs --tail=50 mysql` |
| Versi server yang sebenarnya | `php artisan db:show` dari `backend/` (baris `MySQL 8.4.x`) |
| Konsol SQL sebagai root | `docker exec -it solveit-mysql bash -c 'mysql --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(cat /run/secrets/mysql_root_password)")'` |
| Menjalankan ulang provisioning (aman; menyamakan kata sandi kedua pengguna dengan secret) | `docker exec solveit-mysql bash -c 'bash /docker-entrypoint-initdb.d/10-solveit-databases.sh'` (dalam `bash -c` agar Git Bash tidak mengubah path) |
| Backup database pengembangan, ke luar repository | `docker exec solveit-mysql bash -c 'mysqldump --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(cat /run/secrets/mysql_root_password)") --single-transaction --databases solveit_indonesia' > ~/solveit-backup-$(date +%Y%m%d).sql` |
| Memulihkan backup | `docker exec -i solveit-mysql bash -c 'mysql --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(cat /run/secrets/mysql_root_password)")' < ~/solveit-backup-<tanggal>.sql` |

Backup berisi data inquiry (data pribadi): simpan di luar repository dan jangan dibagikan. `docker compose down` menghapus container dan jaringannya tetapi **tidak** volume; data hanya hilang dengan `docker compose down -v` atau `docker volume rm solveit-mysql-data`, jadi jangan menjalankan keduanya kecuali memang ingin mengosongkan database lokal.

Masalah umum:

- **Port 3307 dipakai proses lain** (`netstat -ano | findstr :3307` di PowerShell): ganti port host di `compose.yaml` (misalnya `127.0.0.1:3308:3306`) serta `DB_PORT` di `.env` dan `.env.testing`. Jangan menghentikan layanan milik proyek lain.
- **`mysql --version` menampilkan MariaDB**: `mysql` di PATH adalah klien bawaan XAMPP (`C:\xampp\mysql\bin`). Perintah itu hanya menyebut versi klien, bukan server yang dipakai Laravel. Server diperiksa lewat koneksi sungguhan: `php artisan db:show`, atau `SELECT VERSION(), @@version_comment` (hasilnya `8.4.x` dan `MySQL Community Server - GPL`). Pakai konsol di dalam container di atas, bukan klien MariaDB.
- **Unhealthy saat start pertama**: `docker compose logs mysql`. Script provisioning menolak secret yang kosong atau kurang dari 32 huruf/angka.

Tanpa Docker: **MySQL Community Server 8.4 LTS** dari dev.mysql.com, di port selain 3306 bila XAMPP berjalan. Buat database dan pengguna sekali sebagai root (kata sandi milik Anda, tidak pernah di-commit):

```sql
CREATE DATABASE solveit_indonesia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE solveit_indonesia_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'solveit_dev'@'%' IDENTIFIED BY '<kata-sandi-dev>';
GRANT ALL PRIVILEGES ON `solveit\_indonesia`.* TO 'solveit_dev'@'%';
CREATE USER 'solveit_test'@'%' IDENTIFIED BY '<kata-sandi-tes>';
GRANT ALL PRIVILEGES ON `solveit\_indonesia\_testing`.* TO 'solveit_test'@'%';
```

Garis bawah di-escape (`\_`) karena pada grant tingkat database MySQL memperlakukan `_` sebagai wildcard; tanpa escape, grant juga berlaku untuk nama database lain yang mirip, dan suite tes menolak pengguna seperti itu. Pada server non-Docker, ganti `'%'` dengan `'localhost'`.

### Kredensial tes

`phpunit.xml` mengunci `APP_ENV=testing`, driver `mysql`, dan nama database `solveit_indonesia_testing` di `$_SERVER` dan `$_ENV` (Laravel membaca `$_SERVER` lebih dulu), jadi variabel shell tidak dapat memindahkan tes. Host, port, pengguna, dan kata sandi dibaca dari `backend/.env.testing` (diabaikan Git) atau dari environment. Buat `.env.testing` berisi `APP_KEY`, `DB_HOST`, `DB_PORT`, `DB_USERNAME=solveit_test`, dan `DB_PASSWORD`. `.env.testing` wajib ada: tanpa file itu Laravel memakai `.env`, dan pengguna pengembangan akan ditolak pengaman. Dengan container Docker di atas, dari `backend/` (tidak ada nilai yang tampil di layar):

```bash
[ -e .env.testing ] || cat > .env.testing <<EOF
APP_ENV=testing
APP_KEY=$(php -r 'echo "base64:".base64_encode(random_bytes(32));')
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=solveit_indonesia_testing
DB_USERNAME=solveit_test
DB_PASSWORD=$(cat docker/mysql/secrets/solveit_test_password)
EOF
```

Pengaman (`tests/Support/TestDatabaseGuard.php`, dipanggil dari `tests/TestCase.php` sebelum `RefreshDatabase` menghapus tabel; sekali per proses) memverifikasi identitas yang eksplisit:

1. `APP_ENV` adalah `testing`.
2. Koneksi `mysql` dengan driver `mysql`, nama database persis `solveit_indonesia_testing`, tanpa `DB_URL`.
3. Server benar-benar memilih database itu (`SELECT DATABASE()`).
4. `SHOW GRANTS FOR CURRENT_USER()` hanya berisi `USAGE` global dan hak pada `` `solveit\_indonesia\_testing`.* ``. Pengguna `root`, pengguna dengan hak global, hak pada database lain, grant wildcard, role, atau proxy ditolak.

Diverifikasi terhadap MySQL 8.4: pengguna dengan `ALL ON *.*`, pengguna dengan grant tanpa escape, dan `root` ditolak sebelum ada tabel yang dihapus; `DB_DATABASE`, `APP_ENV`, `DB_URL`, dan `DB_CONNECTION` dari shell diabaikan; database pengembangan tidak tersentuh.

### Strategi tes

- `RefreshDatabase`: migrasi sekali per proses, lalu setiap tes berjalan dalam transaksi yang di-rollback.
- Jangan menjalankan DDL (`Schema::drop`, `ALTER`) di dalam tes. MySQL melakukan commit implisit untuk DDL, sehingga transaksi tes terputus dan Laravel terpaksa menjalankan `migrate:fresh` lagi pada tes berikutnya. Kegagalan penyimpanan disimulasikan dengan membuat MySQL sendiri menolak baris (nilai melebihi panjang kolom, SQLSTATE 22001 karena strict mode).
- Tabrakan nomor referensi diuji terhadap indeks `UNIQUE` sungguhan (galat 1062), termasuk percobaan ulang dan batas tiga percobaan (`tests/Feature/Actions/SubmitInquiryTest.php`).
- `tests/Feature/Database/MySqlDatabaseTest.php` memastikan server adalah MySQL 8.4 atau lebih baru (bukan MariaDB), strict mode, `utf8mb4`, InnoDB, dan penghitung rate limit di cache store `database`.

## Environment

Semua variabel terdokumentasi di `.env.example`. Yang khusus proyek ini:

| Variabel | Default | Fungsi |
|---|---|---|
| `APP_DEBUG` | `true` di contoh | **Wajib `false` di luar lokal**: mode debug menambahkan stack trace ke respons galat |
| `DB_*` | `mysql`, `127.0.0.1:3307`, `solveit_indonesia`, `solveit_dev` | Database pengembangan; port 3307 milik container Docker di atas (server lain: portnya sendiri). Tes memakai database terpisah (di atas) |
| `MYSQL_ATTR_SSL_CA` | kosong | Sertifikat CA bila server MySQL produksi mewajibkan TLS |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:4173,http://localhost:4174` | Origin browser yang boleh memanggil `/api/*`: server Vite, preview statis, dan build frontend dengan kanal API aktif (port 4174). Kosong: tidak ada |
| `TRUSTED_PROXIES` | kosong | IP atau CIDR load balancer/CDN; tanpa itu `X-Forwarded-For` diabaikan |
| `INQUIRY_RATE_LIMIT_PER_MINUTE` / `_PER_HOUR` | `5` / `20` | Batas kiriman inquiry per IP |
| `INQUIRY_MAX_BODY_BYTES` | `65536` | Batas body; di atasnya `413` |
| `CACHE_STORE` | `database` | Juga menyimpan penghitung rate limit; tidak butuh Redis |

Nilai dibaca lewat `config/` (`config/database.php`, `config/cors.php`, `config/trustedproxy.php`, `config/inquiries.php`), tidak pernah lewat `env()` di kode, sehingga `php artisan config:cache` aman.

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
docker/mysql/                                    MySQL 8.4 lokal (compose.yaml, initdb/); secrets/ diabaikan Git. Bukan untuk produksi
routes/api.php                                   /api/v1/...
tests/TestCase.php, tests/Support/               Pengaman database tes (TestDatabaseGuard)
tests/Feature/...                                Endpoint, action, health check, konfigurasi MySQL
tests/Unit/...                                   Aturan kontak, nomor referensi, kontrak enum dengan frontend
```

## Perintah

| Perintah | Fungsi |
|---|---|
| `php artisan test` | Semua tes, hanya pada database MySQL `solveit_indonesia_testing` sebagai pengguna yang haknya terbatas pada database itu (tidak menyentuh database pengembangan) |
| `php artisan test --filter=InquiryControllerTest` | Tes endpoint saja |
| `vendor/bin/pint --test` / `vendor/bin/pint` | Cek / perbaiki gaya kode (`composer run lint` = cek) |
| `composer validate --strict` | Validasi `composer.json` dan lock |
| `composer check-platform-reqs` | PHP dan ekstensi memenuhi lock |
| `composer audit` | Audit keamanan dependensi |
| `php artisan route:list --except-vendor` | Harus menampilkan `POST api/v1/inquiries` |
| `php artisan migrate` / `migrate:status` | Migrasi database pengembangan |

Jangan menjalankan `migrate:fresh`, `migrate:reset`, `db:wipe`, `migrate:rollback`, atau `DROP` selain pada database sekali pakai yang memang dibuat untuk itu. CI menguji rollback pada database MySQL sekali pakai di service container.

## Laravel Boost

Boost wajib untuk pengembangan berbantuan AI di backend ini. Aturan lengkap (lokasi file, apa yang di-commit, MCP dari root repository, verifikasi, pembaruan) ada di `docs/project-structure.md` bagian **Official Laravel Boost & AI Agent Development Standards**. Ringkasnya:

- Dipasang dengan `composer require laravel/boost --dev` (tercatat di `require-dev`, versi 2.10.3 di lock) lalu `php artisan boost:install`.
- Agent yang dikonfigurasi (`boost.json`): Claude Code dan Codex, satu-satunya agent yang dipakai tim. Fitur: guideline, skill, MCP. Integrasi Laravel Cloud, Sail, dan Nightwatch tidak dipakai.
- Guideline bersama ada di `AGENTS.md` folder ini (dibuat Boost; `CLAUDE.md` hanya `@AGENTS.md`). Aturan khusus Solveit ada di `.ai/guidelines/solveit.md` dan masuk ke blok guideline saat `boost:update`.
- MCP dari root repository: `php backend/artisan boost:mcp` (root `.mcp.json` untuk Claude Code, root `.codex/config.toml` untuk Codex). Dari folder ini: `php artisan boost:mcp` (`.mcp.json` dan `.codex/config.toml` di folder ini dibuat `boost:install --mcp`, tidak di-commit). Codex untuk pekerjaan backend dimulai di folder ini agar `AGENTS.md` dan skill Boost terbaca.
- Setelah `composer update` atau perubahan `.ai/guidelines/`: `php artisan boost:update --no-discover`, lalu commit perubahan `AGENTS.md`.

## Development dan produksi

- Pengembangan dan CI: `composer install` (dengan dev dependency, termasuk Boost).
- Produksi: `composer install --no-dev --optimize-autoloader`. Boost, PHPUnit, Pint, dan Pail tidak terpasang; aplikasi tetap berjalan (diverifikasi di CI). `config/boost.php` tetap ada tetapi tidak dibaca tanpa paketnya. Tidak ada script Composer yang memanggil perintah Boost, sehingga instalasi `--no-dev` tidak gagal. Boost juga menonaktifkan dirinya di luar environment `local` kecuali `APP_DEBUG=true`.
- Hosting dan domain belum diputuskan; database produksi adalah MySQL 8.4. Document root web server wajib `backend/public/`, tidak pernah `backend/`: di luar `public/` ada `.env`, `storage/logs`, `vendor/`, dan kode sumber. Bila hosting tidak dapat mengarahkan document root ke `public/`, jangan menyalin seluruh aplikasi ke `public_html`; pilih hosting lain atau minta keputusan pemilik. Daftar periksa keamanan saat deployment ada di `docs/api/inquiries.md` (Privasi).

## Keamanan

- Validasi seluruhnya di server (`StoreInquiryRequest`); mass assignment dibatasi `#[Fillable]`; `public_id` dan `status` diisi server.
- Rate limit per IP, honeypot, batas body 64 KB, CORS dengan daftar origin, proxy tepercaya lewat konfigurasi.
- Respons galat tanpa detail internal saat `APP_DEBUG=false`; kegagalan penyimpanan menjadi 503, tidak pernah 201.
- Tidak ada data pribadi di log. Rute penyajian file bawaan disk `local` dimatikan (`config/filesystems.php`).
- Database: pengguna aplikasi produksi tanpa hak DDL, migrasi dengan pengguna terpisah. Diuji di CI: pengguna dengan `SELECT, INSERT, UPDATE, DELETE` saja menyimpan inquiry lewat HTTP.
- Rahasia hanya di `.env` dan `.env.testing`; Git hanya menyimpan `.env.example`. Kunci, dump SQL, dan file database diabaikan `.gitignore` root.
