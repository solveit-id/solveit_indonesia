# Laporan QA

Semua angka di bawah adalah hasil eksekusi nyata di mesin pengembang (Windows 11, Node 22.23, Playwright 1.64 dengan Chromium 156, Firefox, dan WebKit, Lighthouse 13.5) terhadap build produksi yang disajikan oleh `scripts/serve.mjs` (clean URL, 404 per bahasa, kompresi brotli).

## Putaran 2 (2026-10-13): tema, dua bahasa, navigasi, kontak, parallax, performa

### Pemeriksaan otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run format:check` | Lulus |
| `npm run lint` (ESLint 9, typescript-eslint, react-hooks, jsx-a11y) | Lulus, 0 masalah |
| `npm run typecheck` (TS 6, strict) | Lulus |
| `npm test` (Vitest) | 39/39 lulus: kelengkapan dan kesetaraan konten dua bahasa, larangan em dash di semua teks, peta route dan pasangan slug, hreflang dan canonical (dengan domain tiruan), inquiry per bahasa dan nomor tujuan, perilaku formulir |
| `npm run build` | Lulus; 22 halaman terindeks (11 per bahasa) + 2 halaman 404 di-prerender |
| `npm run test:e2e` (Chromium: desktop 1440, tablet 820, Pixel 7) | Lulus; dijalankan ulang bersama mesin lain di bawah |
| `PW_ALL_BROWSERS=1 npm run test:e2e` (Chromium x3, Firefox, WebKit desktop, WebKit iPhone 14) | **466 lulus, 0 gagal**, 44 dilewati sesuai desain (tes khusus viewport) |
| axe-core WCAG 2.0/2.1/2.2 A dan AA | 0 pelanggaran di 14 halaman x 2 tema x 6 proyek browser |
| Detektor Impeccable (`impeccable detect`, CLI) | 0 temuan |

Cakupan e2e baru: tema terang default walau OS gelap, tema gelap dipulihkan sebelum paint (dicek saat `DOMContentLoaded`) dan bertahan setelah reload dan navigasi, tanpa error hydration; pergantian bahasa pada setiap jenis halaman (termasuk studi kasus, slug ke slug) dengan back/forward; preferensi bahasa hanya mengalihkan `/` bagi pengunjung yang pernah memilih Inggris, tidak pernah untuk konteks baru (crawler); 404 Inggris; `lang`, canonical, hreflang dua arah, dan `x-default` di 14 halaman; tautan halaman Inggris tetap di `/en`; urutan navigasi, indikator aktif (termasuk halaman bertingkat, hover, refresh), penanda menu seluler; menu WhatsApp (tiga nomor, `target`/`rel` aman, keyboard, Escape, klik di luar); Instagram di footer dan Kontak; parallax bergerak dan tetap bekerja setelah navigasi; mark Tentang terakit tepat di tengah; teks yang diketik sebelum hydration tetap terkirim dan tidak pernah masuk URL.

### Temuan yang diperbaiki selama QA

| Temuan | Sumber | Perbaikan |
|---|---|---|
| Overflow horizontal 0,67 px saat skala tampilan 150% (pin-spacer ScrollTrigger dibulatkan) | Inspeksi browser | `body { overflow-x: clip }` (tidak membuat scroll container, sticky tetap bekerja) |
| Error hydration saat stylesheet dipindah di `<head>` | Konsol produksi | Pendekatan dibatalkan; urutan `<head>` dibiarkan seperti dirender React |
| Formulir bisa dikirim secara native sebelum hydration, nama dan kontak masuk ke URL | Firefox/WebKit e2e | Tombol kirim nonaktif sampai hydration; `<noscript>` tetap menjelaskan kanal langsung |
| Teks yang diketik sebelum hydration hilang dari state React | Firefox/WebKit e2e | Formulir mengadopsi nilai DOM saat hydration (diuji dengan bundle yang ditahan) |
| Kapsul kontak aktif di tema gelap di bawah 4,5:1 (`#2a66ff`) | axe di Firefox | Logo Deep Cobalt di kedua tema |
| Chevron select berulang | Screenshot | Selektor `.field-input.field-select` |
| Peringatan GSAP target tidak ditemukan di Kontak | Konsol | Animasi mark footer hanya saat band CTA ada |

### Review desain

- **Impeccable critique** (mode tunggal, lihat `.impeccable/critique/`): 30/36 (83%, Good; heuristik 7 n/a untuk permukaan Persuade). Perbaikan yang langsung diterapkan: pemilih bahasa ringkas di header ponsel, bayangan panel Proses yang membuat porselen keruh (0,16 ke 0,07), dua temuan aksesibilitas dan formulir di atas. Overlay browser: `first-viewport-column-overflow` di Kontak (diterima: kolom kanan sticky), `shape-assembled-illustration` pada sampul generatif (diterima: sistem visual merek, berlabel konsep), satu sampel kontras rendah saat fade masuk (positif palsu, tidak terjadi saat diam).
- **Taste skill pre-flight**: nol em dash, satu aksen, satu sistem radius, navigasi satu baris, tanpa eyebrow selain "Error 404", tanpa listener scroll manual. Lede hero Inggris dipangkas ke 19 kata (batas 20).
- Screenshot representatif diperiksa untuk Beranda, Portofolio, studi kasus, Proses, Tentang, Layanan, dan Kontak, di desktop 1440 dan 1024 serta ponsel 390, di tema terang dan gelap, dalam kedua bahasa.

### Lighthouse

Preset: mobile = default Lighthouse 13.5 (Moto G Power teremulasi, simulated slow 4G, CPU 4x); desktop = `--preset=desktop`. **Median dari 3 run per halaman**, build produksi yang sama untuk semua halaman, mesin yang sama. "Sebelum" adalah `main` (commit `bb966f2`) yang diukur ulang dengan metode ini; angka putaran 1 adalah satu kali run.

| Halaman | Mobile Perf sebelum | Mobile Perf sesudah | LCP mobile sebelum | LCP mobile sesudah | FCP mobile sesudah | TBT mobile sesudah | Desktop Perf sebelum / sesudah | CLS |
|---|---|---|---|---|---|---|---|---|
| `/` | 84 | **98** | 3,48 s | **1,58 s** | 0,98 s | 156 ms | 98 / 100 | 0 |
| `/portofolio` | 91 | **99** | 3,00 s | **1,44 s** | 0,99 s | 80 ms | 98 / 100 | 0 |
| `/portofolio/sistem-antrean-klinik` | 89 | **99** | 3,16 s | **1,57 s** | 0,98 s | 121 ms | 98 / 100 | 0 |
| `/kontak` | 92 | **100** | 2,94 s | **1,45 s** | 1,01 s | 62 ms | 99 / 100 | 0 |
| `/en` (baru) | - | 97 | - | 1,58 s | 0,99 s | 174 ms | - / 100 | 0 |
| `/en/contact` (baru) | - | 100 | - | 1,43 s | 0,83 s | 25 ms | - / 100 | 0 |

Accessibility, Best Practices, dan SEO: 100 di semua halaman, kedua preset. LCP desktop 0,41 sampai 0,45 s.

Akar masalah sebelumnya, dari profil: sekitar 20 `modulepreload` JS diunduh dengan prioritas High sebelum stylesheet, sehingga FCP tersimulasi 2,4 sampai 2,9 s; dan judul hero masuk dari `opacity: 0`, sehingga elemen LCP salah (tombol Menu). Perbaikan dan buktinya:

| Langkah | Efek terukur |
|---|---|
| Judul halaman masuk dengan transform saja | Judul menjadi elemen LCP; di Chromium nyata LCP = FCP (144 ms lokal) |
| `fetchpriority="low"` pada modulepreload | FCP turun, tetapi LCP tersimulasi tidak membaik: modul tetap dimulai sebelum paint |
| Memindahkan stylesheet di `<head>` | Dibatalkan: memicu error hydration React 19 |
| Bootstrap disisipkan setelah `requestAnimationFrame` | Beranda 91 dan Kontak 94, tetapi Portofolio dan studi kasus turun (LCP 3,6 s): frame pertama di-raster lambat di mesin uji, sehingga JS masih mulai sebelum paint yang tampil |
| Bootstrap disisipkan setelah entri `first-contentful-paint` (cadangan 3 s) | Hasil akhir di tabel. Tidak ada fitur, tampilan, atau metadata yang dikorbankan; hydration mulai segera setelah konten tampil |

TBT mobile Beranda (156 ms) dan `/en` (174 ms) sedikit di atas baseline 140 ms karena hydration kini jatuh setelah FCP dan dihitung TBT; itu pekerjaan yang sama, dipindah ke belakang paint.

### Ukuran bundle

| | Sebelum | Sesudah |
|---|---|---|
| Seluruh JS (gzip, termasuk GSAP yang dimuat lazily) | 213 KB | 232 KB |
| CSS (gzip) | 9,4 KB | 11,1 KB |

Kenaikan terutama dari konten dua bahasa (teks Inggris ikut terbawa di chunk konten dan kamus, sekitar 9 KB gzip) dan komponen baru. Dengan bootstrap setelah first paint, JS tidak lagi berada di jalur render kritis.

### Keterbatasan

- Lighthouse mengukur emulasi di mesin pengembang; angka lapangan (CrUX, INP) baru tersedia setelah domain aktif.
- Firefox dan WebKit diuji lewat build Playwright, bukan Safari iOS atau Firefox Android fisik; pembaca layar nyata (NVDA, VoiceOver) belum diuji manual.
- Sebelum hydration (setelah first paint, biasanya beberapa milidetik, lebih lama di jaringan lambat) tombol tema, filter portofolio, dan tombol kirim formulir belum aktif. Tautan, pemilih layanan hero, dan menu WhatsApp tetap berfungsi sebagai HTML biasa.
- Konten portofolio tetap konsep demonstrasi sampai ada proyek klien yang boleh dipublikasikan.

## Putaran 1 (2026-10-12): build awal

| Pemeriksaan | Hasil |
|---|---|
| Lint, typecheck, unit (21/21), build (11 halaman + 404) | Lulus |
| e2e Chromium 3 viewport | 91 lulus, 11 dilewati |
| axe 7 halaman x 3 viewport | 0 pelanggaran |

Lighthouse saat itu (satu kali run): mobile Beranda 84 (LCP 3,4 s), Portofolio 91 (2,9 s), studi kasus 93 (2,6 s), Kontak 95 (2,4 s); desktop 99 sampai 100. Pengukuran ulang baseline yang sama dengan median 3 run ada di tabel putaran 2.
