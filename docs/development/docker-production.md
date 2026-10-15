# Deployment Produksi dengan Docker

Status: **konfigurasi produksi Docker disiapkan dan divalidasi (lokal dan CI), belum di-deploy secara publik.** Belum ada hosting, domain, sertifikat TLS, atau database produksi. Docker adalah **salah satu opsi** deployment untuk VPS atau platform container yang mendukung Docker Compose; hosting statis biasa untuk frontend (`development-guide.md` bagian Deployment) dan hosting PHP biasa untuk backend tetap mungkin. Pemilihan hosting adalah keputusan pemilik.

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

Semua service: `restart: unless-stopped` (kecuali `migrate`), `no-new-privileges`, log `json-file` dengan rotasi (10 MB x 5), dan batas CPU dan memori (`deploy.resources.limits`). Jaringan `internal` bertanda `internal: true` (tanpa rute keluar); hanya `gateway` juga ada di jaringan `edge` yang punya port.

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
- `VITE_*` adalah konfigurasi publik saat build, bukan rahasia. `compose.prod.yaml` mengunci `VITE_INQUIRY_API_ENABLED: "false"`: build Docker tidak dapat mengaktifkan kanal **Kirim melalui website** secara tidak sengaja. Mengubahnya butuh persetujuan pemilik (privasi, retensi, hosting, database, penanganan inquiry), lalu B2.2 (idempotensi di frontend) sebaiknya selesai lebih dulu.
- Galat `502` atau `504` yang dibuat gateway (backend tidak terjangkau, timeout) berarti hasil **tidak pasti** bagi klien; hanya `503` dengan body JSON dari Laravel berarti pasti tidak tersimpan (`docs/api/inquiries.md`).

## File konfigurasi dan rahasia

| File | Di-commit | Isi |
|---|---|---|
| `infra/docker/compose.prod.yaml` | Ya | Service, jaringan, volume, secret, batas |
| `infra/docker/production.env.example` | Ya | Template konfigurasi runtime backend tanpa rahasia; nilainya langsung dapat dipakai untuk uji lokal |
| `infra/docker/production.env` | **Tidak** (`*.env` diabaikan) | Salinan yang disesuaikan untuk server: `APP_URL`, `DB_HOST`, `CORS_ALLOWED_ORIGINS`, `TRUSTED_PROXIES` |
| `infra/docker/secrets/` | **Tidak** | `app_key`, `db_app_password`, `db_migrator_password`, `mysql_root_password` |

Variabel Compose (shell atau `infra/docker/.env`, keduanya tidak di-commit): `SOLVEIT_HTTP_BIND` dan `SOLVEIT_HTTP_PORT` (alamat publikasi gateway), `SOLVEIT_IMAGE_TAG` (tag image, default `local`), `SOLVEIT_SITE_URL`, `SOLVEIT_API_BASE_URL`, `SOLVEIT_GOOGLE_SITE_VERIFICATION` (build frontend), `SOLVEIT_ENV_FILE`, `SOLVEIT_SECRETS_DIR`, `SOLVEIT_DB_MIGRATOR_USERNAME`.

**Rahasia.** Entrypoint backend membaca `APP_KEY_FILE` dan `DB_PASSWORD_FILE` (path Docker secret), mengisi variabelnya hanya untuk proses itu, lalu `php artisan optimize` menyimpan konfigurasi ke cache di tmpfs. Worker PHP-FPM tidak mewarisi environment (`clear_env = yes`). Tidak ada rahasia di image, di `production.env`, atau di argumen perintah.

Compose (tanpa Swarm) memasang file secret apa adanya sebagai bind mount: **tidak dienkripsi**, dan izin file di host berlaku di container. Di server:

```bash
cd infra/docker
umask 077 && mkdir -p secrets
printf 'base64:%s' "$(openssl rand -base64 32)" > secrets/app_key
for name in db_app_password db_migrator_password mysql_root_password; do openssl rand -hex 24 > "secrets/$name"; done
sudo chown -R root:33 secrets && sudo chmod 0750 secrets && sudo chmod 0640 secrets/*   # 33 = www-data di container backend
```

Simpan salinan rahasia di pengelola rahasia tim (bukan Git, bukan chat). Disk server sebaiknya terenkripsi dan hanya pengguna deploy yang punya akses shell. Platform dengan secret manager sendiri dapat memasang file di path yang sama, atau mengganti `APP_KEY_FILE`/`DB_PASSWORD_FILE` dengan path miliknya.

## TLS

Belum dikonfigurasi, karena domain dan sertifikat belum ada; jangan menganggap situs ini HTTPS. Pilihan saat domain diputuskan:

1. Reverse proxy di host atau load balancer platform menerminasi TLS dan meneruskan ke `127.0.0.1:8080` (default `SOLVEIT_HTTP_BIND`). Isi `set_real_ip_from` di `gateway.conf` dengan alamat yang **dilihat gateway** untuk koneksi dari proxy itu (sering gateway jaringan bridge Docker, bukan `127.0.0.1`, karena port loopback diteruskan oleh proxy Docker), agar batas laju melihat IP pengunjung. Tanpa itu semua pengunjung terhitung satu alamat.
2. Atau tambah server `listen 8443 ssl` di `gateway.conf` dengan sertifikat dari secret, lalu publikasikan 443 ke 8443.

Setelah TLS aktif: `APP_URL=https://...`, header `Strict-Transport-Security` di titik terminasi TLS, dan `VITE_SITE_URL` untuk canonical dan sitemap.

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

Dengan MySQL terkelola: hilangkan `--profile bundled-db`, isi `DB_HOST` (dan `MYSQL_ATTR_SSL_CA` bila TLS), buat sendiri database dan kedua pengguna dengan hak seperti di `infra/docker/mysql/initdb-production/10-solveit-production.sh`, dan beri jaringan `internal` akses keluar (ganti `internal: true` dengan jaringan biasa yang dibatasi firewall), karena jaringan `internal` tidak punya rute ke luar host.

## Migrasi

- Hanya lewat `docker compose ... --profile ops run --rm migrate`, sebagai `solveit_migrator`. Container `backend` tidak pernah menjalankan migrasi saat start dan pengguna aplikasinya tidak punya hak DDL.
- Sebelum migrasi: backup (di bawah) dan baca diff migrasi pada rilis itu.
- Tidak ada `migrate:fresh`, `migrate:reset`, `migrate:rollback`, `db:wipe`, atau `DROP` pada database produksi. Pembalikan skema dilakukan dengan migrasi baru yang ditinjau.
- Migrasi harus kompatibel dengan versi aplikasi sebelumnya (menambah kolom nullable, bukan mengganti nama), agar rollback image tidak butuh rollback skema. Migrasi B2.1 (`idempotency_key_hash`, nullable) memenuhi ini.

## Pembaruan dan rollback

1. `git pull` ke commit rilis, `export SOLVEIT_IMAGE_TAG=<sha>`, `build`.
2. Backup, lalu `run --rm migrate`.
3. `up -d --wait`. PHP-FPM menerima `SIGQUIT` dan menyelesaikan request yang berjalan (sampai 20 detik, `stop_grace_period` 30 detik).
4. Periksa `/up`, halaman utama, dan log (`docker compose ... logs --tail=100 backend gateway`).
5. Rollback: `export SOLVEIT_IMAGE_TAG=<sha sebelumnya>` lalu `up -d --wait` (image lama masih ada di host; jangan `docker image prune` sebelum rilis stabil). Skema tidak di-rollback (lihat Migrasi).

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

Uji pemulihan secara berkala di proyek terpisah (`docker compose -p solveit-restore-test ...`). `docker compose ... down` aman (volume tetap); `down -v` menghapus database produksi dan tidak boleh dipakai.

## Queue dan scheduler

Tidak ada. Aplikasi saat ini tidak mengirim job dan tidak punya jadwal (`QUEUE_CONNECTION=sync`, `routes/console.php` tanpa jadwal). Tambahkan service worker atau scheduler hanya bila fitur yang membutuhkannya dibangun.

## Uji lokal mirip produksi

Untuk QA saja, dengan data sintetis dan proyek terisolasi (tidak menyentuh `solveit-mysql` atau database pengembangan):

```bash
export SOLVEIT_PROD_PROJECT=solveit-prod-smoke SOLVEIT_SECRETS_DIR=<folder sementara di luar repository> SOLVEIT_ENV_FILE=./production.env.example
# buat keempat secret di $SOLVEIT_SECRETS_DIR seperti di atas
docker compose -p $SOLVEIT_PROD_PROJECT -f infra/docker/compose.prod.yaml build
docker compose -p $SOLVEIT_PROD_PROJECT -f infra/docker/compose.prod.yaml --profile bundled-db up -d --wait mysql
docker compose -p $SOLVEIT_PROD_PROJECT -f infra/docker/compose.prod.yaml --profile bundled-db --profile ops run --rm migrate
docker compose -p $SOLVEIT_PROD_PROJECT -f infra/docker/compose.prod.yaml --profile bundled-db up -d --wait
bash infra/docker/scripts/verify-production.sh
docker compose -p $SOLVEIT_PROD_PROJECT -f infra/docker/compose.prod.yaml --profile bundled-db down -v   # hanya proyek uji ini
```

`verify-production.sh` memeriksa versi PHP dan ekstensi, isi image (tanpa dev package, `.env`, kunci, dump, `.git`, Node), port yang dipublikasikan, halaman ID/EN, 404 per bahasa, cache dan kompresi aset, header, `/up`, kontrak inquiry (201, replay, 409, 400, 422, 429), hak pengguna database, dan restart. Lulus di sini **bukan** deployment publik.
