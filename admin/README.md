# Konsol admin Solveit (`admin/`)

Aplikasi admin website Solveit Indonesia, terpisah dari website publik (`frontend/`). Status: **fondasi B3.2a, sedang dibangun di branch `admin`, belum di-deploy.** Belum ada layar masuk, administrasi pengguna, audit, atau data apa pun: layar itu datang di B3.2b dan B3.2c, rilis admin privat di B3.2d. Arsitektur: `docs/architecture/admin-dashboard.md`. Kontrak API: `docs/api/admin-auth.md`, `docs/api/admin-users.md`.

React 19, TypeScript strict, Vite 8, React Router 7 dalam **mode data** (bukan framework mode: tanpa skrip inline, CSP ketat), Tailwind CSS 4, ikon Phosphor. Tanpa Axios, state manager global, pustaka komponen, atau pustaka grafik.

## Mulai

```bash
cd admin
npm install                # sekali (Node 22, .nvmrc)
npm run dev                # http://127.0.0.1:5174 (bukan localhost, lihat di bawah)
```

Untuk pemeriksaan koneksi, Laravel harus berjalan: `php artisan serve` di `backend/` (127.0.0.1:8000). Docker: `docker compose -f infra/docker/compose.dev.yaml up -d backend admin` dari root repository (`docs/development/docker-development.md`).

**Satu origin.** Browser hanya melihat `http://127.0.0.1:5174`. Server dev Vite mem-proxy `/api/v1/admin` (dan hanya itu) ke Laravel dan meneruskan header `Host` dan `Origin` browser apa adanya; `AdminRequestBoundary` di backend menerima tepat origin `ADMIN_URL`, yang default-nya `http://127.0.0.1:5174`. Tidak ada CORS, tidak ada origin yang dipalsukan. Dari `localhost:5174` API menjawab `404`. Target proxy: `SOLVEIT_ADMIN_API_TARGET` (`.env.example`; dibaca `vite.config.ts` saja, tidak pernah sampai ke browser).

## Perintah

| Perintah                              | Fungsi                                                                                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                         | Server dev dengan proxy satu origin dan header keamanan (tanpa CSP: HMR butuh skrip inline)                                                                                   |
| `npm run build`                       | `tsc` lalu build produksi ke `dist/` (CSP di `<meta>`, tanpa halaman referensi)                                                                                               |
| `npm run check:build`                 | Memeriksa `dist/`: CSP, `noindex`, tanpa skrip inline, tanpa origin lain, tanpa source map, tanpa halaman referensi, anggaran JS awal 150 KB dan CSS 20 KB gzip               |
| `npm run build:reference`             | Build produksi ditambah halaman referensi komponen, ke `dist-reference/` (untuk tes browser)                                                                                  |
| `npm run preview:reference`           | Menyajikan `dist-reference/` di 127.0.0.1:4175 dengan header produksi (CSP lengkap termasuk `frame-ancestors 'none'`)                                                         |
| `npm run lint` / `typecheck` / `test` | ESLint (termasuk `no-console` di kode aplikasi), `tsc`, Vitest                                                                                                                |
| `npm run test:e2e`                    | Playwright pada `dist-reference/` (desktop 1440, tablet 820, Pixel 7), axe di kedua tema, header keamanan, tema, reduced motion. Satu worker. Jalankan `build:reference` dulu |
| `npm run format` / `format:check`     | Prettier dengan pengurutan kelas Tailwind                                                                                                                                     |
| `npm run check`                       | format, lint, typecheck, test, build, check:build                                                                                                                             |

## Struktur

```text
admin/
├── public/              theme-init.js (tema sebelum paint, eksternal karena CSP), robots.txt
├── scripts/             check-build.mjs
├── security-policy.ts   CSP dan header keamanan: satu definisi untuk dev, preview, build (dan B3.2d)
├── src/
│   ├── app/             router (mode data, lazy), layout akar, error boundary, metadata route, data fase
│   ├── components/
│   │   ├── brand/       logo dari path asli website (tanpa salinan)
│   │   ├── layout/      shell: rail, bar ponsel, navigasi, preferensi
│   │   └── ui/          primitif: tombol, isian, status, panel, keadaan memuat/kosong/gagal
│   ├── i18n/            Indonesia (default) dan Inggris; struktur sama dicek TypeScript dan tes
│   ├── lib/             tema, preferensi, tautan akses (fragmen), cn
│   ├── pages/           satu modul per layar
│   ├── routes/          path
│   ├── services/admin-api/  klien API bertipe: satu-satunya tempat yang memanggil Laravel
│   └── styles/admin.css lapisan admin di atas token merek bersama
└── tests/e2e/           Playwright
```

## Design system bersama

Admin membaca empat file website **di tempat, read-only, tanpa salinan** (`vite.config.ts` `sharedDesignSources`, `server.fs.allow` hanya mengizinkan itu): `frontend/src/styles/tokens.css` (palet, tipe, motion, tema gelap), `frontend/src/assets/fonts/archivo-solveit.woff2`, `frontend/src/components/brand/logo-paths.ts`, `frontend/public/favicon.svg`. Aturannya: `docs/project-structure.md` bagian 7.1.

## Aturan keamanan klien

- Hanya `src/services/admin-api/` yang memanggil Laravel: `fetch` native, path relatif terhadap `/api/v1/admin` (path lain ditolak), `credentials: "same-origin"`, `cache: "no-store"`, `redirect: "error"`, tanpa bearer token.
- CSRF: `GET auth/csrf-cookie` sebelum penulisan pertama (satu request untuk banyak penulisan serentak), lalu `X-XSRF-TOKEN` dari cookie.
- **419:** klien mengambil token baru sekali. Penulisan dikirim ulang otomatis **hanya** bila pemanggil menyatakan `replay: "automatic"` (langkah masuk, keluar). Default setiap penulisan adalah `confirm`: klien mengembalikan galat `csrf` dengan `requiresConfirmation`, dan layar harus bertanya sebelum mengirim lagi (undangan, pencabutan, peran, penangguhan, aktivasi ulang, reset kredensial, kata sandi).
- Setiap galat punya `kind` dan `outcome`: `not-applied` (semua 4xx API ini: server menolak sebelum bertindak), `uncertain` (5xx, jaringan, timeout, abort, sukses yang tidak terbaca: jangan kirim ulang tanpa memeriksa keadaan), `not-applicable` (baca). Tidak ada retry otomatis untuk hasil yang tidak pasti.
- Penyimpanan browser hanya untuk dua preferensi (`solveit-admin-theme`, `solveit-admin-locale`). Sesi ada di cookie `HttpOnly` yang tidak dapat dibaca konsol. Token tautan akses hanya dibaca dari fragmen URL (`src/lib/access-link.ts`), fragmen langsung dihapus dari riwayat, token tidak pernah disimpan atau di-log. ESLint melarang `console` di kode aplikasi.
- CSP produksi: `script-src 'self'`, tanpa `unsafe-inline` atau `unsafe-eval`, `frame-ancestors 'none'` (header), gambar `data:` hanya untuk QR TOTP (B3.2b).
