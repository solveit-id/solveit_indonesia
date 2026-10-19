# Konsol admin Solveit (`admin/`)

Aplikasi admin website Solveit Indonesia, terpisah dari website publik (`frontend/`). Status: **fondasi B3.2a (PR #38), B3.2b (masuk, aktivasi, keamanan akun sendiri; PR #41, `02f3859`), dan B3.2c (ruang kerja administrasi owner; PR #43, `c0ecde9`) dirilis ke `main`, belum di-deploy. B3.2d di branch `admin`: image produksi (nginx statis, tanpa Node) dan listener admin privat, disiapkan dan divalidasi dengan data sintetis, belum di-deploy** (bagian Produksi). Tidak ada hostname admin, sertifikat, atau akun produksi. Arsitektur: `docs/architecture/admin-dashboard.md`. Kontrak API: `docs/api/admin-auth.md`, `docs/api/admin-users.md`. Standar UI dan motion admin: `docs/design/design-system.md`, Konsol admin.

React 19, TypeScript strict, Vite 8, React Router 7 dalam **mode data** (bukan framework mode: tanpa skrip inline, CSP ketat), Tailwind CSS 4, ikon Phosphor, GSAP (inti saja, chunk lazy sejak B3.2c). Tanpa Axios, state manager global, pustaka komponen, pustaka grafik, atau pustaka smooth scroll (Lenis dievaluasi dan tidak dipakai, lihat Motion).

## Mulai

```bash
cd admin
npm install                # sekali (Node 22, .nvmrc)
npm run dev                # http://127.0.0.1:5174 (bukan localhost, lihat di bawah)
```

Untuk pemeriksaan koneksi, Laravel harus berjalan: `php artisan serve` di `backend/` (127.0.0.1:8000). Docker: `docker compose -f infra/docker/compose.dev.yaml up -d backend admin` dari root repository (`docs/development/docker-development.md`).

**Satu origin.** Browser hanya melihat `http://127.0.0.1:5174`. Server dev Vite mem-proxy `/api/v1/admin` (dan hanya itu) ke Laravel dan meneruskan header `Host` dan `Origin` browser apa adanya; `AdminRequestBoundary` di backend menerima tepat origin `ADMIN_URL`, yang default-nya `http://127.0.0.1:5174`. Tidak ada CORS, tidak ada origin yang dipalsukan. Dari `localhost:5174` API menjawab `404`. Target proxy: `SOLVEIT_ADMIN_API_TARGET` (`.env.example`; dibaca `vite.config.ts` saja, tidak pernah sampai ke browser).

## Perintah

| Perintah                              | Fungsi                                                                                                                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                         | Server dev dengan proxy satu origin dan header keamanan (tanpa CSP: HMR butuh skrip inline)                                                                                                                                                                |
| `npm run build`                       | `tsc` lalu build produksi ke `dist/` (CSP di `<meta>`, tanpa halaman referensi)                                                                                                                                                                            |
| `npm run check:build`                 | Memeriksa `dist/`: CSP, `noindex`, tanpa skrip inline, tanpa origin lain, tanpa source map, tanpa halaman referensi, anggaran JS awal 150 KB dan CSS 20 KB gzip                                                                                            |
| `npm run build:reference`             | Build produksi ditambah halaman referensi komponen, ke `dist-reference/` (untuk tes browser)                                                                                                                                                               |
| `npm run preview:reference`           | Menyajikan `dist-reference/` di 127.0.0.1:4175 dengan header produksi (CSP lengkap termasuk `frame-ancestors 'none'`)                                                                                                                                      |
| `npm run lint` / `typecheck` / `test` | ESLint (termasuk `no-console` di kode aplikasi), `tsc`, Vitest                                                                                                                                                                                             |
| `npm run test:e2e`                    | Playwright pada `dist-reference/` (desktop 1440, tablet 820, Pixel 7) dengan API yang di-mock (`tests/e2e/support/mock-api.ts`): axe di kedua tema untuk setiap layar, header keamanan, tema, reduced motion. Satu worker. Jalankan `build:reference` dulu |
| `npm run test:integration`            | Playwright terhadap Laravel dan MySQL nyata (database tes): alur masuk, aktivasi, reset, keamanan akun, kedaluwarsa sesi, batas API. Jalankan `npm run build` dulu; lihat bagian Tes browser nyata                                                         |
| `npm run format` / `format:check`     | Prettier dengan pengurutan kelas Tailwind                                                                                                                                                                                                                  |
| `npm run check`                       | format, lint, typecheck, test, build, check:build                                                                                                                                                                                                          |

## Struktur

```text
admin/
├── public/              theme-init.js (tema sebelum paint, eksternal karena CSP), robots.txt
├── scripts/             check-build.mjs, write-nginx-headers.mjs (header produksi dari security-policy.ts)
├── security-policy.ts   CSP dan header keamanan: satu definisi untuk dev, preview, build, dan header nginx produksi (B3.2d)
├── src/
│   ├── app/             router (mode data, lazy), layout akar dan privat, error boundary, peringatan idle, metadata route, data fase
│   ├── auth/            sesi di memori, loader penjaga (GET me), jalur kembali yang aman, salinan galat
│   ├── components/
│   │   ├── brand/       logo dari path asli website (tanpa salinan), tanda yang merakit diri (momen fokus B3.2c)
│   │   ├── admin/       ruang kerja owner (B3.2c): dialog tindakan sensitif, tautan sekali tampil, daftar cursor, kejadian audit, nama akun
│   │   ├── account/     kode pemulihan sekali tampil, daftar fakta akun
│   │   ├── layout/      shell dengan akun, bingkai autentikasi tanpa navigasi, navigasi, preferensi
│   │   └── ui/          primitif: tombol, isian, status, panel, keadaan memuat/kosong/gagal
│   ├── i18n/            Indonesia (default) dan Inggris; struktur sama dicek TypeScript dan tes; owner/ untuk teks ruang kerja owner
│   ├── lib/             tema, preferensi, tautan akses (fragmen), aturan kata sandi, waktu, hari lokal, media query, motion (GSAP lazy), cn
│   ├── pages/           satu modul per layar
│   ├── routes/          path
│   ├── services/admin-api/  klien API bertipe: satu-satunya tempat yang memanggil Laravel; owner.ts untuk endpoint owner
│   └── styles/admin.css lapisan admin di atas token merek bersama
├── tests/e2e/           Playwright pada build referensi, API di-mock
├── tests/integration/   Playwright pada build produksi terhadap Laravel dan MySQL nyata (playwright.integration.config.ts)
└── tests/production/    Playwright pada image produksi di belakang listener admin, TLS nyata (playwright.production.config.ts, B3.2d)
```

## Design system bersama

Admin membaca empat file website **di tempat, read-only, tanpa salinan** (`vite.config.ts` `sharedDesignSources`, `server.fs.allow` hanya mengizinkan itu): `frontend/src/styles/tokens.css` (palet, tipe, motion, tema gelap), `frontend/src/assets/fonts/archivo-solveit.woff2`, `frontend/src/components/brand/logo-paths.ts`, `frontend/public/favicon.svg`. Aturannya: `docs/project-structure.md` bagian 7.1.

## Aturan keamanan klien

- Hanya `src/services/admin-api/` yang memanggil Laravel: `fetch` native, path relatif terhadap `/api/v1/admin` (path lain ditolak), `credentials: "same-origin"`, `cache: "no-store"`, `redirect: "error"`, tanpa bearer token.
- CSRF: `GET auth/csrf-cookie` sebelum penulisan pertama (satu request untuk banyak penulisan serentak), lalu `X-XSRF-TOKEN` dari cookie.
- **419:** klien mengambil token baru sekali. Default setiap penulisan adalah `confirm`: klien mengembalikan galat `csrf` dengan `requiresConfirmation`, dan layar harus bertanya sebelum mengirim lagi. `replay: "automatic"` (kirim ulang sekali) hanya diterima untuk metode dan path persis di `automaticReplayAllowlist` (`client.ts`): `POST auth/login`, `POST auth/two-factor-challenge`, `POST auth/confirm-password`, `POST auth/logout`, `POST access-links/inspect`. Langkah ini bukan tanpa efek (masuk memulai sign-in tertunda, tantangan menyelesaikannya, konfirmasi kata sandi menandai sesi, keluar mengakhiri sesi); mereka boleh dikirim ulang karena `419` dibuat pemeriksaan CSRF Laravel sebelum throttle, guard, dan controller, jadi percobaan pertama pasti tidak diproses, dan pengiriman ulang hanya melakukan sekali apa yang baru saja diminta orangnya. Jaringan gagal, timeout, abort, 5xx, atau respons yang tidak terbaca tidak pernah dikirim ulang. Request dibekukan sekali saat dipanggil (metode, URL dengan query, body JSON yang diserialisasi), sehingga percobaan pertama dan pengiriman ulang mengirim string yang sama walaupun objek, body bertingkat, atau query milik pemanggil berubah selama request berjalan. Untuk path lain, termasuk undangan, pencabutan, peran, penangguhan, aktivasi ulang, reset kredensial, kata sandi, kode pemulihan, sesi, `access-links/redeem` dan `confirm`, serta route apa pun yang ditambahkan nanti, `automatic` ditolak dengan `TypeError` sebelum ada request yang dikirim. Route baru masuk daftar itu hanya setelah ditinjau.
- Setiap galat punya `kind` dan `outcome`: `not-applied` (semua 4xx API ini: server menolak sebelum bertindak), `uncertain` (5xx, jaringan, timeout, abort, sukses yang tidak terbaca: jangan kirim ulang tanpa memeriksa keadaan), `not-applicable` (baca). Tidak ada retry otomatis untuk hasil yang tidak pasti.
- Penyimpanan browser hanya untuk dua preferensi (`solveit-admin-theme`, `solveit-admin-locale`). Sesi ada di cookie `HttpOnly` yang tidak dapat dibaca konsol. Token tautan akses hanya dibaca dari fragmen URL (`src/lib/access-link.ts`), fragmen langsung dihapus dari riwayat, token tidak pernah disimpan atau di-log. ESLint melarang `console` di kode aplikasi.
- CSP produksi: `script-src 'self'`, tanpa `unsafe-inline` atau `unsafe-eval`, `frame-ancestors 'none'` (header), gambar `data:` hanya untuk QR TOTP, yang ditampilkan sebagai `<img>` (tidak pernah disisipkan sebagai markup).

## Sesi dan layar (B3.2b)

| Jalur            | Isi                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/masuk`         | Masuk: email dan kata sandi, lalu kode TOTP atau satu kode pemulihan                                                           |
| `/access`        | Tautan akses (aktivasi atau reset kredensial), pendaftaran autentikator, kode pemulihan sekali tampil. Path ditetapkan backend |
| `/`              | Beranda: akun dan sesi ini, jalan ke Akun dan Keamanan, tahap pembangunan                                                      |
| `/akun`          | Akun sendiri, baca saja (tidak ada API untuk mengubah profil)                                                                  |
| `/akun/keamanan` | Kata sandi, kode pemulihan (konfirmasi kata sandi bila `423`), perangkat yang masuk                                            |

- **Gerbang privat.** Setiap navigasi ke atau di dalam area privat menjalankan `GET me` lebih dulu (`src/auth/guards.ts`); tidak ada data akun yang dirender sebelum Laravel menjawab. `401` ke `/masuk?kembali=<path>`; `kembali` hanya diterima bila persis salah satu dari tiga layar privat. `403`, `429`, `5xx`, jaringan, dan timeout tampil sebagai galat tanpa data akun: server yang tidak menjawab tidak pernah dianggap masuk.
- **Keadaan sesi hanya di memori** (`src/auth/session.ts`): diisi dari `GET me` yang terverifikasi, dikosongkan pada setiap `401`, saat keluar, dan saat tab lain browser yang sama keluar (`BroadcastChannel`, hanya fakta, tanpa data). Setelah tab tersembunyi 60 detik atau lebih, perangkat tidur, atau halaman dipulihkan dari back-forward cache, konten disembunyikan dan `GET me` dijalankan lagi. Pemeriksaan itu request nyata, jadi Laravel menghitungnya sebagai aktivitas.
- **Idle dan batas absolut.** Peringatan lima menit sebelum perkiraan idle 30 menit (dari respons terakhir yang mencapai sesi); **Tetap masuk** mengirim satu `GET me`. Pada perkiraan kedaluwarsa satu `GET me` memeriksa, dan `401` membawa ke halaman masuk. Pemberitahuan sepuluh menit sebelum batas 12 jam tanpa perpanjangan. Tidak ada polling; server tetap penentu.
- **Tidak ada pengiriman ulang otomatis** selain yang dilakukan klien setelah `419` untuk lima langkah di allowlist. Hasil yang tidak pasti (jaringan, timeout, `5xx`, respons tak terbaca) dilaporkan dan diselesaikan dengan baca (`GET me` atau `access-links/inspect`), tidak dengan mengirim ulang tulisan. `429` menampilkan hitung mundur dari `Retry-After` (paling lama satu jam) dan tidak mengirim apa pun selama itu.
- **Rahasia.** Token tautan akses diambil dari fragmen di `main.tsx` sebelum router dibuat, dihapus dari alamat dan riwayat, lalu hanya ada di memori layar `/access` sampai dipakai atau ditolak. Kunci TOTP, kode pemulihan, kata sandi, dan kode hanya di state komponen; tidak disimpan, di-log, atau diambil ulang. Kode pemulihan ditampilkan sekali dengan tombol salin dan konfirmasi wajib; meninggalkan halaman sebelum itu dicegah (navigasi dalam aplikasi) atau diperingatkan (reload, tutup tab).

## Ruang kerja owner (B3.2c)

| Jalur            | Isi                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/pengguna`      | Daftar akun (`GET users`): filter peran dan status di alamat (`?peran=admin&status=suspended`), muat lebih banyak dengan cursor Laravel |
| `/pengguna/:id`  | Detail akun: ringkasan, tautan terbuka (metadata saja), aktivitas audit terbaru, tindakan (peran, penangguhan, aktivasi ulang, reset)   |
| `/undangan`      | Daftar undangan (`GET invitations`) dengan filter status dan pencabutan undangan yang masih terbuka                                     |
| `/undangan/baru` | Undang admin: email dan peran, tinjau, tautan sekali tampil                                                                             |
| `/audit`         | Audit log baca saja (`GET audit-events`): filter yang diizinkan Laravel, dikelompokkan per hari lokal, muat kejadian lebih lama         |

- **Laravel otoritas RBAC.** Navigasi owner dan tombol tindakan tampil hanya bila `GET me` melaporkan izinnya; setiap request tetap diotorisasi Laravel. Akun tanpa izin yang membuka layar owner melihat keadaan "Khusus owner" tanpa request; `403` dari API memberi keadaan yang sama dan akun dibaca ulang.
- **Setiap penulisan lewat `SensitiveActionDialog`** (`src/components/admin/`): satu dialog yang isinya maju. Keputusan dijelaskan dengan kata; `423` membuka langkah kata sandi (`POST auth/confirm-password`), lalu keputusan kedua yang disengaja, dan hanya tekanan itu yang mengirim lagi. `419`: belum diproses, tekan lagi. `429`: hitung mundur, tidak ada yang dikirim. `409`: kalimat per `code`, hanya tombol Tutup, data dibaca ulang. `404`: data dibaca ulang. Hasil tidak pasti (5xx, jaringan, timeout, sukses tak terbaca): dialog tertutup dan tombol **Periksa** membaca keadaan sekarang (detail akun, atau undangan yang menunggu untuk alamat itu); penulisan tidak pernah dikirim ulang sendiri.
- **Tautan sekali tampil** (`OneTimeLinkReveal`): URL undangan atau reset dari respons `201` hanya ada di state komponen, tidak pernah di penyimpanan browser, alamat, state router, judul, atribut, atau log. Salin hanya saat ditekan; meninggalkan halaman sebelum konfirmasi dicegah (`LeaveGuard`, sama dengan kode pemulihan B3.2b); Selesai membuangnya. Selama tautan tampil tidak ada tindakan lain yang dapat menggantinya.
- **Daftar** (`useCursorList`): filter di alamat (nilai yang tidak dikenal diabaikan, tidak pernah dikirim), baris lama tetap terlihat redup saat filter baru dimuat, muat lebih banyak memindahkan fokus ke baris baru pertama. Ganti filter saja tidak menjalankan `GET me` lagi (`revalidatePrivateArea` di `router.tsx`); request daftar sendiri menemui `401` seketika. Tabel mulai 768 px, kartu di bawahnya (satu DOM sesuai lebar, `useMediaQuery`).
- **Tanggal audit**: satu hari dikirim sebagai awal dan akhirnya di zona waktu perangkat dengan offset tertulis (`src/lib/local-day.ts`), karena Laravel membaca tanggal polos sebagai tengah malam UTC.
- **Nama akun** di undangan dan audit berasal dari satu halaman `GET users` (100 akun) di memori layar; selebihnya "Akun #7", tidak pernah tebakan.
- **Ukuran.** Teks owner (`src/i18n/owner/`) dan klien owner (`src/services/admin-api/owner.ts`) hanya diimpor kode owner, jadi tidak masuk JavaScript awal.

## Motion (GSAP) dan Lenis

- GSAP inti (tanpa plugin) di `src/lib/gsap.ts`, dimuat lazy lewat `src/lib/motion.ts` saat browser idle setelah start-up (`preloadMotion` di `main.tsx`). Tidak ada yang menunggu GSAP: konten dirender terlihat, dan animasi masuk hanya berjalan bila GSAP sudah termuat saat konten muncul.
- `useMotion` menjalankan setup di `gsap.context()` sebelum paint dan me-revert semua tween serta gaya inline saat unmount atau dependensi berubah; tidak berjalan sama sekali dengan `prefers-reduced-motion: reduce`.
- Pemakaian: konten layar naik saat layar berganti (bukan layar pertama), kapsul aktif navigasi berpindah dari item sebelumnya (FLIP), baris baru daftar naik (paling banyak 12, kurang dari 300 ms), langkah dialog bergeser masuk, fakta yang berubah setelah tindakan bergeser masuk, dan momen fokus: tanda Solveit merakit diri dari empat kapsulnya pada sumbu 33 derajat saat tautan sekali tampil muncul (keputusan pemilik 2026-10-18).
- CSP produksi tetap ketat: GSAP menulis gaya lewat CSSOM (diizinkan `style-src 'self'`) dan atribut `transform` SVG; tes browser memeriksa nol pelanggaran CSP.
- **Lenis tidak dipakai.** Konsol adalah permukaan Operate dengan scroll native: rail dan menu ponsel punya scroll sendiri, dialog native, tabel, `scroll-margin`, pemulihan scroll React Router, dan fokus keyboard semuanya bergantung pada scroll native, dan `docs/DESIGN.md` melarang pustaka smooth scroll. Tidak ada area yang terbukti lebih baik dengan Lenis (sentuhan di ponsel tetap native di Lenis), jadi tidak ada byte atau listener tambahan.

## Produksi (B3.2d, belum di-deploy)

Image `infra/docker/admin/Dockerfile` target `prod`: `vite build`, `check-build.mjs`, dan `scripts/write-nginx-headers.mjs` berjalan di tahap build; runtime hanya `dist/` di nginx unprivileged (`infra/docker/nginx/admin.conf`), tanpa Node, sumber, atau source map. CSP dikirim sebagai header HTTP (meta CSP ditambah `frame-ancestors 'none'`, dari `security-policy.ts` yang sama), HTML `no-store`, aset hashed `private, max-age=31536000, immutable`, semua path selain file menjadi `index.html`.

Di depan image itu ada listener admin privat `admin-gateway` (Compose profil `admin`, loopback secara default): konsol dan `/api/v1/admin` pada satu origin `ADMIN_URL`, host lain `421`, gateway publik tetap menolak semua path admin. Arsitektur, opsi paparan, TLS, proxy tepercaya, dan keputusan pemilik: `docs/development/docker-production.md`, Admin privat.

`npm run` tidak punya perintah untuk ini; tes browser produksi dijalankan pada stack Docker produksi sintetis yang sudah berjalan (urutan lengkap di panduan produksi, Uji lokal mirip produksi):

```bash
npx playwright test --config playwright.production.config.ts   # SOLVEIT_PROD_PROJECT, SOLVEIT_ADMIN_URL
```

Tes itu membuat owner pertama dengan `admin:bootstrap-owner`, jadi hanya berjalan sekali per database. Tanpa trace, screenshot, atau video; asersi cookie dan rahasia tidak pernah mencetak nilai.

## Tes browser nyata (Laravel dan MySQL)

`npm run test:integration` (konfigurasi `playwright.integration.config.ts`) menjalankan Playwright terhadap build produksi (`dist/`, jadi jalankan `npm run build` dulu) yang disajikan `vite preview` di `127.0.0.1:4176` dengan CSP produksi dan proxy satu origin ke Laravel di `127.0.0.1:8100`. Tidak ada yang di-mock di jalur kritis, kecuali satu jawaban `419` yang tertulis jelas di tesnya (Chromium selalu mengirim `Sec-Fetch-Site: same-origin`, sehingga browser praktis tidak pernah mendapat `419` nyata; `419` nyata dites di batas API).

- **Pengaman database.** `tests/integration/support/start-laravel.mjs` menjalankan `backend/tests/E2E/harness.php gate`, lalu `migrate:fresh`, lalu server PHP bawaan dengan router `backend/tests/E2E/server.php`. Setiap perintah dan setiap request HTTP lebih dulu melewati gerbang: `APP_ENV` harus kosong atau `testing` (selain itu ditolak), nilai yang menentukan tujuan data dikunci seperti `phpunit.xml`, lalu `TestDatabaseGuard` memeriksa environment, database yang benar-benar dipilih server (`solveit_indonesia_testing`), tanpa `DB_URL`, dan grant pengguna yang hanya untuk database itu. Gagal satu, berhenti.
- **Data sintetis.** Akun hanya lewat perintah dan API aplikasi sendiri (`admin:bootstrap-owner`, `admin:reset-credentials`, undangan owner), alamat `@example.test`, kata sandi acak per run, TOTP dihitung di Node (`tests/integration/support/totp.ts`). Setiap tes mengosongkan database tes lebih dulu (`harness.php reset`).
- **Jam terkendali.** Tes menggeser jam Laravel lewat file `test-results/integration-clock.json` (dibaca router dan harness, hanya di environment testing) dan jam browser lewat `page.clock`, sehingga kedaluwarsa idle, 12 jam, tantangan 5 menit, pendaftaran 15 menit, dan konfirmasi kata sandi 15 menit dites tanpa menunggu.
- **Tanpa jejak rahasia.** Tanpa trace, screenshot, atau video (akan merekam tautan, kunci, kode); asersi rahasia memakai `tests/integration/support/secrets.ts`, yang gagal tanpa mencetak nilainya.
- **Lokal:** butuh `backend/` yang sudah disiapkan (`backend/README.md`, termasuk `.env.testing` untuk pengguna tes) dan container `solveit-mysql` berjalan. Jangan dijalankan bersamaan dengan `php artisan test` (database yang sama). Satu project sekali: `npm run test:integration -- --project=desktop`, lalu `tablet`, lalu `mobile` (dua yang terakhir hanya tata letak dan axe).
- **CI:** `.github/workflows/admin-integration.yml`, MySQL 8.4 sekali pakai, pengguna dengan grant hanya pada database tes, tanpa artefak.
