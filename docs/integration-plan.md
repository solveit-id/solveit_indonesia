# Rencana Integrasi Backend dan Solveit OpsHub

Status: **usulan**. Belum ada endpoint yang dibangun. Dokumen ini menjadi kontrak awal agar frontend dan Laravel API website dapat dikembangkan tanpa merombak fondasi, dan agar website dapat terhubung ke sistem Solveit lain tanpa menyatu dengannya.

## Batas sistem (keputusan 2026-10-14)

- **Repository ini** hanya berisi website company profile Solveit Indonesia (`frontend/`) dan backend/API yang memang menjadi tanggung jawab website itu (`backend/`: inquiry, konten proyek dan layanan, kebutuhan admin website).
- **Solveit OpsHub** dan aplikasi bisnis atau produk Solveit lainnya dikembangkan sebagai proyek dan repository **terpisah**, masing-masing dengan deployment, dependensi, dan siklus rilisnya sendiri. Tidak ada monorepo perusahaan dan tidak ada satu aplikasi yang memuat semua sistem.
- Hubungan antarsistem lewat **kontrak**: REST API berversi, event/webhook (misalnya inquiry baru dari website diteruskan ke OpsHub), dan tautan antar-domain. Tidak memakai database bersama lintas aplikasi sebagai ketergantungan utama; setiap sistem memiliki datanya sendiri dan membuka API untuk yang dibutuhkan sistem lain.
- Identitas visual boleh dibagi (token desain, logo), tetapi sebagai aset atau paket yang disalin/dipublikasikan, bukan import lintas repository.

## Backend

- Laravel 13, PHP 8.5 (minimum 8.5.7, target 8.5.11 atau patch stabil terbaru seri 8.5), REST JSON di bawah `/api/v1`.
- Dikembangkan di branch `backend`, folder `backend/`.
- Autentikasi: hanya untuk admin website (mis. Laravel Sanctum). Autentikasi klien dan portal klien milik sistem ekosistem yang terpisah, bukan backend ini.

## Titik tukar di frontend

| Kebutuhan | Saat ini | Setelah API tersedia |
|---|---|---|
| Daftar dan detail proyek | `src/services/projects.ts` membaca `src/data/projects.ts` | Fungsi yang sama memanggil API; halaman memakai `clientLoader`; route studi kasus kembali ke `portofolio/:slug` |
| Inquiry konsultasi | `src/services/inquiry.ts` menyusun pesan WhatsApp/email | Tambahkan kanal `api` yang mengirim payload yang sama; tampilkan nomor tiket dari respons |
| Konfigurasi | `VITE_API_BASE_URL` sudah dibaca di `src/config/site.ts` | Diisi per lingkungan |

## Kontrak yang diusulkan

### `POST /api/v1/inquiries`

```json
{
  "name": "string, wajib, 2-120",
  "organization": "string, opsional",
  "contact": "string, wajib, email atau nomor telepon",
  "service": "website | aplikasi-web | sistem-informasi | custom-software | dukungan-teknis",
  "budget": "belum-tahu | di-bawah-10jt | 10-50jt | 50-150jt | di-atas-150jt",
  "timeline": "fleksibel | 1-3-bulan | segera",
  "message": "string, wajib, minimal 20 karakter"
}
```

Respons `201`: `{ "id": "INQ-...", "status": "received" }`. Respons `422`: `{ "message": "...", "errors": { "field": ["..."] } }` (format validasi Laravel), dipetakan ke `InquiryErrors` di frontend. Perlu rate limiting dan proteksi spam (honeypot atau Turnstile).

### `GET /api/v1/projects` dan `GET /api/v1/projects/{slug}`

Bentuk data mengikuti tipe `Project` di `frontend/src/types/content.ts` (termasuk `isDemo`, `results`, `metricsToTrack`, `cover`). Tambahan yang disarankan: `images[]` (url, alt, width, height) untuk visual hasil, dan `publishedAt`.

### `GET /api/v1/services`

Bentuk data mengikuti tipe `Service`.

## Peta jalan integrasi dengan ekosistem

Solveit OpsHub (pusat operasional internal) dan bagian ekosistem untuk klien dibangun di repository-nya sendiri. Nama bagian untuk klien (Connect, Scope, Accord, Ledger, Pulse, Care) dan nama payung Solveit Orbit masih usulan (`product-naming.md`); apakah tiap bagian menjadi aplikasi sendiri atau modul belum diputuskan, sehingga kolom tengah menyebut fungsinya. Kolom kanan hanya mencatat apa yang berubah **di website ini** pada setiap tahap.

| Tahap | Fitur (di sistem ekosistem, bukan website ini) | Dampak ke website ini |
|---|---|---|
| 1 | Inquiry via API website, panel admin website | Kanal `api` di form kontak (backend website ini); inquiry diteruskan ke OpsHub lewat event/webhook bila OpsHub sudah ada |
| 2 | Akun klien, pemesanan layanan | Tautan "Masuk portal" ke domain/subdomain sistem klien; tidak ada route `/portal/*` di website ini |
| 3 | Proposal dan kontrak digital | Tidak ada; dokumen hidup di sistem ekosistem |
| 4 | Invoice dan pembayaran | Tidak ada; integrasi payment gateway di sistem ekosistem |
| 5 | Progres dan revisi | Opsional: studi kasus nyata dapat menampilkan data yang dipublikasikan lewat API publik, setelah izin klien; pratinjau responsif studi kasus dapat memakai tangkapan layar nyata (`preview.kind: "screenshots"`) |
| 6 | Pemeliharaan dan tiket | Tautan ke kanal dukungan |

Halaman publik website tetap prerender statis. Autentikasi klien (mis. Sanctum atau OIDC) adalah tanggung jawab sistem ekosistem; website tidak menyimpan sesi klien. Repository `solveit_opshub` dan identifier-nya tidak diganti nama.
