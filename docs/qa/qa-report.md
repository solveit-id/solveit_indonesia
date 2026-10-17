# Laporan QA

Semua angka di bawah adalah hasil eksekusi nyata di mesin pengembang (Windows 11, Node 22.23, Playwright 1.64 dengan Chromium 156, Firefox, dan WebKit, Lighthouse 13.5) terhadap build produksi yang disajikan oleh `scripts/serve.mjs` (clean URL, 404 per bahasa, kompresi brotli).

## B3.2b masuk, aktivasi, dan keamanan akun sendiri di konsol admin (2026-10-17)

Cakupan: layar `/masuk` (kata sandi lalu TOTP atau kode pemulihan), `/access` (aktivasi dan reset kredensial lewat tautan akses, pendaftaran TOTP, kode pemulihan sekali tampil), `/` (akun, sesi ini, tahap pembangunan), `/akun` (baca saja), `/akun/keamanan` (kata sandi, kode pemulihan dengan konfirmasi kata sandi, sesi), gerbang sesi dengan `GET me`, peringatan idle, dan harness tes browser nyata terhadap Laravel dan MySQL. Kode aplikasi backend tidak berubah; harness ada di `backend/tests/E2E/`. Tidak ada deployment, akun nyata, atau layar administrasi owner (B3.2c). Baseline yang diverifikasi: `origin/main`, `origin/admin`, `origin/backend`, `origin/frontend` = `15b131a` (rilis B3.2a, PR #38), `origin/staging` `519615a`, semua tree `b5be91e`; working tree bersih, tanpa stash, satu worktree, tanpa PR terbuka; lima check rilis PR #38 hijau.

Keputusan pemilik pada tugas ini (2026-10-17): beranda setelah masuk menampilkan ringkasan akun dan sesi beserta jalur tahap; pemeriksaan koneksi pengembang pindah ke build pengembangan dan referensi saja. Waiver `concept-seed` Impeccable tetap **tertunda**.

### Pemeriksaan otomatis (lokal, Windows 11, Node 22.23.1, PHP 8.5.7, MySQL 8.4.11)

| Pemeriksaan | Hasil |
|---|---|
| `npm run check` di `admin/` (format, lint dengan `no-console`, typecheck, Vitest, build, `check:build`) | Lulus. **256 tes** di 17 file (136 sebelumnya): klien dan endpoint akun (kebijakan 419 per endpoint: lima langkah autentikasi diulang sekali, redeem, confirm, kata sandi, kode pemulihan, dan sesi tidak pernah; handle sesi yang bukan segmen path ditolak sebelum dikirim; sukses tanpa `data` ditolak), observer respons, sesi di memori (401 mengosongkan akun, kontak hanya dari respons yang mencapai sesi, offset jam server dari header `Date`), jalur kembali (18 nilai berbahaya ditolak: `//host`, skema, backslash, karakter kontrol, `/access`, path tak dikenal), aturan kata sandi (12 karakter, 72 byte UTF-8), TOTP, token tautan akses ditahan sebelum router, label perangkat dari user agent, layar masuk (15), tautan akses (12), keamanan (15), gerbang privat dan navigasi (15), peringatan idle dengan jam palsu (6) |
| `check:build` | CSP produksi sama dengan `security-policy.ts`, tanpa skrip inline, tanpa origin lain, tanpa halaman referensi, dan (baru) tanpa petunjuk setup pengembang (`php artisan serve`, `SOLVEIT_ADMIN_API_TARGET`, `ADMIN_URL di backend`) di build produksi; terbukti gagal pada build referensi lama. JS awal **131,0 KB gzip** (110,8 sebelumnya, anggaran 150), CSS **7,5 KB gzip** (6,2 sebelumnya, anggaran 20). Satu URL ditambahkan ke daftar aman: saran polyfill di dalam pesan galat `useSearchParams` React Router (tidak pernah diminta) |
| `npm audit --audit-level=high` | 0 kerentanan |
| Playwright pada `dist-reference`, API di-mock (`tests/e2e/support/mock-api.ts`), Chromium, 1 worker | desktop **31** lulus dan 2 dilewati (khusus ponsel), tablet **33**, mobile **33**. axe (WCAG 2.0/2.1/2.2 A dan AA) tanpa pelanggaran di terang dan gelap pada `/masuk`, langkah kode, `/access`, 404, referensi komponen, `/`, `/akun`, `/akun/keamanan`, dialog konfirmasi, dan menu ponsel; tanpa scroll ke samping; QR sebagai gambar `data:` di bawah CSP produksi tanpa pelanggaran, dan skrip di dalam SVG QR tidak berjalan; data akun tidak ada di penyimpanan browser |
| Backend (`backend/`): `vendor/bin/pint --test`, `php artisan test`, `composer validate --strict`, `composer audit`, `route:list` | Lulus: **377 tes, 2.842 asersi** (376 dan 2.836 sebelumnya; satu tes regresi replay TOTP), Pint bersih, tanpa advisori, route tidak berubah. Uji mutasi: tanpa binding provider baru tes regresi gagal, dengan binding lulus. Flake jam `AdminInvitationTest` tidak muncul, jadi tidak diubah |
| Docker | `docker compose -f infra/docker/compose.dev.yaml config --quiet` lulus; `run --rm --no-deps admin npm test` di container: 256 lulus. Run dingin pertama di container gagal 3 tes `findBy` (batas tunggu 1 detik saat transform pertama di bind mount); setelah batas tunggu Testing Library dinaikkan ke 5 detik (`src/test/setup.ts`, asersi tidak berubah) 256 lulus. `solveit-mysql` (ID `7286975bacf9`) dan volumenya tidak berubah |

### Nyata: browser ke Laravel ke MySQL (database tes, data sintetis)

`npm run test:integration`: build produksi admin (`vite preview`, `127.0.0.1:4176`, CSP produksi sebagai header) dengan proxy satu origin ke Laravel (server PHP bawaan, `127.0.0.1:8100`, router bergerbang). **Pengaman database** sebelum migrasi, fixture, dan setiap request: `APP_ENV` harus kosong atau `testing` (`production` dan `local` ditolak, diverifikasi), nilai tujuan dikunci seperti `phpunit.xml`, `TestDatabaseGuard`: environment `testing`, database yang dipilih server `solveit_indonesia_testing`, tanpa `DB_URL`, grant hanya untuk database itu; alamat selain `@example.test` ditolak. Ringkasan gerbang yang dicetak: `APP_ENV=testing, database solveit_indonesia_testing, MySQL 8.4.11, grants limited to solveit_indonesia_testing`. Setiap tes mengosongkan database tes (1,5 detik); `migrate:fresh` sekali per run (6 detik). Tanpa trace, screenshot, atau video.

Hasil: desktop **33 lulus** (8,2 menit), tablet **2**, mobile **2** (tata letak dan axe layar nyata). Yang dibuktikan:

| Skenario | Bukti |
|---|---|
| Rute privat tanpa sesi | `/akun/keamanan` ke `/masuk?kembali=%2Fakun%2Fkeamanan`, tanpa navigasi; jalur kembali `//evil.example/akun` diabaikan setelah masuk |
| Tidak ada data privat sebelum `GET me` | Jawaban `GET me` asli ditahan 0,5 detik: tidak ada email, nama, atau judul di halaman; lalu tampil |
| Masuk kata sandi dan TOTP | TOTP dihitung di Node dari kunci yang ditampilkan; ID sesi berganti saat masuk; keluar ke `/masuk?alasan=keluar`; Back tetap di halaman masuk dan `GET me` 401 |
| Kata sandi salah, alamat tak dikenal, TOTP salah | Kalimat umum yang sama untuk dua yang pertama; TOTP salah dinamai di langkah kode |
| Kode pemulihan | Masuk sekali (sisa 7), ditolak pada percobaan kedua; TOTP yang sudah dipakai ditolak saat diulang |
| Tantangan kedaluwarsa | Jam Laravel +6 menit: kembali ke langkah kata sandi dengan email tetap terisi, bukan "kode salah" |
| Kedaluwarsa setelah 419 | Cookie sesi dibuang; jawaban pertama `419` **disimulasikan**, refresh token dan satu pengiriman ulang ke Laravel nyata mendapat `422` kedaluwarsa; urutan status `[419, 422]`, kembali ke langkah kata sandi |
| 409 | Tab kedua masuk lebih dulu; `POST auth/login` di tab pertama `409`, lalu masuk ke konsol |
| 429 | Lima kata sandi salah `422`, yang keenam `429` dengan hitung mundur; klik berikutnya tidak mengirim apa pun |
| Idle | `page.clock`: peringatan pada 25:00; jam Laravel +31 menit; pada perkiraan kedaluwarsa satu `GET me` mendapat 401, ke `/masuk?kembali=%2Fakun&alasan=berakhir` tanpa data akun. **Tetap masuk**: tepat satu `GET me` 200, sesi masih hidup 25 menit kemudian |
| Batas 12 jam | Aktif setiap 20 menit selama 12 jam (jam Laravel), lalu +12 jam 1 menit: 401 dan halaman masuk |
| Aktivasi | Fragmen hilang dari alamat dan riwayat; alamat tersamar dari Laravel; QR `<img>` `data:image/svg+xml` yang benar-benar terender, tanpa SVG besar sebagai markup, tanpa pelanggaran CSP; kunci 32 karakter base32; 8 kode pemulihan; konfirmasi wajib sebelum lanjut; setelah itu kode tidak dapat ditampilkan lagi dan penyimpanan browser, cookie, URL, dan riwayat tidak memuat token, kunci, kata sandi, atau kode |
| Tautan tidak berlaku | Tautan terpakai, tidak dikenal, dan kedaluwarsa (jam +31 menit): jawaban yang sama, tanpa formulir |
| Pendaftaran terputus | Reload setelah redeem: kunci tidak muncul lagi; tautan yang sama sudah tidak berlaku, dengan petunjuk tautan baru. Lewat 15 menit (jam +16 menit): "Pendaftaran ini tidak dapat diselesaikan" |
| Reset kredensial | `admin:reset-credentials`: kata sandi dan autentikator baru; kata sandi lama dan kode pemulihan lama ditolak, TOTP baru masuk |
| Admin undangan dan 403 | Owner mengundang lewat API (konfirmasi kata sandi `201`); admin aktif lewat layar; `GET users` dari sesi admin **403** dari Laravel |
| Tautan saat sudah masuk | `409`, keluar lalu tautan yang sama diperiksa ulang menjadi formulir aktivasi |
| Ganti kata sandi | Dua perangkat; "1 sesi lain diakhiri", perangkat lain ke halaman masuk, sesi ini lanjut dengan ID baru, masuk lagi dengan kata sandi baru berhasil; kata sandi sekarang yang salah dinamai pada isiannya |
| Sesi | Tiga perangkat terdaftar seperti dicatat Laravel, handle tidak pernah tampil; akhiri satu, lalu semua yang lain; perangkat yang diakhiri mendapat 401 |
| Kode pemulihan baru | `423`, dialog kata sandi, konfirmasi `201`, keputusan kedua yang disengaja, `200`: urutan status `[423, 200]`, 8 kode baru sekali tampil; kode lama ditolak, kode baru masuk. Konfirmasi kata sandi berakhir setelah 15 menit (jam +16): `423` lagi |
| Cookie, Origin, CSRF, header | Cookie sesi `HttpOnly`, `SameSite=Strict`, host-only `127.0.0.1`, cookie sesi browser; `XSRF-TOKEN` dapat dibaca skrip, `Strict`, berumur 30 menit; respons API `no-store`; header CSP dengan `frame-ancestors 'none'` dan `img-src 'self' data:`. Origin asing, `Sec-Fetch-Site: cross-site`, dan penulisan tanpa Origin **403** tanpa cookie; penulisan dengan Origin admin tanpa token **419 nyata** |
| Batas gateway dan publik | Di host Laravel langsung: `/api/v1/admin/...` **404** tanpa cookie; `/up` 200 dan `POST /api/v1/inquiries` 201 tanpa cookie |
| Responsif dan aksesibel | Masuk, langkah kode, aktivasi, pendaftaran, `/access` tanpa tautan, beranda, akun, keamanan: tanpa pelanggaran axe dan tanpa scroll ke samping di desktop, tablet, dan Pixel 7 |

Temuan dan perbaikan selama QA:

| Temuan | Perbaikan |
|---|---|
| Hitung mundur peringatan idle diumumkan dengan waktu basi (30:00) saat dialog terbuka: waktu tersimpan baru diperbarui pada tik pertama | `useSecondsUntil` membaca jam lewat `useSyncExternalStore`, sehingga setiap render memakai waktu sekarang |
| Setelah 401, jalur kembali menunjuk layar yang ditinggalkan, bukan yang dituju | Navigasi yang sedang berjalan dipakai sebagai jalur kembali |
| Panel sesi di beranda memeras nilai menjadi satu kata per baris | Daftar fakta berdampingan hanya bila wadahnya cukup lebar (container query) |
| Kunci TOTP terpotong di tengah kelompok, lalu (perbaikan pertama) melebar ke samping di ponsel | Kelompok empat karakter tanpa pemisah internal, spasi di luar kelompok; tes responsif mengukur lebar halaman |
| Setelah mengirim formulir tautan akses, halaman tetap tergulir di tombol dan judul langkah baru tidak terlihat | Fokus (dan gulir) pindah ke judul langkah baru |
| Fixture aktivasi lewat API meninggalkan sesi API yang masuk, sehingga penghitungan sesi lain salah | Fixture keluar dari sesi API itu |
| Chromium memasang lagi `Sec-Fetch-Site` yang dihapus tes, dan Laravel menerima `same-origin` tanpa token | Dicatat di `docs/api/admin-auth.md`; `419` nyata dites di batas API, di browser hanya jawaban pertama yang disimulasikan |
| **Keamanan (backend, B3.1a):** kode TOTP dari langkah 30 detik berikutnya dapat dipakai dua kali, di sesi lain. Fortify meminta google2fa "kode yang lebih baru dari yang terakhir dipakai" dengan `null` bila kode belum pernah dipakai; google2fa lalu menjawab `true`, bukan langkah yang cocok, dan Fortify menyimpan langkah sekarang. Ditemukan oleh tes browser nyata di **Admin integration** CI pertama PR #39 (harness memakai kode langkah berikutnya), lalu direproduksi lokal 5 dari 5 dan di PHPUnit (`204` pada replay). Tes replay PHPUnit lama memakai kode langkah sekarang, yang memang terlindungi. Dampak: rendah (penyerang tetap butuh kata sandi dan tantangan baru dalam sekitar satu menit), tetapi melanggar kontrak | Keputusan pemilik: perbaiki di PR ini. `App\Services\ReplaySafeTwoFactorAuthenticationProvider` (dibinding di `FortifyServiceProvider`) memberi stempel waktu 0 alih-alih `null`, sehingga langkah yang cocok yang disimpan, selama seluruh masa berlaku kode (90 detik, sebelumnya 60). Tes regresi `test_a_totp_code_from_the_next_step_cannot_be_replayed`; tes browser nyata kini memeriksa status `204` lalu `422` |
| Tes unit "asks Laravel again after the tab was hidden" gagal sekali di container Docker CI (lokal 2 dari 12 run) | Tes, bukan aplikasi: heading sudah ada di DOM sebelum React menjalankan effect layout yang memasang listener `visibilitychange`, jadi event tes kadang terkirim sebelum listener ada. Effect di-flush dengan `act` sebelum event; lokal 0 dari 20 run gagal, CI hijau |
| Tes 429 di CI gagal: klik setelah `429` mengirim request | Bukan galat aplikasi: tombol bertanda `aria-disabled` selama menunggu, dan `click()` Playwright menunggu sampai tombol aktif (sekitar 60 detik), lalu mengirim. Tes kini memeriksa tanda itu, menekan paksa, dan memastikan tidak ada request; lima kata sandi salah dikirim cepat lewat sesi browser yang sama agar `Retry-After` panjang |

### Tinjauan desain (impeccable)

Dunia visual yang ada diperluas, bukan diganti (Operate, kontrak `.impeccable/surfaces/admin-src-app.md`, kini ditulis untuk B3.2b dengan kutipan brief pemilik). Detector Impeccable: tanpa temuan. Peninjau akhir terpisah, empat putaran: dua kali meminta tangkapan ulang (tangkapan halaman penuh menumpuk elemen tetap; enam tangkapan gelap ternyata terang karena skrip tangkapan; posisi kunci ponsel), lalu disposisi **fix** dengan delapan temuan. Diterapkan dan dinilai ulang sebagai selesai: kontrak dan dokumen desain diperbarui, nama perangkat sesi dari user agent ("Chrome 156, Windows"), alur kode pemulihan menjadi satu dialog yang maju (langkah keputusan kedua tetap, karena brief pemilik mewajibkannya dan kini dikutip), pemberitahuan perhatian bergaris penuh (garis putus-putus khusus "belum"), jalur langkah tidak tampil pada tautan gagal, jalur langkah satu baris di ponsel ("Langkah 3 dari 4"), kotak centang bertema (dicek tercentang dan berfokus di kedua tema), tautan beranda membawa keadaan akun. Tanpa regresi. Disposisi akhir tetap **fix** hanya karena satu butir milik pemilik: rekaman `concept-seed` atau waiver eksplisit, yang menurut keputusan pemilik tetap tertunda. 80 tangkapan viewport (1440x900, 390x844, terang dan gelap) ada di scratchpad sesi, tidak di-commit (berisi data sintetis yang tampak seperti rahasia).

### Belum diverifikasi

- CI pada PR #39: putaran pertama hijau kecuali **Admin integration** (dua temuan di atas). Pada head `a326ba7` kesebelas check hijau (Admin integration, Admin CI, Backend CI, Docker CI; Frontend CI tidak berjalan karena tidak ada file frontend yang berubah); run ID di `.ai/project-status.md`.
- Firefox dan WebKit untuk admin: tidak dijalankan (suite admin hanya Chromium).
- `419` nyata dari browser: tidak dapat dipicu dari Chromium (lihat temuan); jalur klien setelah `419` dites dengan jawaban pertama yang disimulasikan.
- Peringatan sebelum `beforeunload` (reload saat kode pemulihan tampil) hanya dites di unit; dialog browser bawaan tidak dibuka di tes nyata.
- Pemulihan dari back-forward cache (`pageshow` dengan `persisted`): diimplementasikan, tidak dapat dipaksakan di Playwright; jalur tab tersembunyi dan tidur (jam) dites.
- Lighthouse admin: tidak diukur; ukuran bundle diperiksa `check-build`.
- Pemeriksaan sesi saat bangun adalah `GET me` nyata yang dihitung Laravel sebagai aktivitas; tidak ada endpoint baca yang tidak menyentuh sesi.

## B3.2a fondasi konsol admin (2026-10-16)

Cakupan: aplikasi `admin/` terpisah (React 19, TypeScript strict, Vite 8, React Router 7 mode data, Tailwind CSS 4): shell responsif, primitif UI, token merek bersama tanpa salinan, klien API admin bertipe dengan CSRF, layar status jujur dengan pemeriksaan koneksi nyata, layanan Docker pengembangan, Admin CI. Belum ada layar masuk, administrasi, audit, atau data (B3.2b, B3.2c); tidak ada deployment, akun, atau listener admin produksi. Baseline yang diverifikasi: `origin/main`, `origin/backend`, `origin/frontend` = `4874c73` (rilis B3.1b, PR #35), `origin/staging` `7105161`, semua tree `7c3f03b`; tanpa branch `admin` lokal atau remote sebelumnya; working tree bersih, tanpa stash, tanpa PR terbuka.

Keputusan pemilik pada tugas ini: tema terang sebagai default dengan pilihan gelap (OS tidak diikuti, aturan website); satu-satunya layar nyata adalah status fondasi dengan pemeriksaan koneksi; referensi komponen hanya di build pengembangan dan QA. Arah dan struktur lain dari brief B3.2a (folder `admin/`, branch `admin`, `127.0.0.1:5174`, proxy satu origin, Indonesia default dengan Inggris siap, loopback).

Instalasi dependensi: `npm install` pertama di sesi agent dihentikan Claude Code karena memori sistem kritis; pemilik memasang ulang secara manual (`npm install --prefer-online ... --maxsockets=3`, 375 paket, `package-lock.json` dari `registry.npmjs.org` saja). Pekerjaan dilanjutkan tanpa scaffolding ulang. Laravel Boost MCP dan Playwright MCP gagal tersambung di sesi lanjutan; tidak dibutuhkan untuk perubahan frontend dan Docker ini.

### Token bersama dan regresi website publik

| Pemeriksaan | Hasil |
|---|---|
| Pemisahan `frontend/src/styles/app.css` ke `tokens.css` (palet terang dan gelap, font, motion, radius, varian gelap) | Build website sebelum dan sesudah dibandingkan file per file, nama berhash dinormalkan: 82 file, JavaScript dan HTML identik. Satu-satunya perubahan CSS: aturan `--header-h` website (dan override 1024 px) kini berada setelah blok tema gelap, bukan di dalam blok `:root` pertama; blok gelap tidak menyetel `--header-h`, jadi semua nilai terhitung sama. Selain itu hanya hash dan `version` di manifest router |
| `npm run lint`, `typecheck`, `npm test` di `frontend/` | Lulus; 178 tes. `format:check` hanya menandai `frontend/.impeccable/hook.cache.json`, file lokal lama yang dikecualikan `.git/info/exclude` (tidak ada di clone baru) |
| Playwright website, project desktop, 1 worker | 179 lulus, 5 dilewati, 1 gagal dari 185 (180 dijalankan, sama dengan baseline B2.2). Yang gagal (`contact-channels.spec.ts`, menu WhatsApp) berjalan 54,6 menit dalam run 1,1 jam: mesin macet di bawah tekanan memori, bukan asersi. Dijalankan ulang sendiri: 4 dari 4 tes file itu lulus (tes tersebut 2,5 detik). Tablet dan mobile tidak dijalankan lokal (memori); **Frontend CI** menjalankan suite penuh |

### Admin: pemeriksaan otomatis (lokal, Windows 11, Node 22.23.1)

| Pemeriksaan | Hasil |
|---|---|
| `format:check`, `lint` (termasuk `no-console` di kode aplikasi), `typecheck` | Lulus |
| `npm test` (Vitest) | **136 tes lulus** di 8 file (101 saat PR #36; 29 tes allowlist replay dan 6 tes snapshot replay ditambah sesudahnya): klien API 77 (CSRF, satu request CSRF untuk penulisan serentak, aturan 419, klasifikasi galat, `outcome`, timeout, abort, path yang ditolak), CSRF dan pemeriksaan koneksi, tautan akses (fragmen saja, fragmen dihapus, tidak disimpan), tema dan preferensi, copy dua bahasa (kunci sama, tanpa em dash), aplikasi lewat router memori (navigasi hanya layar yang ada, 404 jujur untuk `/masuk` dan lainnya, menu ponsel, tema, bahasa, pemeriksaan koneksi), primitif UI |
| Uji mutasi aturan 419 | Default `replay` diubah ke `automatic`: tepat 6 tes penulisan sensitif gagal; dipulihkan |
| Allowlist replay otomatis (setelah PR #36) | `replay: "automatic"` hanya untuk 5 langkah autentikasi (metode dan path persis); 21 kombinasi lain (6 operasi administratif, 4 keamanan akun sendiri, `access-links/redeem` dan `confirm`, route masa depan, path mirip, huruf besar, metode salah, baca) ditolak tanpa request apa pun; request disalin saat masuk sehingga mengubah objek pemanggil tidak mengubah yang dikirim ulang. Mutasi: tanpa pemeriksaan di pintu masuk 21 tes gagal, tanpa kedua pemeriksaan (perilaku lama) 21 gagal, tanpa salinan dan pemeriksaan dalam 1 gagal; pemeriksaan dalam sendiri tidak teramati lewat API publik (lapisan cadangan). Playwright desktop 19 dan 2 dilewati, tablet 21, mobile 21; `check:build` dan `npm audit` lulus |
| Snapshot replay (PR #37) | Request dibekukan sekali di `prepare()`: URL dengan query dan body JSON diserialisasi satu kali, percobaan pertama dan replay mengirim string yang sama. Tes mengubah body bertingkat, query, dan objek request pemanggil saat respons `419` ditunggu dan saat cookie CSRF di-refresh, juga sebelum prefetch CSRF penulisan pertama: URL dan body tetap yang asli. `toJSON` dipanggil tepat sekali; body yang tidak dapat diserialisasi dan `automatic` yang ditolak tidak mengirim apa pun (dan tidak membaca body). Tes jsdom: kata sandi pada replay yang gagal tidak ada di `localStorage`, `sessionStorage`, cookie, konsol, atau galat. Mutasi: membaca body dan query hidup (perilaku salinan dangkal lama) 4 tes gagal, body saja 3, query saja 2, tanpa pemeriksaan allowlist di `prepare()` 22; pemeriksaan dalam sendiri tetap tidak teramati (lapisan cadangan). `check`: 136 tes, JS awal 110,8 KB gzip, 0 kerentanan; Playwright desktop 19 dan 2 dilewati, tablet 21, mobile 21 |
| `npm run build` lalu `check:build` | Lulus: CSP produksi di `<meta>` sama dengan `security-policy.ts`, tanpa skrip inline, tanpa `unsafe-inline`/`unsafe-eval`, `noindex`, tanpa source map, tanpa origin lain (pengecualian tertulis: namespace SVG, tautan galat React, basis parse URL React Router, komentar lisensi Tailwind), tanpa halaman referensi. JS awal **110,8 KB gzip** (anggaran 150), CSS **6,2 KB gzip** (anggaran 20). Bukti kegagalan: `check-build.mjs dist-reference` menolak build referensi (3 temuan) |
| `npm audit --audit-level=high` | 0 kerentanan (juga `--omit=dev`) |
| Playwright pada `dist-reference` (preview dengan header produksi), Chromium, 1 worker | desktop 19 lulus dan 2 dilewati (khusus ponsel), tablet 21, mobile 21: shell per lebar, tanpa scroll ke samping, menu ponsel dan Escape, fokus ke konten setelah navigasi, 404, logo dan Archivo, tema gelap bertahan setelah reload tanpa kilasan terang, penyimpanan hanya `solveit-admin-theme`, reduced motion menghentikan animasi, axe (WCAG 2.0/2.1/2.2 A dan AA) tanpa pelanggaran di terang dan gelap dan dengan menu ponsel terbuka, tombol skip pertama dan cincin fokus, header CSP/`X-Frame-Options`/`Referrer-Policy`/`nosniff`/`X-Robots-Tag`/`no-store`, semua request satu origin, tanpa pelanggaran CSP di konsol, tidak dapat dibingkai, pemeriksaan koneksi nyata ke port tertutup ("Laravel tidak menjawab") dan dua jawaban yang di-mock (204, 403) |

Temuan dan perbaikan selama QA:

| Temuan | Perbaikan |
|---|---|
| Chunk `component-reference` ada di build produksi: konstanta dari modul lain tidak dilipat bundler | Konstanta build `__ADMIN_COMPONENT_REFERENCE__` (`define`) dipakai langsung di router dan navigasi; copy halaman referensi dipindah ke samping halamannya; `check-build` memastikan tidak ada chunk, route, atau copy |
| axe `color-contrast` di rail, tema terang: segmen terpilih memakai `--paper` porselen di atas tinta malam | Di dalam rail `--paper` menjadi tanah rail (navy, malam di tema gelap) |
| Nama tombol menu berubah "Menu"/"Tutup" padahal `aria-expanded` sudah membawa keadaan | Nama tetap "Menu"; ikon menunjukkan keadaan |
| Rail dan area kerja hampir menyatu di tema gelap | Garis rambut pada tepi rail gelap |

### Tinjauan desain (impeccable)

Kontrak arah di `.impeccable/surfaces/admin-src-app.md` (Operate, dunia Solveit yang ada, struktur dikunci oleh `admin-dashboard.md` bagian 7). Dua putaran tangkapan (desktop 1440, tablet 820, ponsel 390, terang dan gelap, menu terbuka, referensi komponen), lalu peninjau akhir yang terpisah: disposisi **fix** dengan tujuh temuan. Diterapkan dan dinilai ulang: tindakan utama cobalt, glyph kapsul lingkungan sesuai fase, kode fase di dalam judul (tanpa eyebrow di 390 px), satu glyph per baris fase, perintah dan path sebagai `<code>` (semuanya *resolved*, tanpa regresi). Status sibuk (kapsul bergerak di sumbu 33 derajat) dibuktikan dengan pengukuran setelah verdict: `translateX` berubah dari -2,0 ke 6,9 px dalam 450 ms, statis di reduced motion (`desktop-busy*.png`). Satu temuan **ditolak dan diserahkan ke pemilik**: rekaman seed `concept-seed` pada kontrak; skill melarang roll untuk permintaan yang strukturnya sudah dikunci, peninjau menilai hanya pemilik yang dapat mengecualikannya.

### Nyata: browser ke Laravel lewat proxy (lokal, data sintetis tanpa akun)

`php artisan serve` (127.0.0.1:8000) dan `npm run dev` (127.0.0.1:5174), Chromium:

- Tombol pemeriksaan: `GET /api/v1/admin/auth/csrf-cookie` lewat proxy menjawab **204**; `AdminRequestBoundary` menerima host dan origin tanpa perubahan backend.
- Cookie sesi `solveit-admin-session`: `HttpOnly`, `SameSite=Strict`, host-only `127.0.0.1`, cookie sesi browser (tanpa `Secure` karena HTTP lokal, sesuai rancangan). `XSRF-TOKEN`: dapat dibaca skrip, `Strict`. Penyimpanan browser kosong.
- Lewat `localhost:5174`: **404** (host bukan `ADMIN_URL`). `Origin` asing: **403** tanpa cookie. `POST /api/v1/inquiries` di origin admin: **404** (proxy hanya `/api/v1/admin`).
- Hanya satu baris sesi anonim yang dibuat di database pengembangan; tidak ada akun.

### Docker pengembangan

- `infra/docker/admin/` (target `dev`, Node 22.23.1), layanan `admin` di `compose.dev.yaml` (loopback 5174, volume `admin-node-modules`, empat folder website read-only). `compose config --quiet` lulus, hash service `mysql` sama dengan file aslinya, shellcheck bersih.
- Temuan lama yang terlihat di mesin pemilik: container `backend` berhenti dengan `Class "Laravel\Fortify\Features" not found` karena volume `backend-vendor` dibuat sebelum B3.1a dan entrypoint hanya memasang ke volume kosong. Entrypoint `backend` dan `admin` kini menyimpan hash lockfile di volume dan memasang ulang bila berbeda. Diverifikasi: Composer memasang ulang, backend sehat; `npm ci` di atas volume admin yang sudah terisi berhasil (379 paket). Entrypoint `frontend` punya celah yang sama, belum diubah (tindak lanjut).
- Di container: Node v22.23.1, polling aktif, halaman tersaji, `tokens.css` tersaji dan `app.css` ditolak `fs.allow` (403), proxy ke service `backend`: admin origin **204**, origin asing **403**, `npm test` 101 lulus, perubahan file di host memicu HMR. `solveit-mysql` (ID `7286975bacf9`, waktu start sama) dan volumenya tidak berubah; container dihentikan dengan `stop`.

### Belum diverifikasi

- Alur browser nyata untuk masuk, TOTP, undangan, pemulihan, dan administrasi: belum dibangun (B3.2b, B3.2c).
- Firefox dan WebKit untuk admin: tidak dijalankan (Admin CI hanya Chromium).
- Lighthouse admin: tidak diukur; ukuran bundle diperiksa `check-build`.
- Admin CI, Frontend CI, dan Docker CI pada PR: hasil di GitHub.

## B3.1b administrasi pengguna admin dan pembacaan audit (2026-10-16)

Cakupan: endpoint khusus owner di `backend/` (`/api/v1/admin`): daftar dan detail akun, undangan, pencabutan undangan, perubahan peran, penangguhan dan aktivasi ulang, reset kredensial oleh owner, dan pembacaan audit log (kontrak: `docs/api/admin-users.md`; keputusan: `docs/architecture/admin-dashboard.md` bagian 4). Backend saja: tidak ada aplikasi admin, akun produksi, listener admin, atau deployment. Baseline yang diverifikasi: `origin/main`, `origin/backend`, `origin/frontend` = `ffe07fc` (rilis B3.1a, PR #33), `origin/staging` `769d1b6` dengan tree yang sama (`ad928b0`), working tree bersih, tanpa stash, satu worktree, tanpa PR terbuka, CI terakhir hijau.

Keputusan pemilik yang dikonfirmasi langsung pada awal tugas (bukan diambil dari dokumen usulan): undangan diserahkan manual dengan tautan yang hanya tampil sekali kepada owner penerbit; hanya `owner` yang membaca seluruh audit log; undangan 48 jam; reset oleh owner 24 jam. Retensi audit tetap tertunda (tanpa pemangkasan, tanpa ekspor).

Laravel Boost MCP menjawab di sesi ini (`application-info`: Laravel 13.36.0, PHP 8.5, Fortify 1.41.0, MySQL; `search-docs` untuk cursor pagination, pessimistic locking, resource pagination, dan Gate). Perilaku `Cursor::fromEncoded`, `RequirePassword` (423 untuk JSON), kunci limiter bernama, dan percobaan ulang transaksi dibaca dari sumber framework yang terpasang. Playwright MCP gagal tersambung (tidak dibutuhkan: backend saja).

### Komponen B3.1a yang dipakai ulang dan temuan

| Temuan | Bukti | Tindakan |
|---|---|---|
| `ResetAdminCredentials` tidak memeriksa pelaku | Dipanggil hanya dari CLI di B3.1a | Lewat HTTP pelaku wajib owner aktif dan bukan akun itu sendiri, di bawah kunci owner; CLI tetap jalur darurat tanpa owner |
| Dua owner dapat saling mereset dan meninggalkan nol owner yang dapat masuk | `ActiveOwners` menghitung owner tanpa autentikator terkonfirmasi | Owner aktif = dapat masuk (autentikator terkonfirmasi); reset dikunci bersama operasi lain. Uji mutasi di bawah |
| Deadlock InnoDB saat dua owner saling menurunkan | Tes multi-proses: `1213 Deadlock found` pada `SELECT ... FOR UPDATE` owner; pembaruan `role` pemenang menulis ke gap index yang dikunci yang menunggu | Semua operasi owner memakai `DB::transaction(..., 3)`; percobaan ulang melihat perubahan yang sudah commit dan menjawab `403`. Tanpa perbaikan: `500` (tidak ada data yang rusak) |
| Pemeriksaan "undangan hidup" bergantung pada waktu snapshot REPEATABLE READ | Uji mutasi: tanpa kunci owner, enam undangan bersamaan semuanya "berhasil" | Dibaca dengan `FOR UPDATE` (current read); kini lulus juga tanpa kunci owner |
| Satu tautan terbuka per akun hanya dijaga kode | `IssueAdminAccessLink` cabut lalu sisipkan | Kolom tergenerasi `open_for_user_id` + `UNIQUE`; MySQL menolak tautan terbuka kedua (dites) |
| `SESSION_DRIVER` dari environment dapat mematikan pencabutan sesi diam-diam | `config/session.php` B3.1a | Driver ditetapkan `database` di config; `AdminRequestBoundary` menjawab `503` tanpa sesi bila driver lain aktif |
| Tautan yang dibuka sebelum penangguhan hidup lagi setelah aktivasi ulang | `accountFits()` hanya menolak selama ditangguhkan | Penangguhan mencabut tautan terbuka (`access_links_revoked` di audit) |
| Route model binding akan menjawab `404` sebelum `can:` | Prioritas middleware Laravel (`SubstituteBindings` sebelum `Authorize`) | Tanpa binding: akun dicari setelah izin, `admin` mendapat `403` yang identik untuk ID ada dan tidak ada |
| `password.confirm` sebelum `can:` membuat `admin` mendapat `423`, bukan `403` | Urutan middleware grup | `can:` dipasang sebelum `password.confirm` pada setiap penulisan (dites di route coverage) |
| `TRUNCATE` melewati trigger audit | Perilaku MySQL (DDL) | Smoke test produksi memastikan `solveit_app` ditolak; dokumentasi menyebut batas terhadap pemegang hak DDL |

### Pemeriksaan otomatis (lokal, Windows 11, PHP 8.5.7, MySQL 8.4.11)

| Pemeriksaan | Hasil |
|---|---|
| `vendor/bin/pint --test` | Lulus |
| `php artisan test` (database `solveit_indonesia_testing`) | **376 tes, 2.836 asersi lulus** (261 dan 1.216 di baseline `ffe07fc`, juga diverifikasi lulus sebelum perubahan). Tes B1, B2.1, B3.1a tetap lulus; dua asersi izin B3.1a diperbarui karena owner kini memegang tujuh izin, dan route coverage diperluas |
| `composer validate --strict`, `check-platform-reqs`, `audit` | Lulus (`check-platform-reqs` exit 0), tanpa advisory. Tidak ada dependensi baru |
| `php artisan route:list` | 27 route: 25 di `api/v1/admin` (14 B3.1a, 11 baru), `POST api/v1/inquiries`, `GET up` |
| Migrasi | Satu migrasi aditif baru lulus di database tes (setiap run) dan database pengembangan (`migrate`, bukan `fresh`; tidak ada akun admin di sana); `--pretend` diperiksa lebih dulu. Up, down, up di Backend CI |
| `EXPLAIN` (database pengembangan, lewat Boost `database-query`) | Filter `actor_user_id` dan `subject_type, subject_id` memakai index masing-masing dengan backward index scan; `action` memakai PRIMARY pada tabel kosong (index `action` tersedia). Tidak ada index baru untuk audit |

Tes baru di `tests/Feature/Admin/`, semua lewat `InteractsWithAdminApi` (cookie, `Origin`, CSRF, TOTP nyata, tanpa `actingAs()`):

| Area | Yang dibuktikan |
|---|---|
| Matriks izin | Gate: owner tujuh izin, admin hanya `account.manage-own`; matriks mencakup setiap kasus enum. HTTP: 11 route owner menolak `admin` (`403`, bahkan dengan konfirmasi kata sandi baru, tanpa perubahan dan tanpa audit) dan tanpa sesi (`401`) |
| IDOR | `admin` mendapat jawaban identik untuk ID ada dan tidak ada; baris tanpa peran tidak pernah tampil (`404`) |
| Privasi daftar dan detail | Kunci field persis; tanpa hash kata sandi, rahasia TOTP, kode pemulihan, remember token, `token_hash`, atau ID sesi; detail hanya jumlah sesi |
| Pagination | Cursor, filter `role`/`status`, `per_page` 1 sampai 100, parameter tak dikenal dan cursor rusak, berkolom lain, atau ber-`id` string ditolak `422` |
| Undangan | Alur penuh dari tautan respons sampai aktivasi; owner mengundang owner; tautan hanya di respons penerbit (tidak di daftar, detail, akun, audit, log); 48 jam; kedaluwarsa, dicabut, dipakai ulang; field tambahan tidak mengubah status; enam keadaan alamat yang ada tanpa duplikat; akun tertunda dengan undangan hidup ditolak sampai dicabut; pendaftaran yang sedang berjalan dihentikan oleh pencabutan; pendaftaran yang ditinggal membebaskan akun; MySQL menolak tautan terbuka kedua |
| Peran dan penangguhan | Perubahan peran dan penangguhan mengakhiri sesi target; aktivasi ulang tidak membuat sesi; tindakan pada diri sendiri `409 own_account`; owner yang tidak dapat masuk tidak dihitung; owner yang diturunkan kehilangan akses owner |
| Reset kredensial | Akun terkunci seketika, kata sandi lama dan saja tidak cukup, pulih hanya dengan kata sandi dan autentikator baru; persetujuan `acknowledge_access_loss` wajib; tautan hilang, kedaluwarsa (24 jam), dan pendaftaran setengah jalan diganti dengan reset baru; penangguhan mencabut tautan reset; akun tertunda, ditangguhkan, dan diri sendiri ditolak |
| Konfirmasi kata sandi | `423` tanpa konfirmasi, berlaku 14 menit, ditolak setelah 16 menit; baca tidak butuh konfirmasi |
| CSRF dan origin | `419` tanpa token; `403` untuk origin lain, tanpa `Origin`, `same-site`, `cross-site`; tanpa perubahan |
| Batas laju | Penulisan ke-21 dalam semenit `429` dengan `Retry-After`; baca tetap jalan |
| Kegagalan audit | Gagal menulis audit (peran, penangguhan, undangan, reset) membatalkan seluruh tindakan: peran, penangguhan, sesi, akun, dan tautan tidak berubah; `500 {"message":"Server Error"}` tanpa tautan |
| Log | Token, URL, dan kata sandi tidak ada di log, juga saat kegagalan dilaporkan |
| Audit reader | Owner saja, terbaru dulu, kunci field persis, tanpa celah atau pengulangan antarhalaman walau kejadian baru masuk, ukuran bawaan 25 dan maksimal 100, filter aksi, pelaku, subjek, dan waktu, sebelas parameter di luar allowlist (termasuk cursor yang dimanipulasi) ditolak, metadata di luar allowlist tidak pernah tampil, tidak ada rahasia setelah satu putaran administrasi lengkap, tidak ada `POST`/`PUT`/`PATCH`/`DELETE` (`405`), detail, atau ekspor (`404`) |
| Driver sesi | `SESSION_DRIVER=file` di environment diabaikan; driver lain saat runtime: `503` tanpa cookie dan tanpa baris sesi |
| Route coverage | Setiap route owner meminta tepat izinnya; penulisan punya `admin-administration` dan `password.confirm` setelah `can:`; baca tanpa konfirmasi |

### Konkurensi nyata (proses PHP dan koneksi MySQL terpisah)

`AdminAdministrationConcurrencyTest` menjalankan setiap operasi di prosesnya sendiri (`tests/Support/admin-administration-worker.php`, dijaga `TestDatabaseGuard`), dilepas pada saat yang sama, tiga putaran per skenario: enam undangan bersamaan dari dua owner untuk alamat baru (satu berhasil, lima `invitation_pending`, satu akun, satu tautan, satu audit); empat undangan ulang bersamaan untuk akun tertunda; dua owner saling menurunkan, saling menangguhkan, saling mereset, serta penangguhan melawan reset (tepat satu berhasil, sisanya `403`, tepat satu owner yang dapat masuk tersisa, dan dialah pemenangnya). Dijalankan tiga kali berturut-turut, semuanya lulus (6 tes, 74 asersi).

### Uji mutasi (setiap pertahanan dirusak sementara, lalu dipulihkan dan diverifikasi)

| Mutasi | Hasil |
|---|---|
| `lockForUpdate()` dihapus dari `ActiveOwners::lock()` | Keenam tes konkurensi gagal: kedua owner saling menurunkan, menangguhkan, atau mereset (nol owner), enam undangan "berhasil" |
| Sama, setelah pembacaan undangan hidup memakai `FOR UPDATE` | Kedua tes undangan lulus (pertahanan berlapis: kunci baris akun, current read, `UNIQUE` email). Untuk mutasi ini hanya tes undangan yang dijalankan |
| Syarat autentikator terkonfirmasi dihapus dari definisi owner aktif | Tes saling mereset gagal: kedua reset berhasil, tidak ada owner yang dapat masuk |

### Docker

- `verify-production.sh`: empat path B3.1b (`users`, `invitations`, `audit-events`, `users/1/credential-reset`) ditambahkan ke daftar path admin yang wajib `404` di listener publik (26 ejaan, `GET` dan `POST`), dan `TRUNCATE TABLE admin_audit_events` dari `solveit_app` wajib ditolak. `bash -n` dan shellcheck 0.10.0 bersih.
- Smoke test produksi lokal (proyek terisolasi `solveit-prod-smoke`, secret acak sintetis di luar repository, image dibangun ulang dari working tree): migrasi sebagai `solveit_migrator` termasuk migrasi baru, **semua pemeriksaan lulus** (skrip berhenti pada kegagalan pertama). Proyek dan volumenya dihapus setelahnya; `solveit-mysql` tidak tersentuh.

### Mesin pemilik

- Migrasi aditif `add_open_link_constraint_to_admin_access_links_table` dijalankan pada database pengembangan `solveit_indonesia` (tidak ada akun admin dibuat). `solveit-mysql`, volumenya, XAMPP, dan file secret tidak diubah; tidak ada `.env` yang dibaca atau diedit.

### CI pertama pada PR #34

Backend CI run 38875997334 (push `8725192`): 18 dari 376 tes gagal, semuanya karena CI menjalankan suite dengan `APP_DEBUG=true`, sehingga badan galat `403`, `404`, dan `500` memuat `exception`, `file`, dan `trace` dan asersi badan persis gagal (perilaku produk benar: di luar pengembangan lokal `APP_DEBUG=false` wajib). Direproduksi lokal dengan `APP_DEBUG=true` (18 gagal), lalu tiga kelas tes menyematkan `config(['app.debug' => false])` seperti tes B1 dan B3.1a. Setelahnya 376 lulus dengan `APP_DEBUG=true` dan tanpa itu.

Saat verifikasi ulang satu tes gagal sekali secara acak (`419`). Penyebab, dibuktikan dengan lotre garbage collection sesi dipaksa 100%: browser yang mengirim cookie sesi yang sudah melewati batas idle 30 menit membuat `DatabaseSessionHandler` menandai baris lama sebagai ada; bila lotre GC (2%) di `StartSession` menghapus baris itu sebelum sesi disimpan, penyimpanan menjadi `UPDATE` nol baris, sesi hilang, dan `POST` berikutnya `419`. Dengan GC 100% tes lama selalu gagal dan tes yang diperbaiki (browser baru setelah jeda panjang, seperti kenyataannya) selalu lulus. Dampak produk kecil dan aman (tidak ada akses yang terbuka): admin yang kembali setelah sesinya kedaluwarsa kadang mendapat satu `419`; klien B3.2 harus mengambil ulang `auth/csrf-cookie` sekali lalu mengulang (`admin-auth.md`, CSRF).

### Belum diverifikasi

- HTTP nyata lewat `php artisan serve` untuk endpoint B3.1b: tidak dijalankan, karena butuh akun owner di database pengembangan dan pernyataan "tidak ada akun admin di mana pun" harus tetap benar. Seluruh stack middleware, sesi database, CSRF, dan TOTP dijalankan oleh tes fitur.
- Aplikasi admin (B3.2), WebKit, dan Lighthouse: tidak relevan untuk perubahan backend saja.
- `EXPLAIN` dengan data volume produksi: tabel pengembangan kosong.
- Hasil CI setelah perbaikan: di GitHub (`gh pr checks 34`).

## B3.1a identitas admin backend dan pengerasan keamanan (2026-10-16)

Cakupan: fondasi identitas admin di `backend/` (`/api/v1/admin`): bootstrap owner lewat CLI, tautan akses sekali pakai, TOTP wajib sebelum aktivasi, masuk dan tantangan TOTP, sesi database, peran `owner` dan `admin`, audit log hanya-tambah, isolasi listener gateway publik (kontrak: `docs/api/admin-auth.md`; keputusan: `docs/architecture/admin-dashboard.md`). Tidak ada aplikasi admin, akun produksi, listener admin, atau deployment. Baseline yang diverifikasi: `origin/main`, `origin/backend`, `origin/frontend` = `28b3557`, `origin/staging` `ce89476` (tree sama), working tree bersih, tanpa stash, satu worktree, tanpa PR terbuka.

Keputusan selama tugas: Sanctum **tidak** dipakai (Sanctum 4.3.3 menimpa `session.same_site` menjadi `lax` di setiap request; admin satu origin), Fortify 1.41 headless dengan `ignoreRoutes()`. Pemilik memilih trigger MySQL dengan `log_bin_trust_function_creators = ON` untuk audit hanya-tambah, dan retensi audit tetap tertunda (tanpa pemangkasan).

Laravel Boost: koneksi MCP sesi Claude Code habis waktu saat start; server yang sama menjawab lewat stdio (`application-info`: Laravel 13.36.0, PHP 8.5, MySQL) dan `search-docs` dipakai untuk CSRF Laravel 13 (verifikasi `Sec-Fetch-Site`), sesi, dan validasi kata sandi. Perilaku Fortify dan Sanctum dibaca dari sumber paket yang terpasang dan dokumentasi resmi 13.x.

### Temuan yang diverifikasi sebelum implementasi

| Temuan | Bukti | Tindakan |
|---|---|---|
| Seeder membuat `test@example.com` dengan kata sandi `password` | `DatabaseSeeder` B0 | Dihapus; tes regresi |
| Sanctum memaksa `SameSite=Lax` | `EnsureFrontendRequestsAreStateful::configureSecureCookieSessions()` v4.3.3 | Sanctum tidak dipasang |
| `PreventRequestForgery` melewati CSRF saat unit test | `runningUnitTests()` Laravel 13.36 | `AdminPreventRequestForgery` tanpa bypass; tes CSRF nyata |
| Event `Failed` Fortify membawa kata sandi mentah | `RedirectIfTwoFactorAuthenticatable::fireFailedEvent()` | Listener audit hanya menyimpan sidik jari HMAC alamat |
| `authenticateUsing` Fortify melewati `Timebox` bawaan | Sumber Fortify 1.41 | `AuthenticateAdmin` memakai `Timebox` 400 ms dan hash buangan |
| Kode pemulihan bekas diganti kode baru yang tidak terlihat | `TwoFactorAuthenticatable::replaceRecoveryCode()` | Kode dihapus; sisa kode dilaporkan benar |
| Rahasia TOTP bawaan 80 bit | `secret-length` 16 | 32 karakter base32 (160 bit) |
| Pengguna non-SUPER tidak dapat membuat trigger | MySQL 8.4.11, `log_bin=1`, `log_bin_trust_function_creators=0`: error 1419 di database tes | Setelan server (keputusan pemilik); setelah `SET PERSIST`, `solveit_test` membuat trigger dan `DELETE` ditolak SQLSTATE 45000 |
| `Referrer-Policy: no-referrer` membuat `Origin: null` pada POST same-origin | Spesifikasi Fetch | Dicatat untuk B3.2: halaman admin memakai `same-origin` |

### Pemeriksaan otomatis (lokal, Windows 11, PHP 8.5.7, MySQL 8.4.11)

| Pemeriksaan | Hasil |
|---|---|
| `vendor/bin/pint --test` | Lulus |
| `php artisan test` (database `solveit_indonesia_testing`) | **261 tes, 1.216 asersi lulus**, juga dengan `APP_DEBUG=true` dan tanpa TTY seperti CI (151 dan 466 sebelumnya; 110 tes admin baru). Tes B1, B2.1 tidak berubah dan lulus |
| `composer validate --strict`, `check-platform-reqs`, `audit` | Lulus, tanpa advisory (`laravel/fortify` 1.41.0, `pragmarx/google2fa` 9.1.0, `bacon/bacon-qr-code` 3.1.1, `laravel/passkeys` 0.2.1, `web-auth/webauthn-lib` 5.3.9) |
| `php artisan route:list` | 16 route: 14 di `api/v1/admin`, `POST api/v1/inquiries`, `GET up`. Tidak ada route Fortify, passkey, atau Sanctum bawaan |
| Migrasi | Empat migrasi aditif lulus di database tes, database pengembangan (`solveit_indonesia`, sebagai `solveit_dev`), dan smoke test produksi (sebagai `solveit_migrator`) |

Tes admin (`tests/Feature/Admin/`), lewat `Tests\Support\InteractsWithAdminApi`: cookie jar per browser, `Origin` admin, `X-XSRF-TOKEN` dari cookie, kode TOTP nyata, tanpa `actingAs()`. Status guard, store sesi, dan controller direset di antara request agar setiap request hanya diautentikasi oleh cookie-nya (perilaku proses PHP-FPM).

| Area | Yang dibuktikan |
|---|---|
| Masuk | Kata sandi lalu TOTP; kata sandi saja tidak masuk; jawaban `422` identik untuk kata sandi salah, alamat tidak ada, belum aktif, ditangguhkan, tanpa peran, autentikator belum dikonfirmasi; remember me diabaikan; TOTP salah dicatat; kode TOTP yang dipakai ditolak di browser lain; kode pemulihan sekali pakai (sisa 7); tantangan kedaluwarsa setelah 5 menit; akun ditangguhkan di antara langkah tidak dapat menyelesaikan; batas laju login dan TOTP; login kedua saat sudah masuk `409`; keluar |
| Batas permintaan | Atribut `Set-Cookie` nyata (host-only, `Path=/`, `HttpOnly`, `SameSite=Strict`, tanpa `Expires`; tanpa `Secure` di HTTP); dengan `ADMIN_URL` https cookie `__Host-solveit-admin-session` dan `Secure`; nilai kebijakan mengabaikan `SESSION_*` di environment; `419` tanpa token, dengan token palsu, dengan token sesi lain; `Sec-Fetch-Site: same-origin` diterima; `403` untuk origin website publik, origin lain, `Origin: null`, `same-site`, `cross-site`, dan penulisan tanpa `Origin`, tanpa baris sesi; host lain `404` tanpa cookie; ejaan path lain dan route Fortify, Sanctum, passkey bawaan tidak ada; inquiry publik `201` tanpa `Set-Cookie` meski cookie admin dikirim; preflight admin tanpa header CORS |
| Sesi | ID sesi berganti saat masuk dan cookie anonim lama tidak berguna (fiksasi); idle 30 menit; batas absolut 12 jam meski aktif (28 x 25 menit lalu 721 menit), dicatat; `401` tanpa sesi; penangguhan atau peran hilang mengakhiri sesi yang ada; daftar sesi dengan handle HMAC (bukan ID tersimpan); mengakhiri sesi lain, satu per satu atau semua; sesi saat ini dan sesi akun lain tidak dapat diakhiri lewat handle; ganti kata sandi mengakhiri sesi lain dan mengganti ID sesi saat ini; kode pemulihan baru butuh konfirmasi kata sandi dan kedaluwarsa setelah 15 menit; batas laju konfirmasi |
| Tautan akses | Aktivasi owner lengkap (QR SVG, kunci 160 bit, 8 kode pemulihan, alamat dinormalkan); token hanya sebagai SHA-256; penebusan tanpa konfirmasi tidak memberi akses apa pun; kode pertama salah tidak mengubah apa pun; tautan tidak dapat ditebus dua kali (juga tidak menimpa kata sandi); konfirmasi hanya dari browser yang menebus; tautan kedaluwarsa setelah 30 menit; konfirmasi kedaluwarsa setelah 15 menit; tautan baru mencabut yang lama, juga pendaftaran tertunda; validasi tidak memakai tautan; route pra-aktivasi menolak sesi masuk; batas laju; reset kredensial menghapus baris sesi, menolak kredensial lama, dan memulihkan dengan kata sandi dan autentikator baru; akun ditangguhkan tidak dapat memakai tautannya; rahasia TOTP terenkripsi di database |
| Perintah CLI | Seeder tidak membuat akun; bootstrap mencetak tautan, akun belum dapat masuk, dicatat sebagai `cli` tanpa IP, tanpa log; ditolak bila owner aktif ada (dicatat), bila owner lain tertunda, bila alamat milik akun non-owner, bila alamat tidak valid; konfirmasi di production; reset kredensial mengakhiri sesi dan menolak akun tidak dikenal, tertunda, ditangguhkan |
| Audit | Model menolak update dan delete; database menolak `UPDATE` dan `DELETE` (SQLSTATE 45000); kedua trigger ada; metadata di luar daftar izin ditolak; satu alur masuk lengkap tidak meninggalkan kata sandi, tebakan, kode TOTP, rahasia, atau kode pemulihan di audit |
| Invarian akun | Owner mengubah peran akun lain dan sesinya dihapus; tidak ada yang mengubah peran atau menangguhkan dirinya sendiri; admin dan owner yang ditangguhkan tidak dapat bertindak; owner aktif terakhir tidak dapat dihapus; owner yang diturunkan tidak lagi bertindak; penangguhan menghapus sesi dan memblokir masuk sampai diaktifkan lagi |
| Route dan izin | Setiap route admin terdaftar tepat di satu tingkat dengan perlindungannya (grup `admin` pertama, batas laju, guest atau `auth:web`, `auth.session`, `admin.active`, `admin.session-lifetime`, `can:`); tidak ada route lain yang memakai sesi; matriks Gate: owner dan admin punya `account.manage-own`, akun yang tidak boleh masuk tidak punya izin, kemampuan tidak terdefinisi ditolak, hanya dua peran |

### Uji mutasi (setiap pertahanan dirusak sementara, lalu dipulihkan)

| Mutasi | Tes yang gagal |
|---|---|
| CSRF memakai `PreventRequestForgery` Laravel (dengan bypass tes) | 2 dari 24 (batas permintaan) |
| `admin.active` dihapus dari route terautentikasi | 2 dari 14 (sesi) |
| `admin.session-lifetime` dihapus | 1 dari 14 |
| Pemeriksaan origin dimatikan | 6 dari 24 |
| Pemeriksaan host dimatikan | 1 dari 24 |
| `AuthenticateAdmin` menerima akun yang tidak boleh masuk | 1 dari 17 (masuk) |
| Penggantian kode pemulihan bawaan Fortify dipulihkan | 1 dari 17 |
| Penghapusan sesi saat reset diterbitkan, saat reset selesai, saat penangguhan, saat perubahan peran | Awalnya tidak terdeteksi (pemeriksaan akun aktif tetap mengakhiri sesi itu); tes ditambah asersi baris tabel `sessions`; setelah itu masing-masing 1 tes gagal |
| Trigger `DELETE` diganti | 5 dari 10 (audit) |

### HTTP nyata (`php artisan serve`, environment testing, curl)

`GET csrf-cookie` `204` dengan `Cache-Control: no-store, private`, `XSRF-TOKEN` (`Max-Age=1800; path=/; samesite=strict`, tanpa `HttpOnly`) dan `solveit-admin-session` (`path=/; httponly; samesite=strict`, tanpa `Domain` dan `Expires`); login tanpa token `419`; dengan token dan akun tidak dikenal `422` dengan pesan umum; `Origin: http://localhost:5173` `403`; `Host: www.example.test` `404`; `POST /api/v1/inquiries` `201` tanpa `Set-Cookie`.

### Docker

| Pemeriksaan | Hasil |
|---|---|
| Smoke test produksi lokal (proyek terisolasi `solveit-prod-smoke`, secret sintetis, `verify-production.sh`) | **59 pemeriksaan lulus** (33 sebelumnya), termasuk 22 ejaan path admin x `GET`/`POST` yang ditolak listener publik tanpa cookie, sesi admin efektif di container (`database`, `__Host-`, `Secure`, `Strict`, `HttpOnly`, terenkripsi, 30, tanpa `Domain`), inquiry tanpa cookie, dan `UPDATE`/`DELETE` audit ditolak untuk `solveit_app`. Proyek uji dan volumenya dihapus setelahnya |
| Lapisan yang menolak | Semua ejaan diblokir nginx (`Cache-Control: no-store` dari `gateway.conf`); `/API/V1/ADMIN/...` tidak masuk blok `/api/` sama sekali dan dijawab 404 situs statis |
| Percobaan pertama smoke test | Gagal di MySQL: `openssl` Git for Windows menulis secret dengan CRLF dan `initdb` menolaknya. Artefak skrip uji lokal (CI di Linux tidak terkena); dicatat di `docker-production.md` |
| `docker compose -f infra/docker/compose.dev.yaml config --quiet` | Lulus; hash konfigurasi `mysql` sama dengan label container `solveit-mysql` yang berjalan (`f62aba90...`), jadi container tidak dibuat ulang |
| shellcheck 0.10.0 (container resmi) | Lulus untuk skrip `infra/docker/scripts/`, entrypoint, dan kedua skrip `initdb` |

### Mesin pemilik

- `SET PERSIST log_bin_trust_function_creators = ON` dijalankan sekali sebagai root di `solveit-mysql` (persetujuan pemilik). Container ID `7286975bacf9` dan waktu start sama sebelum dan sesudah; volume `solveit-mysql-data`, XAMPP, dan file secret tidak disentuh.
- Migrasi B3.1a dijalankan di database pengembangan (aditif). Tidak ada akun admin yang dibuat di database pengembangan.
- `backend/.env` lokal tidak diubah: tanpa `ADMIN_URL` berlaku default `http://127.0.0.1:5174`, dan `SESSION_LIFETIME`/`SESSION_ENCRYPT` lamanya kini diabaikan karena kebijakan ditetapkan di config.

### CI pertama pada PR #32

Backend CI dan onboarding Docker CI gagal pada 2 tes yang lulus lokal; smoke test produksi dan validasi Compose lulus.

| Tes | Penyebab | Perbaikan |
|---|---|---|
| `writes without a csrf token get 419` | CI menyalin `.env.example` (`APP_DEBUG=true`), sehingga JSON galat berisi field debug dan `assertExactJson` gagal; status dan pesan benar | Asersi pada `message` |
| `bootstrap asks for confirmation in production` | Dengan environment `production`, prompt Laravel tanpa TTY (CI) diam-diam memakai jawaban "tidak", sedangkan di Windows ia jatuh ke pertanyaan Symfony; perilaku bergantung OS | Perintah sendiri kini menolak eksplisit di production tanpa terminal kecuali `--force` (`ConfirmsInProduction`), dites dengan `--no-interaction` dan `--force` |

### Belum diverifikasi

- Backend CI dan Docker CI di GitHub setelah perbaikan: lihat PR #32 (`.ai/project-status.md`).
- Perilaku `SameSite=Strict` di browser sungguhan: header dibuktikan di tingkat HTTP; penegakannya milik browser dan akan diuji bersama aplikasi admin (B3.2).
- Pemanggilan tool Boost dari sesi Codex.

## B2.2 idempotensi inquiry di frontend dan percobaan ulang yang aman (2026-10-16)

Cakupan: klien website mengirim `Idempotency-Key` per kiriman logis, memeriksa hasil yang tidak pasti dengan kunci yang sama, dan menangani `400`, `409`, `429`, serta `503` dari gateway (kontrak: `docs/api/inquiries.md`, Penerapan di frontend). Kanal **Kirim melalui website** tetap **nonaktif secara default**; build yang dirilis tidak memanggil API. Baseline yang diverifikasi: `origin/main`, `origin/frontend`, `origin/backend` = `cf55c2f`, `origin/staging` `b6b429b` (tree sama); B2.1 dirilis sebagai `d22a079`; working tree bersih, tanpa stash, worktree lain, PR terbuka, atau proteksi branch. Backend, Docker, dan konfigurasi CORS tidak diubah.

### Pemeriksaan otomatis (lokal, Windows 11, Node 22.23.1, Playwright 1.64)

| Pemeriksaan | Hasil |
|---|---|
| `npm run format:check`, `lint`, `typecheck`, `build` | Lulus (satu-satunya peringatan Prettier adalah cache alat lokal `.impeccable/hook.cache.json`, dikecualikan lewat `.git/info/exclude` dan tidak ada di CI) |
| `npm test` | **178 tes lulus** (125 sebelumnya): kunci UUID v4 dari `crypto.randomUUID`, tanpa cadangan lemah, kanonisasi, kunci sama untuk isi sama dan baru untuk isi lain, snapshot tidak berubah oleh edit, pelepasan kunci per hasil, `201` dengan dan tanpa replay, `400`, `409`, `429` dan `Retry-After`, `503` Laravel lawan `503` gateway atau maintenance atau tak terbaca, `502` dan `504`, `201` rusak, tanpa retry otomatis, klik ganda, abort dan unmount, WhatsApp dan email tanpa kunci, flag mati tanpa request, teks ID dan EN, kunci dan isian tidak masuk URL, konsol, storage, atau cookie |
| Uji mutasi | Formulir dipaksa membuat kunci baru setiap kirim: 5 tes gagal. Kunci tidak dilepas setelah `400` atau `409`: 2 tes gagal. Kode dipulihkan |
| E2E bawaan (kanal nonaktif), `--workers=1` | desktop 180 lulus, tablet 161 lulus (24 dilewati), mobile 147 lulus (38 dilewati): **488**, sama dengan B2 |
| E2E build API (`npm run test:e2e:api`, mock berstatus yang meniru B2.1) | **15 lulus** di desktop, tablet, mobile, dan Firefox (9 sebelumnya): respons hilang setelah tersimpan lalu dipulihkan dengan kunci sama (ID dan EN, axe tanpa pelanggaran di keadaan tidak pasti dan tanda terima), isi berubah mendapat kunci baru, kiriman terpisah mendapat kunci terpisah, klik ganda pada tombol ulang tetap satu `POST`, `409` tanpa teks server dan tanpa retry otomatis, `503` gateway sebagai hasil tidak pasti |
| Ukuran bundle (gzip -9, build bawaan) | Chunk `contact` 6.947 menjadi 7.421 byte (+474), chunk `i18n` 13.168 menjadi 13.659 byte (+491, teks baru dalam dua bahasa), seluruh JS 259.967 menjadi 260.833 byte (+866, +0,3%). Tanpa dependensi baru |
| Tampilan (390, 820, 1440 px; terang dan gelap; ID dan EN) | Keadaan tidak pasti, isian berubah, dan replay memakai token dan tombol kapsul yang ada; tanpa overflow horizontal; tombol ulang 44 px; kotak status yang difokus tidak tertutup header |

### Integrasi nyata browser ke Laravel ke MySQL 8.4 (tanpa mock pada percobaan ulang)

Build varian `VITE_INQUIRY_API_ENABLED=true`, `VITE_API_BASE_URL=http://127.0.0.1:8000` di `http://localhost:4174`; `php artisan serve` (PHP 8.5.7) di `127.0.0.1:8000`; database pengembangan `solveit_indonesia` di container `solveit-mysql` (MySQL 8.4.11, tidak diubah). Data sintetis saja; awalnya 0 baris.

| Pemeriksaan | Hasil |
|---|---|
| Membuka `/kontak` | 0 request ke API |
| Percobaan pertama (Chromium): diteruskan ke Laravel, lalu respons diputus | Server `201` `INQ-AEEX-D7T8-PP9W` (tersimpan); halaman menampilkan "Website belum memberi konfirmasi" tanpa nomor referensi; kunci UUID v4 |
| 3 detik tanpa tindakan | Tetap 1 `POST` (tidak ada retry otomatis) |
| **Kirim ulang permintaan yang sama**, langsung ke Laravel (preflight CORS nyata) | `201`, `Idempotent-Replayed: true`, kunci dan body sama persis; referensi yang tampil `INQ-AEEX-D7T8-PP9W` = yang tersimpan; kalimat replay tampil (header terbaca lewat CORS) |
| Privasi di browser | Kunci tidak ada di URL; 0 `window.open`; tidak ada kunci atau isian di `localStorage` atau `sessionStorage` (satu-satunya entri `solveit-boot-seen`, flag animasi pembuka yang sudah ada); satu pesan konsol adalah log jaringan Chromium sendiri untuk koneksi yang diputus (`net::ERR_CONNECTION_RESET`), tanpa URL, kunci, atau isian |
| HTTP dengan `Origin: http://localhost:4174` | Kunci baru `201` `INQ-PN6T-13SQ-K7KN`; kunci sama dengan spasi tambahan `201` referensi sama, `Idempotent-Replayed: true`; kunci sama dengan pesan lain `409` tanpa `id`; kunci terpisah dengan isi identik `201` `INQ-AJZ7-Y72E-06K3`; kunci rusak `400` |
| Preflight dari `http://localhost:4174` | `204`, `Access-Control-Allow-Origin: http://localhost:4174`, `Access-Control-Allow-Headers` memuat `idempotency-key`; `Access-Control-Expose-Headers: Idempotent-Replayed, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining` |
| Preflight dari `http://evil.example` | `204` tanpa `Access-Control-Allow-Origin` (browser menolak) |
| Database | Tepat **3 baris untuk 7 `POST`**, semuanya dengan hash kunci; pesan yang memicu `409` tidak tersimpan |
| Pembersihan | Hanya baris dengan kontak sintetis **dan** tiga referensi di atas dihapus (`deleted=3`); kembali 0 baris. Penghitung rate limit di tabel `cache` kedaluwarsa sendiri |

### Belum diverifikasi

- WebKit (desktop dan iPhone 14): lewat workflow **Cross-browser QA** pada head PR (lihat `.ai/project-status.md`).
- `429` nyata dari Laravel tidak dipicu (dibuktikan dengan respons tiruan di tes komponen).
- Uji nyata hanya di Chromium; tidak ada deployment, domain, atau HTTPS publik.
- Lighthouse tidak diulang: perubahan menambah kurang dari 1 KB gzip dan hanya menyentuh formulir di `/kontak`.

## B2.1 idempotensi inquiry dan lingkungan Docker (2026-10-16)

Cakupan: header `Idempotency-Key` pada `POST /api/v1/inquiries` (backend saja; frontend B2.2 belum), lingkungan pengembangan Docker penuh, konfigurasi Docker produksi (disiapkan dan divalidasi, **tidak di-deploy**), dan Docker CI. Baseline yang diverifikasi: `origin/main`, `origin/frontend`, `origin/backend` = `6474647` (rilis PR #24), `origin/staging` `966ddf0` (PR #25) dengan tree yang sama (`5205258`); working tree bersih, tanpa stash atau worktree lain; tidak ada proteksi branch atau ruleset di GitHub.

### Lingkungan awal (mesin pemilik)

- PHP CLI XAMPP 8.5.7 (ZTS), Composer 2.8.12, Node 22.23.1, Docker 29.8.2, Compose 5.6.0.
- Container `solveit-mysql` (`mysql:8.4.11`, `127.0.0.1:3307`, healthy), volume `solveit-mysql-data`. MariaDB XAMPP di 3306 (proses Windows, bukan Docker). Container dan volume proyek lain (berhenti) tidak disentuh.

### Idempotensi (B2.1)

| Pemeriksaan | Hasil |
|---|---|
| `php artisan test` native (PHP 8.5.7, MySQL 8.4.11, `solveit_indonesia_testing`) | **151 tes, 466 assertion, lulus** (sebelumnya 109 dan 275) |
| Tes baru | `InquiryIdempotencyTest` (HTTP: replay, 6 variasi payload setara, 7 variasi isi berbeda untuk `409`, kunci berbeda, tanpa kunci, 8 kunci rusak untuk `400`, kegagalan penyimpanan dan `422` tidak memakai kunci, rate limit tetap berlaku, baris lama tanpa kunci, log tanpa data pribadi, preflight CORS dari origin terdaftar dan tidak terdaftar, `Idempotent-Replayed` dapat dibaca), `SubmitInquiryConcurrencyTest` (5 tes multi-proses), tes model (indeks `UNIQUE`, banyak `NULL`, hash tidak diserialisasi), tabrakan `public_id` dengan kunci |
| Konkurensi nyata | Proses PHP terpisah, masing-masing koneksi MySQL sendiri, dengan pengaman database tes: 6 permintaan serentak dengan satu kunci menghasilkan tepat 1 baris, 6 kali `201` dengan referensi sama, tepat 1 tanpa `Idempotent-Replayed`; 3 lawan 3 dengan isi berbeda menghasilkan 1 baris, 3 kali `201`, 3 kali `409`; `INSERT` yang tertahan transaksi lain menjadi replay setelah commit, inquiry baru setelah rollback, `409` bila isi berbeda |
| Uji mutasi | Action diubah agar tidak menulis hash kunci: kelima tes konkurensi gagal (6 baris, hash `null`, insert tidak pernah tertahan); kode dipulihkan |
| Migrasi | Naik pada database pengembangan (aditif); turun lalu naik lagi pada `solveit_indonesia_testing`; kolom `char(64)` ASCII nullable dengan indeks `inquiries_idempotency_key_hash_unique` (dibaca lewat Boost `database-schema`) |
| Pint, `composer validate --strict`, `check-platform-reqs`, `audit` (`COMPOSER_IPRESOLVE=4`), `route:list` | Lulus; tidak ada advisory; `POST api/v1/inquiries`, `GET|HEAD up` |
| Backend CI run 38805166473 (`6c39e6f`, PHP 8.5.11, MySQL 8.4.11 di Linux) | Lulus, termasuk tes multi-proses |

### Docker pengembangan

| Pemeriksaan | Hasil |
|---|---|
| Image | `backend:dev` dari `php:8.5.11-fpm-bookworm` (PHP 8.5.11 NTS, `bcmath`, `intl`, `mbstring`, `pdo_mysql`, OPcache; Composer 2.10.3), `frontend:dev` dari `node:22.23.1-bookworm-slim` (Node v22.23.1). Build pertama 25 menit, hampir seluruhnya unduhan image dasar dan kompilasi `intl` |
| `include` MySQL | `config --hash mysql` identik untuk `compose.dev.yaml`, `backend/docker/mysql/compose.yaml`, dan label container yang berjalan |
| `setup-dev.sh` di mesin pemilik | 58 detik; secret, `.env`, `.env.testing` sudah ada dan tidak diubah (ukuran dan waktu ubah sama); `solveit-mysql` dipakai ulang: ID, waktu dibuat, waktu start, dan jumlah restart sama sebelum dan sesudah; migrasi "Nothing to migrate" |
| Laravel di container | 13.36.0, `db:show`: MySQL 8.4.11, host `mysql`, port 3306, database `solveit_indonesia` |
| Tes backend di container | **151 lulus, 466 assertion** pada `solveit_indonesia_testing` lewat pengaman yang sama (awalnya 3 tes kontrak frontend dilewati karena `frontend/src/types` tidak terlihat; kini di-mount read-only). Pint lulus |
| Frontend di container | `npm test` 125 lulus, `typecheck` dan `lint` exit 0; dev server `200` di `127.0.0.1:5173` |
| Hot reload | Tanpa polling, `fs.watch` di container tidak menerima event dari folder Windows (dibuktikan). Dengan `SOLVEIT_WATCH_POLLING=true`, browser Chromium menerima `[vite] hot updated: /src/styles/app.css` 2,6 detik setelah file diubah di host; file dikembalikan |
| `/up` | `{"status":"ok"}` di `127.0.0.1:8000` |
| Native dan Docker bersamaan | `php artisan test` native (151 lulus) saat backend Docker tetap menjawab `/up` |
| Restart | `compose restart` (termasuk `solveit-mysql`, container yang sama, 0 restart tercatat): 5 migrasi tetap tercatat |
| Port | 3306 tetap MariaDB XAMPP (`0.0.0.0`), 3307, 5173, 8000 hanya `127.0.0.1` |
| Stop | Dengan `init: true` kedua server dev berhenti dalam 1,6 detik (sebelumnya dimatikan paksa setelah 10 detik, exit 137) |
| Setelah QA | `backend` dan `frontend` dihentikan (`stop`) dan tanpa restart otomatis, agar port 8000 dan 5173 bebas untuk alur native; `solveit-mysql` tetap berjalan |

### Docker produksi (proyek uji terisolasi `solveit-prod-smoke`, data sintetis)

Rahasia acak di folder sementara di luar repository, `production.env.example` sebagai konfigurasi, profil `bundled-db`. `infra/docker/scripts/verify-production.sh`: **33 pemeriksaan lulus**, antara lain:

- PHP 8.5.11 dengan kelima ekstensi; `expose_php`, `display_errors`, `opcache.validate_timestamps` mati; Laravel 13.36.0; backend sebagai `www-data` (uid 33), kode read-only; tanpa Boost, PHPUnit, Pint, `tests/`, `.env`; tidak ada `.env`, dump, `auth.json`, `.git`, kunci, atau sertifikat aplikasi di image backend dan frontend; image frontend tanpa Node.
- Hanya gateway yang mempublikasikan port (`127.0.0.1:8080`); backend, frontend, MySQL tidak.
- `/` (`lang="id"`), `/en/`, `/kontak` tanpa honeypot (kanal API nonaktif), `/en/contact` `200`; `/halaman-tidak-ada` `404` dengan halaman ID, `/en/missing-page` `404` dengan halaman EN, `/404.html` `404`; aset ber-hash `immutable`, `text/css`, gzip; HTML `no-cache`, `nosniff`, tanpa versi server; tidak ada endpoint health di port publik.
- `/up` `200`; `GET /api/v1/inquiries` `405` tanpa trace; `POST` dengan kunci `201`, ulang `201` dengan referensi sama dan `Idempotent-Replayed`, isi lain `409`, kunci rusak `400`, payload kosong `422`, percobaan keenam `429` dengan `Retry-After`.
- Setelah restart backend: `/up` `200`; MySQL 8.4.11 dengan tepat 1 inquiry; `solveit_app` hanya `SELECT, INSERT, UPDATE, DELETE` pada `` `solveit\_indonesia`.* ``.

Migrasi berjalan hanya lewat `run --rm migrate` (5 migrasi sebagai `solveit_migrator`). Container backend: read-only, `cap_drop: ALL`, `no-new-privileges`, batas memori 512 MB; environment hanya berisi `APP_KEY_FILE` dan `DB_PASSWORD_FILE`. Tidak satu pun dari empat rahasia muncul di `docker inspect` keempat container atau di `docker history` kedua image. Ukuran image: frontend 94,6 MB, backend 794 MB (image Debian PHP resmi menyertakan toolchain kompilasi; dapat diperkecil nanti). Proyek uji dihapus dengan `down -v` (hanya volume `solveit-prod-smoke_mysql-data`).

Temuan yang diperbaiki selama QA:

- Health check nginx di `/healthz` dengan `allow 127.0.0.1` ternyata terjangkau dari host: port forwarding Docker Desktop membuat koneksi host tampak sebagai loopback di container. Health check dipindah ke server nginx terpisah di `127.0.0.1:8081` yang tidak pernah dipublikasikan. Akibat yang sama untuk batas laju didokumentasikan (`set_real_ip_from` di `docker-production.md`, TLS).
- Docker CI pertama gagal di Linux dengan `[1130] Host ... is not allowed`: `setup-dev.sh` membuat secret MySQL `600`, padahal image MySQL membaca secret sebagai uid 999 setelah melepas hak root, sehingga provisioning start pertama gagal. Di Windows tidak terlihat karena bind mount Docker Desktop longgar. Perbaikan: file `644`/`0444`, folder `700`; berlaku juga untuk panduan produksi.

### Docker CI (GitHub Actions, Ubuntu)

| Run | Hasil |
|---|---|
| 38805164238 (`6c39e6f`) | Workflow ditolak: konteks `runner` di `env` tingkat job. Diperbaiki; workflow kini lulus actionlint 1.7.7 dan semua skrip lulus shellcheck |
| 38805322828 (`73c2a1e`) | Compose dan skrip lulus. Produksi gagal di langkah secret (glob pada folder yang baru dikunci). Pengembangan gagal: `[1130]`, karena izin secret MySQL (di atas) |
| 38805741991 (`a126fbe`) | Compose dan skrip lulus. **Produksi lulus** (build, migrasi eksplisit, 33 pemeriksaan smoke di Linux). Pengembangan: onboarding dari clone baru lulus (PHP 8.5.11, Node v22.23.1, Laravel 13.36.0), lalu gagal hanya pada regex baris versi MySQL (`db:show` memakai titik, bukan spasi); diperbaiki di `fc12e92` |

Pada PR #26 (head `3202aab`) dan rilis PR #27 semua check lulus: Backend CI (151 tes, 466 assertion, PHP 8.5.11, MySQL 8.4.11, tanpa advisory), Frontend CI (125 unit, E2E bawaan 488 lulus, E2E build API 24 lulus), dan Docker CI (ketiga job). Run: 38806467946, 38806468013, 38806467997 (PR #26); 38807594540, 38807594554, 38807594773 (PR #27). Rilis di `main`: `d22a079`.

### Belum diverifikasi

- Deployment publik, TLS, domain, database produksi, dan perilaku di penyedia hosting tertentu: tidak ada yang dipilih.
- Docker di macOS dan Linux desktop secara langsung (Linux hanya lewat runner GitHub Actions).
- Playwright e2e di dalam container (tidak didukung image Node slim; tetap di host dan CI).
- Server MCP Laravel Boost lewat `docker compose exec` untuk kontributor tanpa PHP di host.
- Klien frontend dengan `Idempotency-Key`: selesai di B2.2 (bagian di atas).

## MySQL 8.4 lokal permanen dan uji integrasi nyata B2 (2026-10-16)

Lingkungan pengembangan di mesin pemilik, tanpa mengubah XAMPP. Kode backend dan frontend tidak berubah; yang di-commit hanya `backend/docker/mysql/` dan dokumentasi.

### Kondisi awal

- PHP CLI `C:\xampp\php\php.exe` 8.5.7 (ZTS, x64), `php.ini` `C:\xampp\php\php.ini`, `pdo_mysql` dan `mysqlnd` aktif. Composer 2.8.12 memakai PHP yang sama.
- MariaDB XAMPP 10.4.32 mendengarkan di 3306 (`mysqld.exe`). Klien `mysql` di `PATH` adalah klien MariaDB itu. Tidak ada layanan Windows MySQL.
- Docker 29.8.2 (Linux, amd64), Compose 5.6.0. Port 3307 kosong. Belum ada container `solveit-mysql` maupun volume `solveit-mysql-data`. Container proyek lain (berhenti) tidak disentuh.
- `backend/.env` masih memilih SQLite; `backend/.env.testing` belum ada.

### Instalasi

- `backend/docker/mysql/compose.yaml`: image `mysql:8.4.11` (digest sama dengan `mysql:8.4`), container `solveit-mysql`, `127.0.0.1:3307->3306`, volume bernama `solveit-mysql-data`, `restart: unless-stopped`, health check `mysqladmin ping` lewat TCP. Kata sandi acak (48 karakter heksadesimal) sebagai Docker secret dari `secrets/` yang diabaikan Git; `docker inspect` hanya menampilkan `MYSQL_ROOT_PASSWORD_FILE`. `root` hanya `root@localhost` di dalam container.
- `initdb/10-solveit-databases.sh` berjalan pada start pertama dan membuat kedua database dan kedua pengguna.
- Restart container: kembali `healthy`, keempat migrasi tetap tercatat.

### Verifikasi SQL

| Pemeriksaan | Hasil |
|---|---|
| `VERSION()`, `@@version_comment` | `8.4.11`, `MySQL Community Server - GPL` (bukan MariaDB) |
| `sql_mode`, engine, charset server | `STRICT_TRANS_TABLES` dan mode default 8.4 lainnya, InnoDB, `utf8mb4` |
| Database | `solveit_indonesia` dan `solveit_indonesia_testing`, keduanya `utf8mb4_unicode_ci` |
| `SHOW GRANTS` `solveit_dev@%` | `USAGE ON *.*`, `ALL PRIVILEGES ON `` `solveit\_indonesia`.* `` |
| `SHOW GRANTS` `solveit_test@%` | `USAGE ON *.*`, `ALL PRIVILEGES ON `` `solveit\_indonesia\_testing`.* `` |
| PDO dari PHP 8.5.7 (mysqlnd 8.5.7) | Kedua pengguna tersambung ke 8.4.11 dan memilih database masing-masing; `USE` ke database yang lain ditolak (SQLSTATE 42000) |

### Laravel

- `backend/.env` diubah dengan izin pemilik oleh script yang hanya mengganti `DB_*` dan menambah `CORS_ALLOWED_ORIGINS` (cadangan `backend/.env.backup`); nilai tidak ditampilkan. `.env.testing` dibuat baru (`APP_KEY` sendiri, `solveit_test`).
- `php artisan db:show`: MySQL 8.4.11, `solveit_indonesia`, `127.0.0.1:3307`, `solveit_dev`, 0 tabel. `php artisan migrate`: 4 migrasi, batch 1.
- `php artisan test`: **109 tes, 275 assertion, lulus** pada `solveit_indonesia_testing` (pengaman menerima grant yang di-escape).
- Pint lulus; `composer validate --strict` valid; `composer check-platform-reqs` semua sukses (php 8.5.7); `composer audit`: tidak ada advisory (perlu `COMPOSER_IPRESOLVE=4`; lewat IPv6 permintaan ke Packagist timeout di jaringan ini); `route:list --except-vendor`: `POST api/v1/inquiries`, `GET|HEAD up`.
- Laravel Boost MCP: `application-info` melaporkan Laravel 13.36.0, PHP 8.5, engine `mysql`; `database-schema` membaca tabel hasil migrasi.

### Integrasi nyata frontend ke Laravel ke MySQL (B2, tanpa mock)

Frontend `frontend` di `1ef187c` dibangun dengan `VITE_INQUIRY_API_ENABLED=true` dan `VITE_API_BASE_URL=http://127.0.0.1:8000` ke `build/inquiry-api-local`, disajikan di `http://localhost:4174`; Laravel `php artisan serve` di `127.0.0.1:8000`. Data sintetis saja.

| Pemeriksaan | Hasil |
|---|---|
| Preflight `OPTIONS` dari `http://localhost:4174` | `204`, `Access-Control-Allow-Origin: http://localhost:4174`, metode `GET, POST` |
| Preflight dari origin lain | `204` tanpa header `Access-Control-Allow-Origin` (browser menolak) |
| Membuka `/kontak` | 0 request ke API |
| Klik ganda **Kirim melalui website** (Chromium) | Tepat 1 `POST /api/v1/inquiries`, `201` `{"id":"INQ-DXJA-G0DD-MFXE","status":"received"}`; referensi yang tampil sama dengan respons; tidak ada `window.open`, tidak ada pesan konsol |
| Database | Tepat 1 baris dengan `public_id` itu (`website`, `belum-tahu`, `fleksibel`, `received`) |
| `422` data tidak valid (curl, header `Origin`) | Galat untuk `name`, `contact`, `service`, `budget`, `timeline`, `message`; header CORS ada |
| `422` honeypot terisi | Galat hanya `homepage`; jumlah baris tetap 1 |
| Build bawaan (tanpa variabel) | `/kontak` tanpa tombol website dan honeypot, tidak ada rujukan ke API lokal |

Sebelum service dipilih, validasi formulir di browser menolak kiriman dan tidak ada request. Baris uji dihapus setelahnya berdasarkan referensinya (sisa 0 baris). Penghitung rate limit di tabel `cache` kedaluwarsa sendiri (paling lama 1 jam).

### Belum diverifikasi

- Tampilan `422` dari server sungguhan di browser: validasi klien menolak data yang sama lebih dulu. Pemetaan `422`, `429`, `503`, dan galat jaringan tetap dibuktikan dengan respons tiruan (bagian B2 di bawah).
- Rate limit `429` nyata tidak dipicu, agar tidak mengisi cache dengan percobaan tambahan.
- WebKit dan Firefox tidak dipakai untuk uji nyata ini (hanya Chromium).

## B2: integrasi API inquiry di frontend (2026-10-15)

Cakupan: kanal **Kirim melalui website** di formulir kontak, di balik flag yang nonaktif secara default, dan perbaikan tes animasi tema yang flaky di WebKit. Baseline yang diverifikasi: `origin/main`, `origin/frontend`, `origin/backend` = `88db528` (rilis B1.1, PR #21), `origin/staging` `22f6853` dengan tree yang sama (`4b71119`); working tree bersih, tanpa stash atau worktree lain.

### Mode aktif dan nonaktif

Nilai `VITE_*` ditanam saat build, jadi mode aktif dibuktikan dengan build kedua (`playwright.api.config.ts`: `BUILD_DIR=build/inquiry-api`, port 4174, `VITE_INQUIRY_API_ENABLED=true`, `VITE_API_BASE_URL=http://127.0.0.1:65530`). Semua request ke origin itu dijawab `page.route`; tidak ada request yang keluar dan tidak ada data inquiry nyata. Build bawaan (dan Frontend CI) tetap membuktikan mode nonaktif: tes `the default build has no website channel and calls no API` memeriksa teks privasi lama, tidak ada tombol website atau honeypot, dan tidak ada request ke path `/api/` saat WhatsApp dibuka.

### Pemeriksaan otomatis (lokal, Windows 11, Node 22.23.1, Playwright 1.64)

| Pemeriksaan | Hasil |
|---|---|
| `npm run lint`, `npm run typecheck`, `npm run build` | Lulus |
| Prettier | Semua file yang akan di-commit lulus. `npm run format:check` lokal menandai `frontend/.impeccable/hook.cache.json`, cache hook desain yang dikecualikan lewat `.git/info/exclude` (tidak ada di checkout CI) |
| `npm test` | 15 file, 125 tes lulus (sebelumnya 69). Baru: `site.test.ts` (origin dan flag), `inquiry-api.test.ts` (request, 201 valid dan rusak, 422, honeypot, 413, 429 dengan/tanpa `Retry-After`, 503, 4xx/5xx lain, jaringan, timeout, abort, pembersihan timer dan listener, tanpa retry), `inquiry-form.api.test.tsx` (17 tes mode aktif, ID dan EN), paritas validasi di `inquiry.test.ts` |
| E2E build bawaan, Chromium desktop 1440 | 180 lulus, 5 dilewati, 0 gagal |
| E2E build bawaan, Chromium tablet 820 | 161 lulus, 24 dilewati, 0 gagal |
| E2E build bawaan, Pixel 7 | 147 lulus, 38 dilewati, 0 gagal |
| E2E build API, desktop + tablet + Pixel 7 | 24 lulus |
| E2E build API, Firefox | 8 lulus |
| E2E build API, WebKit desktop + iPhone 14 (lokal) | 14 lulus, 2 dilewati: tes email di WebKit, karena WebKit Playwright di Windows menyerahkan `mailto:` ke handler email sistem yang mengganti halaman (perilaku sama dengan kode lama; komposisi `mailto:` dites di unit test, Chromium, dan Firefox) |
| axe pada status penerimaan (build API, semua project) | 0 pelanggaran |

### Tes tema yang flaky di WebKit (diperbaiki, akar masalah terkonfirmasi)

Gejala: Cross-browser QA run 38723672210 percobaan 1, `webkit-mobile`, `refinement.spec.ts` "the theme icons roll through the button": `expect(moving).not.toBe("none")`, diterima `"none"`; lulus pada percobaan 2 tanpa perubahan kode.

Akar masalah: `setTheme()` (`src/lib/theme.ts`) menerapkan `data-theme` di dalam callback `document.startViewTransition()`, yang berjalan satu frame atau lebih setelah klik. Tes membaca `transform` ikon matahari tepat setelah `click()`, jadi kadang membaca keadaan sebelum tema berganti. Pada perangkat sentuh (`hover: none`) keadaan itu `none` sehingga gagal; pada perangkat pointer, rotasi hover matahari (`rotate(45deg)`) membuat asersi lulus walau tema belum berganti, jadi tes tidak pernah benar-benar memeriksa gulungan ikon di sana. Bukti (skrip diagnostik, 10 run per konfigurasi, callback ditunda 100 ms untuk meniru frame lambat di runner): pembacaan lama memberi `theme=light transform=none` di WebKit iPhone 14 dan Chromium Pixel 7, dan `theme=light transform=moved` di desktop; asersi baru lulus di keempatnya. Tanpa penundaan, keempat konfigurasi selalu membaca tema gelap (80/80), sesuai kegagalan yang hanya muncul di runner CI yang sibuk.

Perbaikan (hanya tes, aplikasi tidak berubah): tunggu `data-theme="dark"`, catat transisi ikon lewat `transitionrun` yang terjadi setelah tema gelap aktif (gulungan hover sebelumnya tidak terhitung), wajibkan transisi `transform` pada matahari dan bulan, lalu periksa keadaan akhir: matahari bergeser ke bawah sel (`DOMMatrix.f > 0`) dan transparan, bulan opasitas 1 dan tegak setelah pointer menjauh. Tes baru untuk reduced motion: hanya crossfade, tanpa transisi `transform`. Tidak ada timeout yang dinaikkan. Pengulangan lokal: WebKit desktop dan iPhone 14, 10 kali masing-masing untuk kedua tes, 40/40 lulus; Chromium desktop dan Pixel 7 lulus.

### CI (GitHub Actions)

| Run | Hasil |
|---|---|
| Frontend CI 38734922594 (PR #22, `8eed02d`) | Lulus. E2E build bawaan 488 lulus; E2E build API 24 lulus |
| Cross-browser QA 38734781136 (`09efbc0`, push) dan 38734933837 (`8eed02d`, dispatch), 1 worker, tanpa retry | Keduanya: WebKit 177 lulus, 0 gagal, 0 flaky, 8 dilewati; WebKit iPhone 14 145 lulus, 0 gagal, 0 flaky, 40 dilewati; build API 7 lulus dan 1 dilewati per project. Tes tema yang sebelumnya flaky lulus di keempat eksekusi |

### Performa dan aksesibilitas

| Ukuran (gzip) | `main` `88db528` | B2 (build bawaan) |
|---|---|---|
| Chunk route kontak | 3,46 KB | 6,95 KB |
| Seluruh JS | 254,9 KB | 260,4 KB (+5,5 KB, sebagian besar teks dua bahasa) |
| HTML `/kontak` | 15.540 B | 15.559 B |

Lighthouse 13.5, preset mobile bawaan (simulasi throttling), `/kontak`, median 3 run, kedua build disajikan `scripts/serve.mjs`: performa 100 vs 100, LCP 1590 vs 1588 ms, TBT 9 vs 9 ms, CLS 0 vs 0, aksesibilitas 100 vs 100. Tidak ada request saat render atau prerender; request hanya setelah klik dan validasi lolos.

Review visual build API pada 1440, 820, dan 390 px, tema terang dan gelap: status idle, mengirim, diterima, dan tidak pasti. Satu perbaikan selama review: judul "Atau kirim sendiri lewat WhatsApp atau email" menjadi pemisah tenang bergaris agar pemilih nomor jelas milik WhatsApp. Umpan balik sebelumnya tetap tampil (redup) selama mengirim agar tombol tidak melompat, kecuali ringkasan kolom yang belum diisi karena isinya sudah tidak benar.

### Integrasi Laravel dan MySQL

**Tidak diverifikasi secara lokal.** Mesin pemilik belum punya MySQL 8.4 permanen, dan tugas ini tidak mengizinkan memasang layanan, membuat kredensial, atau membaca `.env`. Semua tes frontend memakai respons mock sesuai `docs/api/inquiries.md`; kontrak backend tetap dibuktikan oleh tes backend dan Backend CI (MySQL 8.4) yang tidak berubah. Uji HTTP nyata frontend ke Laravel dan MySQL perlu dilakukan setelah lingkungan sekali pakai diizinkan atau API di-deploy.

Pembaruan 2026-10-16: uji nyata ini sudah dilakukan setelah MySQL 8.4 lokal disiapkan; hasilnya di bagian "MySQL 8.4 lokal permanen dan uji integrasi nyata B2" di atas.

## B1.1: review akhir dan penyelarasan konfigurasi QA (2026-10-15)

Cakupan: temuan review PR #20, tanpa memperluas B1.1. Baseline yang diverifikasi: `origin/backend` = lokal `258dae4`, `origin/staging` `7e936b5`, `origin/main` dan `origin/frontend` `7729d17`; PR #20 open, mergeable, Backend CI run 38711417910 dan Frontend CI run 38711417888 lulus pada `258dae4`. Server uji: container `mysql:8.4` sekali pakai baru (MySQL 8.4.11, `127.0.0.1:3307`, tmpfs), dihapus di akhir sesi.

| Temuan | Tindakan | Bukti |
|---|---|---|
| `.claude/skills/backend-verify/SKILL.md` masih menyebut SQLite in-memory dan matriks PHP 8.3/8.5 | Ditulis ulang: PHP 8.5 minimal 8.5.7 dan `pdo_mysql`, tes hanya di `solveit_indonesia_testing` dengan pengaman, `check-platform-reqs`, migrasi di database pengembangan MySQL, CI PHP 8.5 + MySQL 8.4. Kali ini perubahan `.claude/` tidak ditolak (permintaan eksplisit pemilik) | Skill termuat ulang di sesi dengan deskripsi baru dan dipakai untuk verifikasi di bawah |
| `.claude/rules/backend.md` (path `backend/**`) | Dihapus. Keempat butirnya sudah ada di sumber yang dimuat pada pemicu yang sama: `backend/CLAUDE.md` (`@AGENTS.md`), blok Boost (search-docs, `make:*`, Pint, tes), dan guideline Solveit (endpoint dan `docs/api/`). Perilaku pemuatan: di sesi ini, membaca file di `backend/` memuat `backend/CLAUDE.md`, `backend/AGENTS.md`, dan aturan itu bersamaan, sesuai pemuatan on-demand `CLAUDE.md` bertingkat. `.claude/rules/frontend.md` tetap | `.claude/rules/` kini hanya `frontend.md`; root `CLAUDE.md` tetap benar |
| Pengaman tes hanya memeriksa substring `_testing` | `tests/Support/TestDatabaseGuard.php`, dipanggil dari `TestCase::setUpTraits()` sebelum `RefreshDatabase`, sekali per proses: `APP_ENV` `testing`; koneksi `mysql` dengan driver `mysql`; nama persis `solveit_indonesia_testing` tanpa `DB_URL`; `SELECT DATABASE()` dari server; `SHOW GRANTS FOR CURRENT_USER()` hanya `USAGE` global dan hak pada `` `solveit\_indonesia\_testing`.* ``. `phpunit.xml` kini juga mengunci `APP_ENV` dan `DB_DATABASE` di `$_SERVER` dan `$_ENV` | Lihat tabel uji di bawah |
| Grant contoh di README dan CI memakai `solveit_indonesia_testing.*` tanpa escape; di MySQL `_` adalah wildcard pada grant tingkat database, sehingga grant juga berlaku untuk nama lain yang mirip | README dan CI memakai `` `solveit\_indonesia\_testing`.* `` (juga untuk database pengembangan dan CI). Pengaman menolak grant tanpa escape | `SHOW GRANTS` di MySQL 8.4.11: grant tanpa escape tampil sebagai `` `solveit_indonesia_testing`.* ``, yang di-escape sebagai `` `solveit\_indonesia\_testing`.* ``. SQL CI yang dihasilkan heredoc diperiksa lokal; `actionlint` bersih |

### Uji pengaman terhadap server nyata

Tabel penanda dibuat di database pengembangan `solveit_indonesia` sebelum percobaan.

| Percobaan | Hasil |
|---|---|
| Pengguna dengan `ALL PRIVILEGES ON *.*` | Ditolak sebelum tes berjalan: "may only hold privileges on `` `solveit\_indonesia\_testing`.* ``; it also holds privileges on `*.*`" |
| Pengguna dengan grant tanpa escape | Ditolak ("… privileges on `` `solveit_indonesia_testing`.* ``") |
| `root` | Ditolak (hak `*.*`) |
| `DB_DATABASE=solveit_indonesia`, `APP_ENV=local`, `DB_URL=mysql://…/solveit_indonesia`, `DB_CONNECTION=sqlite` dari shell | Diabaikan karena dikunci; tes berjalan di `solveit_indonesia_testing` dan `MySqlDatabaseTest` lulus |
| Database pengembangan setelah semua percobaan | Tetap satu tabel penanda dengan barisnya; tidak ada file SQLite yang dibuat |

Tes regresi baru `tests/Feature/Support/TestDatabaseGuardTest.php` (15 kasus): koneksi nyata lolos dan memilih database tes; database pengembangan, nama yang hanya mengandung `_testing` (`shop_testing_backup`), `DB_URL`, dan koneksi SQLite ditolak sebelum terhubung; environment selain `testing` ditolak; sesi di database lain ditolak; grant yang benar diterima; tujuh grant tidak aman ditolak (hak global, hak dinamis global, database pengembangan, grant wildcard, pola `%`, role, proxy). Uji mutasi: pemeriksaan grant dimatikan, tepat tujuh kasus grant tidak aman gagal; file dipulihkan.

### Verifikasi (skill `backend-verify` yang diperbarui)

| Langkah | Hasil |
|---|---|
| PHP | `PHP 8.5.7 (cli) … ZTS`, `pdo_mysql` dimuat |
| Pint | Lulus |
| `php artisan test` (pengguna `solveit_test` dengan grant yang di-escape; kredensial lewat environment, bukan `.env.testing`, agar tidak membuat file kredensial di working copy) | **109 lulus, 275 assertion**, juga dengan `--order-by=random`. Sebelumnya 94 dan 249: plus 15 kasus pengaman |
| `composer validate --strict`, `check-platform-reqs` | Valid; `php 8.5.7 success` |
| `composer audit` | Tidak ada advisory |
| Route | `POST api/v1/inquiries`, `GET|HEAD up` |
| `migrate:status` (database pengembangan di container sekali pakai) | 4 migrasi `Ran` |
| `boost:update --no-discover` | Berhasil; `backend/AGENTS.md` berubah satu baris di blok Solveit |
| MCP | `claude mcp list`: `laravel-boost` Connected. `playwright` kali ini timeout 30 detik (cold start `npx` di Windows, dicatat di `CLAUDE.md`; tidak terkait perubahan ini). `application-info`: Laravel 13.36.0, PHP 8.5, `database_engine sqlite`, karena server MCP membaca `backend/.env` lokal pemilik yang belum dipindah ke MySQL |

### CI

Pada `856c6f3`: Backend CI run 38713920726 (pull_request) dan 38713906937 (push) lulus, `Tested PHP: 8.5.11`, `Tested MySQL: 8.4.11 (MySQL Community Server - GPL)`, `109 passed (275 assertions)`; pengguna tes CI dengan grant yang di-escape diterima pengaman. Frontend CI run 38713920741 lulus.

### Diff PR #20

Terhadap `origin/staging`: 0 file `frontend/`; gitleaks pada 37 file yang berubah tidak menemukan kebocoran; tidak ada `.env` selain `.env.example`, kunci, file database, log, cache, atau salinan agent lokal (`backend/.claude/`, `.agents/`, `.codex/`, `.mcp.json`). Satu-satunya nama yang cocok dengan pola sensitif adalah penghapusan `.cursor/mcp.json`. Teks mirip kata sandi hanya root kosong service container CI sekali pakai dan placeholder `<kata-sandi-root-lokal>` di README.

## B1.1: MySQL, PHP 8.5.7, konsolidasi agent, keamanan repository (2026-10-15)

Cakupan: branch `backend`, fast-forward dari `origin/staging` `7e936b5` (merge PR #19; tree sama dengan `fbb537e`). Tanpa perubahan aplikasi frontend, desain, atau konten. Mesin: Windows 11, PHP 8.5.7 ZTS (XAMPP, `C:\xampp\php\php.exe`, juga dipakai Composer 2.8.12), Docker 29.8.2, Claude Code 2.1.300, Codex CLI 0.160.0.

### Lingkungan database

| Pemeriksaan | Hasil |
|---|---|
| Server lokal yang ada | Port 3306 milik XAMPP: `mysqld --version` = **MariaDB 10.4.32**, bukan Oracle MySQL. Tidak dipakai dan tidak diubah |
| Server uji | Container Docker sekali pakai `mysql:8.4` (digest `sha256:24989179…`), hanya di `127.0.0.1:3307`, data di tmpfs: `SELECT VERSION()` = **8.4.11**, `@@version_comment` = `MySQL Community Server - GPL`, `sql_mode` berisi `STRICT_TRANS_TABLES`, `utf8mb4`, InnoDB |
| Database dan pengguna | `solveit_indonesia` (pengembangan, `solveit_dev` semua hak hanya di database ini), `solveit_indonesia_testing` (`solveit_test`), `solveit_app` (`SELECT, INSERT, UPDATE, DELETE` saja). Kata sandi acak di scratchpad sesi, tidak di repository |

### Tes sebelum refactor: suite lama di MySQL

Suite B1 dijalankan apa adanya terhadap MySQL: 89 lulus, 1 gagal (`test_tests_run_against_an_isolated_in_memory_database`, yang memang menegaskan SQLite). Dua tes kegagalan penyimpanan yang memakai `Schema::drop('inquiries')` **lulus, tetapi karena kebetulan**: di MySQL `DROP TABLE` melakukan commit implisit, transaksi `RefreshDatabase` putus, dan Laravel mendeteksi transaksi yang hilang lalu menjalankan `migrate:fresh` lagi sebelum tes berikutnya (`RefreshDatabase::beginDatabaseTransaction`, `RefreshDatabaseState::$migrated = false`). Biayanya migrasi ulang penuh dan ketergantungan pada efek samping; durasi suite sekitar 16 detik.

### Perubahan tes

| Perubahan | Alasan |
|---|---|
| `phpunit.xml`: `DB_CONNECTION=mysql` (dikunci di `<server>` dan `<env force>`), `DB_DATABASE=solveit_indonesia_testing` | Tes memakai MySQL, bukan SQLite in-memory. Ditemukan saat QA: `<env force="true">` saja tidak cukup, karena Laravel membaca `$_SERVER` lebih dulu; `DB_CONNECTION=sqlite` di shell masih memindahkan suite ke SQLite dan membuat file `backend/solveit_indonesia_testing` (dihapus). Setelah `<server>` ditambahkan, override itu diabaikan dan tidak ada file yang dibuat |
| `tests/TestCase.php`: menolak nama database tanpa `_testing` sebelum trait tes berjalan | Diverifikasi: `DB_DATABASE=solveit_indonesia` menghasilkan galat "Tests only run against a disposable database…" sebelum ada tabel yang dihapus |
| Tes kegagalan penyimpanan: `Schema::drop` diganti baris yang ditolak MySQL (`name` 121 karakter lewat event `creating`, SQLSTATE 22001 karena strict mode) | Tanpa DDL; transaksi tes utuh. Tes juga menegaskan `sqlstate` `22001`, tidak ada baris tersimpan, dan exception yang dilaporkan tanpa data pribadi |
| `tests/Feature/Actions/SubmitInquiryTest.php` (2 tes baru) | Tabrakan nomor referensi terhadap indeks `UNIQUE` sungguhan (galat 1062): dua tabrakan lalu sukses pada percobaan ketiga; tiga tabrakan menghasilkan `InquiryNotStoredException` (`sqlstate` `23000`, tanpa exception sebelumnya) dan tidak ada baris baru. Uji mutasi: `MAX_ATTEMPTS = 1` membuat keduanya gagal; dikembalikan |
| `tests/Feature/Database/MySqlDatabaseTest.php` (3 tes baru) | Server MySQL 8.4 atau lebih baru dan bukan MariaDB, database `_testing`; strict mode, `utf8mb4`, tabel `utf8mb4_unicode_ci` InnoDB; penghitung rate limit di cache store `database` (konfigurasi produksi) |
| Tes SQLite in-memory dihapus | Digantikan tes MySQL di atas |

Jumlah: **94 tes, 249 assertion** (sebelumnya 90 dan 230): minus 1 tes SQLite, plus 2 tes action, plus 3 tes MySQL; assertion bertambah dari tes baru dan pemeriksaan tambahan pada dua tes kegagalan penyimpanan.

### Hasil lokal (MySQL 8.4.11, PHP 8.5.7)

| Pemeriksaan | Hasil |
|---|---|
| `php artisan test` | 94 lulus, 249 assertion, sekitar 6 sampai 8 detik (sebelumnya sekitar 16 detik karena migrasi ulang). Dua kali berturut-turut, tiga kali `--order-by=random`, dan setiap tes baru sendiri-sendiri: semua lulus |
| Migrasi | Database pengembangan: naik 4, rollback 4, naik 4, `migrate:status` 4 `Ran`. `migrate:rollback` sebagai `solveit_app` ditolak (`SQLSTATE[42000] 1142 DROP command denied`) dan tidak mengubah apa pun |
| Skema | `SHOW CREATE TABLE inquiries`: `varchar` dengan panjang yang sama, `text`, `bigint unsigned`, `UNIQUE inquiries_public_id_unique`, index `status`, InnoDB, `utf8mb4_unicode_ci`. Migrasi tidak diubah |
| HTTP nyata sebagai `solveit_app` (`APP_ENV=production`, `APP_DEBUG=false`, `CACHE_STORE=database`) | `/up` `{"status":"ok"}`; lima `POST /api/v1/inquiries` `201`, keenam `429 Too Many Attempts.`; baris tersimpan dengan referensi `INQ-…` valid, status `received`, `created_at` terisi; tabel `cache` berisi penghitung |
| `vendor/bin/pint --test` | Lulus |
| `composer validate --strict` | Valid |
| `composer check-platform-reqs` | `php 8.5.7 success`, semua ekstensi terpenuhi |
| `composer audit` | Tidak ada advisory |
| `php artisan route:list --except-vendor` | `POST api/v1/inquiries`, `GET|HEAD up` |
| Instalasi `--no-dev` (salinan bersih) | Boot, route terdaftar, 0 perintah `boost:`, `laravel/boost`, `laravel/mcp`, `laravel/roster`, PHPUnit tidak terpasang, `config:cache` berhasil, `database.default` = `mysql` |

### PHP 8.5.7

- `php -v`: 8.5.7 ZTS; `composer --version` melaporkan PHP 8.5.7 dari `C:\xampp\php\php.exe`. Ekstensi: `pdo_mysql`, `mysqlnd`, `mbstring`, `intl`, `bcmath`, `openssl`, `fileinfo`, `ctype`, `tokenizer`, `xml`.
- `composer.json`: `"php": "^8.5.7"`, `config.platform.php` `8.5.7`. `composer update --lock --dry-run`: "Nothing to modify in lock file"; setelah dijalankan, diff `composer.lock` hanya `content-hash` dan dua baris platform. Tidak ada paket yang berubah: Laravel 13.36.0, Boost 2.10.3, MCP 1.0.2, PHPUnit 12.5.39, Pint 1.32.1, Symfony 7.4.x. Batas PHP paket-paket itu (`^8.3`, `>=8.2`, `^8.2`) semuanya menerima 8.5.7.
- `vendor/composer/platform_check.php` kini menolak `PHP_VERSION_ID < 80507`.

### Backend CI

`.github/workflows/backend-ci.yml` ditulis ulang: satu job PHP 8.5 dengan service container `mysql:8.4`. Langkah: kebijakan PHP (8.5, minimal 8.5.7, `pdo_mysql`, versi aktual ke ringkasan run), versi MySQL 8.4.x dan bukan MariaDB (ke ringkasan), dua database sekali pakai dan tiga pengguna dengan kata sandi acak yang disamarkan, `composer validate`, `install`, `check-platform-reqs`, Pint, migrasi naik-turun-naik sebagai pengguna migrasi, smoke test HTTP sebagai pengguna DML saja, tes, cek route, `composer audit`, instalasi `--no-dev`. `actionlint` 1.7.7: tidak ada temuan pada workflow ini.

Hasil di GitHub untuk `8991ebd` (PR #20): Backend CI run 38709084941 (PR) dan 38709043589 (push) **lulus**. Ringkasan run: `Tested PHP: 8.5.11` (patch terbaru runner, lolos syarat minimal 8.5.7; CI tidak mengklaim 8.5.7 persis) dan `Tested MySQL: 8.4.11 (MySQL Community Server - GPL)`. Migrasi naik-turun-naik 4 `Ran`, smoke test HTTP lulus, `Tests: 94 passed (249 assertions)`, route `POST api/v1/inquiries`, tidak ada advisory, instalasi `--no-dev` tanpa perintah Boost. Frontend CI run 38709084923 (dipicu perubahan izin workflow) lulus.

### Agent

| Pemeriksaan | Hasil |
|---|---|
| Cursor | `.cursor/mcp.json` dihapus dari Git; `cursor` dihapus dari `backend/boost.json`; salinan lokal `backend/.cursor/` (dibuat Boost: `mcp.json` dan tiga skill yang identik dengan salinan Claude) dihapus; `.cursor/` ditambahkan ke `.gitignore` (`/.cursor/` bawaan Laravel di `backend/.gitignore` dipertahankan). Rujukan Cursor yang tersisa hanya aturan ignore, catatan B1.1 ini, dan bagian sejarah laporan QA yang menurut aturan tidak ditulis ulang |
| `php artisan boost:update --no-discover` | "Boost guidelines and skills updated successfully". Diff `backend/AGENTS.md` hanya di blok Solveit (guideline MySQL dan tes); skill tetap untuk `.claude/skills/` dan `.agents/skills/` |
| Claude Code | `claude mcp list` dari root: `playwright` dan `laravel-boost` Connected. Skill Boost `laravel-best-practices` dan `testing-best-practices` muncul di sesi saat bekerja di `backend/` |
| Codex | Dengan `CODEX_HOME` sementara yang mempercayai root dan `backend/`: dari root `laravel-boost php backend/artisan boost:mcp enabled`, dari `backend/` `php artisan boost:mcp enabled`; tanpa kepercayaan tidak ada server. Dokumentasi Codex: `AGENTS.md` dibaca dari root turun ke folder kerja, skill dari folder kerja naik; maka Codex dimulai di `backend/` untuk pekerjaan backend. Pemanggilan tool dari sesi Codex yang login tidak diuji |
| Struktur | Tidak ada `frontend/AGENTS.md` (aturan frontend cukup di root `AGENTS.md` dan aturan path-scoped). Perubahan di `.claude/` (aturan dan skill Claude Code) ditolak oleh pengaman mode otomatis sesi ini sebagai modifikasi diri, jadi `.claude/rules/backend.md` (rangkap dengan `backend/CLAUDE.md`) dan teks SQLite di `.claude/skills/backend-verify/SKILL.md` menunggu pemilik |

### Keamanan repository

| Pemeriksaan | Hasil |
|---|---|
| Visibilitas | Repository **publik** (`gh api`), jadi riwayat diaudit penuh |
| gitleaks 8.24.3 (Docker), riwayat semua ref, `--redact` | 23 commit non-merge (42 total), sekitar 1,94 MB: **tidak ada kebocoran** |
| gitleaks pada pohon kerja yang akan di-commit (266 file terlacak dan baru, tanpa file yang diabaikan) | Tidak ada kebocoran |
| Nama file sensitif di seluruh riwayat (`.env`, kunci, `sqlite`, `.sql`, dump, `auth.json`, log) | Hanya `backend/.env.example` dan `frontend/.env.example` |
| `.gitignore` root | Ditambah kunci (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `auth.json`), file database dan dump (`*.sqlite`, `*.sqlite3`, `*.sql`, `*.sql.gz`, `*.dump`, `*.bak`), cache tes (`.phpunit.cache/`, `.phpunit.result.cache`, `.eslintcache`), `AGENTS.override.md`, `.cursor/`, `Desktop.ini`, `*.swp`, `*~`. `git ls-files -ci --exclude-standard` kosong; `.env.example`, lock file, `boost.json`, `.codex/config.toml`, `.claude/settings.json`, `.mcp.json` tidak diabaikan; contoh `.env`, `.env.testing`, `auth.json`, `*.pem`, `database.sqlite`, `dump.sql`, `laravel.log` diabaikan |
| Document root | `backend/public/` hanya berisi `index.php`, `.htaccess`, `robots.txt`, `favicon.ico`; dokumentasi mewajibkan document root `public/` |
| GitHub Actions | Ketiga workflow kini menyatakan `permissions: contents: read` (sebelumnya hanya Backend CI; izin bawaan repository tidak dapat dibaca dengan akses sesi ini). Tidak ada rahasia GitHub yang dipakai |
| CORS, proxy, data inquiry | Tidak berubah dan tetap dites: origin dari daftar, `X-Forwarded-For` hanya dari proxy tepercaya, exception penyimpanan tanpa data pribadi (kini juga di MySQL) |

### Keterbatasan

- Database lokal pemilik: `backend/.env` (tidak dibuka) masih memakai SQLite, dan mesin pemilik hanya punya MariaDB XAMPP. Verifikasi lokal di atas memakai container sekali pakai yang dihapus di akhir sesi; pemilik perlu menjalankan MySQL 8.4 sendiri (`backend/README.md`) dan memperbarui `.env` serta membuat `.env.testing`.
- Akses `gh` sesi ini tidak dapat membaca izin bawaan Actions dan proteksi branch repository.
- Frontend tidak diubah; suite browser tidak dijalankan ulang. Frontend CI akan berjalan pada PR karena file workflow-nya berubah.

## Backend B0 dan B1: integrasi `staging` ke `main` (2026-10-15)

Cakupan: audit setelah PR #16 (`backend` ke `staging`) di-merge pemilik sebagai `09d05a4`, dan satu perbaikan kecil sebelum PR `staging` ke `main`.

| Pemeriksaan | Hasil |
|---|---|
| Isi `origin/staging` | Tree `09d05a4` identik dengan tree `origin/backend` `079ee88` (`0bed1cc`); `origin/main` adalah ancestor `origin/staging` (tidak ada commit `main` yang hilang, tidak ada konflik) |
| Artefak | Backend Laravel 13, `laravel/boost` di `require-dev`, `boost.json`, `AGENTS.md`/`CLAUDE.md` backend, `config/boost.php`, guideline Solveit, API inquiry, migrasi, tes, Backend CI, `.mcp.json`/`.codex`/`.cursor`, `.claude/settings.json`, dokumen, dan `.ai/` ada di `origin/staging`. Salinan skill per agent sengaja tidak di-commit (dibuat `boost:update`) |
| Frontend | Tidak ada file `frontend/` yang berbeda dari `main`; logo di `frontend/public/brand/` identik; Frontend CI dan Cross-browser QA tidak berubah |

### Perbaikan: log setelah penyimpanan

Risiko: `SubmitInquiry` memanggil `Log::info()` setelah `save()` tanpa pengaman. Bila channel log gagal (Monolog melempar `UnexpectedValueException` saat file log tidak dapat dibuka), inquiry yang sudah tersimpan menjadi respons 500, dan pengunjung yang mengulang kiriman membuat duplikat.

- Tes regresi `test_failing_log_channel_still_returns_201_for_a_stored_inquiry` ditulis lebih dulu dan **gagal** sebelum perbaikan (exception keluar dari action sampai ke exception handler).
- Perbaikan satu baris: log dibungkus `rescue(..., report: false)` (tidak dilaporkan, karena pelaporan menulis ke log yang sama). Tes yang memastikan log hanya berisi nomor referensi tetap lulus.
- `php artisan test`: 90 lulus, 230 assertion. Pint lulus. Hasil Backend CI untuk perbaikan ini ada di PR-nya dan di `.ai/project-status.md`.

## Backend B0 dan B1: fondasi Laravel 13, Laravel Boost, API inquiry (2026-10-15)

Cakupan: fondasi backend di branch `backend` (fast-forward dari `main` `7e37a77`). Tanpa perubahan kode frontend, desain, atau konten. Mesin: Windows 11, PHP 8.5.7 (ZTS, XAMPP), Composer 2.8.12, Node 22.23.1, Claude Code CLI, Codex CLI 0.160.0. Cursor tidak terpasang.

### Fondasi Laravel

| Pemeriksaan | Hasil |
|---|---|
| Scaffolding | `composer create-project laravel/laravel:^13.0` di folder sementara di luar repository, lalu disalin ke `backend/` tanpa menimpa README. `php artisan --version`: **Laravel Framework 13.36.0** |
| Kompatibilitas PHP | Lock pertama memilih Symfony 8.1 (butuh PHP 8.4.1), bertentangan dengan `"php": "^8.3"`. Diperbaiki dengan `config.platform.php = 8.3.0`: 17 paket Symfony turun ke 7.4 LTS, `composer check-platform-reqs --lock` lulus |
| `composer validate --strict` | `./composer.json is valid` |
| `composer audit` | `No security vulnerability advisories found.` |
| `vendor/bin/pint --test` | Lulus |
| `php artisan route:list --except-vendor` | `POST api/v1/inquiries .. api.v1.inquiries.store`; ditambah `GET /up`. Rute penyajian file `storage/{path}` bawaan dimatikan (`serve => false`). `POST /api/api/v1/inquiries` menghasilkan 404 (dites lewat HTTP) |
| Migrasi | Database lokal: 4 migrasi `Ran`. File SQLite sekali pakai: naik 4, rollback 4, naik lagi 4 (sama dengan langkah CI) |
| Instalasi produksi | Salinan bersih: `composer install --no-dev` menghapus `laravel/boost`, `laravel/mcp`, `laravel/roster`; aplikasi boot, route terdaftar, 0 perintah `boost:`, `config:cache` berhasil |
| Clone bersih | File yang akan di-commit disalin ke folder kosong: `composer install`, `key:generate`, `migrate`, `boost:update --no-discover` membuat `AGENTS.md` identik byte dan skill untuk tiga agent; `php artisan test` 89/89 |

### Laravel Boost

| Pemeriksaan | Hasil |
|---|---|
| Paket | `laravel/boost` **v2.10.3** di `require-dev` (bersama `laravel/mcp`, `laravel/roster` sebagai dependensinya), tercatat di `composer.lock` |
| `php artisan list boost` | `boost:add-skill`, `boost:install`, `boost:list-skills`, `boost:mcp`, `boost:update` |
| `boost:install` | Non-interaktif dengan `boost.json` (agent `claude_code`, `codex`, `cursor`; `cloud: false`) dan `--guidelines --skills --mcp`: 8 guideline dan 3 skill (`infer-conventions`, `laravel-best-practices`, `testing-best-practices`) untuk ketiga agent, MCP untuk ketiganya, semua ✓ |
| Guideline | `deployments` (rekomendasi Laravel Cloud) dikecualikan karena hosting belum diputuskan. Guideline kustom `backend/.ai/guidelines/solveit.md` masuk di urutan pertama blok. Pengantar di luar blok `AGENTS.md` bertahan setelah `boost:update` |
| MCP dari root repository | Klien stdio MCP (handshake JSON-RPC) ke `php backend/artisan boost:mcp`: server `Laravel Boost`, protokol `2025-06-18`, 10 tool (`application-info`, `browser-logs`, `database-connections`, `database-query`, `database-schema`, `get-absolute-url`, `last-error`, `read-log-entries`, `record-rule`, `search-docs`) |
| Tool baca-saja | `application-info`: `php_version 8.5`, `laravel_version 13.36.0`, `database_engine sqlite` |
| Dokumentasi sesuai versi | `search-docs` (routing, rate limiting, CORS, trusted proxies, exception JSON, validasi enum, Form Request, testing database) mengembalikan hasil berlabel `laravel/framework@13.x`; dipakai untuk merancang route, limiter, CORS, proxy, render exception, dan tes |
| Claude Code | `claude mcp list` dari root: `laravel-boost: php backend/artisan boost:mcp - ✔ Connected`, scope "Project config (shared via .mcp.json)". Skill di `backend/.claude/skills/` ditemukan otomatis oleh sesi yang berjalan di root |
| Codex | Dengan `CODEX_HOME` sementara yang mempercayai repository: `codex mcp list` dari root menampilkan `laravel-boost php backend/artisan boost:mcp enabled`; dari `backend/` memakai konfigurasi buatan Boost (`php artisan boost:mcp`). Tanpa kepercayaan proyek, konfigurasi proyek tidak dimuat (perilaku Codex). Pemanggilan tool dari dalam sesi Codex **tidak diuji** (butuh sesi Codex yang login) |
| Cursor | `.cursor/mcp.json` dibuat, **tidak diverifikasi**: Cursor tidak terpasang |
| Playwright MCP | Entri tidak berubah (diff hanya menambah baris). `claude mcp list` melaporkan timeout 30 s untuk `npx` pada Windows, seperti catatan yang sudah ada di `CLAUDE.md`; server yang sama dijalankan langsung (`cmd /c npx -y @playwright/mcp@0.0.83`) menjawab handshake dalam sekitar 10 s dengan 25 tool, dan tool Playwright tersedia di sesi ini |

### API inquiry: tes otomatis

`php artisan test`: **89 lulus, 0 gagal, 227 assertion** (SQLite in-memory, `RefreshDatabase`).

| Area | Tes |
|---|---|
| Sukses | 201 dengan `{id, status}` persis, baris tersimpan dengan semua field, status `received`, timestamp; dua kiriman mendapat referensi berbeda; log hanya `Inquiry received.` dengan nomor referensi |
| Field opsional dan teks | `organization` tidak dikirim, `""`, atau spasi menjadi `null`; Unicode (aksen, aksara Jepang, emoji) tersimpan utuh; spasi di tepi dibuang |
| Validasi | Payload kosong (enam field wajib, pesan persis); format 422 Laravel persis; 13 batas panjang termasuk karakter multibyte (2/120 nama, 160 organisasi, 254 kontak, 20/5000 pesan); kontak email dan telepon; 7 nilai enum tidak valid (tidak dikenal, label, huruf besar, angka, array); tipe non-string |
| Aturan kontak (unit) | 8 nilai valid dan 14 tidak valid, termasuk batas 8 dan 18 karakter telepon, tab, dan baris baru |
| Kontrak frontend | Nilai enum backend sama persis dengan `ServiceId`, `BudgetRange`, `Timeline` yang dibaca dari `frontend/src/types/` |
| Referensi publik | Format `INQ-XXXX-XXXX-XXXX` Crockford; 5000 referensi unik; tidak berurutan; database menolak duplikat (`UniqueConstraintViolationException`) |
| Spam dan penyalahgunaan | Honeypot terisi: 422 dan tidak tersimpan; honeypot kosong: 201 dan tidak tersimpan sebagai kolom; batas per menit dan per jam (429, `Retry-After`, tidak tersimpan); percobaan yang ditolak ikut dihitung; `X-Forwarded-For` palsu tidak melewati batas tanpa proxy tepercaya, dan dihormati di belakang proxy tepercaya; body di atas batas: 413 |
| Mass assignment | `id`, `public_id`, `status`, `created_at` dari klien diabaikan |
| Kegagalan | Tabel dihapus di tengah tes: 503 tanpa referensi dan tanpa `received`; exception yang dilaporkan tidak memuat nama, kontak, atau pesan dan tidak membawa `QueryException`; galat tak terduga: 500 `Server Error` tanpa detail |
| Akses | `GET`/`PUT`/`DELETE` koleksi: 405; `GET`/`PATCH`/`DELETE` dengan referensi: 404; tidak ada data yang bocor dan baris tidak berubah. Respons galat dengan `APP_DEBUG=false` hanya berisi `message` |
| CORS | Origin terdaftar mendapat izin preflight tanpa credentials; origin lain tidak; tanpa konfigurasi tidak ada izin |
| Lainnya | `/up` 200 `{"status":"ok"}` tanpa cookie sesi, 503 `{"status":"down"}` tanpa detail saat pemeriksaan gagal; `/` 404; route bernama berada di `/api/v1/inquiries`; tes memakai SQLite `:memory:` |

### API inquiry: HTTP nyata

`php artisan serve` dengan database SQLite lokal: contoh `curl` di `docs/api/inquiries.md` mengembalikan `201 {"id":"INQ-ZVM2-M64Z-4VQM","status":"received"}` dengan `X-RateLimit-Limit: 5`; payload salah 422 dengan enam field; `GET` 405; `/up` 200 JSON tanpa `Set-Cookie`; `/api/api/v1/inquiries` 404. Dengan `CORS_ALLOWED_ORIGINS` terisi, preflight dari `http://localhost:5173` mendapat `Access-Control-Allow-Origin`, `Allow-Methods: GET, POST`, `Max-Age: 3600`; origin lain tidak. Catatan: `backend/.env` lokal dibuat sebelum variabel baru ada, jadi tanpa variabel itu CORS menolak semua origin (default aman); salin variabel baru dari `.env.example`.

### Temuan yang diperbaiki selama QA

| Temuan | Perbaikan |
|---|---|
| `"php": "^8.3"` tidak benar karena lock membutuhkan PHP 8.4.1 | `config.platform.php` 8.3.0, CI menguji 8.3 dan 8.5 |
| Halaman `/up` bawaan berjudul "Laravel" | `/up` JSON sendiri di luar grup `web` |
| Respons 429 menyertakan trace saat `APP_DEBUG=true` | Perilaku framework yang benar untuk lokal; tes memakai `APP_DEBUG=false` seperti produksi, dan dokumentasi mewajibkan `false` di luar lokal |
| Pesan `QueryException` memuat nilai SQL (data pribadi) bila dilaporkan | `InquiryNotStoredException` tanpa exception sebelumnya, hanya SQLSTATE |
| Rute `storage/{path}` bawaan aktif | Dimatikan untuk host API |
| Aturan `deny` `Read(./**/.env.*)` memblokir `.env.example` (pembacaan ditolak di sesi ini) | Pola diganti daftar file rahasia yang eksplisit; `.env.example` dapat dibaca, `.env` tetap ditolak |
| Guideline Boost "buat dokumentasi hanya bila diminta" dan rekomendasi Laravel Cloud bertentangan dengan aturan repository | Guideline kustom Solveit menyatakan prioritas; `deployments` dikecualikan |

### CI dan frontend

- **Backend CI** baru (`.github/workflows/backend-ci.yml`), run 38698395762 pada push `745a852`: **lulus** di PHP 8.3 dan 8.5 (setiap langkah: validate, install, Pint, migrasi naik-turun-naik, `Tests: 89 passed (227 assertions)`, cek route, `composer audit` tanpa advisory, instalasi `--no-dev` tanpa perintah Boost). Anotasi hanya pemberitahuan GitHub (aksi `@v4` berbasis Node 20, migrasi label `ubuntu-latest`), sama dengan workflow frontend yang sudah ada.
- Frontend tidak diubah (`git status frontend/` bersih, tidak ada file `frontend/` di diff). `npm run check` (lint, typecheck, unit test, build, dirangkai `&&`) keluar dengan kode 0; unit test 12 file, 69/69 lulus; build mem-prerender 22 halaman terindeks. `npm run format:check` hanya memperingatkan `frontend/.impeccable/hook.cache.json`, file cache lokal yang tidak dilacak Git (sama dengan catatan sebelumnya). E2E tidak dijalankan ulang karena tidak ada perubahan UI. Frontend CI tidak dipicu oleh PR ini (path `frontend/**` tidak berubah).

### Keterbatasan

- Codex: konfigurasi diverifikasi, pemanggilan tool dari sesi Codex tidak. Cursor: tidak diverifikasi sama sekali.
- Belum ada deployment, database produksi, domain, atau origin produksi; proteksi spam tambahan (CAPTCHA, firewall) menunggu keputusan deployment.
- Masa simpan, ekspor, dan penghapusan data inquiry belum diputuskan (`docs/api/inquiries.md`, Privasi).

## Kerapian struktur repository (2026-10-15)

Cakupan: permintaan pemilik setelah rilis putaran 6. Tanpa perubahan fitur, desain, atau motion.

| Perubahan | Bukti |
|---|---|
| Folder `brand/` di root dihapus | Kedua file identik byte (`cmp`) dengan salinan di `frontend/public/brand/`, yang kini menjadi satu-satunya salinan |
| Logo publik diberi nama jelas: `logo-solveit-primary.svg` menjadi `solveit-logo-full.svg`, `logo-solveit-icon.svg` menjadi `solveit-logo-icon.svg` | `git mv`; rujukan di `seo.ts` (logo JSON-LD), `generate-brand-assets.mjs`, `logo-paths.ts`, dan dokumen diperbarui. Build tidak lagi memuat nama lama (0 rujukan di `build/client`); JSON-LD menunjuk `/brand/solveit-logo-full.svg` |
| `PRODUCT.md` dan `DESIGN.md` pindah ke `docs/`; dokumen lain dikelompokkan ke `architecture/`, `design/`, `development/`, `product/`, `seo/`, `qa/`; peta di `docs/README.md` | `impeccable context` menemukan `docs\PRODUCT.md` dan `docs\DESIGN.md`. Uji terpisah: di subfolder `docs/` keduanya tidak ditemukan, jadi keduanya tetap di tingkat atas `docs/`. Keputusan "wajib di root" pada tabel putaran 6 digantikan oleh hasil ini |
| `CLAUDE.local.md` dan `.claude/settings.local.json` digabung lalu dihapus | Catatan lingkungan ke `AGENTS.md` (dimuat `CLAUDE.md`), catatan Playwright MCP ke `CLAUDE.md`, `enabledMcpjsonServers` ke `.claude/settings.json`. `allow` di file lokal kosong, jadi izin tidak berubah |
| `.ai/` (handoff agent), `docs/project-structure.md` (aturan struktur), `AGENTS.md` diperbarui | Semua tautan Markdown relatif dan path dokumen di 20 file Markdown diperiksa skrip: tidak ada yang rusak (sisa temuan hanya path yang sengaja disebut sebagai contoh, file yang diabaikan Git, atau folder backend yang direncanakan) |

Verifikasi: lint, typecheck, unit 69/69, build lulus; e2e Chromium desktop untuk SEO, halaman, dan axe: 51 lulus, 0 gagal. `format:check` hanya memperingatkan `frontend/.impeccable/hook.cache.json`, file cache lokal yang tidak dilacak Git.

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
- **Keputusan pemilik** (diselesaikan 2026-10-15): visi resmi diganti dengan redaksi pemilik yang tidak lagi menyebut "melalui Solveit OpsHub"; lihat `docs/product/product-naming.md`.
- **Ditunda (fase deployment)**: optimasi SEO/GEO final, lihat `docs/seo/seo-geo.md`.

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
- **Ditunda (fase deployment)**: optimasi SEO/GEO final, lihat `docs/seo/seo-geo.md`.

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
