# Admin API: identitas dan sesi (B3.1a)

Kontrak endpoint `/api/v1/admin` yang dibangun pada B3.1a: aktivasi akun lewat tautan akses, masuk dengan kata sandi dan TOTP, serta keamanan akun sendiri. Status: **dibangun dan dites, belum di-deploy**. Belum ada aplikasi admin yang memanggilnya (B3.2). Administrasi pengguna dan pembacaan audit oleh owner (B3.1b) punya kontrak sendiri: `admin-users.md`. Arsitektur dan keputusan: `docs/architecture/admin-dashboard.md` bagian 3.

Implementasi: `backend/routes/admin.php` (route dan tingkatnya), `bootstrap/app.php` (grup middleware `admin`), `app/Http/Controllers/Api/V1/Admin/`, `app/Actions/Admin/`, `app/Http/Middleware/{AdminRequestBoundary,AdminPreventRequestForgery,EnsureAdminGuest,EnsureAdminAccountActive,EnforceAdminSessionLifetime,EnsureLoginChallengeIsValid}.php`, `config/admin.php`, `config/session.php`, `config/fortify.php`. Tes: `backend/tests/Feature/Admin/`.

## Konvensi

- **Satu origin.** Aplikasi admin dan API-nya disajikan dari origin yang sama, `ADMIN_URL` (`config/admin.php`). Request untuk host lain mendapat `404 {"message":"Not Found."}` tanpa sesi. Request dengan `Origin` lain, `Origin: null`, atau `Sec-Fetch-Site` `same-site`/`cross-site` mendapat `403 {"message":"Cross-origin requests to the admin API are not allowed."}`. Setiap request selain `GET`/`HEAD`/`OPTIONS` wajib membawa `Origin` yang sama dengan `ADMIN_URL`. Tidak ada CORS untuk path admin (CORS hanya untuk `api/v1/inquiries`).
- **Sesi cookie.** Sesi database (driver `database` ditetapkan di `config/session.php`, bukan dari `SESSION_DRIVER`; bila driver lain aktif saat runtime, setiap request admin mendapat `503 {"message":"The admin API is unavailable."}` tanpa sesi, karena pencabutan sesi tidak akan bekerja), cookie host-only `HttpOnly`, `SameSite=Strict`, `Path=/`, kedaluwarsa saat browser ditutup; dengan `ADMIN_URL` https juga `Secure` dan bernama `__Host-solveit-admin-session` (HTTP lokal: `solveit-admin-session`). Tidak ada token di `localStorage`, tidak ada token API, tidak ada "remember me".
- **CSRF.** Ambil `GET auth/csrf-cookie` dulu. Setiap penulisan mengirim header `X-XSRF-TOKEN` berisi nilai cookie `XSRF-TOKEN` (yang di-URL-decode), atau dikirim browser dengan `Sec-Fetch-Site: same-origin`. Tanpa keduanya: `419 {"message":"CSRF token mismatch."}`. Klien yang menerima `419` mengambil ulang `auth/csrf-cookie` **sekali** lalu mengulang request itu: cookie sesi yang sudah kedaluwarsa (idle 30 menit) kadang kehilangan barisnya ke garbage collector sesi Laravel sebelum sesi baru tersimpan (B3.1b, `docs/qa/qa-report.md`). Konsol admin (`admin/`) mengulang otomatis hanya langkah autentikasi yang tidak mengubah keadaan akun (`login`, `two-factor-challenge`, `confirm-password`, `logout`, `access-links/inspect`); penulisan lain menunggu konfirmasi orangnya (`admin/README.md`, aturan 419).
- **Format.** JSON. Respons berisi data dibungkus `data`. Galat `{"message": "..."}`, galat validasi menambah `errors` (format Laravel). Semua respons `Cache-Control: no-store, private`.
- **Tanpa sesi atau sesi berakhir:** `401 {"message":"Unauthenticated."}` (idle 30 menit, batas absolut 12 jam, keluar, dicabut, atau akun tidak lagi boleh masuk). Klien kembali ke layar masuk.
- **Batas laju:** `429` dengan `Retry-After` (limiter di `docs/architecture/admin-dashboard.md` 3.4).

## Tingkat route

| Tingkat | Route | Syarat |
|---|---|---|
| Publik, autentikasi | `GET auth/csrf-cookie`, `POST auth/login`, `POST auth/two-factor-challenge` | Tanpa akun; login dan tantangan hanya tanpa sesi masuk (`409` bila sudah masuk) |
| Pra-aktivasi | `POST access-links/inspect`, `POST access-links/redeem`, `POST access-links/confirm` | Tanpa akun, tanpa izin; sesi masuk ditolak (`409`) |
| Terautentikasi | Semua route lain | Masuk dengan kata sandi dan TOTP, akun aktif, dalam batas absolut, dan izin route itu: `account.manage-own` untuk route di dokumen ini, izin owner untuk route di `admin-users.md` (B3.1b) |

Path di bawah relatif terhadap `/api/v1/admin/`.

## Publik, autentikasi

### `GET auth/csrf-cookie`

`204`. Memulai sesi anonim dan memasang cookie sesi dan `XSRF-TOKEN`.

### `POST auth/login`

```json
{ "email": "owner@example.com", "password": "..." }
```

- `200 {"two_factor": true}`: kata sandi benar dan akun boleh masuk. Belum masuk; lanjutkan ke tantangan dalam 5 menit.
- `422`: `{"message":"These credentials do not match our records.","errors":{"email":["These credentials do not match our records."]}}`, sama untuk kata sandi salah, alamat yang tidak ada, akun belum aktif, ditangguhkan, tanpa peran, atau tanpa autentikator terkonfirmasi. Field yang hilang memakai pesan validasi biasa.
- Field `remember` diabaikan.

### `POST auth/two-factor-challenge`

```json
{ "code": "123456" }
```

atau `{ "recovery_code": "xxxxxxxxxx-xxxxxxxxxx" }`.

- `204`: masuk; ID sesi diganti. Kode TOTP yang sudah pernah dipakai ditolak; kode pemulihan habis setelah dipakai.
- `422` dengan `errors.code` atau `errors.recovery_code`: kode salah, atau `The sign-in attempt has expired. Sign in again.` (lebih dari 5 menit, tanpa langkah kata sandi, atau akun berubah status di antaranya).

## Pra-aktivasi

Tautan akses berbentuk `ADMIN_URL/access#token=<43 karakter base64url>`. Aplikasi admin membaca token dari fragmen dan mengirimnya di body; token tidak pernah ada di path atau query. Semua kegagalan tautan (tidak dikenal, kedaluwarsa, sudah dipakai, dicabut, akun tidak cocok) mendapat jawaban yang sama: `404 {"message":"This access link is invalid or has expired."}`.

### `POST access-links/inspect`

```json
{ "token": "..." }
```

`200`, tidak memakai tautan:

```json
{ "data": { "purpose": "activation", "email": "o***@example.com", "requires_name": true, "expires_at": "2026-10-16T06:00:00+00:00" } }
```

`purpose`: `activation` (akun baru) atau `credential-reset` (kata sandi dan autentikator diganti).

### `POST access-links/redeem`

```json
{ "token": "...", "name": "Nama Owner", "password": "...", "password_confirmation": "..." }
```

`name` wajib hanya untuk `activation` (maks. 120). Kata sandi minimal 12 karakter, maksimal 72 byte, dikonfirmasi. Validasi yang gagal tidak memakai tautan.

`200`, tautan terpakai, akun **belum** dapat masuk:

```json
{ "data": { "two_factor": { "qr_code_svg": "<svg ...>", "setup_key": "32 karakter base32" }, "confirm_before": "2026-10-16T05:45:00+00:00" } }
```

Tampilkan QR sebagai `<img src="data:image/svg+xml,...">`. Rahasia hanya ada di respons ini.

### `POST access-links/confirm`

```json
{ "code": "123456" }
```

Harus dari browser (sesi) yang menebus, dalam 15 menit.

- `200`: akun aktif (atau dipulihkan), masuk, semua sesi lain akun itu berakhir. Kode pemulihan hanya ditampilkan di sini:

```json
{ "data": { "recovery_codes": ["...", "..."], "account": { "...": "seperti GET me" } } }
```

- `422 errors.code`: kode salah; tidak ada yang berubah.
- `404`: tidak ada pendaftaran tertunda di sesi ini, kedaluwarsa, atau tautan dicabut.

## Terautentikasi

### `GET me`

```json
{
  "data": {
    "id": 1,
    "name": "Nama Owner",
    "email": "owner@example.com",
    "role": "owner",
    "permissions": ["account.manage-own", "users.view", "users.invite", "users.change-role", "users.suspend", "users.reset-credentials", "audit.view-all"],
    "two_factor": { "confirmed_at": "2026-10-16T05:31:00+00:00", "recovery_codes_remaining": 8 },
    "session": { "signed_in_at": "2026-10-16T05:31:00+00:00", "absolute_expires_at": "2026-10-16T17:31:00+00:00", "idle_timeout_minutes": 30 }
  }
}
```

`permissions` untuk `owner` seperti di atas (sejak B3.1b); untuk `admin` hanya `["account.manage-own"]`.

### `POST auth/logout`

`204`. Sesi dibuang dan token CSRF diganti.

### `POST auth/confirm-password`

`{ "password": "..." }` → `201`; berlaku 15 menit untuk route yang membutuhkan konfirmasi. Salah: `422`. Batas: 5 per menit per akun.

### `PUT me/password`

```json
{ "current_password": "...", "password": "...", "password_confirmation": "..." }
```

`200 {"data":{"other_sessions_ended": 1}}`. Sesi lain berakhir, sesi ini lanjut dengan ID baru. `422` untuk kata sandi sekarang yang salah, kata sandi baru yang lemah, lebih dari 72 byte, atau sama dengan yang lama.

### `POST me/two-factor-recovery-codes`

Butuh konfirmasi kata sandi terbaru, selain itu `423 {"message":"Password confirmation required."}`. `200 {"data":{"recovery_codes":[8 kode]}}`; kode lama tidak berlaku lagi.

### `GET me/sessions`

```json
{ "data": [ { "id": "32 hex", "current": true, "ip_address": "203.0.113.5", "user_agent": "...", "last_active_at": "2026-10-16T05:40:00+00:00" } ] }
```

`id` adalah handle HMAC, bukan ID sesi.

### `DELETE me/sessions/{id}`

`204`. Sesi saat ini tidak dapat diakhiri lewat sini (`422`, gunakan keluar). Handle yang tidak dikenal atau milik akun lain: `404`.

### `DELETE me/sessions`

`200 {"data":{"other_sessions_ended": n}}`: semua sesi lain berakhir.

## Shell server (bukan HTTP)

| Perintah | Fungsi |
|---|---|
| `php artisan admin:bootstrap-owner <email>` | Owner pertama dan tautan aktivasi 30 menit; ditolak bila sudah ada owner aktif. Di production: konfirmasi di terminal, atau `--force` (tanpa terminal wajib `--force`) |
| `php artisan admin:reset-credentials <email>` | Pemulihan darurat: hapus autentikator, akhiri semua sesi, tautan reset 30 menit. Tidak butuh owner aktif; reset oleh owner lewat API (24 jam) ada di `admin-users.md` |

Tautan dicetak sekali ke terminal operator, tidak disimpan, tidak di-log. Serahkan lewat kanal tepercaya. Di Docker produksi: `docker compose ... exec backend php artisan admin:bootstrap-owner <email>`. Belum ada akun produksi; bootstrap produksi menunggu deployment dan keputusan pemilik.

## Yang tidak ada

Registrasi, reset kata sandi lewat email, verifikasi email, mematikan 2FA, passkey, token API pribadi, route Fortify bawaan (`/login`, `/register`, `/user/...`), dan `/sanctum/csrf-cookie`. Semua mengembalikan `404`.
