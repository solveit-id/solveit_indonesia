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
| Route modules (halaman) | `src/pages/` | Satu file per halaman, masing-masing mengekspor `meta` dan komponen default |
| Layout | `src/layouts/site-layout.tsx` | Header, footer, progress navigasi, fokus dan transisi antarhalaman |
| Komponen | `src/components/{brand,layout,ui,portfolio,contact,sections/home}` | Komponen presentasi; `brand/logo-paths.ts` berisi path logo asli |
| Hooks | `src/hooks/` | `use-reveal`, `use-tilt`, `use-hydrated` |
| Lib | `src/lib/` | `motion.ts` (pemuatan GSAP + `useMotion`), `seo.ts` (meta + JSON-LD), `device.ts`, `cn.ts` |
| Services | `src/services/` | Akses data (`projects.ts`) dan pengiriman inquiry (`inquiry.ts`); titik tukar ke API |
| Data | `src/data/` | Konten bertipe: perusahaan, layanan, proses, proyek demo, navigasi |
| Types | `src/types/` | Kontrak tipe konten dan inquiry |
| Config | `src/config/site.ts` | Variabel lingkungan (`VITE_SITE_URL`, `VITE_API_BASE_URL`, verifikasi Search Console) |
| Styles | `src/styles/app.css` | Design tokens (CSS variables + Tailwind v4 `@theme`), komponen dasar, motion CSS |

### Rendering dan routing

- `react-router.config.ts`: `ssr: false` + `prerender`. Setiap halaman publik (termasuk tiap studi kasus) di-build menjadi HTML statis lengkap dengan metadata dan JSON-LD, lalu di-hydrate di browser.
- Studi kasus didaftarkan sebagai route eksplisit per slug (`src/routes.ts`). Slug yang tidak dikenal jatuh ke route `*`, sehingga `404.html` di-hydrate pada route yang sama dengan saat ia dirender. Rute dinamis `:slug` akan dipakai lagi saat data berasal dari API (lihat `integration-plan.md`).
- `scripts/postbuild.mjs` menghasilkan `404.html`, `robots.txt`, dan `sitemap.xml` (hanya jika `VITE_SITE_URL` diisi) dari HTML yang benar-benar di-prerender, melewati halaman `noindex`.
- `src/entry.client.tsx` menunda hydration satu frame agar HTML prerender dilukis lebih dulu.

### Motion

- GSAP (ScrollTrigger, Flip) dimuat secara dinamis lewat `useMotion` (`src/lib/motion.ts`) setelah halaman dilukis, sehingga tidak berada di jalur render kritis.
- `useMotion` menjalankan setup di dalam `gsap.context()` dan me-revert seluruh tween, ScrollTrigger, dan `matchMedia` pada cleanup layout effect (sebelum React menghapus DOM, penting untuk elemen yang di-pin).
- Semua efek dibungkus `gsap.matchMedia()` dengan kondisi `prefers-reduced-motion: no-preference`; efek berat (pin, parallax pointer) dilewati di perangkat terbatas (`isLiteDevice`).
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
| `eslint-plugin-jsx-a11y` di ESLint 10 | Plugin belum mendeklarasikan ESLint 10 sebagai peer, tetapi berjalan normal; a11y juga diverifikasi oleh axe di Playwright |
