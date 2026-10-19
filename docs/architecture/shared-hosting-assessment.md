# Asesmen kelayakan shared hosting

Status (B5a, 2026-10-19): **asesmen konseptual, Owner decision required.** Dokumen ini tidak memilih penyedia, tidak membandingkan harga, dan tidak menyetujui shared hosting. Pemilik menyebut shared hosting sebagai preferensi biaya untuk masa depan; kelayakan teknisnya belum dibuktikan. Yang sudah disiapkan dan divalidasi adalah deployment Docker yang tidak terikat penyedia (`docs/development/docker-production.md`), belum di-deploy.

Ringkasan: **shared hosting biasa kemungkinan besar tidak memenuhi syarat proyek tanpa perubahan arsitektur**, terutama karena MySQL 8.4 Oracle, variabel server `log_bin_trust_function_creators`, dan isolasi listener admin. Shared hosting baru dapat dipertimbangkan bila lolos semua kriteria wajib di bagian 4, dibuktikan dengan uji di akun percobaan (bagian 5).

## 1. Yang dibutuhkan proyek saat ini

| Kebutuhan | Sumber di repository |
|---|---|
| PHP 8.5, minimal 8.5.7 (`composer.json`, `config.platform.php`) | `backend/composer.json` |
| MySQL 8.4 LTS Oracle, bukan MariaDB | `AGENTS.md`, `docs/project-structure.md` 8.1 |
| Trigger database untuk audit log hanya-tambah, catatan dan riwayat status inquiry, serta kolom kiriman inquiry yang terkunci | Migrasi `backend/database/migrations/` (B3.1a, B4a) |
| `log_bin_trust_function_creators = ON` di tingkat server bila binary log aktif (pengguna tanpa SUPER tidak bisa membuat trigger, error 1419) | `backend/README.md`, Trigger audit |
| Pengguna database terpisah: migrator (DDL) dan aplikasi (hanya SELECT, INSERT, UPDATE, DELETE) | `infra/docker/mysql/initdb-production/` |
| Sesi, cache, dan rate limit di tabel database; tanpa Redis, queue worker, atau scheduler | `infra/docker/production.env.example` |
| Perintah CLI: `php artisan migrate --force`, `admin:bootstrap-owner`, `admin:reset-credentials`, `optimize` | `docs/development/docker-production.md` |
| Website statis hasil prerender dan konsol admin statis (SPA) | `frontend/`, `admin/` |
| Admin di origin sendiri (`ADMIN_URL`, https), konsol dan `/api/v1/admin` pada origin yang sama, website publik menolak semua path admin | `docs/architecture/admin-dashboard.md` bagian 10 |
| Header keamanan: CSP tanpa inline script, `frame-ancestors 'none'`, `no-store`, HSTS | `infra/docker/nginx/admin.conf`, `admin-gateway-routes.conf` |
| Backup dan pemulihan yang diuji | `infra/docker/scripts/drill-backup-restore.sh` |

## 2. Evaluasi per kebutuhan

| Area | Shared hosting pada umumnya | Risiko | Yang harus dibuktikan |
|---|---|---|---|
| PHP 8.5.7+ | Banyak panel menyediakan beberapa versi PHP, tetapi versi terbaru sering tertinggal | Sedang | Versi tepat (`php -v` via SSH, bukan hanya di panel), ekstensi yang diminta `composer check-platform-reqs --no-dev`, PHP CLI sama dengan PHP web |
| MySQL 8.4 Oracle | Sering MariaDB, atau MySQL versi lain; jarang 8.4 | **Tinggi (pemblokir)** | `SELECT VERSION()` menunjukkan `8.4.x` tanpa `MariaDB`. MariaDB bukan pengganti: perilaku trigger, JSON, dan kolom generated berbeda dan tidak dites |
| Trigger dan `log_bin_trust_function_creators` | Variabel global server; penyewa shared tidak bisa mengubahnya. Bila binary log mati, trigger mungkin bisa dibuat tanpa variabel itu | **Tinggi (pemblokir)** | `php artisan migrate --force` berhasil membuat semua trigger dengan pengguna migrator; `SHOW TRIGGERS` lengkap |
| Hak akses database | Panel biasanya mengizinkan beberapa pengguna dengan hak per database | Sedang | Pengguna migrator dengan `TRIGGER`, `CREATE`, `ALTER`, `INDEX`, `REFERENCES`; pengguna aplikasi tanpa DDL; aplikasi tidak bisa `TRUNCATE` audit log |
| Document root Laravel | Bisa diarahkan ke `backend/public` lewat panel (addon domain atau subdomain) | Sedang | Hanya `public/` yang dapat diakses web; `.env`, `vendor/`, `storage/` tidak pernah di bawah document root |
| Sesi dan cache database | Didukung | Rendah | Tabel `sessions` dan `cache` terisi; driver sesi tetap `database` (dipaksa di `config/session.php`) |
| CLI dan SSH | Tidak selalu tersedia; kadang hanya terminal terbatas | Tinggi | SSH dengan PHP CLI 8.5.7+ untuk migrasi dan perintah akun owner |
| Cron | Umumnya ada | Rendah | Proyek saat ini tidak butuh scheduler; cron mungkin perlu untuk backup sendiri |
| Website statis | Cocok | Rendah | Clean URL dan 404 per bahasa lewat aturan server (biasanya `.htaccess`) |
| Konsol admin statis | Cocok sebagai file | Sedang | Fallback SPA, `no-store` untuk HTML, cache panjang untuk aset ber-hash, header CSP lengkap lewat `.htaccess` |
| Isolasi host dan origin admin | Tidak ada listener privat atau jaringan Docker; semua lewat web server bersama | **Tinggi** | Subdomain admin dengan document root sendiri yang melayani konsol dan meneruskan `/api/v1/admin` ke Laravel di origin yang sama; website publik menolak `/api/v1/admin`. `AdminRequestBoundary` Laravel tetap memeriksa Host dan Origin sebagai lapis kedua |
| TLS | Umumnya sertifikat otomatis gratis | Rendah | Sertifikat untuk domain dan subdomain admin, pembaruan otomatis, HSTS |
| Akses admin | Tidak bisa loopback, VPN, atau SSH tunnel seperti opsi B3.2d | Tinggi | Pilihan pemilik: admin publik dengan TOTP wajib saja, pembatasan IP (bila ada IP tetap), atau Cloudflare Access di depan domain |
| Alamat IP pengunjung dan rate limit | Di belakang proxy penyedia atau Cloudflare, `REMOTE_ADDR` bisa berupa alamat proxy | Sedang | `TRUSTED_PROXIES` diisi hanya alamat proxy yang benar, supaya rate limit dan audit tidak memakai satu alamat bersama |
| Proteksi API publik | Tergantung web server bersama | Sedang | `POST /api/v1/inquiries` tetap nonaktif sampai keputusan aktivasi; batas ukuran body dan rate limit berjalan |
| Backup | Backup penyedia ada, tetapi frekuensi, retensi, dan pemulihan per database berbeda-beda | Sedang | Backup harian yang bisa dipulihkan per database, salinan di luar server, dan uji pemulihan (prosedur setara `drill-backup-restore.sh`) |
| Monitoring | Terbatas | Sedang | Uptime eksternal ke `/up`, akses log Laravel (`LOG_CHANNEL` file harian karena tidak ada stderr container) |
| Batas sumber daya | Batas CPU, memori, proses per akun | Sedang | Hash kata sandi, TOTP, dan migrasi tidak terhenti oleh batas proses |
| Pemulihan | Bergantung dukungan penyedia | Sedang | Langkah rollback ke rilis sebelumnya tanpa Docker image |

## 3. Perubahan arsitektur bila shared hosting dipilih

Tidak dikerjakan sekarang; daftar ini untuk memperkirakan usaha.

1. **Pengganti nginx dan Docker:** aturan `.htaccess` (atau setara di panel) untuk website (clean URL, 404 per bahasa), konsol admin (fallback SPA, header CSP dan keamanan yang sama dengan `infra/docker/nginx/admin.conf`), dan subdomain admin yang meneruskan hanya `/api/v1/admin/*` ke Laravel. Header CSP tetap berasal dari satu sumber (`admin/security-policy.ts`), jadi perlu skrip build yang menulis `.htaccess`, seperti `write-nginx-headers.mjs` sekarang.
2. **Paket rilis:** build di CI (frontend, admin, `composer install --no-dev`), unggah lewat SFTP/rsync atau Git deploy, lalu `php artisan optimize`. Tanpa image ber-tag, rollback berarti menyimpan rilis sebelumnya di folder terpisah dan mengganti symlink (bila didukung).
3. **Konfigurasi:** `.env` di server (di luar document root, izin ketat) menggantikan Docker secret; `LOG_CHANNEL=daily`; `TRUSTED_PROXIES` sesuai proxy penyedia; `ADMIN_URL` subdomain admin.
4. **Database:** pengguna migrator dan aplikasi dibuat lewat panel; trigger hanya bila syarat bagian 2 lolos. Bila trigger tidak bisa dibuat, jaminan append-only audit log dan kunci kiriman inquiry hilang: ini **bukan** kompromi yang boleh diambil diam-diam dan membutuhkan keputusan pemilik serta desain pengganti.
5. **Akses admin:** keputusan pemilik di antara admin publik dengan TOTP, pembatasan IP, atau Cloudflare Access; masing-masing perlu diuji dengan cookie `__Host-` dan pemeriksaan Origin.
6. **Backup dan uji pemulihan** tanpa skrip Docker.

## 4. Kriteria minimum saat memilih hosting nanti

Wajib (gagal satu, tidak lanjut):

- [ ] MySQL **8.4.x Oracle** (bukan MariaDB), dengan pembuatan trigger oleh pengguna non-SUPER terbukti berhasil.
- [ ] PHP **8.5.7 atau lebih baru** untuk web dan CLI, dengan ekstensi yang diminta `composer check-platform-reqs --no-dev`.
- [ ] SSH dengan PHP CLI untuk migrasi dan perintah akun owner.
- [ ] Document root dapat diarahkan ke `backend/public` dan subdomain admin ke folder sendiri.
- [ ] Header HTTP kustom (CSP, HSTS, `no-store`) dan aturan rewrite dapat diatur per subdomain.
- [ ] TLS untuk domain dan subdomain admin dengan pembaruan otomatis.
- [ ] Backup database harian yang dapat dipulihkan, plus kemampuan membuat dump sendiri untuk salinan di luar server.

Sangat dianjurkan:

- [ ] Server database khusus atau setidaknya jaminan bahwa variabel global yang dibutuhkan tidak berubah tanpa pemberitahuan.
- [ ] Lokasi data dan kontrak yang sesuai kewajiban UU PDP (data inquiry adalah data pribadi).
- [ ] Log akses dan error yang dapat dibaca, dan batas sumber daya yang jelas.

Alternatif yang sudah siap secara teknis (bukan rekomendasi biaya): host yang mendukung Docker, memakai `compose.prod.yaml` yang sudah divalidasi, atau MySQL 8.4 terkelola ditambah host PHP yang memenuhi kriteria di atas.

## 5. Cara membuktikan sebelum membeli atau berpindah

Bila penyedia menawarkan masa percobaan atau garansi uang kembali, uji dengan data sintetis saja:

1. SSH, lalu `php -v`, `php -m`, dan `composer check-platform-reqs --no-dev` di salinan `backend/`.
2. Buat database dan dua pengguna, lalu `php artisan migrate --force` dengan pengguna migrator. Pastikan `SHOW TRIGGERS` memuat semua trigger audit dan inquiry.
3. Jalankan `php artisan test` hanya bila host mengizinkan database uji terpisah; bila tidak, cukup smoke test manual `GET /up`, `admin:bootstrap-owner` dengan alamat `@example.test`, aktivasi, masuk dengan TOTP.
4. Periksa header website dan admin di browser (CSP, HSTS, `no-store`), cookie `__Host-solveit-admin-session`, dan bahwa `/api/v1/admin` di domain website menjawab 404.
5. Uji backup dan pemulihan ke database kedua.
6. Catat hasil di `docs/qa/qa-report.md` dan putuskan bersama pemilik.

Keputusan biaya, penyedia, dan waktu migrasi tetap milik pemilik.
