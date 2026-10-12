# Rencana Integrasi Backend dan Solveit OpsHub

Status: **usulan**. Belum ada endpoint yang dibangun. Dokumen ini menjadi kontrak awal agar frontend dan Laravel API dapat dikembangkan tanpa merombak fondasi.

## Backend

- Laravel 13, PHP 8.5 (minimum 8.5.7, target 8.5.11 atau patch stabil terbaru seri 8.5), REST JSON di bawah `/api/v1`.
- Dikembangkan di branch `backend`, folder `backend/`.
- Autentikasi Client Portal: Laravel Sanctum (cookie SPA) untuk domain yang sama, atau token untuk subdomain API.

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

## Peta jalan OpsHub

| Tahap | Fitur | Dampak ke frontend |
|---|---|---|
| 1 | Inquiry via API, panel admin | Kanal `api` di form kontak |
| 2 | Akun klien, pemesanan layanan | Route `/portal/*` di dalam layout terpisah yang dilindungi |
| 3 | Proposal dan kontrak digital | Halaman dokumen + tanda tangan |
| 4 | Invoice dan pembayaran | Integrasi payment gateway |
| 5 | Progres dan revisi | Timeline proyek, permintaan revisi terhubung ke ruang lingkup |
| 6 | Pemeliharaan dan tiket | Sistem tiket dukungan |

Halaman publik tetap prerender statis. Portal klien menjadi bagian aplikasi yang dirender di klien, berbagi design tokens, komponen, dan `services/`.
