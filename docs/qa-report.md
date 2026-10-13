# Laporan QA

Semua angka di bawah adalah hasil eksekusi nyata di mesin pengembang (Windows 11, Node 22.23, Playwright 1.64 dengan Chromium 156, Firefox, dan WebKit, Lighthouse 13.5) terhadap build produksi yang disajikan oleh `scripts/serve.mjs` (clean URL, 404 per bahasa, kompresi brotli).

## Putaran 3 (2026-10-13): motion, interaksi premium, asisten, testimoni

Cakupan: tombol tema dan pemilih bahasa, header adaptif dengan urutan menu baru, tombol kembali ke atas, umpan balik pemuatan, Asisten Solveit (panduan otomatis), seksi cerita klien, kosakata motion, dan evaluasi Lenis. Baseline: `main` pada `d2b9956`.

### Pemeriksaan otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Lulus, 0 masalah |
| `npm test` (Vitest) | 50/50 lulus. Baru: mesin asisten (jawaban topik di kedua bahasa dengan tautan ke route nyata, hanya kontak terkonfirmasi, pencocokan FAQ, fallback jujur dengan eskalasi, tanpa harga, durasi, atau hasil karangan) dan integritas testimoni (hanya entri non-demo dengan izin bertanggal yang boleh tampil; daftar kosong sesuai PRODUCT.md; placeholder menyebut dirinya placeholder). Larangan em dash kini juga memeriksa kosakata asisten dan placeholder |
| `npm run build` | Lulus; 22 halaman terindeks, plus `/pratinjau/testimoni` (`noindex`, tidak masuk sitemap) dan 2 halaman 404 |
| `npm run test:e2e` (Chromium desktop 1440, tablet 820, Pixel 7) | 263 lulus, 0 gagal, 31 dilewati sesuai desain |
| `PW_ALL_BROWSERS=1` (Chromium x3, Firefox, WebKit desktop, WebKit iPhone 14), 4 worker | 523 lulus, 6 gagal pada run penuh. Diperiksa satu per satu: (1) WebKit tidak memfokuskan tautan saat diklik mouse, jadi asersi fokus pada pemilih bahasa diganti dengan kontrak sebenarnya (fokus tidak ditarik ke `<main>`); (2) lima tes yang mengunjungi setiap halaman melewati batas 30 detik di bawah beban paralel. Waktu hydration WebKit diukur sama dengan `main` (rata-rata 1,22 s vs 1,28 s per halaman), jadi batas kedua tes itu dinaikkan ke 90 detik seperti tes axe. Semua lulus saat dijalankan ulang |
| axe-core WCAG 2.0/2.1/2.2 A dan AA | 0 pelanggaran di 14 halaman x 2 tema, ditambah panel asisten yang terbuka |
| Detektor Impeccable | 0 temuan pada file UI yang berubah |

Cakupan e2e baru (`tests/e2e/interactions.spec.ts`): tombol tema ditekan lima kali beruntun, ukuran tetap, keadaan akhir dan ikon benar; pemilih bahasa menuju halaman setara, menjaga posisi scroll dan tidak menarik fokus, history back; toggle bahasa ponsel; umpan balik pemuatan (muatan pertama tanpa status, chunk ditahan 2,5 s menampilkan runner, chip, dan `role="status"`, navigasi yang chunk-nya sudah ada tidak menampilkan apa pun); tombol kembali ke atas (tersembunyi di atas, muncul, kembali ke 0, fokus ke `<main>`); Back memulihkan posisi scroll; header adaptif dengan histeresis dan tinggi tetap 72 px; asisten (topik, FAQ, fallback dengan tautan WhatsApp yang membawa pertanyaan, Escape, fokus kembali ke peluncur, halaman inert di ponsel, **tidak ada satu pun request ke luar origin**); scroll roda di panel tidak menggulir halaman; seksi cerita klien tanpa `blockquote` dan tanpa Review/AggregateRating; halaman pratinjau `noindex` dan bisa dinavigasi dengan keyboard; tanpa JavaScript konten dan navigasi bekerja dan tidak ada kontrol mengambang yang mati. Urutan menu diuji di kedua bahasa.

### Temuan yang diperbaiki selama QA

| Temuan | Sumber | Perbaikan |
|---|---|---|
| **Back tidak memulihkan posisi scroll** (selalu kembali ke 0). Sudah ada di `main` | Evaluasi Lenis, lalu jejak `scrollY` setelah Back | `html:focus-within { scroll-behavior: smooth }` membuat pemulihan scroll router menjadi scroll halus yang terputus. Aturan global dihapus; scroll halus diminta per aksi. Setelahnya Back kembali tepat ke 1800 px |
| Beranda: TBT naik dan Performance turun 3 poin setelah fitur baru | Lighthouse, 5 run berselang-seling | `styleLayout` naik dari 765 ke 1331 ms: loader kapsul di chip status selalu ada di DOM (opacity 0) dengan animasi tak berujung pada path SVG, yang tidak dikomposit. Animasi kini hanya berjalan saat chip sibuk. Beranda menjadi lebih cepat dari baseline (median 93 vs 86 pada run berselang-seling) |
| Kapsul header ringkas terlalu sempit di ponsel (kontrol 44 px menempel tepi kapsul) | Screenshot 390 px | Kapsul mengambang hanya mulai 768 px; di bawahnya permukaan penuh dan logo mengecil |
| Halaman pratinjau memakai label "Konsep demonstrasi, bukan proyek klien" | Screenshot | Label sendiri: "Placeholder tata letak, bukan testimoni" |
| Nama aksesibel peluncur tidak memuat teks yang terlihat (WCAG 2.5.3) | Review kode | Nama berasal dari label yang terlihat ("Tanya Solveit" / "Tutup"); kedua label berbagi satu sel grid agar lebar kapsul tetap |
| Dua landmark `region` dengan nama sama di seksi testimoni | e2e | Carousel menjadi `role="group"` dengan `aria-roledescription` |
| Pertanyaan "berapa biaya bikin website" dijawab dengan topik Layanan | Unit test | Kata kunci FAQ berbobot 2,5 kali kata kunci topik |

### Keputusan: overlay pemuatan layar penuh

Ditolak. Setiap halaman di-prerender dan terlukis sebelum JavaScript dimuat (bootstrap setelah FCP), LCP adalah judul halaman, dan sebagian besar navigasi klien selesai di bawah 150 ms. Overlay penuh hanya akan menutupi konten yang sudah siap atau menambah jeda buatan. Penggantinya diskalakan ke lama tunggu sebenarnya: tidak ada apa pun di bawah 150 ms, runner tak-tentu setelah 150 ms, chip bermerek "empat kapsul merakit diri" dengan pengumuman screen reader setelah 900 ms, dan chip "Memuat asisten" untuk chunk asisten. Tidak ada persentase.

### Keputusan: Lenis

Prototipe Lenis 1.3.11 (`autoRaf`, CSS resmi) disuntikkan ke build produksi yang sama dan dibandingkan dengan scroll native di Chromium desktop 1440 px, dua run per mode, setelah perbaikan pemulihan scroll di atas.

| Ukuran | Native | Lenis |
|---|---|---|
| Waktu main thread selama 24 langkah roda | 857 sampai 922 ms | 1008 sampai 1081 ms (sekitar +18 persen) |
| Frame di atas 25 ms dalam rentang yang sama | 65 | 119 sampai 123 |
| Scroll yang masih bergerak 150 ms setelah input berhenti | 0 px | 57 sampai 94 px |
| Main thread saat diam (3 s) | 211 sampai 222 ms | 217 sampai 226 ms |
| Pan portofolio ter-pin, tombol End, pemulihan saat Back | Bekerja | Bekerja |
| Roda di atas log asisten | Log bergulir 400 px, halaman diam | Log diam, **halaman bergulir 400 px** (butuh `data-lenis-prevent` di setiap area gulir) |

Keputusan: tetap native. Lenis menambah biaya main thread dan inersia tanpa manfaat bagi pengguna sentuh (mayoritas audiens di ponsel; Lenis tidak menghaluskan sentuhan secara default), membajak scroll bersarang, dan menimpa pengaturan scroll sistem pengunjung. Instalasi hanya dilakukan di folder sementara, bukan di proyek.

### Lighthouse

Metode sama dengan putaran 2: Lighthouse 13.5, mobile default (Moto G Power teremulasi, slow 4G, CPU 4x) dan `--preset=desktop`, **median 3 run per halaman**, build produksi tanpa `VITE_SITE_URL` di kedua sisi, server `scripts/serve.mjs` yang sama, mesin yang sama. "Sebelum" diukur ulang hari ini dari `main` (`d2b9956`); angkanya lebih rendah dari laporan putaran 2 karena TBT di mesin ini lebih tinggi hari ini, jadi pembanding yang adil adalah kolom "sebelum" di bawah, bukan putaran 2.

| Halaman | Mobile Perf sebelum | Mobile Perf sesudah | LCP sebelum / sesudah | TBT sebelum / sesudah | Desktop Perf sesudah | CLS |
|---|---|---|---|---|---|---|
| `/` | 89 | **95** | 1,62 / 1,45 s | 367 / 222 ms | 100 | 0 |
| `/portofolio` | 99 | 98 | 1,63 / 1,59 s | 87 / 139 ms | 100 | 0 |
| `/portofolio/sistem-antrean-klinik` | 99 | 98 | 1,62 / 1,58 s | 84 / 160 ms | 100 | 0 |
| `/kontak` | 100 | 99 | 1,47 / 1,45 s | 48 / 69 ms | 100 | 0 |
| `/en` | 86 | 90 | 1,64 / 1,60 s | 408 / 359 ms | 100 | 0 |

Accessibility, Best Practices, dan SEO 100 di semua halaman, kedua preset. Beranda juga diukur dengan 5 run berselang-seling sebelum/sesudah: median 86 vs 93, TBT 419 vs 271 ms. Selisih 1 poin pada Portofolio, studi kasus, dan Kontak berada di dalam sebaran run (misalnya studi kasus 98/98/94 sesudah, 99/89/99 sebelum). `/en` (90) tetap di bawah target 95 dengan sebaran besar (84 sampai 95); TBT-nya berasal dari hydration yang sudah ada di baseline, bukan dari fitur baru.

### Ukuran bundle

| | Sebelum | Sesudah |
|---|---|---|
| Seluruh JS (gzip, termasuk chunk lazy) | 226,8 KB | 241,6 KB |
| Di antaranya chunk asisten (lazy, hanya saat ada niat) | - | 6,6 KB |
| CSS (gzip) | 10,9 KB | 13,8 KB |

### Review visual

Satu putaran screenshot berbatch (desktop 1440 dan Pixel 7, terang dan gelap): hero, header ringkas, seksi cerita klien, asisten terbuka, jawaban FAQ, fallback, hover kontrol header, halaman pratinjau, bottom sheet ponsel, menu ponsel, dock yang menyingkir dari tombol kirim Kontak, dan chip pemuatan dengan chunk yang ditahan. Temuan di tabel di atas diperbaiki, lalu dikonfirmasi dengan satu putaran ulang.

### Keterbatasan

- Belum ada testimoni klien yang diizinkan; beranda menampilkan janji tertulis. Komponen kutipan hanya terlihat di `/pratinjau/testimoni` dengan placeholder.
- Asisten adalah panduan berbasis aturan dengan kosakata terbatas; pertanyaan di luar kosakata dialihkan ke tim. Integrasi AI menunggu backend Laravel.
- Lighthouse dan evaluasi Lenis adalah emulasi di mesin pengembang; angka lapangan (CrUX, INP) baru tersedia setelah domain aktif. Firefox dan WebKit diuji lewat build Playwright, bukan Safari iOS fisik; pembaca layar nyata belum diuji manual.
- View Transition tema membutuhkan dukungan browser (Chromium, Safari 18, Firefox 144 ke atas); browser lain berganti tema secara instan.

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
