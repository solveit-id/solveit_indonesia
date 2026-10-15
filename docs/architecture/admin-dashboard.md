# Dashboard Admin Website

Status (2026-10-15): **Planned, rancangan saja.** Belum ada UI admin, autentikasi, tabel admin, atau endpoint admin. Dokumen ini menetapkan batas dan arah agar implementasi berikutnya tidak merusak website publik. Keputusan yang masih milik pemilik ditandai **Owner decision required**.

Terkait: `visitor-analytics.md` (data analitik yang ditampilkan dashboard), `github-integration.md` (integrasi yang dimiliki sistem lain), `integration-plan.md` (batas antarsistem), `docs/api/inquiries.md` (data inquiry dan privasi).

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

Backend admin tetap bagian dari `backend/` (Laravel), memakai database MySQL website. Data sistem lain hanya didapat lewat API atau event berversi, tidak lewat database bersama.

## 2. Arsitektur frontend admin

Syarat yang tidak boleh dilanggar:

- Halaman publik tetap prerender statis dan performanya tidak turun (baseline putaran 6: Lighthouse mobile 96 sampai 99).
- Tidak ada data privat admin di HTML yang di-prerender, di bundle publik, atau di cache CDN.
- Kode admin tidak masuk chunk yang dimuat halaman publik.

| Opsi | Cara | Kelebihan | Kekurangan |
|---|---|---|---|
| A. Route `/admin/*` di app `frontend/` | Route client-only (`clientLoader`, tidak masuk daftar `prerender`), chunk terpisah, `noindex` | Satu toolchain, token desain langsung dipakai | Hosting statis harus menyajikan shell SPA untuk `/admin/*`; pemisahan bundle bergantung disiplin; CSP dan cache publik dan admin bercampur; rilis admin ikut siklus website |
| B. App terpisah `admin/` di repository ini, disajikan di subdomain (misalnya `admin.<domain>`) | Vite + React + TypeScript SPA sendiri; token desain diambil dari satu sumber bersama | Isolasi paling kuat (bundle, CSP, cache, deploy), tidak mungkin bocor ke prerender publik, cookie sesi dapat dibatasi ke subdomain admin | Satu app lagi untuk dirawat; token desain harus dibagi tanpa salinan (paket atau file bersama) |
| C. Panel server-side Laravel (Blade, Livewire, atau Filament) | Dirender `backend/` | Cepat dibangun, satu stack auth | Menambah stack UI kedua; tampilan generik (Filament) bertentangan dengan arah desain; tidak memakai komponen website |

**Rekomendasi: opsi B**, karena memenuhi syarat isolasi tanpa bergantung pada disiplin manual, dan memungkinkan kebijakan keamanan admin yang lebih ketat daripada website publik. Opsi A dapat dipertimbangkan bila hosting yang dipilih tidak mendukung subdomain. **Owner decision required:** opsi frontend, subdomain, dan apakah `admin/` menjadi folder dan branch baru (aturan `docs/project-structure.md` bagian 2: satu folder per aplikasi).

## 3. Autentikasi

- **Laravel Sanctum, mode SPA (cookie sesi)** untuk app admin di domain yang sama secara registrasi dengan API. Cookie `HttpOnly`, `Secure`, `SameSite=Lax`, CSRF lewat `/sanctum/csrf-cookie`. Tidak ada token di `localStorage`.
- Tanpa pendaftaran publik. Akun dibuat lewat undangan oleh peran `owner`, dengan tautan sekali pakai yang kedaluwarsa.
- Kata sandi di-hash dengan hasher bawaan Laravel; batas percobaan login per akun dan per IP; pesan galat yang tidak membedakan "akun tidak ada" dan "kata sandi salah".
- **MFA (TOTP) wajib** untuk `owner` dan `admin`; passkey dapat ditambahkan kemudian. **Owner decision required:** MFA untuk semua peran atau hanya peran tinggi.
- Batas umur sesi dan idle timeout; keluar dari semua perangkat; sesi dicabut saat peran berubah atau akun dinonaktifkan.
- Sanctum dipasang saat fase admin dimulai (sesuai keputusan B0: `install:api` tidak dipakai sebelumnya).

## 4. Peran dan izin (RBAC)

Laravel Gates dan Policies, tanpa paket tambahan sampai kebutuhan terbukti.

| Izin | owner | admin | editor | analyst |
|---|---|---|---|---|
| Lihat ringkasan KPI | Ya | Ya | Ya | Ya |
| Lihat daftar inquiry (kontak disamarkan) | Ya | Ya | Tidak | Tidak |
| Lihat detail inquiry lengkap | Ya | Ya | Tidak | Tidak |
| Ubah status dan catatan inquiry | Ya | Ya | Tidak | Tidak |
| Ekspor inquiry | Ya | Tidak | Tidak | Tidak |
| Hapus inquiry (permintaan subjek data) | Ya | Tidak | Tidak | Tidak |
| Lihat analitik | Ya | Ya | Ya | Ya |
| Kelola konten dan portofolio | Ya | Ya | Ya | Tidak |
| Kelola pengguna dan peran | Ya | Tidak | Tidak | Tidak |
| Pengaturan website | Ya | Terbatas | Tidak | Tidak |
| Lihat audit log | Ya | Ya | Tidak | Tidak |

Nama dan matriks peran adalah usulan. **Owner decision required.**

## 5. Modul

| Modul | Isi | Catatan |
|---|---|---|
| Ringkasan | KPI dari agregat analitik dan inquiry: kunjungan, halaman populer, inquiry per hari, konversi agregat | Hanya angka yang definisinya tertulis di `visitor-analytics.md`; tidak ada angka buatan |
| Inquiry | Daftar dengan filter (status, layanan, tanggal), detail, riwayat status, catatan internal, ekspor | Status baru (misalnya `in_review`, `contacted`, `closed`) ditambahkan ke `InquiryStatus` dengan riwayatnya. Penerusan ke OpsHub lewat event `inquiry.received.v1` bila OpsHub siap |
| Analitik | Tren, sumber, halaman populer, pengunjung aktif (definisi di dokumen analitik) | Data agregat; tidak ada data per orang |
| Konten dan portofolio | Proyek, layanan, FAQ, testimoni berizin | Konten saat ini ada di `frontend/src/data/`. Memindahkannya ke API memerlukan build ulang situs statis setiap kali konten berubah (webhook build ke hosting), atau mengubah sebagian halaman menjadi data saat runtime. **Owner decision required** |
| Audit log | Siapa, kapan, tindakan, objek | Hanya-tambah; tidak dapat diubah lewat UI |
| Pengaturan | Kanal kontak, flag fitur, origin CORS tidak termasuk (tetap di environment) | Dibatasi peran |
| Integrasi | Tautan dan status baca-saja produk Solveit lain | Lewat API berversi milik produk itu |

## 6. Backend admin

- Route `routes/api.php` di bawah `v1/admin`, middleware `auth:sanctum`, verifikasi MFA, dan policy per tindakan. Semua respons admin `Cache-Control: no-store`.
- Tabel baru (usulan): `roles` dan `role_user` (atau kolom `role` pada `users` bila hanya satu peran per orang), `inquiry_status_changes`, `inquiry_notes`, `audit_logs` (`actor_id`, `action`, `subject_type`, `subject_id`, `metadata` tanpa data pribadi, `created_at`, index `created_at` dan `(subject_type, subject_id)`).
- Pagination di server untuk setiap daftar, index pada kolom filter (`inquiries.status` sudah ada; tambah `created_at`).
- Data pribadi: daftar menampilkan kontak yang disamarkan; detail lengkap dicatat di audit log; ekspor mencatat siapa dan berapa baris. Masa simpan inquiry tetap **Owner decision required** (`docs/api/inquiries.md`).
- Tidak ada endpoint publik baru untuk inquiry; aturan B1 tetap berlaku.

## 7. Desain

Mengikuti bahasa visual Solveit (`docs/DESIGN.md`, `docs/design/design-system.md`): token warna dan tipografi yang sama, satu aksen, kapsul untuk kontrol, sumbu 33 derajat sebagai detail, tanpa meniru layout halaman publik dan tanpa template dashboard generik.

- **Hierarki:** satu pertanyaan per layar ("apa yang perlu saya tindak lanjuti hari ini"), angka utama besar dengan konteks pembanding, tabel padat tetapi terbaca. Navigasi samping di desktop, bar bawah atau menu di ponsel.
- **Responsif:** desktop, tablet, ponsel; tabel menjadi daftar kartu di bawah 768 px; tidak ada scroll horizontal halaman.
- **Keadaan:** setiap tampilan data punya keadaan memuat (skeleton dengan ukuran tetap, tanpa lompatan layout), kosong (menjelaskan dan memberi tindakan), galat (pesan, coba lagi, tanpa detail teknis), dan tanpa izin (menjelaskan peran yang dibutuhkan).
- **Aksesibilitas:** WCAG 2.2 AA, navigasi keyboard penuh, fokus terlihat, tabel dengan header yang benar, grafik dengan ringkasan teks dan tabel data alternatif, warna tidak menjadi satu-satunya pembeda.
- **Motion:** hemat; transisi pendek pada transform dan opacity, tanpa animasi angka berjalan, menghormati `prefers-reduced-motion`.
- **Kerapatan dan performa:** grafik ringan (SVG), dimuat per modul; tidak ada library grafik besar di chunk awal.

## 8. Performa

- Chunk per modul (lazy route); target JavaScript awal admin di bawah 150 KB gzip (target, belum diukur).
- Query terindeks, pagination server, agregat analitik yang sudah dihitung, cache singkat (misalnya 60 detik) untuk ringkasan.
- Tidak ada polling di halaman publik. Di admin, polling hanya untuk "pengunjung aktif", hanya saat tab terlihat (Page Visibility API).

## 9. Urutan implementasi yang diusulkan

1. B2: kanal `api` formulir kontak (sudah direncanakan; tidak bergantung pada admin).
2. Keputusan pemilik: opsi frontend admin, subdomain, hosting, peran, MFA, masa simpan data.
3. Admin fondasi: Sanctum, undangan, login, MFA, peran, audit log, keadaan izin.
4. Modul inquiry (status, catatan, riwayat, penyamaran kontak, ekspor terkendali).
5. Analitik (setelah tinjauan privasi, `visitor-analytics.md`).
6. Konten dan portofolio (setelah keputusan build statis vs data runtime).
7. Titik masuk integrasi ke OpsHub (setelah kontrak API OpsHub ada).
