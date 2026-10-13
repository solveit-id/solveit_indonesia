# Arsitektur

## Gambaran

```text
solveit_indonesia/
├── frontend/   React 19 + TypeScript (strict) + Vite 8 + React Router 7 (framework mode, prerender statis)
├── backend/    Disiapkan untuk Laravel 13 (PHP 8.5). Belum berisi kode; lihat backend/README.md
├── docs/       Dokumentasi proyek (file ini, desain, SEO/GEO, integrasi, QA)
├── PRODUCT.md  Fakta produk yang sudah dikonfirmasi (sumber kebenaran konten)
└── logo-solveit-*.svg  Aset merek asli (sumber identitas visual, jangan diubah bentuknya)
```

Fase ini hanya membangun frontend publik. Tidak ada backend, autentikasi, atau endpoint. Formulir konsultasi menyusun pesan yang dikirim pengunjung sendiri lewat WhatsApp atau email.

## Frontend

| Lapisan | Lokasi | Isi |
|---|---|---|
| Route modules (halaman) | `src/pages/` | Satu file per halaman (dipakai untuk kedua bahasa), masing-masing mengekspor `meta` dan komponen default |
| i18n | `src/i18n/` | `config.ts` (bahasa, peta path per halaman), `paths.ts` (resolusi URL, pasangan halaman lintas bahasa, daftar route), `messages/{id,en}.ts` (teks antarmuka bertipe), `index.ts` (`useI18n`) |
| Layout | `src/layouts/site-layout.tsx` | Header, footer, umpan balik navigasi, dock mengambang, fokus dan transisi antarhalaman |
| Komponen | `src/components/{brand,layout,ui,portfolio,contact,feedback,assistant,sections}` | Komponen presentasi; `brand/logo-paths.ts` berisi path logo asli; `assistant/assistant-panel.tsx` dimuat lazily |
| Hooks | `src/hooks/` | `use-reveal`, `use-tilt`, `use-parallax`, `use-hydrated`, `use-delayed-flag` |
| Lib | `src/lib/` | `motion.ts` (pemuatan GSAP + `useMotion`), `theme.ts` (tema terang/gelap), `seo.ts` (meta, hreflang, JSON-LD), `device.ts`, `cn.ts` |
| Services | `src/services/` | Akses konten per bahasa (`content.ts`, `projects.ts`), pengiriman inquiry (`inquiry.ts`), mesin panduan asisten (`assistant.ts`), dan testimoni yang boleh tampil (`testimonials.ts`); titik tukar ke API |
| Data | `src/data/` | Fakta yang tidak bergantung bahasa (perusahaan, urutan layanan dan proses, dasar proyek, navigasi) dan teks per bahasa di `src/data/locales/{id,en}/` |
| Types | `src/types/` | Kontrak tipe konten, inquiry, asisten (`AssistantEngine`), dan testimoni |
| Config | `src/config/site.ts` | Variabel lingkungan (`VITE_SITE_URL`, `VITE_API_BASE_URL`, verifikasi Search Console) |
| Styles | `src/styles/app.css` | Design tokens (CSS variables + Tailwind v4 `@theme`), komponen dasar, motion CSS |

### Rendering dan routing

- `react-router.config.ts`: `ssr: false` + `prerender`. Setiap halaman publik dalam kedua bahasa (termasuk tiap studi kasus) di-build menjadi HTML statis lengkap dengan metadata dan JSON-LD, lalu di-hydrate di browser.
- Bahasa ditentukan oleh URL saja: Indonesia di root (URL lama tetap), Inggris di bawah `/en` dengan path terjemahan (`/en/services`, `/en/portfolio/<slug-inggris>`). Satu modul halaman melayani dua route ber-id berbeda (`services-id`, `services-en`); komponen membaca bahasa dari `useLocation()`, sehingga prerender, hydration, dan `<html lang>` selalu sama.
- Studi kasus didaftarkan sebagai route eksplisit per slug dan per bahasa (`src/routes.ts`). URL yang tidak dikenal jatuh ke route `*` atau `en/*`, sehingga `404.html` dan `en/404.html` di-hydrate pada route yang sama dengan saat dirender. Rute dinamis `:slug` akan dipakai lagi saat data berasal dari API (lihat `integration-plan.md`).
- `scripts/postbuild.mjs` menghasilkan `404.html` per bahasa, `robots.txt`, dan `sitemap.xml` dengan alternatif hreflang (hanya jika `VITE_SITE_URL` diisi) dari HTML yang benar-benar di-prerender, melewati halaman `noindex`. Langkah yang sama memindahkan bootstrap JavaScript ke belakang first paint (lihat Performa).
- Preferensi pengunjung: tema dan bahasa disimpan di `localStorage`. Skrip kecil di `<head>` (`root.tsx`) memulihkan tema gelap sebelum paint, dan hanya mengarahkan pengunjung yang pernah memilih Inggris dari `/` (tanpa referrer situs ini) ke `/en`. Crawler tidak menyimpan preferensi, jadi tidak pernah dialihkan.

### Tema

- Terang adalah default bagi semua pengunjung; preferensi OS tidak diikuti. Gelap hanya aktif bila dipilih lewat tombol tema.
- Token warna ada di `src/styles/app.css` (`:root` dan `:root[data-theme="dark"]`); varian `dark:` Tailwind mengikuti atribut yang sama.
- Pergantian tema memakai satu View Transition dengan sapuan di sepanjang sumbu 33 derajat (`src/lib/theme.ts`), bukan transisi warna per elemen. Gelap menyapu dari kiri atas, terang dari kanan bawah; pergantian beruntun melewati (`skipTransition`) sapuan yang sedang berjalan. Tanpa dukungan View Transitions atau dengan reduced motion, pergantian instan.

### Performa

- Setiap halaman lengkap sebagai HTML statis; JavaScript hanya menambah interaksi. `postbuild` menghapus modulepreload dari `<head>` dan menyisipkan kembali preload dan skrip modul yang sama setelah browser melaporkan `first-contentful-paint` (cadangan 3 detik untuk tab latar). CSS dan font tidak lagi berebut bandwidth dengan sekitar 20 modul JS.
- Konsekuensinya: sebelum hydration (beberapa milidetik setelah paint di perangkat nyata), tautan bekerja sebagai navigasi biasa, formulir pemilih layanan di hero tetap dikirim lewat GET, dan menu WhatsApp (`<details>`) tetap bisa dibuka.
- Judul halaman masuk dengan animasi transform saja (tanpa opacity 0), sehingga terlukis pada frame pertama dan dihitung sebagai LCP.

### Motion

- GSAP (ScrollTrigger, Flip) dimuat secara dinamis lewat `useMotion` (`src/lib/motion.ts`) setelah halaman dilukis, sehingga tidak berada di jalur render kritis.
- `useMotion` menjalankan setup di dalam `gsap.context()` dan me-revert seluruh tween, ScrollTrigger, dan `matchMedia` pada cleanup layout effect (sebelum React menghapus DOM, penting untuk elemen yang di-pin).
- Semua efek dibungkus `gsap.matchMedia()` dengan kondisi `prefers-reduced-motion: no-preference`; efek berat (pin, parallax pointer) dilewati di perangkat terbatas (`isLiteDevice`).
- Parallax scroll di tiga area: lapisan hero (lattice, mark, dan teks pada kedalaman berbeda, mulai 768px), sampul portofolio dan studi kasus (`useParallax`, separuh jarak di ponsel), dan mark di halaman Tentang yang terakit tepat saat seksinya berada di tengah layar.
- Konten terlihat secara default (tanpa JS, reduced motion). Teks di atas lipatan masuk dengan animasi CSS agar tidak menunggu JS.
- Navigasi klien: halaman baru naik pendek (opacity dan 14 px, 500 ms); pergantian bahasa pada halaman yang sama hanya meredup ke 0,55 lalu pulih (350 ms) dan fokus tetap di pemilih bahasa. Halaman lama tidak ditahan untuk animasi keluar, karena itu sama dengan menunda navigasi.
- Header adaptif dan tombol kembali ke atas membaca posisi scroll dari listener ScrollTrigger yang sama dan hanya menulis atribut saat keadaannya berganti. Morph logo header (wordmark terlipat ke mark) dan penyusutan kapsul pelat adalah transisi CSS (transform dan clip-path) yang dipicu atribut itu, bukan animasi per frame scroll.
- Studi kasus: rail bab memakai ScrollTrigger (`onToggle`) untuk `aria-current="location"`; reveal solusi (clip diagonal), peta sistem, alur, badge teknologi, dan slot pengukuran adalah timeline `once` di dalam `gsap.matchMedia()`.
- Scroll native. Tidak ada `scroll-behavior: smooth` global karena menggagalkan pemulihan scroll saat Back (lihat QA putaran 3).

### Umpan balik pemuatan

- Muatan pertama dan hard refresh: layar pemuatan bermerek layar penuh (`components/brand/boot-loader.tsx`, `lib/boot.ts`). Markup statis di setiap HTML yang di-prerender, dianimasikan CSS saja, jadi tampil pada paint pertama tanpa menunggu React atau GSAP. Skrip head yang sama dengan pemulihan tema menulis `<html data-boot>`: `intro` (kapsul merakit, wordmark keluar dari mark), `exit` (panggung terangkat, lembar menyapu di sepanjang sumbu 33 derajat), `done` (`display: none`). Dua panjang lewat `<html data-boot-mode>`: `full` (sekitar 1,3 s) pada muatan pertama di tab, `short` (sekitar 0,6 s) pada muatan berikutnya di tab yang sama; penanda `solveit-boot-seen` di `sessionStorage`, dan bila storage diblokir setiap muatan dihitung pertama. Keluar dipicu `animationend` kapsul keempat (di reduced motion: mark diam sejenak) **dan** halaman siap (DOMContentLoaded + `document.fonts.ready`), dengan batas 2,6 s sejak `animationstart` pertama, batas keras 6 s, dan failsafe CSS di compositor setelah 3,4 s. Overlay `aria-hidden` dan `pointer-events: none`, sehingga tidak menjebak fokus atau menahan klik; HTML di bawahnya tetap lengkap dan terbaca, dan judul halaman tetap terlukis di frame pertama (LCP tidak berubah, lihat QA putaran 4). Tanpa JavaScript atribut tidak pernah ditulis dan overlay tetap tersembunyi; bila stylesheet gagal, `display: none` inline menahannya. Entrance di halaman (`.enter`, mark hero GSAP lewat `bootSettled()`) menunggu `exit`, jadi diputar saat terlihat. Bootstrap JS tetap dimulai tepat setelah FCP.
- Uji e2e menonaktifkan overlay lewat `window.__solveitBoot = "off"` dari init script (fixture), kecuali tes layar pemuatan sendiri (`bootLoader: true`).
- Navigasi klien: `RouteProgress` membaca `useNavigation()`. Runner tak-tentu tampil setelah 150 ms (via `transition-delay` CSS), chip status dengan `CapsuleLoader` dan pengumuman `role="status"` setelah 900 ms (`useDelayedFlag`). Navigasi yang chunk-nya sudah dimuat tidak menampilkan apa pun.
- Asinkron: panel asisten dimuat lazily; prefetch saat peluncur di-hover atau difokus, dan bila masih memuat saat dibuka, chip "Memuat asisten" muncul setelah 150 ms.

### Asisten Solveit

- `FloatingDock` (layout) merender peluncur dan tombol kembali ke atas setelah hydration. Panel (`components/assistant/assistant-panel.tsx`) dan kosakata panduan (`data/locales/{id,en}/assistant.ts`) berada di chunk terpisah (sekitar 7 KB gzip) yang dimuat saat ada niat.
- `services/assistant.ts` mendefinisikan `AssistantEngine.reply(input): Promise<AssistantReply>`. Implementasi saat ini, `createGuideEngine`, menjawab topik dari data yang sama dengan halaman (layanan, proses, proyek demo, kontak resmi) dan mencocokkan pertanyaan dengan FAQ yang sudah terbit (kata kunci per bahasa; FAQ berbobot 2,5 kali topik). Tidak ada jaringan, penyimpanan, atau teks yang dihasilkan. Pertanyaan yang tidak cocok mendapat jawaban jujur dan tautan WhatsApp/email yang membawa pertanyaan itu (baru terkirim bila pengunjung menekan kirim di aplikasinya).
- Fase berikutnya dapat mengganti mesin dengan panggilan ke endpoint Laravel yang meneruskan ke layanan AI di server. Kunci API tidak pernah berada di frontend, dan antarmuka harus tetap menyebut sumber jawabannya.
- Percakapan hanya ada di memori komponen selama kunjungan; berganti bahasa memulai percakapan baru.

### Testimoni

- `data/testimonials.ts` kosong sampai ada izin tertulis. `getPublishedTestimonials()` hanya meloloskan entri non-demo dengan `permission.granted` dan tanggal izin; unit test mengunci keduanya. Beranda menampilkan janji tertulis selama daftar kosong, lalu otomatis beralih ke kutipan.
- Placeholder tata letak hanya tampil di `/pratinjau/testimoni` (`noindex`, di-prerender, tidak masuk sitemap) dan teksnya menyebut dirinya placeholder.

## Keputusan teknis

| Keputusan | Alasan |
|---|---|
| React Router 7 framework mode, bukan v8 | v8 baru rilis; v7.18 stabil, kompatibel dengan Vite 8, dan mendukung prerender bawaan |
| TypeScript 6.0 | `typescript-eslint` belum mendukung TS 7 (peer `<6.1`) |
| Tailwind CSS v4 + CSS variables | Token tema (terang/gelap) di satu tempat, utilitas tanpa konfigurasi JS |
| Prerender statis, bukan SSR | Tidak ada data dinamis; HTML statis paling cepat dan mudah di-hosting |
| GSAP dimuat lazily | Mengurangi JS sebelum first paint; skor Lighthouse mobile naik signifikan |
| Font Archivo di-subset sendiri | 90 KB menjadi 29 KB; sumbu lebar dan berat dibatasi ke yang dipakai |
| Tanpa WebGL/Three.js | Identitas visual cukup dibawa SVG + transform; biaya performa tidak sebanding |
| Tanpa custom smooth scroll (Lenis dievaluasi, ditolak) | Prototipe Lenis 1.3 pada build produksi: waktu main thread saat scroll naik sekitar 18 persen, frame di atas 25 ms hampir dua kali lipat, scroll roda di panel asisten dibajak ke halaman, dan scroll masih bergerak sekitar 75 px setelah input berhenti; pengguna sentuh (mayoritas audiens) tidak mendapat manfaat karena Lenis tidak menghaluskan sentuhan secara default. Data di `qa-report.md` |
| Layar pemuatan bermerek hanya untuk muatan dokumen, berbasis CSS | Diminta pengguna setelah evaluasi langsung (putaran 4 membatalkan penolakan putaran 3). Dibangun agar tidak menunda apa pun: CSS/SVG statis di HTML, tanpa progres palsu, keluar saat halaman siap, batas 2,6 s, tanpa JS tidak tampil. Navigasi klien tetap memakai runner dan chip yang diskalakan ke lama tunggu sebenarnya |
| Asisten berbasis panduan, bukan AI | Belum ada backend; jawaban hanya dari konten terverifikasi, identitas jujur, antarmuka mesin siap ditukar |
| Formulir via WhatsApp/email | Kanal resmi yang sudah dikonfirmasi; tidak ada klaim "terkirim" tanpa backend |
| i18n tanpa library | Dua bahasa, teks statis, tanpa pluralisasi kompleks: kamus bertipe (TypeScript memaksa kunci yang sama di kedua bahasa) lebih kecil dan lebih sederhana daripada i18next/react-intl |
| Bahasa dari URL, bukan dari browser | Prerender dan hydration deterministik; crawler melihat satu bahasa per URL; hreflang dua arah |
| Terang sebagai default | Brief: pemilik bisnis menilai vendor di siang hari; gelap tetap tersedia sebagai pilihan sadar |
| Bootstrap JS setelah first paint | HTML statis sudah lengkap; menunda unduhan modul ke belakang FCP menurunkan LCP mobile tersimulasi dari sekitar 3 detik ke sekitar 1,6 detik tanpa mengubah tampilan |
| ESLint 9, bukan 10 | `eslint-plugin-jsx-a11y` belum mendukung ESLint 10 (peer `^9`); ESLint 9 menjaga `npm ci` tetap ketat tanpa `--legacy-peer-deps`. A11y juga diverifikasi oleh axe di Playwright |
