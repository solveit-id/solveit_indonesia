# API Website Solveit Indonesia

Referensi endpoint backend Laravel milik website ini (`backend/`). Hanya kontrak yang benar-benar dibangun dan dites yang ditulis di sini; rencana endpoint lain ada di `docs/architecture/integration-plan.md`.

Status: **dibangun dan dites secara lokal dan di CI (B1, idempotensi B2.1, identitas admin B3.1a, administrasi pengguna dan audit B3.1b), belum di-deploy.** Klien frontend (B2) ada di balik flag `VITE_INQUIRY_API_ENABLED` yang nonaktif secara default, sehingga website publik belum memanggil API. Domain, hosting, dan URL produksi belum ditentukan.

## Endpoint

| Method | Path | Fungsi | Dokumen |
|---|---|---|---|
| `POST` | `/api/v1/inquiries` | Menyimpan permintaan konsultasi dari formulir website | [inquiries.md](inquiries.md) |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/v1/admin/...` | API admin website (B3.1a): aktivasi lewat tautan akses, masuk dengan kata sandi dan TOTP, sesi dan keamanan akun sendiri. Hanya untuk aplikasi admin di origin `ADMIN_URL`; tidak disajikan di listener publik | [admin-auth.md](admin-auth.md) |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/v1/admin/users`, `invitations`, `audit-events` | Khusus owner (B3.1b): daftar dan detail akun, undangan (tautan ditampilkan sekali, tanpa email), perubahan peran, penangguhan, reset kredensial, pembacaan audit log. Batas dan konvensi sama dengan API admin | [admin-users.md](admin-users.md) |
| `GET` | `/up` | Pemeriksaan kesehatan untuk monitor uptime: `{"status":"ok"}` (200) atau `{"status":"down"}` (503) | Bagian di bawah |

Tidak ada endpoint publik lain. Tidak ada endpoint untuk membaca, mengubah, atau menghapus inquiry: data itu berisi data pribadi dan baru akan dibuka untuk admin website yang terautentikasi pada B4. Konvensi di bawah berlaku untuk API publik; API admin punya konvensinya sendiri (sesi, CSRF, satu origin) di `admin-auth.md`.

## Konvensi bersama

- **Prefiks dan versi.** Laravel menambahkan `/api` ke semua route di `backend/routes/api.php`; file itu mengelompokkan route di bawah `v1`. Perubahan yang memutus kontrak membuat versi baru (`/api/v2/...`), bukan mengubah `v1`.
- **Format.** Permintaan dan respons JSON (`Content-Type: application/json`, `Accept: application/json`). Respons galat di bawah `/api/*` selalu JSON, apa pun header `Accept`.
- **Galat.** Semua respons galat berbentuk `{"message": "..."}`; galat validasi menambahkan `errors`. Dengan `APP_DEBUG=false` (wajib di luar pengembangan lokal) tidak ada trace, nama file, atau pesan exception internal di respons.

| Status | Arti | Isi |
|---|---|---|
| `201` | Tersimpan, atau percobaan ulang idempoten yang dijawab dari data tersimpan (header `Idempotent-Replayed: true`) | Bentuk per endpoint |
| `400` | Header permintaan tidak valid (misalnya `Idempotency-Key`) | `{"message": "..."}` |
| `404` | Path tidak ada | `{"message": "..."}` |
| `405` | Method tidak didukung di path itu | `{"message": "..."}` |
| `409` | `Idempotency-Key` sudah dipakai untuk isi lain | `{"message": "..."}` |
| `413` | Body melebihi batas | `{"message": "The request body is too large."}` |
| `422` | Validasi gagal | `{"message": "...", "errors": {"field": ["..."]}}` (format validasi Laravel) |
| `429` | Batas laju terlampaui | `{"message": "Too Many Attempts."}` dan header `Retry-After` |
| `500` | Galat tak terduga | `{"message": "Server Error"}` |
| `503` | Penyimpanan gagal atau layanan tidak sehat | `{"message": "..."}` atau `{"status": "down"}` |

- **CORS.** Hanya origin di `CORS_ALLOWED_ORIGINS` (daftar dipisah koma, skema, host, dan port persis) yang boleh memanggil `/api/v1/inquiries` dari browser (sejak B3.1a `paths` hanya endpoint itu, sehingga path admin tidak pernah menjawab preflight). Kosong berarti tidak ada akses lintas origin. Tanpa cookie (`supports_credentials: false`). Header yang diizinkan: `Accept`, `Content-Type`, `Idempotency-Key`, `X-Requested-With`. Header yang dapat dibaca frontend: `Idempotent-Replayed`, `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`. Origin produksi ditambahkan setelah domain diputuskan; jangan memakai `*`.
- **Alamat klien.** Batas laju dihitung per alamat IP. Di belakang load balancer atau CDN, isi `TRUSTED_PROXIES` dengan alamat proxy itu; tanpa itu header `X-Forwarded-For` diabaikan (dites: header palsu tidak bisa melewati batas laju).
- **Autentikasi.** Endpoint publik tidak memakai autentikasi dan tidak pernah memulai sesi atau memasang cookie (dites). Admin website memakai sesi cookie Laravel dengan TOTP wajib di `/api/v1/admin` (B3.1a, tanpa Sanctum; `admin-auth.md`). Autentikasi klien bukan tanggung jawab backend ini.

## `GET /up`

Pengganti halaman HTML `/up` bawaan Laravel, sehingga respons tidak menyebut framework, versi, atau environment. Route ini berada di luar grup `web`, jadi tidak membuat sesi, cookie, atau baris database per pemeriksaan. Pemeriksaan tambahan (misalnya koneksi database) dapat dipasang sebagai listener `Illuminate\Foundation\Events\DiagnosingHealth` yang melempar exception saat tidak sehat; responsnya menjadi 503 tanpa detail.
