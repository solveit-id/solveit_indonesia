# Rencana Integrasi Backend dan Solveit OpsHub

Status (2026-10-15): **inquiry dibangun (B1), sisanya usulan.** `POST /api/v1/inquiries` sudah ada di `backend/` dan dites, tetapi belum di-deploy dan belum dipanggil frontend; kontraknya kini di `docs/api/inquiries.md`. Endpoint proyek dan layanan di bawah masih usulan. Dokumen ini menjaga batas sistem dan peta jalan agar website dapat terhubung ke sistem Solveit lain tanpa menyatu dengannya.

## Batas sistem (keputusan 2026-10-14)

- **Repository ini** hanya berisi website company profile Solveit Indonesia (`frontend/`) dan backend/API yang memang menjadi tanggung jawab website itu (`backend/`: inquiry, konten proyek dan layanan, kebutuhan admin website).
- **Solveit OpsHub** dan aplikasi bisnis atau produk Solveit lainnya dikembangkan sebagai proyek dan repository **terpisah**, masing-masing dengan deployment, dependensi, dan siklus rilisnya sendiri. Tidak ada monorepo perusahaan dan tidak ada satu aplikasi yang memuat semua sistem.
- Hubungan antarsistem lewat **kontrak**: REST API berversi, event/webhook (misalnya inquiry baru dari website diteruskan ke OpsHub), dan tautan antar-domain. Tidak memakai database bersama lintas aplikasi sebagai ketergantungan utama; setiap sistem memiliki datanya sendiri dan membuka API untuk yang dibutuhkan sistem lain.
- Identitas visual boleh dibagi (token desain, logo), tetapi sebagai aset atau paket yang disalin/dipublikasikan, bukan import lintas repository.

## Backend

- Laravel 13 (13.36 saat dibangun), REST JSON di bawah `/api/v1`. PHP 8.5, minimal 8.5.7 (keputusan pemilik, B1.1); CI menegaskan minimum dan mencatat patch yang diuji. Database MySQL 8.4 LTS untuk pengembangan, tes, dan produksi (keputusan pemilik, B1.1); hosting belum dipilih.
- Dikembangkan di branch `backend`, folder `backend/`. Rincian setup: `backend/README.md`.
- Autentikasi: hanya untuk admin website (mis. Laravel Sanctum, belum dipasang). Autentikasi klien dan portal klien milik sistem ekosistem yang terpisah, bukan backend ini.
- Rancangan yang belum dibangun: dashboard admin (`admin-dashboard.md`), analitik pengunjung first-party (`visitor-analytics.md`), dan batas integrasi GitHub organisasi `solveit-id` (`github-integration.md`; dimiliki OpsHub, bukan website).
- Laravel Boost adalah alat pengembangan untuk coding agent (dev dependency), bukan runtime, bukan sistem bisnis, dan tidak terhubung ke OpsHub.

## Titik tukar di frontend

| Kebutuhan | Saat ini | Setelah API tersedia |
|---|---|---|
| Daftar dan detail proyek | `src/services/projects.ts` membaca `src/data/projects.ts` | Fungsi yang sama memanggil API; halaman memakai `clientLoader`; route studi kasus kembali ke `portofolio/:slug` |
| Inquiry konsultasi | `src/services/inquiry.ts` menyusun pesan WhatsApp/email | B2: kanal `api` yang mengirim payload yang sama ke `POST /api/v1/inquiries` (sudah ada), kirim honeypot `homepage` kosong, tampilkan nomor referensi dari `201`, petakan `422` ke `InquiryErrors`, dan tawarkan WhatsApp/email pada `429`, `503`, atau galat jaringan |
| Konfigurasi | `VITE_API_BASE_URL` sudah dibaca di `src/config/site.ts` | Diisi per lingkungan |

## Kontrak

### `POST /api/v1/inquiries` (dibangun)

Kontrak lengkap, aturan validasi, respons, proteksi spam, dan privasi: `docs/api/inquiries.md`. Bentuk permintaan tetap `InquiryPayload` dari `frontend/src/types/inquiry.ts`; respons `201` `{ "id": "INQ-...", "status": "received" }`, `422` format validasi Laravel.

Penerusan ke Solveit OpsHub belum dibangun. Saat OpsHub siap, inquiry yang tersimpan dikirim lewat event atau webhook berversi dari backend ini (misalnya `inquiry.received.v1` berisi nomor referensi dan field yang disepakati), bukan dengan OpsHub membaca tabel `inquiries`.

### Usulan: `GET /api/v1/projects` dan `GET /api/v1/projects/{slug}`

Bentuk data mengikuti tipe `Project` di `frontend/src/types/content.ts` (termasuk `isDemo`, `results`, `metricsToTrack`, `cover`). Tambahan yang disarankan: `images[]` (url, alt, width, height) untuk visual hasil, dan `publishedAt`.

### Usulan: `GET /api/v1/services`

Bentuk data mengikuti tipe `Service`.

## Peta jalan integrasi dengan ekosistem

Solveit OpsHub (pusat operasional internal) dan bagian ekosistem untuk klien dibangun di repository-nya sendiri. Nama bagian untuk klien (Connect, Scope, Accord, Ledger, Pulse, Care) dan nama payung Solveit Orbit masih usulan (`docs/product/product-naming.md`); apakah tiap bagian menjadi aplikasi sendiri atau modul belum diputuskan, sehingga kolom tengah menyebut fungsinya. Kolom kanan hanya mencatat apa yang berubah **di website ini** pada setiap tahap.

| Tahap | Fitur (di sistem ekosistem, bukan website ini) | Dampak ke website ini |
|---|---|---|
| 1 | Inquiry via API website, panel admin website | Endpoint inquiry sudah dibangun (B1). Berikutnya: kanal `api` di form kontak (B2), panel admin website, lalu penerusan ke OpsHub lewat event/webhook bila OpsHub sudah ada |
| 2 | Akun klien, pemesanan layanan | Tautan "Masuk portal" ke domain/subdomain sistem klien; tidak ada route `/portal/*` di website ini |
| 3 | Proposal dan kontrak digital | Tidak ada; dokumen hidup di sistem ekosistem |
| 4 | Invoice dan pembayaran | Tidak ada; integrasi payment gateway di sistem ekosistem |
| 5 | Progres dan revisi, termasuk repository GitHub proyek klien (`github-integration.md`) | Opsional: studi kasus nyata dapat menampilkan data yang dipublikasikan lewat API publik, setelah izin klien; pratinjau responsif studi kasus dapat memakai tangkapan layar nyata (`preview.kind: "screenshots"`) |
| 6 | Pemeliharaan dan tiket | Tautan ke kanal dukungan |

Halaman publik website tetap prerender statis. Autentikasi klien (mis. Sanctum atau OIDC) adalah tanggung jawab sistem ekosistem; website tidak menyimpan sesi klien. Repository `solveit_opshub` dan identifier-nya tidak diganti nama.
