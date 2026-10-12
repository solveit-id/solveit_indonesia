# Strategi SEO dan GEO

## Yang sudah diimplementasikan

| Area | Implementasi | Lokasi |
|---|---|---|
| HTML statis | Semua halaman publik di-prerender lengkap dengan konten, metadata, dan JSON-LD; dapat dibaca tanpa JavaScript (diuji e2e) | `react-router.config.ts` |
| Title dan description | Unik per halaman (diuji e2e), format `Halaman | Solveit Indonesia` | `export const meta` di `src/pages/*` |
| Canonical, `og:url`, `og:image` absolut | Dipancarkan hanya jika `VITE_SITE_URL` diisi | `src/lib/seo.ts` |
| Open Graph dan Twitter Card | `summary_large_image`, gambar 1200x630 dari logo asli | `public/og/solveit-og.png` |
| JSON-LD | `Organization` (email dan 3 WhatsApp terkonfirmasi, tanpa alamat), `WebSite`, `Service` (5 layanan), `FAQPage` (Layanan, Proses), `BreadcrumbList` (saat domain tersedia), `CreativeWork` hanya untuk proyek nyata | `src/lib/seo.ts` |
| Sitemap dan robots | Diturunkan dari HTML hasil prerender, melewati halaman `noindex` | `scripts/postbuild.mjs` |
| 404 | Status 404 asli, `noindex, follow` | `404.html` |
| Semantik | Satu `h1` per halaman, breadcrumb terlihat, landmark, `lang="id"` (tagline bertanda `lang="en"`) | |
| Favicon dan manifest | SVG, PNG 32, apple-touch-icon, manifest | `public/` |

## Pemetaan kata kunci

| Halaman | Niat pencarian | Kata kunci utama | Pendukung |
|---|---|---|---|
| Beranda | Navigasional, komersial | software house Indonesia | jasa pembuatan website dan aplikasi, Solveit Indonesia |
| Layanan | Komersial | jasa pembuatan website | jasa pembuatan aplikasi web, jasa sistem informasi, jasa custom software, jasa maintenance website |
| Portofolio | Investigasi | contoh studi kasus sistem informasi | portofolio software house |
| Proses | Informasional | proses pembuatan aplikasi | tahapan pengembangan software, berapa lama membuat website |
| Kontak | Transaksional | konsultasi pembuatan aplikasi | hubungi software house |
| Tentang | Navigasional | tentang Solveit Indonesia | Solveit OpsHub |

Kata kunci dipakai secara alami di title, h1, lede, dan FAQ. Tidak ada keyword stuffing.

## GEO (Generative Engine Optimization)

- **Answer-first:** setiap halaman dibuka dengan paragraf yang menjawab "apa ini" dalam satu sampai dua kalimat, sehingga mudah dikutip mesin generatif.
- **Konsistensi entitas:** nama "Solveit Indonesia", deskripsi, email, dan nomor sama persis di teks, footer, dan JSON-LD.
- **Fakta eksplisit:** daftar layanan, untuk siapa, apa yang diterima klien, dan tujuh langkah proses ditulis sebagai daftar terstruktur.
- **FAQ:** pertanyaan nyata calon klien (biaya, durasi, revisi, serah terima) tanpa janji angka.
- **Kejujuran:** studi kasus demo diberi label dan tidak masuk structured data; tidak ada klaim peringkat, klien, atau statistik.

## Setelah domain tersedia

1. Isi `VITE_SITE_URL` di lingkungan build, build ulang, pastikan canonical dan `sitemap.xml` muncul.
2. Verifikasi properti di Google Search Console (isi `VITE_GOOGLE_SITE_VERIFICATION` atau verifikasi DNS) dan Bing Webmaster Tools; kirim `sitemap.xml`.
3. Uji halaman dengan Rich Results Test dan Schema Markup Validator.
4. Pasang analitik yang menghormati privasi (misalnya Plausible atau GA4 dengan consent) dan definisikan konversi: klik "Kirim lewat WhatsApp", klik email, klik nomor WhatsApp.
5. Tambahkan `sameAs` (LinkedIn, Instagram, GitHub organisasi) ke `organizationSchema` begitu profil resmi dikonfirmasi.
6. Tambahkan alamat dan `LocalBusiness` hanya jika alamat fisik resmi tersedia.

## Kebutuhan konten lanjutan

- Studi kasus nyata dengan izin publikasi, screenshot hasil, dan dampak terukur (mengganti konsep demo).
- Halaman per layanan (misalnya `/layanan/sistem-informasi`) bila volume konten bertambah.
- Artikel panduan (misalnya "Cara menyiapkan kebutuhan sebelum membuat aplikasi") untuk niat informasional.
- Foto tim dan profil pendiri untuk sinyal E-E-A-T, bila tersedia.
