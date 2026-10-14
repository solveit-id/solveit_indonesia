# Laporan QA

Semua angka di bawah adalah hasil eksekusi nyata di mesin pengembang (Windows 11, Node 22.23, Playwright 1.64 dengan Chromium 156, Firefox, dan WebKit, Lighthouse 13.5) terhadap build produksi yang disajikan oleh `scripts/serve.mjs` (clean URL, 404 per bahasa, kompresi brotli).

## Putaran 6 (2026-10-14/15): morph logo, navbar kaca, slice CTA, Tentang Kami, FAQ, pratinjau responsif, formulir, penamaan ekosistem, kerapian repository

Cakupan: brief "Final experience refinement" fase 1 sampai 12. Baseline: `main` dan `frontend` pada `9338a2a`, `staging` `302542b`, `backend` `1c9ec51` (diverifikasi lokal dan remote sebelum mulai). Tanpa perubahan backend, tanpa dependensi baru, layar pemuatan tidak diubah, SEO/GEO final tetap ditunda ke fase deployment.

### Akar masalah yang diperbaiki

| Masalah | Penyebab (dibuktikan dengan frame yang dijeda lewat Web Animations API) | Perbaikan |
|---|---|---|
| Fragmen wordmark saat navbar meringkas/mengembang ("St", "eit", "NESIA", "IA", huruf "t" dan "o" terpotong) | (1) Lapisan wordmark dan INDONESIA berada **di atas** mark (urutan DOM), sehingga potongan huruf tergambar di atas kapsul. (2) Tepi `clip-path` wordmark mengikuti kotak pembatas mark, padahal siluet mark diagonal dan turun 15,4 persen, sehingga tepi clip memotong huruf di ruang kosong (240 sampai 360 ms). (3) INDONESIA memakai wipe clip sendiri (0,46 s) yang tidak terkait posisi mark. (4) Di ponsel tepi kanan clip menyapu ke kiri dengan fade tertunda 0,2 s | Mark ditumpuk di atas (`z-index`); wordmark dan INDONESIA tidak lagi di-clip, tetapi memudar utuh sambil bergeser sedikit (keluar 200/140 ms ease-out, kembali setelah mark lewat). Hanya transform dan opacity, jadi lebih ringan dari clip-path per frame. Filmstrip sebelum/sesudah di bukti visual |
| Halaman yang dimuat ulang di tengah scroll memutar morph saat GSAP tiba | Keadaan header baru ditulis setelah GSAP dimuat (lazy) | `useLayoutEffect` saat hydration menulis keadaan dari `scrollY` dengan `data-instant` (tanpa transisi) selama dua frame; logika ambang dipusatkan di `syncHeader` |
| Label pratinjau ikut terhitung sebagai label demo | Komponen baru memakai kelas `.demo-label` | Kelas sendiri `.preview-label` dengan tampilan yang sama; `.demo-label` tetap berarti "konsep demonstrasi" |
| Segmen terpilih pratinjau tidak terbaca saat di-hover | Aturan hover lebih spesifik dari `:checked` (tinta di atas tinta) | Hover tidak berlaku untuk segmen terpilih |

### Pemeriksaan otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Lulus (satu-satunya peringatan format: cache lokal `.impeccable/hook.cache.json`, tidak di-commit) |
| `npm test` (Vitest) | 69/69 lulus. Baru: `device-preview.test.ts` (kelas perangkat mengikuti breakpoint situs, skala tidak pernah melebihi panggung atau 1) dan uji kejujuran ekosistem di `content.test.ts` (hanya website berstatus berjalan, tidak ada status "tersedia", Orbit bukan aplikasi, nama OpsHub tetap) |
| `npm run build` | Lulus; 22 halaman terindeks + 404 per bahasa |
| E2E Chromium desktop 1440, 1 worker | 178 lulus, 0 gagal, 5 dilewati (183) |
| E2E Chromium tablet 820, 1 worker | 159 lulus, 0 gagal, 24 dilewati (183) |
| E2E Chromium Pixel 7, 1 worker | 145 lulus, 0 gagal, 38 dilewati (183) |
| E2E Firefox desktop, 1 worker | 177 lulus, 0 gagal, 6 dilewati (183). Firefox memakai jalur cadangan: FAQ membuka instan dan select memakai popup native |
| E2E WebKit desktop 1440, suite penuh, GitHub Actions, 1 worker, tanpa retry | 175 lulus, 0 gagal, 0 flaky, 8 dilewati (183), run [38609496831](https://github.com/solveit-id/solveit_indonesia/actions/runs/38609496831) pada `e8468df` |
| E2E WebKit iPhone 14, suite penuh, GitHub Actions, 1 worker, tanpa retry | 143 lulus, 0 gagal, 0 flaky, 40 dilewati (183), run yang sama |
| axe-core WCAG 2.0/2.1/2.2 A dan AA | 0 pelanggaran, 14 halaman x 2 tema, di desktop, tablet, ponsel, dan Firefox |

Run e2e penuh pertama dihentikan sistem karena memori mesin hampir habis (Chromium "Target crashed", lalu 141 kali "worker process exited unexpectedly"; bukan kegagalan asersi). Setelah memori dibebaskan, setiap project dijalankan ulang di latar depan dalam dua shard berurutan, 1 worker; angka di atas berasal dari run ulang itu. Tidak ada perlindungan memori atau tes yang dilonggarkan.

Cakupan e2e baru (`tests/e2e/experience.spec.ts`): frame morph yang dijeda di delapan titik untuk tiga arah, tanpa clip pada kata dan dengan mark selalu di atas; pembalikan cepat berakhir di keadaan yang benar; halaman yang dibuka di tengah scroll (deep link, discroll browser sebelum hydration) langsung compact tanpa satu pun transisi lockup berjalan dan tanpa `data-instant` tersisa; navigasi dari keadaan compact; backdrop blur dan kilau kapsul; slice CTA header tanpa perubahan ukuran; "Kenali kami" sebagai tautan semantik dengan garis yang tergambar saat fokus; slice "Pelajari prosesnya" dengan rail tetap tujuh langkah; teks visi identik, empat `dt`/`dd` nilai, frasa visi berubah warna maju dan kembali tanpa opacity di bawah 1; peta ekosistem di dua bahasa (8 bagian: 1 berjalan, 1 dirancang, 6 direncanakan; tanpa kata "tersedia sekarang" atau "diluncurkan"), penanda berbalik saat scroll ke atas tanpa menyembunyikan kartu; FAQ di empat halaman (klik, Enter, Space, klik cepat berulang, fokus tetap, jawaban tetap terbuka setelah scroll), satu sistem FAQ per halaman; pratinjau di 5 studi kasus x 2 bahasa berlabel ilustrasi, ganti perangkat mengubah bingkai dan tata letak (sidebar menjadi tombol menu), lebar dari keyboard (Home, panah) dengan `aria-valuetext`, seret tepi bingkai, bingkai 1440 px tidak membuat halaman scroll ke samping; kartu Permasalahan berbeda dari Konteks di dua tema; select mempertahankan nilai dan sumur caret tidak menangkap klik; tombol kirim ber-slice tetap `submit` dan formulir tidak lengkap tidak pernah dinyatakan terkirim; reduced motion. Kontrak yang sengaja berubah diperbarui di `refinement.spec.ts` (lipatan logo kini opacity, bukan inset clip; urutan bab dengan "Pratinjau responsif") dan `polish.spec.ts` (isi kaca 88 persen dan blur; daftar CTA slice yang baru; bab baru di urutan scrollspy).

### Lighthouse

Lighthouse 13.5, mobile default (Moto G Power teremulasi, simulated slow 4G, CPU 4x), Chromium 156 dari Playwright. **Berselang-seling** sebelum/sesudah per halaman, 3 run masing-masing, median; build produksi tanpa `VITE_SITE_URL` di kedua sisi, layar pemuatan penuh, server `scripts/serve.mjs` yang sama, satu browser pada satu waktu. "Sebelum" adalah `9338a2a`.

| Halaman | Performance sebelum / sesudah | LCP (s) | TBT (ms) | Speed Index (s) | CLS |
|---|---|---|---|---|---|
| `/` | 97 / **97** | 1,59 / 1,57 | 133 / 140 | 3,21 / 3,28 | 0 / 0 |
| `/tentang` | 99 / **98** | 1,58 / 1,58 | 77 / 126 | 2,72 / 2,91 | 0 / 0 |
| `/layanan` | 99 / **99** | 1,58 / 1,57 | 84 / 86 | 2,73 / 2,90 | 0 / 0 |
| `/portofolio/sistem-antrean-klinik` | 97 / **96** | 1,58 / 1,57 | 175 / 181 | 2,94 / 2,87 | 0 / 0 |
| `/kontak` | 99 / **99** | 1,59 / 1,56 | 96 / 90 | 2,60 / 2,62 | 0 / 0 |

Accessibility, Best Practices, dan SEO 100 di semua run. Performance tetap 96 sampai 99, LCP di bawah 1,6 s, CLS 0. **Trade-off yang tercatat:** TBT `/tentang` naik dari 77 ke 126 ms (ketiga run sesudah 114 sampai 147 ms, jadi bukan noise). Itu biaya penyiapan timeline scroll baru di halaman itu (frasa visi, sumbu, delapan garis nilai, peta ekosistem); Performance turun satu poin. Studi kasus dan Layanan berubah dalam rentang noise run tunggal. Ukuran (brotli): CSS 15,2 ke 17,9 KB, total JS 224,5 ke 229,0 KB (chunk studi kasus 12,4 ke 15,3 KB, Tentang 1,7 ke 2,5 KB), HTML Beranda 17,4 ke 17,5 KB, Tentang 12,8 ke 13,3 KB, studi kasus 18,9 ke 19,9 KB.

### Kerapian repository

Inventaris berkas terlacak, root, struktur frontend, dokumentasi, konfigurasi agen, aset merek, artefak, export, selector CSS, dan rujukan (impor, skrip, tes, dokumentasi, CI):

| Kandidat | Klasifikasi | Bukti | Tindakan |
|---|---|---|---|
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.gitattributes`, `.editorconfig`, `.github/`, `.claude/`, `.mcp.json`, `.nvmrc` | Wajib atau konvensional di root | Dibaca alat, CI, dan agen dari root | Tetap |
| `PRODUCT.md`, `DESIGN.md`, `.impeccable/` | Wajib di root | Plugin impeccable membaca keduanya dari root proyek | Tetap |
| `logo-solveit-icon.svg`, `logo-solveit-primary.svg` di root | Dapat dipindah | Identik byte dengan `frontend/public/brand/`; tidak dipakai build, hanya dirujuk dokumentasi | `git mv` ke `brand/`; README, PRODUCT, arsitektur, pengembangan, dan komentar `logo-paths.ts` diperbarui; geometri tidak berubah (`cmp` identik) |
| `frontend/src/assets/brand/*.svg` | Terbukti tidak dipakai | Tidak ada impor (Vite hanya membundel aset yang diimpor), tidak dirujuk skrip, tes, atau CI; salinan identik | Dihapus (`git rm`) |
| `getProjectBySlug` (`services/projects.ts`), `isLocale` (`i18n/config.ts`) | Terbukti tidak dipakai | Nol rujukan di kode, tes, skrip, dan dokumentasi; `getProjectBySlug` digantikan `getProjectByPath` di `47e6220` | Dihapus |
| Export yang hanya dipakai di berkasnya sendiri (mis. `LogoGradient`, `matchQuestion`) | Dipakai | Dirujuk di berkas yang sama | Tetap |
| Selector CSS | Semua dipakai | Pemindaian semua kelas di `app.css` terhadap `src/` | Tidak ada yang dihapus |
| Berkas tanpa impor (`root.tsx`, `entry.client.tsx`, `pages/*`, `layouts/*`, `test/setup.ts`) | Dipakai lewat konvensi | Entry framework dan modul route di `routes.ts` | Tetap |
| `.playwright-mcp/`, `.impeccable/review/`, `build/`, `test-results/` | Artefak lokal | Di-gitignore | Tidak disentuh |

### Bukti visual

Disimpan lokal di `.impeccable/review/round-6/` (di-gitignore seperti putaran sebelumnya):

| Bukti | Isi |
|---|---|
| `navbar-morph-collapse-desktop.png`, `navbar-morph-expand-desktop.png`, `navbar-morph-mobile.png` | Frame 0 sampai 700 ms sebelum/sesudah, desktop dan 390 px, kedua arah |
| `header-*-{light,dark}.png`, `nav-cta-hover-*.png` | Kapsul kaca di atas paper, tile navy, dan bidang cobalt footer di dua tema; slice CTA header |
| `before/*.png`, `after/*.png` | Tagline dan "Kenali kami", Visi, Nilai, peta ekosistem, FAQ terbuka, kartu Permasalahan, formulir, pada posisi yang sama |
| `preview-{desktop,tablet,mobile}-*.png`, `select-open-*.png`, `faq-*.png`, `about-*.png` | Pratinjau responsif per mode di desktop gelap/terang dan 390 px; popup select bergaya (Chromium); FAQ; Tentang |

Tidak ada error konsol pada sesi screenshot.

### Status

- **Lulus terverifikasi**: format, lint, typecheck, unit 69/69, build, e2e Chromium (desktop, tablet, Pixel 7) dan Firefox tanpa kegagalan, axe 0 pelanggaran, Lighthouse lima halaman sebelum/sesudah, bukti visual.
- **Lulus terverifikasi (lintas browser)**: suite penuh WebKit desktop dan WebKit iPhone 14 di GitHub Actions. Run pertama pada `ebc9a97` gagal di satu tes baru di kedua project: tes "muat ulang di tengah scroll" bergantung pada kapan router menyimpan posisi scroll sebelum reload, dan di runner WebKit halaman kembali di atas. Lokal (WebKit dan Chromium) posisi pulih dan header benar. Tes diganti dengan deep link yang discroll browser sebelum hydration di semua engine, dan kini juga memastikan tidak ada transisi lockup yang berjalan; tidak ada perubahan kode produk.
- **Keputusan pemilik**: teks visi resmi masih menyebut "melalui Solveit OpsHub"; lihat `docs/product-naming.md`.
- **Ditunda (fase deployment)**: optimasi SEO/GEO final, lihat `docs/seo-geo.md`.

## Putaran 5 (2026-10-14): navbar compact, label demo, bab studi kasus, motion bab, Principles, CTA slice

Cakupan: sembilan masukan pengguna dari evaluasi langsung. Kapsul navbar compact yang lebih jelas dan morph yang menyatu, label demonstrasi, tata letak dan scrollspy bab studi kasus, motion Peta sistem / Alur utama / Yang akan diukur, komposisi "Cara kerja yang bisa Anda pegang.", dan hover slice pada tiga CTA. Juga keputusan batas sistem (website terpisah dari OpsHub) dan SEO/GEO final sebagai tugas fase deployment. Baseline: `main` pada `7443d4a`. Tanpa perubahan backend, tanpa dependensi baru, layar pemuatan tidak diubah.

### Akar masalah yang diperbaiki

| Masalah | Penyebab | Perbaikan |
|---|---|---|
| Kapsul compact menyatu dengan latar | Isi 86 persen `--paper` (warna yang sama dengan halaman) dan garis tepi `--line` 13 persen yang baru muncul 0,3 s setelah kapsul selesai menyusut | Tiga lapisan dengan geometri clip yang sama: rim `--capsule-rim` (20 persen) yang ikut berubah bentuk, isi porselen terangkat 94 persen 1 px di dalamnya, bayangan overlay tipis. Satu treatment, tanpa glow |
| Morph kurang terasa dan "patah" | Radius `round 9999px` langsung menjadi kapsul di awal transisi; garis tepi muncul terpisah; expo-out sangat depan | Radius 1,875 rem yang berinterpolasi dari 0, garis tepi bagian dari bentuk, satu `--morph` 0,7 s `cubic-bezier(0.22, 1, 0.36, 1)` untuk pelat, rim, logo |
| Bab aktif salah atau saling menimpa | Konteks dan Permasalahan sejajar (`md:grid-cols-2`) dengan dua ScrollTrigger `onToggle` independen pada posisi vertikal yang sama | Konteks dan Permasalahan bertumpuk; satu scrollspy deterministik (`src/lib/scrollspy.ts`) menghitung satu bab dari garis baca, offset dokumen tanpa transform, fallback dasar halaman, kunci klik rail sampai input pembaca. Baseline juga tidak menandai bab apa pun setelah Back ke dasar halaman; kini Pengukuran |
| Label demo kecil dan pucat | 13 px tinta redup, garis putus-putus 28 persen | 14 px, frasa utama tinta penuh 650, kapsul berongga 33 derajat, garis putus-putus tinta redup 62 persen, latar porselen terangkat, wrap seimbang |

### Pemeriksaan otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Lulus (satu-satunya peringatan format: cache lokal `.impeccable/hook.cache.json`, tidak di-commit) |
| `npm test` (Vitest) | 66/66 lulus. Baru: `lib/scrollspy.test.ts` (tanpa bab sebelum judul pertama, satu bab, bab panjang tetap aktif di sela, urutan baca untuk bab sejajar, fallback dasar halaman, garis baca di atas titik mendarat anchor) |
| `npm run build` | Lulus; 22 halaman terindeks + 404 per bahasa |
| E2E Chromium desktop 1440, 1 worker | 143 lulus, 0 gagal, 5 dilewati (148) |
| E2E Chromium tablet 820, 1 worker | 125 lulus, 0 gagal, 23 dilewati (148) |
| E2E Chromium Pixel 7, 1 worker | 111 lulus, 1 gagal, 36 dilewati (148); kegagalan itu tes alur yang menggulir terlalu pendek di ponsel (lihat bawah), lulus setelah diperbaiki |
| Ulang akhir pada build final (setelah perbaikan label demo): `polish`, `navigation`, `a11y` di desktop, tablet, Pixel 7 | 151 lulus, 0 gagal, 35 dilewati |
| E2E Firefox desktop, 1 worker | 142 lulus, 0 gagal, 6 dilewati (148) |
| E2E WebKit desktop 1440, suite penuh, GitHub Actions, 1 worker, tanpa retry | 140 lulus, 0 gagal, 0 flaky, 8 dilewati (148) |
| E2E WebKit iPhone 14, suite penuh, GitHub Actions, 1 worker, tanpa retry | 110 lulus, 0 gagal, 0 flaky, 38 dilewati (148) |
| axe-core WCAG 2.0/2.1/2.2 A dan AA | 0 pelanggaran, 14 halaman x 2 tema, di desktop, tablet, ponsel |
| Detektor impeccable | Hanya dua advisory lama (overshoot ikon tema yang sudah disetujui putaran 4); tidak ada temuan pada file yang diubah |

Cakupan e2e baru (`tests/e2e/polish.spec.ts`, 25 tes x project): kapsul compact di kedua tema (opasitas dan warna rim, isi 94 persen, radius 30 px, pelat tepat 1 px di dalam rim, bayangan, kembali penuh di atas), lewat ambang bolak-balik cepat lalu tenang, logo dan kontrol tetap fokus/klik saat compact; label demo di daftar, detail, dan studi kasus tetangga di dua bahasa (teks, kursor bawaan, bukan tombol, tidak keluar dari wadahnya); Konteks di atas Permasalahan; 5 studi kasus x 2 bahasa digulir maju dan mundur melewati delapan bab dengan tepat satu bab aktif dan urutan benar, tanpa bab di atas bab pertama; scroll roda pelan dicatat MutationObserver: tidak pernah dua bab, urutan hanya maju; klik rail (URL hash, fokus, bab aktif sebelum dan sesudah scroll halus selesai), hash langsung, Back, Forward, dan pergantian bahasa (bab aktif = bab di garis baca halaman baru); viewport pendek 620 px; motion peta sistem (kapsul terpentaskan lalu terbuka penuh, sinyal dan cincin kembali tersembunyi), alur maju dan mundur, rencana pengukuran tanpa angka atau persen; reduced motion (semua tampil, penanda alur menyala, tanpa transform); Principles (terpentaskan, terbuka, kursor bawaan, tanpa tautan, hover hanya di pointer halus, tile tidak terangkat); CTA slice (tepat tiga, tidak di header/switch/tutup, bidang masuk saat hover di pointer halus dan tetap di luar pada sentuh, ukuran tetap, warna label, fokus keyboard dengan cincin).

### Temuan yang diperbaiki selama QA

| Temuan | Sumber | Perbaikan |
|---|---|---|
| Judul "Permasalahan" menabrak kolom teks di kartu | Screenshot desktop | Override ukuran judul di `@layer components` kalah dari utilitas `text-title`; `ChapterHead` kini menerima `compact` (skala heading), kolom 5/7 |
| Konteks pendek hampir tidak pernah aktif | Screenshot + rail | Garis baca 30 persen menjadi 22 persen dari sisa tinggi layar |
| Peta sistem lebih dari 2,6 s | e2e | Langkah dipacu eksplisit 0,54 s per bagian (sekitar 2 s total) |
| Label demo keluar dari kartu studi kasus tetangga di ponsel | Screenshot 390 px | `white-space: nowrap` diganti `text-wrap: balance` |
| Tes: hash setelah dua scroll halus yang saling memotong; Back memulihkan posisi tautan di dasar halaman; alur ponsel butuh scroll lebih jauh; tes roda pelan habis waktu di WebKit | e2e | Tes menunggu scroll tenang, membandingkan dengan bab di garis baca (bukan bab tetap), menggulir ke ujung alur, dan anggaran 90 s untuk tes roda. Perilaku produk sama dengan baseline untuk pemulihan scroll |

### WebKit lintas browser (GitHub Actions)

Run lokal WebKit tidak bisa diselesaikan: mesin hanya punya 0,5 sampai 1,5 GB RAM bebas dari 15,4 GB, hydration WebKit butuh sekitar 7,5 s untuk **baseline maupun build baru** (diukur berdampingan), dan tes lama yang tidak tersentuh perubahan ini habis waktu. Satu-satunya hasil lokal adalah `polish.spec.ts` (24 lulus, 1 dilewati). Suite penuh lalu dijalankan di runner bersih lewat workflow baru `.github/workflows/cross-browser-qa.yml` (`workflow_dispatch`, dan sekali saat workflow itu berubah di `frontend`): Ubuntu, Playwright 1.64 WebKit, `PW_ALL_BROWSERS=1`, satu project setelah yang lain, 1 worker, `--retries=0` (flake terlihat sebagai gagal), build produksi dari commit yang sama lewat `webServer` konfigurasi Playwright. Laporan HTML dan JSON disimpan sebagai artefak 14 hari.

Run [38569534271](https://github.com/solveit-id/solveit_indonesia/actions/runs/38569534271) pada `11f1d57`, yang isi `frontend/`-nya identik dengan `89c5445` (commit sesudahnya hanya menambah workflow):

| Project | Lulus | Gagal | Flaky | Dilewati | Durasi |
|---|---|---|---|---|---|
| WebKit desktop 1440 | 140 | 0 | 0 | 8 | 4,6 menit |
| WebKit iPhone 14 | 110 | 0 | 0 | 38 | 4,0 menit |

Semua yang dilewati adalah kondisi `test.skip` di tes itu sendiri, bukan kegagalan: kontrol khusus ponsel di desktop, rail bab dan fitur khusus desktop di iPhone (rail tampil mulai 1024 px), dan fokus keyboard pada tombol slice di WebKit (WebKit tidak berpindah ke tombol dengan Tab secara bawaan; slice saat fokus diverifikasi di Chromium dan Firefox). Spesifikasi putaran ini (`polish.spec.ts`) di WebKit desktop: 24 lulus, 1 dilewati; di iPhone: 11 lulus, 14 dilewati (desktop saja), 0 gagal. Tidak ada perubahan kode atau tes yang dibutuhkan.

### Lighthouse

Lighthouse 13.5, mobile default (Moto G Power teremulasi, simulated slow 4G, CPU 4x), Chromium 156. **Berselang-seling** sebelum/sesudah per halaman, 3 run masing-masing, median; build produksi tanpa `VITE_SITE_URL` di kedua sisi, layar pemuatan penuh (muatan pertama di tab), server `scripts/serve.mjs` yang sama, satu browser pada satu waktu. "Sebelum" adalah `main` `7443d4a`. RAM bebas saat pengukuran sekitar 0,5 GB, sehingga Speed Index kedua sisi lebih tinggi dari putaran 4; pembanding yang adil adalah kolom sebelum di tabel ini.

| Halaman | Performance sebelum / sesudah | LCP (s) | TBT (ms) | Speed Index (s) | CLS |
|---|---|---|---|---|---|
| `/` | 94 / **96** | 1,59 / 1,60 | 232 / 176 | 3,98 / 3,74 | 0 / 0 |
| `/portofolio` | 98 / **98** | 1,60 / 1,59 | 72 / 81 | 3,78 / 3,78 | 0 / 0 |
| `/portofolio/sistem-antrean-klinik` | 98 / **97** | 1,58 / 1,60 | 122 / 141 | 3,11 / 3,04 | 0 / 0 |
| `/en` | 98 / **98** | 1,59 / 1,59 | 104 / 115 | 3,25 / 3,17 | 0 / 0 |

Accessibility, Best Practices, dan SEO 100 di semua run. Performance tetap 96 sampai 98, LCP di bawah 1,6 s, CLS 0. TBT berubah dalam rentang noise run tunggal (studi kasus +19 ms median; sebaran run sebelum 99 sampai 177 ms, sesudah 116 sampai 246 ms). Ukuran: CSS 14,2 ke 15,3 KB brotli, total JS 223,2 ke 224,5 KB, HTML Beranda 17,3 ke 17,5 KB, HTML studi kasus tetap 18,9 KB.

### Bukti visual

Disimpan lokal di `.impeccable/review/round-5/` (di-gitignore seperti putaran sebelumnya), diambil dari build final dan dari baseline yang sama-sama disajikan lokal:

| Bukti | Isi |
|---|---|
| `navbar-before-after.png` | Kapsul compact di atas Principles (paper), karya (sunken), dan bidang cobalt footer, terang dan gelap, sebelum lalu sesudah |
| `navbar-morph-filmstrip.png`, `navbar-tablet-mobile-after.png` | Morph normal ke compact (0 sampai 450 ms) dan kembali (90 sampai 750 ms); tablet dan ponsel |
| `case-context-before-after.png` | Konteks dan Permasalahan sejajar dengan rail menandai Permasalahan saat Konteks dibaca (sebelum) lalu bertumpuk dengan Konteks aktif (sesudah) |
| `case-chapters-after-desktop.png`, `case-chapters-after-mobile.png` | Peta sistem, alur, pengukuran di desktop dan ponsel, terang dan gelap |
| `badge-before-after.png`, `badge-mobile-after.png` | Label demo di detail (dua tema), kartu daftar, dan studi kasus tetangga EN di ponsel |
| `principles-before-after.png`, `principles-mobile-after.png` | Komposisi di tengah entrance dan akhir, hover portal di gelap; ponsel |
| `slice-cta-frames.png` | Slice CTA hero: diam, 120 ms, 260 ms, 700 ms, keluar 200 ms, fokus keyboard, gelap; "Lihat portofolio" terang/gelap; CTA bidang penutup |

Tidak ada error konsol pada sesi screenshot.

### Status

- **Lulus terverifikasi**: format, lint, typecheck, unit 66/66, build, e2e Chromium (desktop, tablet, Pixel 7) dan Firefox tanpa kegagalan, axe 0 pelanggaran, Lighthouse empat halaman sebelum/sesudah, bukti visual.
- **Lulus terverifikasi (lintas browser)**: suite penuh WebKit desktop dan WebKit iPhone 14 di GitHub Actions, lihat bagian "WebKit lintas browser" di atas.
- **Ditunda (fase deployment)**: optimasi SEO/GEO final, lihat `docs/seo-geo.md`.

## Putaran 4 (2026-10-13): layar pemuatan bermerek, morph navbar, kontrol mengambang, detail portofolio

Cakupan: 16 masukan pengguna dari evaluasi langsung. Layar pemuatan fullscreen bermerek (membatalkan keputusan putaran 3, atas permintaan pengguna), tombol tema dan pemilih bahasa, header lebih lega dengan morph logo primer ke ikon, urutan menu baru, dock kembali ke atas dan asisten, audit kursor dan kontrol tutup merah, logo teknologi, desain ulang detail studi kasus, dan penghalusan motion. Baseline: `main` pada `1ea6eea`.

### Pemeriksaan otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Lulus. Satu-satunya peringatan format adalah cache lokal hook desain (`frontend/.impeccable/hook.cache.json`, di-exclude dari git) |
| `npm test` (Vitest) | 60/60 lulus. Baru: `lib/boot.test.ts` (urutan penuh lalu singkat dalam satu tab, exit begitu kapsul keempat mengunci, storage diblokir tetap penuh, reduced motion, batas 2,6 s, hook opt-out, `bootSettled`; setiap tes di dokumen terpisah) dan `data/technologies.test.ts` (setiap teknologi proyek terdeskripsi, hanya logo yang dibundel, REST API tanpa logo merek, judul "diusulkan"/"proposed") |
| `npm run build` | Lulus; 22 halaman terindeks + 404 per bahasa |
| E2E Chromium desktop 1440, 1 worker | 118 lulus, 0 gagal, 5 dilewati sesuai desain (123) |
| E2E Chromium tablet 820, 1 worker | 113 lulus, 0 gagal, 10 dilewati (123) |
| E2E Chromium Pixel 7, 1 worker | 100 lulus, 0 gagal, 23 dilewati (123) |
| E2E Firefox desktop, 1 worker | 117 lulus, 0 gagal, 6 dilewati (123) |
| E2E WebKit desktop, 1 worker | 116 lulus, 0 gagal, 7 dilewati (123) |
| E2E WebKit iPhone 14, 1 worker | 99 lulus, 0 gagal, 24 dilewati (123) |
| axe-core WCAG 2.0/2.1/2.2 A dan AA | 0 pelanggaran di 14 halaman x 2 tema di keenam project di atas |

Satu putaran regresi bersih pada kode final, dijalankan berurutan per project dengan 1 worker (memori bebas 1,1 sampai 2,5 GB). Dua run sebelumnya dihentikan sistem karena tekanan memori (satu run Lighthouse dan satu run e2e paralel yang worker-nya gagal mulai dengan `0xC0000142`); keduanya diulang dengan cara berurutan, bukan dengan mematikan perlindungan memori.

Cakupan e2e baru (`tests/e2e/refinement.spec.ts`): layar pemuatan (urutan penuh pada muatan pertama, singkat pada reload di tab yang sama dan lebih cepat dari yang penuh, penuh lagi di tab baru; menutupi paint pertama, ukuran layar penuh, `pointer-events: none`, judul halaman sudah ada di bawahnya, exit paling lambat 2,6 s setelah frame pertama entrance, hilang setelah sapuan; sekali per dokumen, tidak muncul pada navigasi klien; tema gelap dari frame pertama di route EN; reduced motion tanpa gerak kapsul; tanpa JavaScript tidak tampil; jaringan lambat tetap tampil lalu pergi), gulungan ikon tema dan `view-transition-name`, gulungan label bahasa berlawanan arah dan toggle ponsel, lipatan wordmark ke mark dan kembali (kedua varian lebar), area di luar kapsul header tetap bisa diklik, tombol kembali ke atas di samping peluncur dan tidak tertutup panel asisten, peluncur yang terbuka dipangkas, kontrol tutup merah, kursor (pointer, not-allowed, text), lima studi kasus x dua bahasa menampilkan setiap teknologi dengan logo dan nama tanpa tautan atau tombol, rail bab mengikuti pembaca dan urutan cerita. Urutan menu baru diuji di kedua bahasa.

Opt-out e2e: fixture menulis `window.__solveitBoot = "off"` sebelum skrip halaman berjalan, sehingga tes lain tidak menunggu sekitar 1,3 s per muatan; tes layar pemuatan memakai `bootLoader: true` dan melihat urutan yang sebenarnya.

### Temuan yang diperbaiki selama QA

| Temuan | Sumber | Perbaikan |
|---|---|---|
| TBT Beranda naik 440 ke 581 ms (run berurutan) | Lighthouse, `long-tasks` | Long task terbesar (sekitar 300 ms, juga di baseline) adalah semua setup GSAP yang berjalan beruntun saat GSAP pertama tiba. `useMotion` kini mengantrekan setup pada muatan pertama, satu per task, urutan tetap; setelah GSAP dimuat (navigasi klien) setup tetap sinkron sehingga entrance tidak berkedip. TBT Beranda menjadi 191 ms vs 255 ms baseline |
| Speed Index naik karena overlay menutupi halaman yang sudah terlukis | Lighthouse, filmstrip | Timeline dipadatkan dua kali (1,7 s ke 1,5 s ke sekitar 1,3 s total) tanpa membuang ketukan: kedatangan kapsul, wordmark, INDONESIA, sapuan 33 derajat. Sisa kenaikan dijelaskan di bawah |
| Overlay bisa tertahan bila main thread sibuk saat batas 2,6 s jatuh tempo (timer tidak bisa menyela long task) | Tes kontrak waktu di dalam halaman | Failsafe CSS: animasi `boot-failsafe` dengan delay 3,4 s yang dijalankan compositor, sama di keadaan `intro` dan `exit` sehingga tidak pernah mulai ulang |
| Ikon tema tetap miring setelah diketuk di layar sentuh (hover tersangkut) | e2e tablet/ponsel | Semua hover yang menggerakkan sesuatu hanya di `@media (hover: hover)` |
| Elemen `<header>` tetap menangkap klik di luar kapsul mengambang | e2e `elementFromPoint` | `pointer-events: none` pada header saat ringkas, kontrol di dalamnya tetap aktif |
| Ikon teknologi terlalu kecil dan pucat (MySQL tidak terbaca) | Screenshot | Sumur 2,5 rem, ikon 1,375 rem, warna tinta penuh |
| Path logo muncul tiga kali per halaman (header, overlay, footer) | Ukuran HTML | Satu sprite `<symbol>`/`<use>` bersama (`logo-sprite.tsx`); ikon teknologi juga satu sprite per studi kasus |
| WebKit melaporkan `cursor: auto` untuk tautan dan input teks | e2e WebKit | Kursor dinyatakan eksplisit di base layer (`a[href]` pointer, input teks dan textarea `text`) agar sama di semua mesin |
| Nilai clip-path diserialisasi `71.400002%` di WebKit | e2e WebKit iPhone | Tes membandingkan angka dengan pembulatan 0,1 |
| Dua tes yang mengunjungi 14 halaman melewati 30 s | Run penuh 16 worker | Diukur: 14 muatan tanpa JS sekitar 1,4 s pada build lama maupun baru (Pixel 7), jadi bukan regresi tetapi kepadatan worker. Lulus pada batas bawaan 30 s dengan 1 dan 2 worker; kenaikan batas waktu yang sempat dibuat dibatalkan |
| Overlay penuh menutupi halaman sekitar 1,3 s pada setiap muatan dokumen | Speed Index | Disetujui pemilik produk: urutan penuh hanya pada muatan pertama di tab (`sessionStorage`), versi singkat sekitar 0,6 s pada refresh berikutnya, dan exit dimulai begitu kapsul keempat mengunci. Terukur: penuh 1,29 s, singkat 0,58 s dari paint pertama sampai overlay hilang |

### Lighthouse

Lighthouse 13.5, mobile default (Moto G Power teremulasi, slow 4G, CPU 4x). **Run berselang-seling** tiga varian per halaman, 3 run masing-masing, median; semua build tanpa `VITE_SITE_URL`, disajikan satu proses Node dengan logika `scripts/serve.mjs`, satu browser pada satu waktu:

- **Sebelum**: `main` `1ea6eea`.
- **Penuh**: build final, muatan pertama di tab (urutan sekitar 1,3 s).
- **Singkat**: build final yang sama dengan pemeriksaan sesi dipaksa "sudah dilihat" pada salinan sementara, karena Lighthouse selalu membuka tab baru sehingga reload dalam sesi tidak bisa diulang langsung. Hanya satu ekspresi di skrip head yang diganti; kode produksi tidak berubah.

| Halaman | Performance sebelum / penuh / singkat | LCP (s) | TBT (ms) | Speed Index (s) | CLS |
|---|---|---|---|---|---|
| `/` | 96 / **97** / **98** | 1,59 / 1,58 / 1,57 | 196 / 153 / 147 | 2,96 / 3,21 / 2,89 | 0 |
| `/portofolio` | 99 / **98** / **98** | 1,57 / 1,57 / 1,57 | 92 / 109 / 79 | 2,71 / 3,25 / 3,08 | 0 |
| `/portofolio/sistem-antrean-klinik` | 99 / **98** / **98** | 1,57 / 1,58 / 1,58 | 101 / 135 / 130 | 2,56 / 2,78 / 2,89 | 0 |
| `/kontak` | 100 / **99** / **99** | 1,44 / 1,59 / 1,58 | 85 / 90 / 85 | 1,95 / 2,58 / 2,32 | 0 |
| `/en` | 97 / **97** / **98** | 1,45 / 1,58 / 1,58 | 193 / 152 / 101 | 2,72 / 3,09 / 2,87 | 0 |

Accessibility, Best Practices, dan SEO 100 pada ketiga varian di kelima halaman. Data mentah: `lh-f-*` (varian final), serta `lh-r2*`/`lh-r3*` dari putaran pengukuran sebelumnya di direktori kerja QA.

Riwayat optimasi selama putaran ini (run berurutan, lalu berselang-seling): build pertama menurunkan Beranda 87 ke 82 (TBT 440 ke 581 ms). Setelah setup GSAP diantrekan per task dan timeline dipadatkan, Beranda 94 ke 96 dan `/en` 93 ke 96 dengan TBT lebih rendah dari baseline. Exit begitu kapsul mengunci dan mode singkat menurunkan biaya Speed Index lagi (tabel di atas).

Accessibility, Best Practices, dan SEO 100 di semua halaman yang diukur, sebelum dan sesudah.

Trade-off layar pemuatan (dilaporkan apa adanya): Performance tetap 97 sampai 99, LCP di bawah 1,6 s, CLS 0, dan TBT setara atau lebih rendah dari baseline di sebagian besar halaman. **Speed Index naik** karena overlay menutupi halaman yang sudah terlukis: urutan penuh +0,22 sampai +0,63 s, versi singkat -0,07 sampai +0,38 s dibanding baseline. `/kontak` memiliki baseline paling cepat (FCP 0,84 s) sehingga kenaikannya paling terlihat (LCP 1,44 ke 1,59 s, tetap jauh di bawah 2,5 s). Alternatif yang belum diterapkan: overlay tidak penuh (logo merakit di tengah sementara konten sudah terlihat redup di bawahnya).

### Ukuran

| | Sebelum | Sesudah |
|---|---|---|
| CSS (transfer brotli) | 13 KB | 15 KB |
| HTML Beranda (brotli) | 17,0 KB | 17,6 KB |
| HTML studi kasus (brotli) | 13,1 KB | 19,3 KB (logo teknologi, sampul mini sebelumnya/berikutnya, struktur bab) |

### Review visual

Bukti disimpan lokal di `.impeccable/review/round-4/` (folder ini di-gitignore seperti review putaran sebelumnya), diambil dari build final lewat screencast CDP (paint nyata, tanpa jeda screenshot):

| Bukti | Isi |
|---|---|
| `loader-full-desktop.png`, `loader-full-mobile.png`, `loader-full-dark-en.png` | Muatan pertama: lembar porselen (atau gelap bila tema gelap dipilih, route EN), kapsul merakit, wordmark dan INDONESIA, sapuan 33 derajat dengan pita cobalt, lalu mark hero merakit di halaman |
| `loader-short-reload.png` | Reload di tab yang sama: logo terakit dalam sekitar 0,2 s, sapuan, halaman tampil. Timeline terukur: paint pertama 184 ms, exit 399 ms, selesai 760 ms |
| `loader-slow-network.png` | 1,6 Mbps, latensi 150 ms, CPU 4x: paint pertama 2,2 s, overlay tetap tampil penuh lalu pergi |
| `navbar-condense.png`, `navbar-expand.png` | Wordmark ditelan mark saat meringkas (sekitar 0,6 s) dan keluar lagi saat mengembang; kapsul pelat menyusut dan melebar mengikuti |
| `theme-toggle.png`, `language-switch.png` | Matahari dan bulan bergulir dua arah; thumb bahasa meregang dan label menggulung |
| `dock-assistant-open.png`, `assistant-close-hover.png` | Panel asisten di atas baris dock, tombol kembali ke atas terlihat di sampingnya, peluncur "Tutup" terpangkas; tombol X merah halus saat hover |
| `case-study-desktop-chapters.png`, `case-study-dark-technology.png`, `case-study-mobile-facts.png` | Bab studi kasus, logo teknologi di tema gelap, lembar fakta di ponsel |

Timeline urutan penuh terukur: paint pertama 248 ms, kapsul keempat mengunci dan exit 891 ms, selesai 1533 ms (1,29 s tertutup). Tidak ada error konsol pada sesi screenshot.

Status verifikasi:

- **Lulus terverifikasi**: format, lint, typecheck, unit 60/60, build, e2e enam project (663 lulus, 0 gagal), axe 0 pelanggaran, Lighthouse lima halaman x tiga varian, bukti visual di atas.
- **Gagal terverifikasi**: tidak ada pada kode final.
- **Terhambat lingkungan**: run paralel penuh (lebih dari 2 worker) tidak dapat dijalankan dengan memori mesin ini; diganti run berurutan 1 worker.
- **Tidak diuji**: Safari iOS dan Android fisik, pembaca layar nyata, angka lapangan (CrUX/INP) sebelum domain aktif.

### Keterbatasan

- Lighthouse adalah emulasi di mesin pengembang dengan memori terbatas; angka lapangan baru tersedia setelah domain aktif.
- Firefox dan WebKit diuji lewat build Playwright, bukan Safari iOS fisik; pembaca layar nyata belum diuji manual.
- Logo teknologi adalah merek milik pemiliknya (Simple Icons, CC0), dipakai hanya untuk mengidentifikasi teknologi yang diusulkan.

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
