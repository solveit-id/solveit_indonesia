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
| Layout | `src/layouts/site-layout.tsx` | Header, footer, progress navigasi, fokus dan transisi antarhalaman |
| Komponen | `src/components/{brand,layout,ui,portfolio,contact,sections/home}` | Komponen presentasi; `brand/logo-paths.ts` berisi path logo asli |
| Hooks | `src/hooks/` | `use-reveal`, `use-tilt`, `use-parallax`, `use-hydrated` |
| Lib | `src/lib/` | `motion.ts` (pemuatan GSAP + `useMotion`), `theme.ts` (tema terang/gelap), `seo.ts` (meta, hreflang, JSON-LD), `device.ts`, `cn.ts` |
| Services | `src/services/` | Akses konten per bahasa (`content.ts`, `projects.ts`) dan pengiriman inquiry (`inquiry.ts`); titik tukar ke API |
| Data | `src/data/` | Fakta yang tidak bergantung bahasa (perusahaan, urutan layanan dan proses, dasar proyek, navigasi) dan teks per bahasa di `src/data/locales/{id,en}/` |
| Types | `src/types/` | Kontrak tipe konten dan inquiry |
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
- Pergantian tema memakai satu View Transition dengan sapuan di sepanjang sumbu 33 derajat (`src/lib/theme.ts`), bukan transisi warna per elemen. Tanpa dukungan View Transitions atau dengan reduced motion, pergantian instan.

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
| Tanpa custom smooth scroll | Native scroll lebih stabil dan aksesibel |
| Formulir via WhatsApp/email | Kanal resmi yang sudah dikonfirmasi; tidak ada klaim "terkirim" tanpa backend |
| i18n tanpa library | Dua bahasa, teks statis, tanpa pluralisasi kompleks: kamus bertipe (TypeScript memaksa kunci yang sama di kedua bahasa) lebih kecil dan lebih sederhana daripada i18next/react-intl |
| Bahasa dari URL, bukan dari browser | Prerender dan hydration deterministik; crawler melihat satu bahasa per URL; hreflang dua arah |
| Terang sebagai default | Brief: pemilik bisnis menilai vendor di siang hari; gelap tetap tersedia sebagai pilihan sadar |
| Bootstrap JS setelah first paint | HTML statis sudah lengkap; menunda unduhan modul ke belakang FCP menurunkan LCP mobile tersimulasi dari sekitar 3 detik ke sekitar 1,6 detik tanpa mengubah tampilan |
| ESLint 9, bukan 10 | `eslint-plugin-jsx-a11y` belum mendukung ESLint 10 (peer `^9`); ESLint 9 menjaga `npm ci` tetap ketat tanpa `--legacy-peer-deps`. A11y juga diverifikasi oleh axe di Playwright |
