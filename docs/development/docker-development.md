# Pengembangan dengan Docker

Lingkungan pengembangan lengkap di container: API Laravel, frontend React, dan MySQL 8.4, untuk kontributor yang tidak punya PHP 8.5, Node 22, atau MySQL 8.4 di komputernya. Ini **alternatif**, bukan pengganti, alur native (PHP dan Node di host, MySQL di Docker) yang dijelaskan di `development-guide.md` dan `backend/README.md`. Keduanya memakai database yang sama dan boleh berjalan bersamaan.

Aturan penempatan file Docker ada di `docs/project-structure.md` bagian 11. Deployment produksi dengan Docker: `docker-production.md`.

## Isi

| Service | Image | Port host | Isi |
|---|---|---|---|
| `mysql` | `mysql:8.4.11` | `127.0.0.1:3307` | Didefinisikan **hanya** di `backend/docker/mysql/compose.yaml` dan disertakan apa adanya (`include`). Container `solveit-mysql`, volume `solveit-mysql-data` |
| `backend` | `infra/docker/backend/Dockerfile`, target `dev` (PHP 8.5.11 FPM image, Composer 2.10) | `127.0.0.1:8000` | `php artisan serve`; kode di-bind-mount dari `backend/`, `vendor/` di volume `backend-vendor` |
| `frontend` | `infra/docker/frontend/Dockerfile`, target `dev` (Node 22.23.1) | `127.0.0.1:5173` | Server Vite dengan hot reload; kode di-bind-mount dari `frontend/`, `node_modules/` di volume `frontend-node-modules` |

Semua port hanya di loopback. Port host dapat diubah lewat `SOLVEIT_BACKEND_PORT` dan `SOLVEIT_FRONTEND_PORT` (misalnya bila `php artisan serve` native sudah memakai 8000). MySQL hidup lagi bersama Docker (`restart: unless-stopped` dari file aslinya); `backend` dan `frontend` tidak, sehingga port 8000 dan 5173 hanya terpakai setelah `up`.

### Keputusan desain: satu definisi MySQL

`infra/docker/compose.dev.yaml` memakai nama proyek Compose `solveit-indonesia`, sama dengan `backend/docker/mysql/compose.yaml`, dan menyertakan file itu dengan `include`. Akibatnya:

- Hanya ada satu MySQL lokal. Container `solveit-mysql` yang sudah ada (milik alur native) diakui sebagai service `mysql` proyek ini dan **tidak dibuat ulang**: hash konfigurasinya identik (`docker compose ... config --hash mysql` sama untuk kedua file, dan sama dengan label container; diperiksa juga di CI). Data di `solveit-mysql-data` dipakai bersama.
- Laravel di container memakai `mysql:3306` (DNS service dan port internal), alur native memakai `127.0.0.1:3307`. Hanya `DB_HOST` dan `DB_PORT` yang di-override di container; nama pengguna dan kata sandi tetap dibaca dari `backend/.env` dan `backend/.env.testing` yang sama.
- Tradeoff: kedua file berbagi proyek Compose. `docker compose up` dari `backend/docker/mysql/` mencetak peringatan "orphan containers" untuk `backend` dan `frontend`; itu wajar. Jangan menambahkan `--remove-orphans` di sana. `docker compose ... down` dari salah satu file juga menghapus container `solveit-mysql` (datanya tetap di volume); untuk berhenti sehari-hari pakai `stop`.
- Alternatif yang ditolak: MySQL kedua untuk Docker (dua server, data terpisah, bentrok port), atau jaringan eksternal (dua perintah start dan nama jaringan yang harus dibuat manual).

## Prasyarat

- Docker Desktop (Windows, macOS) atau Docker Engine dengan plugin Compose (Linux). Compose **2.20 atau lebih baru** (`docker compose version`), karena `include`.
- Git, dan bash untuk script setup (Git Bash di Windows).
- Tidak perlu PHP, Composer, Node, npm, atau MySQL di host.
- Linux dengan UID bukan 1000: `export SOLVEIT_UID=$(id -u) SOLVEIT_GID=$(id -g)` sebelum setup, agar container dapat menulis ke folder yang di-bind-mount.

## Setup pertama

Dari root repository:

```bash
bash infra/docker/scripts/setup-dev.sh
```

Script ini aman dijalankan ulang dan hanya membuat yang belum ada; ia tidak menimpa, tidak menghapus, dan tidak mencetak rahasia:

1. Kata sandi acak MySQL di `backend/docker/mysql/secrets/` (diabaikan Git), bila belum ada.
2. `backend/.env` dari `backend/.env.example` dengan `APP_KEY` baru dan kata sandi pengembangan, dan `backend/.env.testing` untuk database tes, bila belum ada. File yang sudah ada tidak diubah.
3. Build image, start MySQL (container yang sudah ada dipakai ulang), backend, dan frontend. Start pertama memasang dependensi Composer dan npm dari lock file ke volume masing-masing.
4. `php artisan migrate` pada database pengembangan `solveit_indonesia` (hanya menambah tabel atau kolom).

Lalu buka `http://localhost:5173` (website) dan `http://localhost:8000/up` (API). Kanal **Kirim melalui website** tetap nonaktif; untuk mencobanya, ikuti langkah build varian di `development-guide.md` bagian Backend.

Bila volume MySQL sudah pernah dibuat dengan kata sandi lain (misalnya secret dihapus lalu dibuat ulang), pengguna MySQL tidak cocok lagi dengan secret. Jalankan ulang provisioning (menyamakan kata sandi kedua pengguna dengan secret, data tetap): `docker exec solveit-mysql bash -c 'bash /docker-entrypoint-initdb.d/10-solveit-databases.sh'`.

## Perintah harian

Semua dari root repository. Untuk mempersingkat, `export COMPOSE_FILE=infra/docker/compose.dev.yaml` lalu cukup `docker compose ...`.

| Tugas | Perintah |
|---|---|
| Menyalakan | `docker compose -f infra/docker/compose.dev.yaml up -d` |
| Status dan health | `docker compose -f infra/docker/compose.dev.yaml ps` |
| Log | `docker compose -f infra/docker/compose.dev.yaml logs -f backend frontend` |
| Menghentikan (container tetap, data tetap) | `docker compose -f infra/docker/compose.dev.yaml stop` |
| Restart | `docker compose -f infra/docker/compose.dev.yaml restart backend frontend` |
| Artisan | `docker compose -f infra/docker/compose.dev.yaml exec backend php artisan <perintah>` |
| Migrasi | `docker compose -f infra/docker/compose.dev.yaml exec backend php artisan migrate` |
| Tes backend (database `solveit_indonesia_testing`, TestDatabaseGuard aktif) | `docker compose -f infra/docker/compose.dev.yaml exec backend php artisan test` |
| Pint | `docker compose -f infra/docker/compose.dev.yaml exec backend vendor/bin/pint --test` |
| Tes, lint, typecheck frontend | `docker compose -f infra/docker/compose.dev.yaml exec frontend npm test` (juga `npm run lint`, `npm run typecheck`, `npm run build`) |
| Memperbarui dependensi setelah `composer.lock` atau `package-lock.json` berubah | `... exec backend composer install` dan `... exec frontend npm ci` |
| Build ulang image (setelah Dockerfile berubah) | `docker compose -f infra/docker/compose.dev.yaml up -d --build backend frontend` |
| Mengosongkan dependensi container saja | `docker compose -f infra/docker/compose.dev.yaml rm -sf backend frontend` lalu `docker volume rm solveit-indonesia_backend-vendor solveit-indonesia_frontend-node-modules` |

Jangan pernah `docker compose ... down -v` dan jangan `docker volume rm solveit-mysql-data`: keduanya menghapus database lokal. Tes hanya memakai database sekali pakai `solveit_indonesia_testing`; untuk mengosongkannya cukup jalankan tes (`RefreshDatabase`), tidak perlu menyentuh volume.

### Yang tidak berjalan di container

- **Playwright e2e** butuh browser yang tidak ada di image Node slim. Jalankan di host (`npm run test:e2e`) atau biarkan **Frontend CI** dan **Cross-browser QA** yang menjalankannya.
- **Laravel Boost MCP** dijalankan agent di host (`php backend/artisan boost:mcp`, `.mcp.json`). Kontributor tanpa PHP di host dapat mendaftarkan server MCP lokal (tidak di-commit) dengan perintah `docker compose -f infra/docker/compose.dev.yaml exec -T backend php artisan boost:mcp`; belum diverifikasi oleh tim.

## Hot reload

- Frontend: Vite di container. Docker Desktop tidak meneruskan event perubahan file dari folder Windows ke container (diverifikasi: `fs.watch` di container tidak menerima event), jadi `compose.dev.yaml` menyetel `SOLVEIT_WATCH_POLLING=true` dan `frontend/vite.config.ts` lalu memakai polling (300 ms). Diverifikasi: perubahan CSS di host sampai ke browser sebagai HMR dalam sekitar 3 detik. Di Linux dan macOS, `SOLVEIT_WATCH_POLLING=false` menghemat CPU.
- Backend: `php artisan serve` membaca file PHP pada setiap request; perubahan kode langsung berlaku. Perubahan `.env` butuh `restart backend`.

## Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| `include` tidak dikenal, atau `service "mysql" ... not found` | Compose lebih lama dari 2.20. Perbarui Docker Desktop |
| `Bind for 127.0.0.1:8000 failed: port is already allocated` | `php artisan serve` native atau proyek lain memakai port itu. `SOLVEIT_BACKEND_PORT=8001 docker compose ... up -d` (atau `SOLVEIT_FRONTEND_PORT` untuk 5173). Jangan menghentikan layanan proyek lain |
| Port 3307 dipakai | Lihat `backend/README.md` (Masalah umum) |
| `backend` berhenti dengan "backend/.env is missing" | Jalankan `infra/docker/scripts/setup-dev.sh` |
| `SQLSTATE[HY000] [1045]` di container | Kata sandi di `.env` atau `.env.testing` tidak sama dengan secret MySQL. Jalankan ulang provisioning (Setup pertama) atau samakan nilainya |
| `SQLSTATE[HY000] [2002]` | MySQL belum `healthy`: `docker compose ... ps`, `docker compose ... logs mysql` |
| Tes berhenti dengan pesan TestDatabaseGuard | Lihat tabel pemecahan masalah di `development-guide.md`; jangan melemahkan pengaman |
| `EACCES` atau "Permission denied" di `storage/`, `bootstrap/cache/`, atau `frontend/` (Linux) | UID container tidak sama dengan pemilik folder. `SOLVEIT_UID=$(id -u) SOLVEIT_GID=$(id -g) docker compose ... up -d --build` |
| Perubahan frontend tidak muncul | `SOLVEIT_WATCH_POLLING` harus `true` di Windows; `docker compose ... logs frontend` |
| Start pertama lama | Composer dan npm memasang dependensi ke volume (sekali). Ikuti `logs -f` |
| Build image gagal mengunduh | Jaringan atau Docker Hub. Ulangi `docker compose ... build`; image dasar dikunci ke tag patch (`php:8.5.11-fpm-bookworm`, `node:22.23.1-bookworm-slim`) |
