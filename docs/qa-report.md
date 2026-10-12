# Laporan QA (2026-10-12)

Semua angka di bawah adalah hasil eksekusi nyata di mesin pengembang (Windows 11, Node 22.23, Chromium Playwright 1.64, Lighthouse 13.5) terhadap build produksi yang disajikan oleh `scripts/serve.mjs` (clean URL, 404 asli, kompresi brotli).

## Pemeriksaan otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run lint` (ESLint 10, typescript-eslint, react-hooks, jsx-a11y) | Lulus, 0 masalah |
| `npm run typecheck` (TS 6, strict, `noUncheckedIndexedAccess`) | Lulus |
| `npm test` (Vitest) | 21/21 lulus: integritas konten (slug, demo tanpa hasil, kategori, peta sistem, nomor WhatsApp, tanpa em dash), validasi dan penyusunan inquiry, helper SEO, perilaku formulir |
| `npm run build` | Lulus; 11 halaman terindeks + 404 di-prerender |
| `npm run test:e2e` (Playwright: desktop 1440, tablet 820, Pixel 7) | 91 lulus, 0 gagal, 11 dilewati sesuai desain (mis. tes menu mobile di desktop) |
| axe-core WCAG 2.0/2.1/2.2 A dan AA (7 halaman x 3 viewport) | 0 pelanggaran |
| Detektor Impeccable (`impeccable detect`) | 0 temuan |

Cakupan e2e: status 200 dan satu `h1` per halaman, title unik, canonical, `lang`, tanpa overflow horizontal di 3 viewport, tanpa error konsol, HTML terbaca tanpa JavaScript, 404 asli + `noindex`, semua link internal berstatus 200, navigasi dan `aria-current`, menu mobile (inert, Escape), skip link, filter portofolio, label demo, form (validasi, tidak pernah mengklaim terkirim, membuka WhatsApp dengan pesan tersusun, prefill layanan dari hero), JSON-LD valid, sitemap dan robots, hero merakit ke posisi logo asli, pan horizontal ter-pin, cleanup ScrollTrigger saat pindah halaman, reduced motion.

## Lighthouse

Preset: mobile = default Lighthouse (Moto G Power teremulasi, simulated slow 4G, CPU 4x); desktop = `--preset=desktop`. Satu kali run per halaman, diukur setelah batch perbaikan pertama; "Peta sistem" (di bawah lipatan studi kasus) ditambahkan sesudahnya.

| Halaman | Mobile Perf | Desktop Perf | A11y | Best Practices | SEO | LCP mobile | TBT mobile | CLS |
|---|---|---|---|---|---|---|---|---|
| `/` | 84 | 99 | 100 | 100 | 100 | 3,4 s | 90 ms | 0 |
| `/portofolio` | 91 | 100 | 100 | 100 | 100 | 2,9 s | 60 ms | 0 |
| `/portofolio/sistem-antrean-klinik` | 93 | 99 | 100 | 100 | 100 | 2,6 s | 40 ms | 0 |
| `/kontak` | 95 | 100 | 100 | 100 | 100 | 2,4 s | 30 ms | 0 |

LCP desktop 0,7 sampai 0,9 s. TBT dipakai sebagai proksi INP (INP butuh data lapangan). Target LCP 2,5 s di mobile tersimulasi tercapai di Kontak, hampir di studi kasus, dan belum di Beranda (3,4 s) dan Portofolio (2,9 s); sisa biaya ada pada JavaScript React + router yang di-modulepreload sebelum first paint, sementara HTML sudah statis. Angka lapangan (CrUX) baru bisa diukur setelah domain aktif.

Optimasi yang diterapkan dan dampaknya (mobile, Beranda): kompresi pada server preview (64 ke 82), subset font 90 ke 29 KB, GSAP dimuat lazily setelah paint (85; halaman lain naik ke 90 sampai 95), reveal manifesto berbasis warna (A11y 96 ke 100).

## Review desain (Impeccable)

Reviewer independen (konteks baru, tanpa riwayat build) memberi disposisi **fix** dengan 7 perbaikan material: visual teknologi pada studi kasus, aturan diagonal 33 derajat pada dua sampul dan ikon menu, label meta di atas judul, baris kartu identik pada alur, kapsul untuk teks statis, sel yatim di grid portofolio, dan fragmen lattice di tile bento.

Putaran verdict kedua: 6 dari 7 **resolved**, 1 **partial** (visual teknologi). Item tersebut lalu ditutup dengan "Peta sistem" per studi kasus: diagram konsep berisi bagian-bagian solusi dan data yang berpindah, kapsul bertingkat dengan konektor tepat 33 derajat, berlabel "Bukan tangkapan layar sistem nyata". Perbaikan terakhir ini diverifikasi dengan screenshot desktop dan mobile serta seluruh tes, tetapi tidak dikirim ke putaran review ketiga (batas dua putaran).

## Temuan tersisa

- LCP mobile tersimulasi Beranda 3,4 s dan Portofolio 2,9 s (lihat di atas).
- Studi kasus belum memiliki visual hasil nyata; menunggu proyek klien yang boleh dipublikasikan.
- Canonical, `og:image` absolut, BreadcrumbList, dan sitemap aktif hanya setelah `VITE_SITE_URL` diisi.
- Uji perangkat fisik (iOS Safari, Android Chrome) dan pembaca layar nyata (NVDA, VoiceOver) belum dilakukan; pengujian di atas memakai emulasi Chromium dan axe.
