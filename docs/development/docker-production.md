# Deployment Produksi dengan Docker

Status: **konfigurasi produksi Docker disiapkan dan divalidasi (lokal dan CI), belum di-deploy secara publik.** Belum ada hosting, domain, sertifikat TLS, atau database produksi. Sejak B3.2d juga listener admin privat (image konsol produksi dan `admin-gateway`, profil `admin`), divalidasi dengan sertifikat uji sekali pakai, **belum di-deploy**: tidak ada hostname admin, sertifikat untuk domain nyata, atau akun admin (bagian Admin privat). Docker adalah **salah satu opsi** deployment untuk VPS atau platform container yang mendukung Docker Compose; hosting statis biasa untuk frontend (`development-guide.md` bagian Deployment) dan hosting PHP biasa untuk backend tetap mungkin. Pemilihan hosting adalah keputusan pemilik.

Aturan penempatan file: `docs/project-structure.md` bagian 11. Pengembangan dengan Docker: `docker-development.md`.

## Arsitektur

```text
                 (TLS di depan gateway: reverse proxy host atau load balancer, belum ada)
                                   |
                     host: ${SOLVEIT_HTTP_BIND}:${SOLVEIT_HTTP_PORT} (default 127.0.0.1:8080)
                                   |
  jaringan edge     +--------------v--------------+
                    | gateway (nginx unprivileged)|
                    +------+---------------+------+
  jaringan internal        | /api/*, /up   | lainnya
  (tanpa internet)  FastCGI|               |HTTP
                    +------v------+  +-----v-------+
                    | backend     |  | frontend    |
                    | PHP-FPM 8.5 |  | nginx statis|
                    +------+------+  +-------------+
                           | 3306
                    +------v------+
                    | mysql 8.4   |  (profil bundled-db, atau MySQL terkelola di luar)
                    +-------------+
```

| Service | Image | Isi dan pengamanan |
|---|---|---|
| `gateway` | `nginxinc/nginx-unprivileged:1.30.6-alpine` + `infra/docker/nginx/gateway.conf` (read-only mount) | Satu-satunya port yang dipublikasikan, default hanya loopback. `/api/*` dan `/up` ke PHP-FPM lewat FastCGI dengan `SCRIPT_FILENAME` tetap `public/index.php`; selain itu ke `frontend`. Batas body 128 KB, `server_tokens off`, non-root, filesystem read-only, tanpa capability |
| `frontend` | `infra/docker/frontend/Dockerfile` target `prod` | Multi-stage: `npm ci` dan `npm run build` (prerender statis) di Node 22, runtime hanya `build/client` di nginx unprivileged. Clean URL, `404.html` dan `en/404.html` dengan status 404, cache `immutable` untuk `/assets/`, `no-cache` untuk HTML, gzip, header keamanan. Tanpa Node, sumber, atau dev dependency |
| `backend` | `infra/docker/backend/Dockerfile` target `prod` | PHP 8.5.11 FPM, `bcmath`, `intl`, `pdo_mysql`, OPcache (`validate_timestamps=0`), `php.ini-production` + `infra/docker/backend/php/production.ini`. `composer install --no-dev` (tanpa Boost, PHPUnit, Pint, Pail; diperiksa saat build). Berjalan sebagai `www-data`, kode milik root dan read-only, hanya `storage/` dan `bootstrap/cache/` yang dapat ditulis (tmpfs). Tidak dipublikasikan |
| `migrate` | Image backend yang sama, profil `ops` | Sekali jalan: `php artisan migrate --force` sebagai pengguna migrasi. Tidak pernah otomatis |
| `mysql` | `mysql:8.4.11`, profil `bundled-db` | Opsional, untuk VPS tunggal. Volume `mysql-data` proyek ini, tanpa port. `infra/docker/mysql/initdb-production/` membuat `solveit_indonesia`, `solveit_migrator` (semua hak hanya di database itu) dan `solveit_app` (`SELECT, INSERT, UPDATE, DELETE` saja) |

| `admin` | `infra/docker/admin/Dockerfile` target `prod`, profil `admin` (B3.2d) | Multi-stage: `npm ci`, `vite build`, pemeriksaan build (`check-build.mjs`), dan header nginx yang dibuat dari `admin/security-policy.ts`; runtime hanya `dist/` di nginx unprivileged (`infra/docker/nginx/admin.conf`): fallback SPA ke `index.html`, aset hashed `private, max-age=31536000, immutable`, selain itu `no-store`, hanya `GET`/`HEAD`. Tanpa Node, sumber, source map, atau halaman referensi |
| `admin-gateway` | `nginxinc/nginx-unprivileged:1.30.6-alpine` + template `nginx/admin-gateway*.conf.template`, `nginx/admin-gateway-routes.conf`, `nginx/admin-origin.envsh` (read-only mount), profil `admin` (B3.2d) | Listener admin privat, loopback secara default. Hanya host dari `ADMIN_URL` (lainnya `421`): `/api/v1/admin/*` ke PHP-FPM lewat FastCGI, path Laravel lain `404`, selain itu ke `admin`. TLS opsional di listener sendiri (`compose.prod.admin-tls.yaml`). Non-root, read-only, tanpa capability |

Semua service: `restart: unless-stopped` (kecuali `migrate`), `no-new-privileges`, log `json-file` dengan rotasi (10 MB x 5), dan batas CPU dan memori (`deploy.resources.limits`). Jaringan `internal` bertanda `internal: true` (tanpa rute keluar); hanya `gateway` juga ada di jaringan `edge` yang punya port. Service admin punya jaringan sendiri (`admin-edge`, `admin-internal`); hanya `backend` ada di `internal` dan `admin-internal` sekaligus.

### Health check

| Pemeriksaan | Membuktikan | Tidak membuktikan |
|---|---|---|
| `GET /up` lewat gateway | Gateway, PHP-FPM, dan Laravel boot (ketersediaan aplikasi) | Database. `/up` tidak membuka koneksi database |
| Health check container `backend` (`cgi-fcgi` ke `/fpm-ping`) | Proses PHP-FPM menjawab | Laravel dan database |
| Health check container `frontend` dan `gateway` (port 8081 di loopback container, tidak pernah dipublikasikan) | nginx berjalan | Isi situs |
| Health check `mysql` (`mysqladmin ping`) | Server database menerima koneksi | Skema |
| `docker compose ... run --rm migrate` lalu `... exec backend php artisan migrate:status` | Kesiapan database: koneksi sebagai pengguna aplikasi dan skema terkini | |

`/up` sengaja tidak memeriksa database, agar gangguan database tidak membuat orkestrator me-restart PHP berulang kali. Kesiapan database diperiksa saat deployment (bagian Deployment pertama). Inquiry saat database mati tetap mendapat `503` tanpa nomor referensi.

### Frontend dan API

- Default **satu origin**: gateway menyajikan situs dan `/api`, sehingga browser tidak butuh CORS (`CORS_ALLOWED_ORIGINS` kosong).
- **Origin terpisah** (misalnya `api.<domain>`): jalankan gateway kedua atau server block lain untuk API, isi `CORS_ALLOWED_ORIGINS` dengan origin website yang persis (tanpa `*`), dan bangun frontend dengan `SOLVEIT_API_BASE_URL=https://api.<domain>`.
- `VITE_*` adalah konfigurasi publik saat build, bukan rahasia. `compose.prod.yaml` mengunci `VITE_INQUIRY_API_ENABLED: "false"`: build Docker tidak dapat mengaktifkan kanal **Kirim melalui website** secara tidak sengaja. Mengubahnya butuh persetujuan pemilik (privasi, retensi, hosting, database, penanganan inquiry). B2.2 (idempotensi di frontend) sudah selesai, jadi syarat teknis dari sisi klien terpenuhi.
- **API admin (B3.1a) tidak disajikan di listener publik.** `gateway.conf` menjawab setiap path `/api/v1/admin...` dengan `404` JSON di dalam blok `/api/` (tanpa membedakan huruf besar kecil, setelah nginx mendekode `%XX`, menggabung garis miring, dan menyelesaikan segmen titik); Laravel sendiri menolak host selain `ADMIN_URL` dengan `404`. `verify-production.sh` menguji 26 ejaan path, termasuk route owner B3.1b (`users`, `invitations`, `audit-events`, `users/1/credential-reset`). Konsol dan API-nya hanya ada di listener admin terpisah (`admin-gateway`, B3.2d, bagian Admin privat); `gateway.conf` tidak berubah dan tidak tahu konsol sama sekali.
- **Sesi hanya untuk admin.** `SESSION_DRIVER=database` (tabel `sessions`); `POST /api/v1/inquiries` dan `/up` tidak pernah memulai sesi atau memasang cookie (diperiksa smoke test). `ADMIN_URL` di `production.env` adalah origin https aplikasi admin: dengan itu cookie admin `Secure` dan bernama `__Host-solveit-admin-session` (template memakai placeholder `https://admin.example.invalid` sampai domain ada).
- Galat `502` atau `504` yang dibuat gateway (backend tidak terjangkau, timeout) berarti hasil **tidak pasti** bagi klien; hanya `503` dengan body JSON dari Laravel berarti pasti tidak tersimpan (`docs/api/inquiries.md`).

## File konfigurasi dan rahasia

| File | Di-commit | Isi |
|---|---|---|
| `infra/docker/compose.prod.yaml` | Ya | Service, jaringan, volume, secret, batas |
| `infra/docker/production.env.example` | Ya | Template konfigurasi runtime backend tanpa rahasia; nilainya langsung dapat dipakai untuk uji lokal |
| `infra/docker/production.env` | **Tidak** (`*.env` diabaikan) | Salinan yang disesuaikan untuk server: `APP_URL`, `ADMIN_URL`, `DB_HOST`, `CORS_ALLOWED_ORIGINS`, `TRUSTED_PROXIES` |
| `infra/docker/compose.prod.admin-tls.yaml` | Ya | Override opsional (B3.2d): listener admin menerminasi TLS sendiri di 8443 |
| `infra/docker/secrets/` | **Tidak** | `app_key`, `db_app_password`, `db_migrator_password`, `mysql_root_password`; dengan override TLS admin juga `admin_tls_certificate` (rantai lengkap) dan `admin_tls_private_key` |

Variabel Compose (shell atau `infra/docker/.env`, keduanya tidak di-commit): `SOLVEIT_HTTP_BIND` dan `SOLVEIT_HTTP_PORT` (alamat publikasi gateway), `SOLVEIT_IMAGE_TAG` (tag image, default `local`), `SOLVEIT_SITE_URL`, `SOLVEIT_API_BASE_URL`, `SOLVEIT_GOOGLE_SITE_VERIFICATION` (build frontend), `SOLVEIT_ENV_FILE`, `SOLVEIT_SECRETS_DIR`, `SOLVEIT_DB_MIGRATOR_USERNAME`. Listener admin (B3.2d): `SOLVEIT_ADMIN_HTTP_BIND` dan `SOLVEIT_ADMIN_HTTP_PORT` (HTTP untuk proxy, default `127.0.0.1:8090`), `SOLVEIT_ADMIN_TLS_BIND` dan `SOLVEIT_ADMIN_TLS_PORT` (TLS lewat override, default `127.0.0.1:8443`); alamat keduanya terpisah, jadi memindahkan TLS ke antarmuka VPN tidak ikut memindahkan HTTP, `SOLVEIT_ADMIN_REAL_IP_FROM` (satu IP atau CIDR proxy tepercaya di depan listener HTTP; kosong berarti tidak ada). Hostname admin tidak punya variabel sendiri: ia diambil dari `ADMIN_URL` di `production.env`.

**Rahasia.** Entrypoint backend membaca `APP_KEY_FILE` dan `DB_PASSWORD_FILE` (path Docker secret), mengisi variabelnya hanya untuk proses itu, lalu `php artisan optimize` menyimpan konfigurasi ke cache di tmpfs. Worker PHP-FPM tidak mewarisi environment (`clear_env = yes`). Tidak ada rahasia di image, di `production.env`, atau di argumen perintah.

Compose (tanpa Swarm) memasang file secret apa adanya sebagai bind mount: **tidak dienkripsi**, dan mode file di host berlaku di dalam container. Backend membacanya sebagai `www-data` (uid 33) dan image MySQL sebagai `mysql` (uid 999, setelah entrypoint-nya melepas hak root), jadi file harus dapat dibaca keduanya. Perlindungan di host ada pada **folder**: hanya pengguna deploy yang dapat membukanya; mode folder tidak ikut ke container karena setiap file di-mount sendiri. Di server, sebagai pengguna deploy:

```bash
cd infra/docker
umask 077 && mkdir -p secrets
printf 'base64:%s' "$(openssl rand -base64 32)" > secrets/app_key
for name in db_app_password db_migrator_password mysql_root_password; do openssl rand -hex 24 > "secrets/$name"; done
chmod 0444 secrets/* && chmod 0700 secrets   # file terbaca di container, folder tertutup di host
```

Simpan salinan rahasia di pengelola rahasia tim (bukan Git, bukan chat). Disk server sebaiknya terenkripsi dan hanya pengguna deploy yang punya akses shell. Platform dengan secret manager sendiri dapat memasang file di path yang sama, atau mengganti `APP_KEY_FILE`/`DB_PASSWORD_FILE` dengan path miliknya.

## TLS

Belum dikonfigurasi, karena domain dan sertifikat belum ada; jangan menganggap situs ini HTTPS. Pilihan saat domain diputuskan:

1. Reverse proxy di host atau load balancer platform menerminasi TLS dan meneruskan ke `127.0.0.1:8080` (default `SOLVEIT_HTTP_BIND`). Isi `set_real_ip_from` di `gateway.conf` dengan alamat yang **dilihat gateway** untuk koneksi dari proxy itu (sering gateway jaringan bridge Docker, bukan `127.0.0.1`, karena port loopback diteruskan oleh proxy Docker), agar batas laju melihat IP pengunjung. Tanpa itu semua pengunjung terhitung satu alamat.
2. Atau tambah server `listen 8443 ssl` di `gateway.conf` dengan sertifikat dari secret, lalu publikasikan 443 ke 8443.

Setelah TLS aktif: `APP_URL=https://...`, header `Strict-Transport-Security` di titik terminasi TLS, dan `VITE_SITE_URL` untuk canonical dan sitemap. TLS listener admin dibahas terpisah di bagian Admin privat.

## Deployment pertama (setelah hosting disetujui)

Belum pernah dilakukan. Urutan yang disiapkan, dari root repository di server dengan Docker Engine dan Compose 2.20+:

```bash
cp infra/docker/production.env.example infra/docker/production.env   # sesuaikan APP_URL, DB_HOST, CORS, proxy
# buat secrets/ seperti di atas
export SOLVEIT_IMAGE_TAG=$(git rev-parse --short HEAD)
docker compose -f infra/docker/compose.prod.yaml --profile bundled-db build
docker compose -f infra/docker/compose.prod.yaml --profile bundled-db up -d --wait mysql
docker compose -f infra/docker/compose.prod.yaml --profile bundled-db --profile ops run --rm migrate
docker compose -f infra/docker/compose.prod.yaml --profile bundled-db up -d --wait
curl -fsS http://127.0.0.1:8080/up
```

Dengan MySQL terkelola: hilangkan `--profile bundled-db`, isi `DB_HOST` (dan `MYSQL_ATTR_SSL_CA` bila TLS), buat sendiri database dan kedua pengguna dengan hak seperti di `infra/docker/mysql/initdb-production/10-solveit-production.sh`, setel parameter server `log_bin_trust_function_creators = ON` (tanpa itu pengguna migrasi tidak dapat membuat trigger audit B3.1a; `backend/README.md`, Trigger audit). Setelan itu berlaku untuk **seluruh server**, bukan hanya database website, sehingga menjadi prasyarat saat memilih penyedia: pastikan penyedia mengizinkannya, dan utamakan server MySQL tersendiri daripada server bersama. Lalu beri jaringan `internal` akses keluar (ganti `internal: true` dengan jaringan biasa yang dibatasi firewall), karena jaringan `internal` tidak punya rute ke luar host.

## Migrasi

- Hanya lewat `docker compose ... --profile ops run --rm migrate`, sebagai `solveit_migrator`. Container `backend` tidak pernah menjalankan migrasi saat start dan pengguna aplikasinya tidak punya hak DDL.
- Sebelum migrasi: backup (di bawah) dan baca diff migrasi pada rilis itu.
- Tidak ada `migrate:fresh`, `migrate:reset`, `migrate:rollback`, `db:wipe`, atau `DROP` pada database produksi. Pembalikan skema dilakukan dengan migrasi baru yang ditinjau.
- Migrasi harus kompatibel dengan versi aplikasi sebelumnya (menambah kolom nullable, bukan mengganti nama), agar rollback image tidak butuh rollback skema. Migrasi B2.1 (`idempotency_key_hash`, nullable) dan B3.1a (kolom admin nullable di `users`, tabel `admin_access_links` dan `admin_audit_events` baru) memenuhi ini.
- Migrasi B3.1a membuat dua trigger yang membuat `admin_audit_events` hanya-tambah untuk setiap pengguna, termasuk `solveit_app`. MySQL bawaan (profil `bundled-db`) menyetel `log_bin_trust_function_creators` di `initdb`; volume yang dibuat sebelum B3.1a butuh `SET PERSIST log_bin_trust_function_creators = ON` sekali sebagai root sebelum migrasi.

## Admin privat (B3.2d)

Status: **disiapkan dan divalidasi (lokal dan Docker CI), belum di-deploy.** Tidak ada hostname admin, sertifikat untuk domain nyata, akun admin, atau listener yang terbuka. Tanpa `--profile admin` tidak ada satu pun service admin yang dibuat. Keputusan yang masih milik pemilik ada di akhir bagian ini.

```text
  browser admin, hanya lewat tunnel SSH, VPN, atau proxy yang dibatasi
          | https://<host ADMIN_URL>
  TLS: di listener sendiri (compose.prod.admin-tls.yaml) atau di proxy di depannya
          |
  host: ${SOLVEIT_ADMIN_TLS_BIND}:${SOLVEIT_ADMIN_TLS_PORT}    (default 127.0.0.1:8443, TLS)
        ${SOLVEIT_ADMIN_HTTP_BIND}:${SOLVEIT_ADMIN_HTTP_PORT}  (default 127.0.0.1:8090, HTTP untuk proxy)
          |
  admin-edge      +-----------------------------------+
                  | admin-gateway (nginx unprivileged)|  Host lain: 421, SNI lain: handshake ditolak
                  +-------+-------------------+-------+
  admin-internal          | /api/v1/admin/*   | lainnya
  (tanpa internet) FastCGI|                   |HTTP
                  +-------v------+    +-------v--------------+
                  | backend      |    | admin (nginx statis) |
                  +--------------+    +----------------------+
```

**Satu origin, satu sumber hostname.** Browser hanya melihat origin `ADMIN_URL`: konsol dan `/api/v1/admin` dari host yang sama, sehingga tidak ada CORS dan `AdminRequestBoundary` Laravel melihat `Host` dan `Origin` asli. `ADMIN_URL` di `production.env` dibaca backend (cookie, tautan akses, batas host dan origin) dan `admin-gateway` (`server_name`, lewat `nginx/admin-origin.envsh`). Keduanya **gagal tertutup**: container tidak start bila `ADMIN_URL` bukan origin `https://` (host huruf kecil, port opsional, tanpa path); backend juga menolak `ADMIN_URL` yang sama dengan `APP_URL`, dan listener menolak `SOLVEIT_ADMIN_REAL_IP_FROM` yang bukan satu IP atau CIDR (nilainya masuk ke konfigurasi nginx).

**Isolasi dari website publik.**

- `gateway` tidak berubah: setiap ejaan `/api/v1/admin` tetap `404`, juga dengan header `Host` admin yang dipalsukan, dan konsol (`/masuk`, `/access`, asetnya) tidak ada di sana.
- Jaringan terpisah: `gateway` dan `frontend` di `edge`/`internal`, `admin-gateway` dan `admin` di `admin-edge`/`admin-internal`; hanya `backend` ada di keduanya. Gateway publik tidak dapat menjangkau konsol, dan listener admin tidak dapat menjangkau website maupun MySQL (diuji dengan kontrol positif).
- Listener admin tidak menyajikan `/api/v1/inquiries`, `/up`, atau path Laravel lain (`404`), dan konsol hanya menerima `GET` dan `HEAD`.

**Header dan cookie (diuji dengan curl dan Chromium nyata).**

| Respons | Header |
|---|---|
| Konsol | CSP sebagai header HTTP, persis CSP meta build ditambah `frame-ancestors 'none'` (keduanya dari `admin/security-policy.ts`): `script-src 'self'` tanpa `unsafe-inline`/`unsafe-eval`, gambar `data:` hanya untuk QR TOTP; `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin` (bukan `no-referrer`, lihat `docs/architecture/admin-dashboard.md` 2), `X-Robots-Tag: noindex, nofollow`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`. HTML `no-store`, aset hashed `private, max-age=31536000, immutable`, aset yang tidak ada `404` tanpa cache |
| API admin | `Cache-Control: no-store, private` (Laravel), `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `nosniff`, `X-Frame-Options: DENY`, `X-Robots-Tag`. Backend tidak menjawab: `502`/`504` JSON `no-store`, yang bagi konsol berarti hasil tidak pasti (tidak pernah dikirim ulang) |
| TLS di listener | `Strict-Transport-Security: max-age=31536000` (tanpa `includeSubDomains` dan `preload` sampai domain diputuskan); TLS 1.2 dan 1.3 saja, HTTP/2, tanpa session ticket. Dengan TLS di proxy, proxy itu yang mengirim HSTS |
| Cookie | `__Host-solveit-admin-session`: `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, tanpa `Domain`, berakhir saat browser ditutup. `XSRF-TOKEN`: `Secure`, `SameSite=Strict`, dapat dibaca konsol (bukan `HttpOnly`). Aturannya tetap di `backend/config/session.php` |

**Proxy tepercaya dan alamat IP.** Laravel tetap tanpa `TRUSTED_PROXIES`: nginx menaruh alamat orang di `REMOTE_ADDR`, dan `admin-gateway` membuang `X-Forwarded-*` dan `Forwarded` sebelum FastCGI. Bila proxy TLS ada di depan listener HTTP, setel `SOLVEIT_ADMIN_REAL_IP_FROM` ke alamat proxy **seperti dilihat listener** (untuk proxy di host yang sama biasanya gateway bridge jaringan `admin-edge`: `docker network inspect <proyek>_admin-edge`), agar batas laju masuk dan audit log melihat IP orangnya. Tanpa itu semua orang terhitung satu alamat, dan batas laju masuk (5 per menit, 20 per jam per IP) dapat dipicu orang lain. `verify-admin.sh` membuktikan `X-Forwarded-For` palsu diabaikan dan hanya dihormati dari alamat yang dipercaya. Alamat IP di audit admin dan di log akses nginx adalah data pribadi; masa simpannya mengikuti keputusan retensi pemilik yang belum ada (log container dirotasi 10 MB x 5).

### Opsi paparan (Owner decision required)

| Opsi | Cara | Catatan |
|---|---|---|
| A. Tunnel SSH (paling privat; tidak ada port admin terbuka) | Listener tetap loopback, TLS di listener (override) dengan sertifikat untuk hostname admin. Operator: `ssh -L 8443:127.0.0.1:8443 <server>` dan baris hosts `127.0.0.1 <host admin>` di laptopnya, lalu buka `https://<host admin>:8443` (port itu bagian dari `ADMIN_URL`) | Sertifikat dari CA internal tim atau ACME DNS-01 (tanpa port terbuka). Cocok untuk satu sampai beberapa admin |
| B. VPN atau jaringan privat (WireGuard, Tailscale, jaringan privat penyedia) | `SOLVEIT_ADMIN_TLS_BIND=<alamat antarmuka VPN>`, TLS di listener (override), firewall host membatasi port itu ke antarmuka VPN. Port HTTP tetap di `SOLVEIT_ADMIN_HTTP_BIND` (loopback) dan tidak ikut terbuka di VPN (diuji di Docker CI) | Alamat VPN tidak boleh dijangkau dari internet |
| C. Proxy TLS terbatas di depan (reverse proxy host, load balancer, atau proxy identitas) | Listener HTTP di loopback; proxy meneruskan ke `127.0.0.1:8090` dengan header `Host` **apa adanya**, mengirim HSTS, dan membatasi akses (allowlist IP atau autentikasi identitas di depan login konsol); `SOLVEIT_ADMIN_REAL_IP_FROM=<alamat proxy>` | Proxy jangan menulis ulang `Host` atau `Origin`: Laravel menolak keduanya bila tidak sama dengan `ADMIN_URL` |

Tidak boleh: `SOLVEIT_ADMIN_TLS_BIND` atau `SOLVEIT_ADMIN_HTTP_BIND` `0.0.0.0` tanpa VPN atau allowlist di depan, listener HTTP di jaringan yang tidak tepercaya, atau hostname admin yang sama dengan website publik.

### Menjalankan (setelah keputusan pemilik)

```bash
# production.env: ADMIN_URL=https://<host admin>[:port]   (placeholder admin.example.invalid sampai diputuskan)
# opsi A/B: secrets/admin_tls_certificate (rantai lengkap) dan secrets/admin_tls_private_key, 0444 di folder 0700
export SOLVEIT_IMAGE_TAG=$(git rev-parse --short HEAD)
docker compose -f infra/docker/compose.prod.yaml --profile admin build admin
docker compose -f infra/docker/compose.prod.yaml -f infra/docker/compose.prod.admin-tls.yaml \
  --profile bundled-db --profile admin up -d --wait          # opsi C: tanpa file override TLS
docker compose -f infra/docker/compose.prod.yaml exec backend php artisan admin:bootstrap-owner <email-owner> --force
```

Tautan aktivasi menunjuk ke `ADMIN_URL/access`; owner membukanya lewat jalur paparan yang dipilih (bagian Akun admin pertama). Sertifikat dibaca nginx saat start: setelah memperbarui file secret, jalankan `docker compose ... restart admin-gateway`. Otomasi pembaruan (ACME) bergantung pada hosting dan DNS, jadi menunggu keputusan pemilik.

### Bukti (CI dan lokal, data sintetis)

**Penjaga gagal tertutup.** Semua skrip dan tes yang mengubah stack (`verify-production.sh`, `verify-admin.sh`, `drill-backup-restore.sh`, tes Playwright produksi) menjalankan `infra/docker/scripts/check-synthetic-stack.sh` lebih dulu dan berhenti bila ia menolak, sebelum membuat akun, mengirim inquiry, menulis audit, me-restart, me-rollback, atau menghapus apa pun. Tidak ada default: `SOLVEIT_PROD_PROJECT` wajib disebut (huruf kecil, mengandung `smoke`, `drill`, atau `ci`, tidak pernah `solveit-indonesia` atau `solveit-indonesia-prod`), `SOLVEIT_ENV_FILE` dan `SOLVEIT_SECRETS_DIR` wajib disebut dan berada di luar repository (file env tidak boleh bernama `production.env`). Stack yang berjalan harus memperlihatkan: MySQL bawaan di volume proyek itu sendiri (tidak pernah `solveit-mysql-data`), `DB_HOST=mysql`, `ADMIN_URL` di host `.test`, `APP_URL` lokal atau `.test`, semua port di `127.0.0.1`, dan hanya akun serta kontak inquiry sintetis. Tes Playwright juga menolak tanpa `SOLVEIT_ADMIN_URL` `.test` yang sama dengan `ADMIN_URL` backend, dan memeriksa ulang tepat sebelum `admin:bootstrap-owner`. Penjaga sendiri hanya membaca (inspeksi Docker dan `SELECT`), tidak pernah menjalankan Compose.

`infra/docker/scripts/test-safety-guards.sh` membuktikannya: setiap konsumen dijalankan dengan pengaturan yang tidak aman (tanpa proyek, proyek produksi atau pengembangan, nama tanpa penanda, proyek yang tidak ada, tanpa file env atau secret, file env `production.env` atau di dalam repository, folder secret repository, origin admin bukan `.test` atau berbeda dari stack) dan harus menolak dengan alasan itu, lalu snapshot container, waktu start, image, dan jumlah baris sebelum dan sesudah harus identik. Kemudian stack dibuat tidak aman satu per satu (akun non-sintetis, `ADMIN_URL` atau `APP_URL` publik, database eksternal, port di luar `127.0.0.1`) dan penjaga serta konsumen harus menolak; setiap perubahan dibatalkan.


- `infra/docker/scripts/verify-admin.sh`: isi image (tanpa Node, sumber, source map, halaman referensi; non-root; read-only; tanpa file rahasia), port hanya loopback, jaringan terpisah, header dan CSP konsol, fallback SPA, cache aset, TLS (1.0/1.1 ditolak, SNI asing ditolak, HTTP/2), cookie `__Host-` dan `XSRF-TOKEN`, batas `Origin`, `Sec-Fetch-Site`, dan CSRF (`403`, `419`), path non-admin `404`, listener HTTP di belakang proxy (`Host` wajib, `X-Forwarded-For` palsu diabaikan, proxy tepercaya dihormati), isolasi gateway publik, konfigurasi yang gagal tertutup, backend atau konsol mati lalu pulih, dan rollback dengan tag image lalu kembali.
- `admin/tests/production/` (Playwright, Chromium nyata, `playwright.production.config.ts`): owner pertama dari `admin:bootstrap-owner`, aktivasi dengan pendaftaran TOTP dan kode pemulihan, cookie `__Host-` dengan atribut lengkap, header yang diterima browser, layar owner (chunk lazy) di bawah CSP produksi, keluar, masuk lagi dengan kata sandi dan TOTP, nol pelanggaran CSP, dan tidak ada rahasia di penyimpanan browser.
- Docker CI menjalankan keduanya pada setiap perubahan `infra/**`, `admin/**`, `backend/**`, atau `frontend/**`, dengan sertifikat self-signed untuk `admin.solveit.test` yang dibuat per run dan nama yang hanya di-resolve curl dan Chromium ke loopback.

### Keputusan pemilik sebelum go-live admin

1. Hostname admin (subdomain website atau domain lain) dan apakah port non-standar diterima; `ADMIN_URL` mengikuti.
2. Opsi paparan (A, B, atau C) dan siapa yang boleh menjangkau listener; untuk C, proxy identitas atau allowlist IP mana.
3. Sumber dan pembaruan sertifikat (CA internal, ACME HTTP-01 atau DNS-01, sertifikat platform), dan HSTS `includeSubDomains`/`preload` atau tidak.
4. Hosting yang menjalankan stack ini (bersama website atau terpisah) dan apakah database bersama website.
5. Siapa owner pertama, berapa owner, dan siapa memegang peran apa (`docs/architecture/admin-dashboard.md` 4).
6. Retensi audit log dan alamat IP (audit, sesi, log akses proxy dan nginx): **tetap pending**, tidak ada pemangkasan.
7. Frekuensi backup, lokasi di luar server, enkripsi, dan masa simpannya (bagian Backup), termasuk target waktu pemulihan.
8. Waiver concept-seed desain admin: **tetap pending**, tidak dicatat sebagai waived.

## Akun admin pertama

Belum ada akun produksi, dan bootstrap menunggu deployment yang disetujui pemilik. Saat waktunya, operator di shell server menjalankan:

```bash
docker compose -f infra/docker/compose.prod.yaml exec backend php artisan admin:bootstrap-owner <email-owner> --force
```

Perintah mencetak satu tautan aktivasi 30 menit ke `ADMIN_URL/access` (tidak disimpan, tidak di-log); serahkan lewat kanal tepercaya. Owner membukanya lewat jalur paparan yang dipilih (bagian Admin privat). Tautan baru menggantikan yang lama; setelah owner aktif, perintah ditolak. Pemulihan darurat: `admin:reset-credentials <email> --force`. Rincian: `docs/api/admin-auth.md`.

## Pembaruan dan rollback

1. `git pull` ke commit rilis, `export SOLVEIT_IMAGE_TAG=<sha>`, `build`.
2. Backup, lalu `run --rm migrate`.
3. `up -d --wait`. PHP-FPM menerima `SIGQUIT` dan menyelesaikan request yang berjalan (sampai 20 detik, `stop_grace_period` 30 detik).
4. Periksa `/up`, halaman utama, dan log (`docker compose ... logs --tail=100 backend gateway`).
5. Rollback: `export SOLVEIT_IMAGE_TAG=<sha sebelumnya>` lalu `up -d --wait` (image lama masih ada di host; jangan `docker image prune` sebelum rilis stabil). Skema tidak di-rollback (lihat Migrasi). Image konsol admin ikut tag yang sama; dengan `--profile admin` (dan override TLS bila dipakai) `up` mengganti `admin` dan `backend` bersama website. `verify-admin.sh` melatih langkah ini (tag sebelumnya, periksa, kembali ke tag rilis) pada setiap run CI.

Image dasar dikunci ke tag patch. Pembaruan keamanan: naikkan tag di Dockerfile atau Compose dalam PR, biarkan **Docker CI** membangun dan menguji, lalu rilis seperti di atas.

## Backup dan pemulihan (profil bundled-db)

Backup berisi data pribadi inquiry: simpan terenkripsi, di luar server dan di luar repository, dengan akses terbatas. Masa simpan backup mengikuti keputusan retensi pemilik yang belum ada.

```bash
# backup
docker compose -f infra/docker/compose.prod.yaml --profile bundled-db exec -T mysql bash -c \
  'mysqldump --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(cat /run/secrets/mysql_root_password)") --single-transaction --databases solveit_indonesia' \
  | gzip > solveit-$(date +%Y%m%d-%H%M).sql.gz
# pemulihan (ke database yang sama; uji dulu di salinan)
gunzip -c solveit-<tanggal>.sql.gz | docker compose -f infra/docker/compose.prod.yaml --profile bundled-db exec -T mysql bash -c \
  'mysql --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(cat /run/secrets/mysql_root_password)")'
```

Backup mencakup tabel `sessions`: memulihkan backup lama menghidupkan lagi sesi admin yang tersimpan di dalamnya (tetap dibatasi idle 30 menit dan batas 12 jam). Setelah pemulihan dari backup lama, akhiri semua sesi admin (`DELETE FROM sessions` sebagai pengguna migrasi; setiap admin masuk lagi) dan periksa audit log. `docker compose ... down` aman (volume tetap); `down -v` menghapus database produksi dan tidak boleh dipakai.

**Latihan pemulihan (B3.2d).** `infra/docker/scripts/drill-backup-restore.sh` menjalankan prosedur di atas pada proyek sintetis yang terisolasi: menghentikan penulisan, mencatat jumlah baris dan `CHECKSUM TABLE` per tabel, membuat backup, **menghapus container MySQL dan volume proyek latihan itu**, membuat MySQL baru dari nol (pengguna dari `initdb`), memulihkan, lalu membuktikan baris, checksum, kedua trigger audit, grant `solveit_app`, sifat hanya-tambah audit log, `migrate:status` tanpa `Pending`, dan `/up`. Ia menolak berjalan kecuali `check-synthetic-stack.sh` menerima stack itu (bagian Admin privat, Bukti): nama proyek mengandung `drill`, `smoke`, atau `ci` (tidak pernah `solveit-indonesia` atau `solveit-indonesia-prod`), file env dan secret sementara di luar repository, volumenya milik proyek itu (tidak pernah `solveit-mysql-data`), backend memakai MySQL bawaan, origin uji, port loopback, dan semua akun serta kontak inquiry sintetis (`example.test`, `example.com`). Backup latihan hanya ada di folder sementara yang dihapus saat selesai. Docker CI menjalankannya pada setiap run; waktu pulih latihan lokal (database sintetis kecil) sekitar 90 detik.

```bash
SOLVEIT_DRILL_PROJECT=solveit-drill-smoke SOLVEIT_PROD_PROJECT=solveit-drill-smoke SOLVEIT_ENV_FILE=<...> SOLVEIT_SECRETS_DIR=<...> \
  bash infra/docker/scripts/drill-backup-restore.sh   # stack latihan sudah berjalan
```

## Queue dan scheduler

Tidak ada. Aplikasi saat ini tidak mengirim job dan tidak punya jadwal (`QUEUE_CONNECTION=sync`, `routes/console.php` tanpa jadwal). Tambahkan service worker atau scheduler hanya bila fitur yang membutuhkannya dibangun.

## Uji lokal mirip produksi

Untuk QA saja, dengan data sintetis dan proyek terisolasi (tidak menyentuh `solveit-mysql` atau database pengembangan):

```bash
export SOLVEIT_PROD_PROJECT=solveit-prod-smoke SOLVEIT_SECRETS_DIR=<folder sementara di luar repository> SOLVEIT_ENV_FILE=<folder sementara>/smoke.env
cp infra/docker/production.env.example "$SOLVEIT_ENV_FILE"   # penjaga menolak file env di dalam repository
# buat keempat secret di $SOLVEIT_SECRETS_DIR seperti di atas
docker compose -p $SOLVEIT_PROD_PROJECT -f infra/docker/compose.prod.yaml build
docker compose -p $SOLVEIT_PROD_PROJECT -f infra/docker/compose.prod.yaml --profile bundled-db up -d --wait mysql
docker compose -p $SOLVEIT_PROD_PROJECT -f infra/docker/compose.prod.yaml --profile bundled-db --profile ops run --rm migrate
docker compose -p $SOLVEIT_PROD_PROJECT -f infra/docker/compose.prod.yaml --profile bundled-db up -d --wait
bash infra/docker/scripts/verify-production.sh
docker compose -p $SOLVEIT_PROD_PROJECT -f infra/docker/compose.prod.yaml --profile bundled-db down -v   # hanya proyek uji ini
```

Dengan listener admin (B3.2d), seperti Docker CI: secret ditambah sertifikat self-signed sekali pakai untuk nama uji, dan file env uji dengan `ADMIN_URL` nama itu.

```bash
export SOLVEIT_PROD_PROJECT=solveit-admin-smoke SOLVEIT_SECRETS_DIR=<folder sementara di luar repository> SOLVEIT_ENV_FILE=<folder sementara>/smoke.env
export SOLVEIT_ADMIN_URL=https://admin.solveit.test:8443
sed 's#^ADMIN_URL=.*#ADMIN_URL=https://admin.solveit.test:8443#' infra/docker/production.env.example > "$SOLVEIT_ENV_FILE"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 2 -subj "/CN=admin.solveit.test"   -addext "subjectAltName=DNS:admin.solveit.test"   -keyout "$SOLVEIT_SECRETS_DIR/admin_tls_private_key" -out "$SOLVEIT_SECRETS_DIR/admin_tls_certificate"
compose() { docker compose -p $SOLVEIT_PROD_PROJECT -f infra/docker/compose.prod.yaml -f infra/docker/compose.prod.admin-tls.yaml --profile bundled-db --profile admin "$@"; }
compose build && compose up -d --wait mysql && compose --profile ops run --rm migrate && compose up -d --wait
bash infra/docker/scripts/test-safety-guards.sh   # tes negatif penjaga, sebelum yang lain
bash infra/docker/scripts/verify-production.sh && bash infra/docker/scripts/verify-admin.sh
(cd admin && npx playwright test --config playwright.production.config.ts)   # sekali per database: membuat owner pertama
SOLVEIT_DRILL_PROJECT=$SOLVEIT_PROD_PROJECT bash infra/docker/scripts/drill-backup-restore.sh
compose down -v   # hanya proyek uji ini
```

`admin.solveit.test` tidak pernah di-resolve DNS: curl memakai `--resolve` dan Chromium `--host-resolver-rules`. Di Git Bash, MSYS mengubah argumen `-subj "/CN=..."` menjadi path; tambahkan `MSYS_NO_PATHCONV=1` di depan perintah `openssl` itu.

`verify-production.sh` memeriksa versi PHP dan ekstensi, isi image (tanpa dev package, `.env`, kunci, dump, `.git`, Node), port yang dipublikasikan, halaman ID/EN, 404 per bahasa, cache dan kompresi aset, header, `/up`, kontrak inquiry (201, replay, 409, 400, 422, 429), hak pengguna database, dan restart. Sejak B3.1a juga: inquiry tanpa cookie, 26 ejaan path admin (`GET` dan `POST`; empat di antaranya route B3.1b) yang ditolak listener publik tanpa cookie, konfigurasi sesi admin efektif di container (`database`, `__Host-`, `Secure`, `Strict`, `HttpOnly`, terenkripsi, 30 menit, tanpa `Domain`), dan audit log yang menolak `UPDATE`, `DELETE`, dan (sejak B3.1b) `TRUNCATE` dari `solveit_app`. Lulus di sini **bukan** deployment publik.

Di Windows (Git Bash), `openssl` dapat menulis secret dengan akhir baris CRLF, yang ditolak skrip `initdb` MySQL (hanya huruf dan angka). Tambahkan `| tr -d '\r\n'` sebelum `>` saat membuat secret uji lokal.
