# Dashboard Admin Website

Status (2026-10-19): **B3.1a, B3.1b, B3.2a, B3.2b, B3.2c, dan B3.2d dirilis ke `main` (PR #33 `ffe07fc`, PR #35 `4874c73`, PR #38 `15b131a`, PR #41 `02f3859`, PR #43 `c0ecde9`, PR #45 `eb31fae`), belum di-deploy. B3.2d (image produksi konsol dan listener admin privat, bagian 10) divalidasi dengan data sintetis dan sertifikat uji sekali pakai. B4a (API pengelolaan inquiry, `docs/api/admin-inquiries.md`) dirilis ke `main` (PR #47, `58cead5`), belum di-deploy. B4b (antarmuka inquiry di konsol, bagian 7) dirilis ke `main` (PR #48, rilis PR #49, `11b0a7d`), belum di-deploy.** Fondasi identitas backend (akun, aktivasi lewat tautan sekali pakai, TOTP wajib, sesi, peran `owner` dan `admin`, audit log) ada di `backend/` di bawah `/api/v1/admin`, kontraknya di `docs/api/admin-auth.md`. Administrasi pengguna dan pembacaan audit oleh owner (B3.1b): `docs/api/admin-users.md`. Konsol admin: `admin/README.md`. **Belum ada:** deployment admin (menunggu keputusan di bagian 10), ekspor dan penghapusan inquiry (menunggu keputusan privasi), analitik, konten. Tidak ada akun produksi, listener admin yang terbuka, hostname admin, sertifikat, atau domain. Keputusan yang masih milik pemilik ditandai **Owner decision required**.

Terkait: `docs/api/admin-auth.md` (kontrak B3.1a), `visitor-analytics.md` (data analitik yang ditampilkan dashboard), `github-integration.md` (integrasi yang dimiliki sistem lain), `integration-plan.md` (batas antarsistem), `docs/api/inquiries.md` (data inquiry dan privasi).

## 1. Tujuan dan batas

Dashboard dipakai founder dan anggota tim yang diberi izin untuk mengelola **website** Solveit Indonesia.

| Termasuk (milik website ini) | Tidak termasuk (milik Solveit OpsHub atau sistem ekosistem lain) |
|---|---|
| Autentikasi dan peran admin website | Akun klien, portal klien |
| Ringkasan KPI website | Proyek, milestone, revisi, tiket klien |
| Pengelolaan inquiry (baca, status, catatan, ekspor terkendali) | Proposal, kontrak, invoice, pembayaran |
| Analitik pengunjung first-party | Orkestrasi GitHub, repository klien (`github-integration.md`) |
| Konten dan portofolio website | Data operasional internal |
| Audit log tindakan admin | |
| Pengaturan website yang dibatasi peran | |
| Titik masuk (tautan, status baca-saja lewat API berversi) ke produk Solveit lain | Membaca database produk lain |

Backend admin tetap bagian dari `backend/` (Laravel), memakai database MySQL website. Data sistem lain hanya didapat lewat API atau event berversi, tidak lewat database bersama. Autentikasi admin tidak bergantung pada database atau implementasi autentikasi Solveit OpsHub.

## 2. Arsitektur frontend admin

Syarat yang tidak boleh dilanggar:

- Halaman publik tetap prerender statis dan performanya tidak turun (baseline putaran 6: Lighthouse mobile 96 sampai 99).
- Tidak ada data privat admin di HTML yang di-prerender, di bundle publik, atau di cache CDN.
- Kode admin tidak masuk chunk yang dimuat halaman publik.

| Opsi | Cara | Kelebihan | Kekurangan |
|---|---|---|---|
| A. Route `/admin/*` di app `frontend/` | Route client-only (`clientLoader`, tidak masuk daftar `prerender`), chunk terpisah, `noindex` | Satu toolchain, token desain langsung dipakai | Hosting statis harus menyajikan shell SPA untuk `/admin/*`; pemisahan bundle bergantung disiplin; CSP dan cache publik dan admin bercampur; rilis admin ikut siklus website |
| B. App terpisah `admin/` di repository ini, disajikan di subdomain (misalnya `admin.<domain>`) | Vite + React + TypeScript SPA sendiri; token desain diambil dari satu sumber bersama | Isolasi paling kuat (bundle, CSP, cache, deploy), tidak mungkin bocor ke prerender publik, cookie sesi dapat dibatasi ke host admin | Satu app lagi untuk dirawat; token desain harus dibagi tanpa salinan (paket atau file bersama) |
| C. Panel server-side Laravel (Blade, Livewire, atau Filament) | Dirender `backend/` | Cepat dibangun, satu stack auth | Menambah stack UI kedua; tampilan generik (Filament) bertentangan dengan arah desain; tidak memakai komponen website |

**Arah yang dipakai: opsi B** (B3.0). Backend B3.1a sudah mengasumsikannya: API admin hanya menjawab origin admin yang sama (`ADMIN_URL`), dengan cookie host-only. Rencana B3.2: React Router dalam mode data (bukan framework mode, yang menyisipkan skrip inline dan mempersulit CSP ketat), proxy `/api` dari server dev Vite ke Laravel agar tetap satu origin, token desain dibagi dari `frontend/` tanpa salinan. Halaman admin wajib memakai `Referrer-Policy: same-origin` (bukan `no-referrer`: dengan itu browser mengirim `Origin: null` pada POST, yang ditolak API). **Diputuskan pemilik untuk B3.2a (2026-10-16):** folder `admin/` dan branch `admin` (alur `admin` ke `staging` ke `main`), URL lokal `http://127.0.0.1:5174` dengan proxy satu origin, bahasa Indonesia sebagai default dengan arsitektur siap Inggris, tema terang sebagai default dengan pilihan gelap (aturan website), listener admin produksi privat/loopback secara default, dan referensi komponen hanya di build pengembangan dan QA. **Owner decision required:** hostname admin produksi, TLS dan hosting, serta apakah listener admin terbuka ke internet atau dibatasi (allowlist IP atau VPN). Infrastrukturnya dibangun tanpa mengandaikan jawabannya (bagian 10).

## 3. Autentikasi (B3.1a, dibangun)

Keputusan pemilik yang berlaku: tanpa pendaftaran publik, bootstrap owner lewat CLI, tautan akses sekali pakai, TOTP wajib sebelum aktivasi untuk semua peran, idle 30 menit, batas absolut 12 jam, konfirmasi kata sandi 15 menit untuk tindakan sensitif, tanpa "remember me", hanya peran `owner` dan `admin`, tanpa SMTP. Kontrak lengkap: `docs/api/admin-auth.md`.

### 3.1 Pilihan teknis: guard sesi Laravel, tanpa Sanctum

Dievaluasi pada B3.1a dengan sumber paket yang terpasang:

| | Sanctum SPA (`EnsureFrontendRequestsAreStateful`) | **Guard `web` Laravel + grup middleware `admin` (dipilih)** |
|---|---|---|
| SameSite | Middleware Sanctum 4.3.3 menimpa `session.same_site` menjadi `lax` pada setiap request (`configureSecureCookieSessions()`), sehingga `Strict` tidak mungkin | `Strict` untuk cookie sesi dan `XSRF-TOKEN` |
| Penentuan "dari frontend sendiri" | Awalan string dari `Referer` atau `Origin` terhadap daftar `stateful` | Host persis dan `Origin` persis (`AdminRequestBoundary`), plus `Sec-Fetch-Site` |
| Token API | Tersedia (harus dimatikan) | Tidak ada sama sekali |
| Endpoint publik | Perlu kehati-hatian agar `statefulApi()` tidak menyentuh `/api/v1/inquiries` | Grup `admin` terpisah; `routes/api.php` tetap tanpa sesi |
| Paket | Satu paket lagi | Tidak ada |

Karena admin dan API-nya satu origin di sisi browser, Sanctum tidak menambah apa pun dan justru melemahkan SameSite. **Laravel Fortify 1.41 (headless)** dipakai sebagai pustaka: pipeline login, tantangan TOTP, konfirmasi kata sandi, serta primitif TOTP dan kode pemulihan. Route Fortify sendiri tidak didaftarkan (`Fortify::ignoreRoutes()`); `routes/admin.php` hanya memetakan controller yang dibutuhkan. Registrasi, reset kata sandi mandiri, verifikasi email, pembaruan profil, mematikan 2FA, dan passkey tidak tersedia. Fortify menarik `laravel/passkeys` dan `web-auth/webauthn-lib` (beserta komponen Symfony 8.1 serializer, property-access, property-info, type-info) sebagai dependensi; passkey tidak diaktifkan dan routenya tidak terdaftar.

### 3.2 Alur

1. **Bootstrap owner** (`php artisan admin:bootstrap-owner <email>`, shell server): membuat akun `owner` yang belum aktif (kata sandi acak yang tidak diketahui) dan mencetak satu tautan aktivasi 30 menit. Ditolak bila sudah ada owner aktif, bila owner lain sedang menunggu aktivasi, atau bila alamatnya milik akun non-owner. Baris owner dikunci, jadi dua proses bersamaan tidak menghasilkan dua owner. Konfirmasi di production kecuali `--force`.
2. **Tautan akses**: token 256 bit (base64url, 43 karakter) di fragmen URL `ADMIN_URL/access#token=...`, sehingga tidak pernah sampai ke server, log proxy, atau header Referer. Database hanya menyimpan SHA-256-nya. Satu tautan hidup per akun (yang lama dicabut), sekali pakai, kedaluwarsa. Tujuan: `activation` dan `credential-reset`.
3. **Penebusan** (`access-links/inspect`, `redeem`, `confirm`): set kata sandi (dan nama, untuk aktivasi), rahasia TOTP baru 160 bit, delapan kode pemulihan; tautan ditandai ditebus. Sesi hanya menyimpan "pendaftaran tertunda" selama 15 menit dan **tidak memberi izin apa pun**: akun baru masuk setelah kode TOTP pertama dikonfirmasi, di browser yang sama. Kode pemulihan hanya ditampilkan di respons konfirmasi.
4. **Masuk**: kata sandi lalu TOTP (atau satu kode pemulihan). Akun tanpa peran, belum aktif, ditangguhkan, atau tanpa autentikator terkonfirmasi mendapat jawaban yang sama dengan kata sandi salah dan alamat yang tidak ada; setiap percobaan dibungkus `Timebox` (400 ms) dan alamat yang tidak ada dicek terhadap hash buangan. Kata sandi yang benar saja tidak pernah membuat sesi masuk. Tantangan TOTP berlaku 5 menit dan dibatalkan bila akun berubah status di antaranya. Kode TOTP yang sudah dipakai ditolak (cache Fortify per kode). Kode pemulihan dihapus setelah dipakai (Fortify menggantinya dengan kode baru yang tidak pernah dilihat orang; diubah di `User::replaceRecoveryCode`).
5. **Reset kredensial** (`php artisan admin:reset-credentials <email>`, tautan 30 menit; sejak B3.1b juga oleh owner lewat `POST users/{id}/credential-reset`, tautan 24 jam, dengan persetujuan eksplisit bahwa akun kehilangan akses): autentikator dan kode pemulihan dihapus, semua sesi berakhir seketika. Tautan yang hilang atau kedaluwarsa diganti dengan menerbitkan reset lagi; akun tetap terkunci sampai itu selesai. Penebusan mengganti kata sandi dan mendaftarkan autentikator baru; tidak ada jalan yang memulihkan akses dengan satu faktor.

### 3.3 Sesi, cookie, dan CSRF

| Aturan | Penerapan |
|---|---|
| Penyimpanan | Driver `database` (tabel `sessions`), payload terenkripsi, serialisasi JSON. Sejak B3.1b driver ditetapkan di config (bukan `SESSION_DRIVER`), dan `AdminRequestBoundary` menjawab `503` bila driver lain aktif saat runtime, karena pencabutan sesi akan diam-diam gagal |
| Cookie | Host-only (tanpa `Domain`), `Path=/`, `HttpOnly`, `SameSite=Strict`, kedaluwarsa saat browser ditutup. Dengan `ADMIN_URL` https: `Secure` dan nama `__Host-solveit-admin-session`; pada HTTP lokal: nama `solveit-admin-session` tanpa `Secure` |
| Idle | 30 menit, ditegakkan server lewat `last_activity` |
| Absolut | 12 jam sejak masuk (`EnforceAdminSessionLifetime`); sesi tanpa waktu masuk dianggap kedaluwarsa |
| Tindakan sensitif | `password.confirm`, berlaku 15 menit (`auth.password_timeout`) |
| Remember me | Selalu diabaikan |
| Regenerasi | ID sesi baru setelah masuk lengkap, setelah aktivasi, setelah ganti kata sandi |
| Pencabutan | Ganti kata sandi (sesi lain), reset kredensial, penangguhan, perubahan peran, keluar dari perangkat lain. Selain itu `EnsureAdminAccountActive` memeriksa ulang akun pada setiap request |
| CSRF | `AdminPreventRequestForgery`: `Sec-Fetch-Site: same-origin` dari browser, atau `X-XSRF-TOKEN` yang cocok dengan sesi; selain itu 419. Turunan `PreventRequestForgery` Laravel yang **tidak** melewati pemeriksaan saat unit test berjalan |
| Origin dan host | `AdminRequestBoundary` sebelum sesi dimulai: host lain 404, `Origin` lain atau `Sec-Fetch-Site` `same-site`/`cross-site` 403, setiap penulisan wajib membawa `Origin` admin |
| Cache | `Cache-Control: no-store, private` pada semua respons admin |

Kebijakan ini ditulis tetap di `config/session.php` dan `config/auth.php`, bukan dari environment, sehingga `.env` lama tidak dapat melemahkannya. Sesi hanya ada di grup `admin`; `POST /api/v1/inquiries` dan `/up` tetap tanpa sesi dan tanpa cookie (dites), dan CORS hanya berlaku untuk `api/v1/inquiries`.

### 3.4 Batas laju

| Limiter | Batas |
|---|---|
| `admin-login` | 5 per menit per alamat+IP, 20 per jam per IP. Tidak ada penguncian akun, jadi owner tidak dapat dikunci dengan sengaja |
| `admin-two-factor`, `admin-enrollment` | 5 per menit per sesi |
| `admin-access-link` | 10 per menit per IP |
| `admin-csrf` | 30 per menit per IP (setiap sesi anonim adalah satu baris tabel) |
| `admin-password-confirm` | 5 per menit per akun |
| `admin-account` | 120 per menit per akun |
| `admin-administration` | 20 per menit per akun, untuk penulisan owner B3.1b (undangan, pencabutan, peran, penangguhan, reset) |

## 4. Peran dan izin (RBAC)

Satu peran per pengguna (`users.role`, enum `AdminRole`), izin sempit (`AdminPermission`), satu Gate per izin; kemampuan yang tidak didefinisikan ditolak. Akun yang tidak boleh masuk tidak memegang izin apa pun. Tidak ada paket RBAC.

**Berlaku sekarang (B3.1a):** hanya `owner` dan `admin`.

| Izin | owner | admin | Fase |
|---|---|---|---|
| `account.manage-own` (profil, kata sandi, kode pemulihan, sesi sendiri) | Ya | Ya | B3.1a, dibangun |
| `users.view` (daftar dan detail akun dan undangan) | Ya | Tidak | B3.1b, dibangun |
| `users.invite` (undang, cabut undangan) | Ya | Tidak | B3.1b, dibangun |
| `users.change-role` | Ya | Tidak | B3.1b, dibangun |
| `users.suspend` (tangguhkan, aktifkan ulang) | Ya | Tidak | B3.1b, dibangun |
| `users.reset-credentials` | Ya | Tidak | B3.1b, dibangun |
| `audit.view-all` (seluruh audit log; keputusan pemilik: owner saja) | Ya | Tidak | B3.1b, dibangun |
| `inquiries.view` (daftar dan detail inquiry, kontak disamarkan, riwayat status, catatan) | Ya | Ya | B4a, dibangun |
| `inquiries.change-status` (alur status, compare and set) | Ya | Ya | B4a, dibangun |
| `inquiries.add-note` (catatan internal hanya-tambah) | Ya | Ya | B4a, dibangun |
| `inquiries.reveal-contact` (kontak lengkap, konfirmasi kata sandi, dicatat setiap kali) | Ya | Ya | B4a, dibangun |
| Ekspor inquiry, hapus inquiry (permintaan subjek data) | Ya | Tidak | Rencana; menunggu keputusan retensi dan prosedur (**Owner decision required**) |
| Kelola konten (`editor`), lihat analitik (`analyst`) | | | Nanti, bersama modulnya |

Invarian yang ditegakkan oleh setiap operasi owner (`InviteAdminAccount`, `RevokeAdminInvitation`, `ChangeAdminRole`, `SuspendAdminAccount`, `ResetAdminCredentials` lewat HTTP): hanya owner aktif yang bertindak, tidak ada yang mengubah peran, penangguhan, atau kredensial dirinya sendiri, dan owner aktif terakhir tidak dapat diturunkan atau ditangguhkan. **Owner aktif** berarti dapat masuk: aktif, tidak ditangguhkan, dan autentikator terkonfirmasi, sehingga owner yang sedang direset tidak dihitung. Setiap operasi mengunci baris owner aktif (`ActiveOwners::lockForActor`), memeriksa ulang pelaku di bawah kunci itu, dan mengulang transaksi bila InnoDB memutus deadlock (maksimal tiga kali). Sesi target berakhir seketika; penangguhan juga mencabut tautan yang masih terbuka. Diuji dengan proses PHP dan koneksi MySQL terpisah (`AdminAdministrationConcurrencyTest`), dan uji mutasi menunjukkan tes itu gagal tanpa kunci atau tanpa syarat autentikator terkonfirmasi. **Owner decision required:** siapa memegang peran apa dan berapa owner (disarankan dua orang berbeda bila memungkinkan; selain itu pemulihan darurat lewat `admin:reset-credentials` di shell server).

Setiap route admin masuk tepat satu tingkat (publik-autentikasi, pra-aktivasi, terautentikasi) dan `tests/Feature/Admin/AdminRouteCoverageTest.php` gagal untuk route baru yang belum diklasifikasikan atau tanpa perlindungan tingkatnya.

## 5. Modul

| Modul | Isi | Catatan |
|---|---|---|
| Ringkasan | KPI dari agregat analitik dan inquiry: kunjungan, halaman populer, inquiry per hari, konversi agregat | Hanya angka yang definisinya tertulis di `visitor-analytics.md`; tidak ada angka buatan. Sampai modul data ada, beranda B3.2 hanya menampilkan data akun yang nyata (peran, status MFA, sesi, kejadian keamanan sendiri) |
| Inquiry | Daftar dengan filter (status, layanan, tanggal, referensi), detail, riwayat status, catatan internal | API dibangun di B4a (`docs/api/admin-inquiries.md`): status `received`, `in-review`, `contacted`, `closed` dengan transisi tetap, kontak disamarkan, pembukaan kontak dicatat. Antarmuka konsol: B4b. Ekspor dan penghapusan menunggu keputusan privasi. Penerusan ke OpsHub lewat event `inquiry.received.v1` bila OpsHub siap |
| Analitik | Tren, sumber, halaman populer, pengunjung aktif (definisi di dokumen analitik) | Data agregat; tidak ada data per orang |
| Konten dan portofolio | Proyek, layanan, FAQ, testimoni berizin | Konten saat ini ada di `frontend/src/data/`. Memindahkannya ke API memerlukan build ulang situs statis setiap kali konten berubah (webhook build ke hosting), atau mengubah sebagian halaman menjadi data saat runtime. **Owner decision required** |
| Audit log | Siapa, kapan, tindakan, objek | Hanya-tambah (bagian 6.2); pembacaan khusus owner lewat `GET audit-events` (B3.1b, dibangun): cursor, filter yang diizinkan, tanpa ekspor |
| Pengaturan | Kanal kontak, flag fitur, origin CORS tidak termasuk (tetap di environment) | Dibatasi peran |
| Integrasi | Tautan dan status baca-saja produk Solveit lain | Lewat API berversi milik produk itu |

## 6. Backend admin

### 6.1 Struktur (B3.1a)

- Route di `routes/admin.php`, dimuat `bootstrap/app.php` di bawah `/api/v1/admin` (nama `api.v1.admin.*`) dengan grup middleware `admin`: `AdminRequestBoundary`, `EncryptCookies`, `AddQueuedCookiesToResponse`, `StartSession`, `AdminPreventRequestForgery`, `SubstituteBindings`. Route terautentikasi menambah `auth:web`, `auth.session`, `admin.active`, `admin.session-lifetime`, batas laju, dan `can:<izin>`; penulisan owner B3.1b menambah `throttle:admin-administration` dan `password.confirm` (setelah `can:`). Controller B3.1b: `UserController`, `InvitationController`, `AuditEventController`; akun dan undangan dicari setelah pemeriksaan izin, tanpa route model binding.
- Operasi di `app/Actions/Admin/`, sesi di `app/Services/AdminSessionStore.php` (ID sesi tidak pernah keluar dari server; API memakai handle HMAC), pencatatan kejadian autentikasi di `app/Listeners/RecordAdminAuthenticationEvents.php` (didaftarkan eksplisit), perintah di `app/Console/Commands/`.
- Migrasi (aditif): kolom TOTP Fortify dan `role`, `activated_at`, `suspended_at`, `last_login_at` pada `users`; tabel `admin_access_links`; tabel `admin_audit_events` dengan dua trigger. B3.1b: kolom tergenerasi `admin_access_links.open_for_user_id` dengan index `UNIQUE`, sehingga MySQL sendiri menolak tautan terbuka kedua untuk satu akun.
- `DatabaseSeeder` tidak membuat pengguna (dulu membuat `test@example.com` dengan kata sandi `password`; dites). Factory memakai kata sandi acak kecuali tes memintanya.
- **B4a (dibangun):** `InquiryController` dan `InquiryNoteController` di bawah izin `inquiries.*`; operasi di `app/Actions/Admin/{ChangeInquiryStatus,AddInquiryNote,RevealInquiryContact}.php`, masing-masing di dalam `DB::transaction(..., 3)` yang lebih dulu membaca ulang akun pelaku dengan kunci bersama (`InquiryHandler::lockFor`), sehingga penangguhan yang sudah commit menghentikan penulisan yang sedang berjalan. Cursor pagination di server, index `service` dan `created_at` (aditif; `status` dan `public_id` sudah ada), kontak disamarkan di semua respons, pembukaan kontak lengkap lewat `POST` dengan konfirmasi kata sandi dan batas laju sendiri, dicatat sebelum ditampilkan. Trigger MySQL menjaga field kiriman pengunjung (idempotensi B2.1) dan membuat riwayat serta catatan hanya-tambah; menghapus inquiry ikut menghapusnya (cascade, tanpa trigger). Masa simpan inquiry tetap **Owner decision required** (`docs/api/inquiries.md`): tidak ada ekspor, penghapusan, atau pemangkasan. Tidak ada endpoint publik baru untuk inquiry; aturan B1 tetap berlaku.

### 6.2 Audit log

Tabel `admin_audit_events`: `occurred_at`, `action`, `actor_type` (`user`, `cli`, `anonymous`), `actor_user_id`, `subject_type`, `subject_id`, `ip_address`, `user_agent` (dipotong), `metadata` JSON. Ditulis hanya oleh `RecordAdminAuditEvent`, yang menerima metadata dari daftar kunci yang diizinkan dengan nilai skalar saja. Tidak pernah disimpan atau di-log: kata sandi, kode TOTP, kode pemulihan, rahasia TOTP, token tautan, ID sesi, payload request, isi inquiry. Login gagal hanya menyimpan sidik jari HMAC dari alamat yang diketik. Kejadian: bootstrap (diterbitkan dan ditolak), reset kredensial diterbitkan dan selesai, tautan ditebus dan ditolak, aktivasi, pendaftaran MFA gagal, login berhasil dan gagal, tantangan MFA gagal, kode pemulihan dipakai dan dibuat ulang, kata sandi diganti, keluar, sesi dicabut, sesi kedaluwarsa, sesi diakhiri karena akun tidak aktif, perubahan peran, penangguhan, aktivasi ulang; sejak B3.1b juga undangan diterbitkan dan dicabut, dan reset kredensial oleh owner (aktor `user`); sejak B4a juga pembukaan kontak inquiry, perubahan status inquiry, dan catatan inquiry baru (subjek `inquiry`; metadata hanya status dan ID catatan, tidak pernah isi inquiry atau catatan). Owner membacanya lewat `GET audit-events`; metadata disaring lagi dengan daftar kunci yang sama saat dibaca.

**Tidak dapat diubah atau dihapus**: model menolak update dan delete, dan dua trigger MySQL (`BEFORE UPDATE`, `BEFORE DELETE`) menolak keduanya untuk setiap pengguna database, termasuk pengguna aplikasi (dites dan diperiksa di smoke test produksi). Membuat trigger dengan binary logging aktif (bawaan MySQL 8.4) tanpa SUPER butuh `log_bin_trust_function_creators = ON` di server (keputusan pemilik B3.1a). Skrip `initdb` pengembangan dan produksi serta Backend CI menyetelnya; MySQL lokal yang sudah ada disetel sekali dengan `SET PERSIST` (`backend/README.md`); MySQL terkelola menyetelnya sebagai parameter. Migrasi berhenti dengan pesan jelas bila setelan itu belum ada. Setelan itu berlaku untuk seluruh server MySQL, jadi menjadi prasyarat penyedia produksi (`backend/README.md`, Trigger audit).

**Batas jaminan:** trigger tidak melindungi dari pemegang hak DDL. Pengguna migrasi, root, atau DBA penyedia tetap dapat `DROP TRIGGER`, `DROP TABLE`, atau `TRUNCATE TABLE` (yang tidak menjalankan trigger). Pengguna aplikasi hanya punya hak DML, sehingga `TRUNCATE` darinya ditolak (diperiksa smoke test produksi sejak B3.1b). Audit log ini mencegah perubahan oleh aplikasi, bukan oleh administrator database.

**Retensi: menunggu keputusan pemilik.** Sampai diputuskan, tidak ada baris yang dapat dihapus dan tidak ada pemangkasan. Mekanisme yang direncanakan: migrasi yang ditinjau menggantikan trigger `DELETE` dengan versi yang hanya mengizinkan baris lebih tua dari masa simpan yang disetujui, ditambah satu perintah Artisan pemangkas yang dijalankan sadar. Alamat IP di audit adalah data pribadi; masa simpannya ikut keputusan ini (UU PDP). **Owner decision required.**

## 7. Desain

Mengikuti bahasa visual Solveit (`docs/DESIGN.md`, `docs/design/design-system.md`): token warna dan tipografi yang sama, satu aksen, kapsul untuk kontrol, sumbu 33 derajat sebagai detail, tanpa meniru layout halaman publik dan tanpa template dashboard generik.

**Dibangun di B3.2a** (arah "Precision Console" dari brief B3.2a; kontrak arah di `.impeccable/surfaces/admin-src-app.md`): rail navy (tinta malam di atas navy) di samping area kerja porselen mulai 1024 px, bar navy dengan menu di bawahnya; satu aksen cobalt untuk tindakan utama dan penanda aktif; kontrol kapsul; skala tipe rem tetap (Operate, bukan skala fluid website); tanda tangan berupa kapsul logo 33 derajat untuk status fase (penuh dirilis, separuh sedang dibangun, putus-putus direncanakan) pada satu tulang punggung. Token merek dibaca dari `frontend/src/styles/tokens.css` (`docs/project-structure.md` 7.1). Detail komponen: `docs/design/design-system.md`, Konsol admin.

**Dibangun di B3.2b** (dunia yang sama, tanpa identitas baru): layar tanpa akun (masuk, tautan akses, 404, galat sesi) memakai rail navy yang sama **tanpa navigasi dan tanpa akun**, karena belum ada yang boleh dilihat; navigasi Beranda, Akun, Keamanan dan kaki akun (nama, peran, Keluar) muncul hanya setelah `GET me` terverifikasi. Langkah alur (masuk dua langkah, aktivasi empat langkah) memakai tanda tangan konsol: kapsul logo 33 derajat penuh, separuh, dan putus-putus pada satu garis rambut. Pesan inline (`Notice`: info, berhasil, perhatian bergaris putus-putus, bahaya), dialog modal native untuk keputusan yang tidak boleh terlewat (akhiri sesi, kode pemulihan baru, konfirmasi kata sandi, peringatan idle sebagai `alertdialog`), fokus awal pada pilihan yang aman, Escape memilih pilihan aman, klik di luar tidak melakukan apa pun. Kode dan kunci memakai huruf monospace karena memang data (kunci TOTP per empat karakter, tidak pernah terpotong di tengah kelompok). QR berlatar putih di kedua tema agar terbaca kamera. Daftar fakta akun menyusun istilah dan nilai berdampingan hanya bila wadahnya cukup lebar (container query).

**Dibangun di B3.2c** (dunia yang sama; keputusan pemilik 2026-10-18: momen fokus "tanda merakit diri" dan paginasi "muat lebih banyak"): ruang kerja owner di bawah grup navigasi "Administrasi" yang hanya tampil bila `GET me` melaporkan izinnya (Pengguna, Undangan, Audit log). Daftar padat sebagai tabel mulai 768 px (header sentence case, garis rambut, angka tabular, tautan nama yang membentang di barisnya) dan kartu di bawahnya; filter di alamat sebagai kapsul segmen dan select native dengan sumur caret. Status akun, tautan, dan kejadian memakai kapsul 33 derajat yang sama dengan dua nada baru: berhenti (ditangguhkan, ditolak: merah pada tint lembutnya) dan berakhir (kedaluwarsa, dicabut: garis rambut kuat berongga), selalu disertai kata. Detail akun: ringkasan fakta, tautan terbuka (metadata saja), aktivitas audit terbaru pada tulang punggung yang sama dengan jalur fase, dan panel Tindakan yang lengket di samping mulai 1280 px; tindakan yang tidak berlaku diganti kalimat penjelasan, bukan tombol mati. Setiap penulisan lewat satu dialog yang isinya maju (keputusan, kata sandi bila `423`, keputusan kedua). Tautan undangan atau reset tampil sekali di panel bergaris kuat dengan nilai monospace, tombol salin, kalimat serah tangan, dan konfirmasi wajib. Audit log: kejadian pada satu tulang punggung per hari lokal dengan judul hari yang lengket, pelaku dan sasaran sebagai nama, metadata sebagai kapsul kata, detail teknis (ID, kode tindakan, IP, browser) di balik disclosure. Motion: GSAP lazy untuk kontinuitas (konten layar, kapsul navigasi yang berpindah, baris baru, langkah dialog, fakta yang berubah) dan satu momen fokus, tanda Solveit yang merakit diri dari empat kapsulnya saat tautan sekali tampil muncul. Standar lengkapnya untuk fase berikutnya: `docs/design/design-system.md`, Konsol admin, Motion.

**Dibangun di B4b** (dunia yang sama, tanpa pola baru; dasar provisional sampai tinjauan desain akhir pemilik): grup navigasi "Operasional" dengan Inquiry untuk akun yang memegang `inquiries.view` (kedua peran saat ini). Daftar inquiry sebagai tabel garis rambut atau kartu, filter status, layanan, tanggal diterima, dan referensi persis di alamat, tanpa kontak atau pesan. Detail: panel Kiriman (kontak samaran, pesan sebagai teks polos), panel Status lengket dengan perpindahan dari `allowed_transitions` lewat dialog tindakan sensitif yang sama (compare and set; `409` dijelaskan, data dibaca ulang, tidak ada yang ditimpa), riwayat status pada tulang punggung, catatan internal hanya-tambah. Kontak lengkap dibuka hanya dengan centang persetujuan, langkah kata sandi `423`, dan tekanan kedua; nilainya hanya di memori komponen. Audit log owner memberi label pada tindakan `inquiry.*` dan tautan ke inquiry. Detail: `admin/README.md`, Inquiry; `docs/design/design-system.md`, Konsol admin.

- **Hierarki:** satu pertanyaan per layar ("apa yang perlu saya tindak lanjuti hari ini"), angka utama besar dengan konteks pembanding, tabel padat tetapi terbaca. Navigasi samping di desktop, bar bawah atau menu di ponsel. Modul yang belum dibangun tidak tampil di navigasi.
- **Responsif:** desktop, tablet, ponsel; tabel menjadi daftar kartu di bawah 768 px; tidak ada scroll horizontal halaman.
- **Keadaan:** setiap tampilan data punya keadaan memuat (skeleton dengan ukuran tetap, tanpa lompatan layout), kosong (menjelaskan dan memberi tindakan), galat (pesan, coba lagi, tanpa detail teknis), dan tanpa izin (menjelaskan peran yang dibutuhkan).
- **Aksesibilitas:** WCAG 2.2 AA, navigasi keyboard penuh, fokus terlihat, tabel dengan header yang benar, grafik dengan ringkasan teks dan tabel data alternatif, warna tidak menjadi satu-satunya pembeda. Autentikasi: tempel diizinkan, `autocomplete="current-password"` dan `one-time-code` (3.3.8); peringatan sebelum idle timeout dengan tombol tetap masuk (2.2.1).
- **Motion:** hemat; transisi pendek pada transform dan opacity, tanpa animasi angka berjalan, menghormati `prefers-reduced-motion`. Sejak B3.2c lewat GSAP inti yang dimuat lazy (`admin/src/lib/motion.ts`), tidak pernah ditunggu; Lenis dievaluasi dan tidak dipakai (scroll native, `admin/README.md`, Motion).
- **Kerapatan dan performa:** grafik ringan (SVG), dimuat per modul; tidak ada library grafik besar di chunk awal. QR pendaftaran dari API ditampilkan sebagai `<img src="data:image/svg+xml,...">`, bukan `innerHTML`, agar CSP tetap ketat.

## 8. Performa

- Chunk per modul (lazy route); anggaran JavaScript awal admin 150 KB gzip, diperiksa `admin/scripts/check-build.mjs` di setiap build: 110,8 KB (B3.2a), 131,0 KB (B3.2b), 135,2 KB (B3.2c), 136,5 KB (B4b: grup navigasi Operasional, ikon Tray, teks inti; kode, teks, dan klien inquiry ada di chunk lazy). Kode, teks, dan klien API owner hanya ada di chunk lazy; GSAP (27,3 KB gzip) chunk lazy yang dimuat saat browser idle. Tambahan B3.2c di chunk awal (+4,2 KB) sebagian besar tiga ikon navigasi baru: modul ikon Phosphor membawa keenam bobot (lihat `.ai/project-status.md`, tindak lanjut).
- Query terindeks, pagination server, agregat analitik yang sudah dihitung, cache singkat (misalnya 60 detik) untuk ringkasan.
- Tidak ada polling di halaman publik. Di admin, polling hanya untuk "pengunjung aktif", hanya saat tab terlihat (Page Visibility API).

## 9. Urutan implementasi

| Fase | Isi | Status |
|---|---|---|
| B2, B2.1, B2.2 | Kanal `api` formulir kontak di balik flag yang nonaktif, idempotensi backend dan frontend | Dibangun, dirilis ke `main` |
| B3.0 | Arsitektur dan keputusan keamanan | Selesai; keputusan pemilik di bagian 3 |
| B3.1a | Identitas backend: bootstrap owner, tautan akses, TOTP wajib, login, sesi, peran `owner`/`admin`, audit log, isolasi gateway publik | Dirilis ke `main` (PR #33, `ffe07fc`), belum di-deploy |
| B3.1b | API administrasi pengguna: undangan (tautan 48 jam ditampilkan sekali kepada owner, tanpa email), daftar dan detail pengguna, perubahan peran, penangguhan dan aktivasi ulang, reset kredensial oleh owner (24 jam), pembacaan audit log khusus owner (`docs/api/admin-users.md`) | Dirilis ke `main` (PR #35, `4874c73`), belum di-deploy |
| B3.2a | Fondasi aplikasi `admin/`: React 19, Vite 8, React Router 7 mode data, token merek bersama tanpa salinan, shell responsif dan primitif UI, klien API bertipe dengan CSRF dan aturan 419 (tanpa replay diam-diam untuk penulisan sensitif), layar status jujur dengan pemeriksaan koneksi nyata, layanan Docker pengembangan, Admin CI | Dirilis ke `main` (PR #38, `15b131a`), belum di-deploy |
| B3.2b | Layar masuk (kata sandi dan TOTP atau kode pemulihan), aktivasi dan reset lewat tautan akses dengan pendaftaran TOTP dan kode pemulihan sekali tampil, akun sendiri (baca saja), keamanan akun sendiri (kata sandi, kode pemulihan dengan konfirmasi kata sandi, sesi), gerbang sesi dengan `GET me`, peringatan idle; E2E browser nyata terhadap Laravel dan MySQL tes (workflow Admin integration) | Dirilis ke `main` (PR #41, `02f3859`), belum di-deploy |
| B3.2c | Ruang kerja administrasi owner: pengguna dan detail akun, undangan (tautan sekali tampil), perubahan peran, penangguhan dan aktivasi ulang, reset kredensial, audit log dengan filter; semua penulisan dengan konfirmasi eksplisit dan langkah kata sandi `423`, tanpa kirim ulang otomatis; GSAP lazy untuk motion; E2E browser nyata terhadap Laravel dan MySQL tes | Dirilis ke `main` (PR #43, `c0ecde9`), belum di-deploy |
| B3.2d | Image produksi admin, listener gateway admin terpisah (loopback secara default, TLS opsional di listener), header keamanan sebagai HTTP header, batas host dan origin, isolasi dari gateway publik, smoke test, tes browser nyata pada image produksi, latihan backup dan pemulihan (bagian 10) | Dirilis ke `main` (PR #44, PR #45 `eb31fae`), belum di-deploy; deployment setelah keputusan hostname, TLS, paparan, dan hosting |
| B4a | API pengelolaan inquiry (`docs/api/admin-inquiries.md`): daftar dengan filter berindeks dan cursor, detail, alur status dengan compare and set dan riwayat, catatan internal hanya-tambah, penyamaran kontak, pembukaan kontak yang disengaja dan dicatat, field kiriman pengunjung dikunci di database (idempotensi B2.1 tetap), tes konkurensi multi-proses | Dirilis ke `main` (PR #46, PR #47 `58cead5`), belum di-deploy |
| **B4b** | Antarmuka inquiry di konsol admin di atas API B4a: daftar dengan filter berindeks dan cursor, detail, perubahan status compare and set dengan penjelasan `409` dan baca ulang, catatan hanya-tambah tanpa kirim ulang otomatis, pembukaan kontak yang disengaja dengan langkah kata sandi, label audit `inquiry.*`; E2E browser nyata terhadap Laravel dan MySQL tes | **Dirilis ke `main`** (PR #48, rilis PR #49, `11b0a7d`, 2026-10-19), belum di-deploy; diterima pemilik dengan waiver concept-seed khusus B4b |
| Nanti (inquiry) | Ekspor terkendali, penghapusan atas permintaan subjek data, masa simpan dan pemangkasan, penerusan ke OpsHub | Setelah keputusan retensi, prosedur, pemberitahuan privasi, dan OpsHub |
| Nanti | Analitik (setelah tinjauan privasi, `visitor-analytics.md`), konten dan portofolio (setelah keputusan build statis vs data runtime), passkey, email transaksional, titik masuk OpsHub (setelah kontrak API OpsHub ada) | Rencana |

## 10. Rilis admin privat (B3.2d, dirilis ke `main`, belum di-deploy)

Panduan operasional, perintah, dan bukti: `docs/development/docker-production.md`, Admin privat. Ringkasan keputusan teknis:

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Image konsol | Tahap build Node (`npm ci`, `vite build`, `check-build.mjs`), runtime nginx unprivileged dengan `dist/` saja | Tanpa Node, sumber, atau dev dependency di produksi; build gagal bila pemeriksaan build gagal |
| Header keamanan | Dibuat saat build dari `admin/security-policy.ts` menjadi direktif nginx | Satu definisi untuk meta CSP, dev, preview, dan header HTTP produksi; header tidak dapat menyimpang dari meta |
| Listener | Service `admin-gateway` sendiri (profil `admin`), bukan server block di gateway publik | Gateway publik tidak berubah dan tidak tahu konsol; jaringan terpisah sehingga kedua sisi tidak dapat saling menjangkau |
| Origin | Konsol dan `/api/v1/admin` pada satu host; FastCGI langsung ke PHP-FPM dengan `Host` asli | Tanpa CORS; `AdminRequestBoundary` tetap pemeriksa host dan origin; tidak ada perubahan backend atau kontrak API |
| Hostname | Diturunkan dari `ADMIN_URL` saat container start; gagal tertutup bila bukan origin `https://` | Satu sumber kebenaran; cookie `__Host-` dan `Secure` bergantung pada skema itu |
| TLS | Opsional di listener (`compose.prod.admin-tls.yaml`), atau di proxy di depan listener HTTP | Tidak mengandaikan penyedia; tunnel SSH dan VPN butuh TLS di listener, proxy identitas atau load balancer di depannya |
| Paparan | Loopback secara default untuk kedua port | Privat sampai pemilik memilih tunnel SSH, VPN, atau proxy yang dibatasi |
| IP klien | `TRUSTED_PROXIES` Laravel tetap kosong; nginx `real_ip` hanya dari satu alamat proxy yang disetel | Header forwarded dari klien tidak pernah menjadi alamat yang diaudit atau dibatasi lajunya |
| Backend | Entrypoint produksi menolak `ADMIN_URL` yang bukan `https://` atau sama dengan `APP_URL` | Konfigurasi yang melemahkan cookie tidak dapat berjalan diam-diam |

Kebutuhan backend yang nyata: tidak ada perubahan kode aplikasi atau kontrak. Satu-satunya perubahan di sisi backend ada di entrypoint image produksi (gagal tertutup pada `ADMIN_URL`).

Keputusan pemilik sebelum go-live (daftar lengkap di panduan produksi): hostname admin, opsi paparan (tunnel SSH, VPN, atau proxy terbatas), sumber dan pembaruan sertifikat beserta HSTS, hosting, owner pertama dan jumlah owner, frekuensi dan lokasi backup. Tetap pending: retensi audit log dan alamat IP, dan waiver concept-seed desain admin.
