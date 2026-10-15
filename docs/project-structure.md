# Aturan Struktur Proyek

Aturan baku penempatan folder dan file untuk repository Solveit Indonesia. Aturan ini sengaja ditulis umum agar dapat disalin ke proyek lain (website, aplikasi web, sistem informasi) supaya setiap repository Solveit punya bentuk yang sama. Bagian yang khusus untuk proyek ini ditandai **(proyek ini)**.

Gunakan dokumen ini saat:

- membuat repository baru,
- menambah folder atau file yang belum punya tempat jelas,
- meninjau pull request yang memindahkan atau menambah file,
- menyerahkan proyek ke agent atau developer lain.

## 1. Prinsip

1. **Satu tempat untuk satu hal.** Setiap jenis file punya satu lokasi. Tidak ada salinan kedua: aset, dokumen, dan konfigurasi tidak boleh diduplikasi di folder lain.
2. **Root hanya untuk file global.** Root berisi folder aplikasi, folder dokumentasi, dan file konfigurasi yang memang dibaca dari root oleh alat (Git, editor, Node, agent). Aset, catatan, dan skrip lepas tidak boleh berada di root.
3. **Dikelompokkan menurut fungsi, bukan menurut waktu.** Folder diberi nama sesuai isinya (`architecture/`, `qa/`), bukan tanggal atau putaran kerja.
4. **Nama menjelaskan isi.** Nama file harus bisa dipahami tanpa membuka file. Hindari singkatan pribadi, `final`, `new`, `v2`, `copy`, atau nomor urut tanpa arti.
5. **Sumber kebenaran ditulis sekali.** Fakta produk, aturan agent, dan status proyek masing-masing punya satu file; file lain menautkannya, tidak menyalinnya.
6. **Yang dihasilkan mesin tidak di-commit,** kecuali memang dibutuhkan saat runtime dan tidak bisa dibangun ulang di server (misalnya ikon PNG hasil generator yang disajikan situs).
7. **Rahasia tidak pernah masuk Git.** Hanya `.env.example` yang di-commit.
8. **Pemindahan memakai `git mv`.** Riwayat file tetap terlacak, dan semua rujukan (kode, dokumen, konfigurasi) diperbarui dalam commit yang sama.

## 2. Struktur root

```text
<repo>/
├── .ai/                 Handoff untuk agent lain: status proyek dan alur kerja
├── .claude/             Konfigurasi Claude Code yang dibagikan (settings, rules, skills)
├── .codex/              config.toml: server MCP proyek untuk Codex (opsional)
├── .github/             Workflow CI dan template GitHub
├── .impeccable/         Kontrak desain skill impeccable (opsional, bila dipakai)
├── backend/             Aplikasi backend (Laravel)
├── docs/                Seluruh dokumentasi proyek
├── frontend/            Aplikasi frontend (React + Vite)
├── .editorconfig        Indentasi, charset, akhir baris untuk semua editor
├── .gitattributes       Normalisasi akhir baris (LF) dan atribut file
├── .gitignore           Daftar file yang tidak di-commit
├── .mcp.json            Server MCP proyek untuk agent (opsional)
├── .nvmrc               Versi mayor Node.js
├── AGENTS.md            Instruksi bersama untuk semua coding agent
├── CLAUDE.md            Memuat AGENTS.md ditambah catatan khusus Claude Code
└── README.md            Pintu masuk repository: apa proyek ini dan cara mulai
```

Repository yang hanya punya satu aplikasi boleh meletakkan aplikasi langsung di root (tanpa `frontend/` atau `backend/`); aturan lain tetap berlaku.

### File global di root

| File | Fungsi | Status |
|---|---|---|
| `README.md` | Ringkasan proyek, tabel folder utama, perintah mulai cepat, alur Git, tautan ke `docs/README.md` | Wajib |
| `AGENTS.md` | Aturan untuk semua agent: konteks proyek, perintah, verifikasi, aturan konten, desain, Git. Dibaca langsung oleh Codex dan dimuat Claude Code lewat `CLAUDE.md` | Wajib bila memakai agent |
| `CLAUDE.md` | Baris `@AGENTS.md` lalu hanya catatan khusus Claude Code (skill, MCP). Tidak mengulang isi `AGENTS.md` | Wajib bila memakai Claude Code |
| `.gitignore` | Dependensi, hasil build, artefak dan cache tes, `.env*` (kecuali `.env.example`), kunci (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `auth.json`), file database dan dump (`*.sqlite`, `*.sql`, `*.dump`, `*.bak`), log, file lokal agent, file OS/editor. Pola tidak boleh menyembunyikan file proyek: setelah mengubahnya, `git ls-files -ci --exclude-standard` harus kosong | Wajib |
| `.gitattributes` | `* text=auto eol=lf` dan atribut biner bila perlu | Wajib |
| `.editorconfig` | UTF-8, LF, indentasi 2 spasi (4 untuk PHP dan Python), baris akhir kosong | Wajib |
| `.nvmrc` | Versi mayor Node yang dipakai CI dan developer | Wajib bila ada Node |
| `.mcp.json` | Server MCP proyek untuk Claude Code (dan agent lain yang membaca format ini) | Opsional; wajib berisi `laravel-boost` bila ada aplikasi Laravel |
| `.codex/config.toml` | Server MCP proyek untuk Codex (dimuat setelah repository dipercaya) | Opsional; sama seperti di atas |

Konfigurasi hanya dibuat untuk agent yang benar-benar dipakai tim. **(proyek ini)** Claude Code dan Codex; konfigurasi Cursor dihapus pada B1.1 dan `.cursor/` diabaikan Git agar tidak masuk lagi tanpa keputusan.

File lain tidak diletakkan di root. Lisensi (`LICENSE`), `CHANGELOG.md`, `CONTRIBUTING.md`, dan `SECURITY.md` boleh ditambahkan di root bila proyek membutuhkannya, karena GitHub membacanya dari sana.

**(proyek ini)** Tidak ada file lokal agent (`CLAUDE.local.md`, `.claude/settings.local.json`); catatan lingkungan dan pengaturan MCP sudah digabung ke `AGENTS.md`, `CLAUDE.md`, dan `.claude/settings.json`. Keduanya tetap tercantum di `.gitignore` agar tidak ter-commit bila suatu saat dibuat lagi.

## 3. Konvensi penamaan

| Jenis | Aturan | Contoh |
|---|---|---|
| Folder | `kebab-case`, kata benda, jamak untuk koleksi | `components/`, `e2e/`, `data/locales/` |
| Dokumen | `kebab-case.md`, menyebut topik lengkap | `integration-plan.md`, `qa-report.md` |
| Dokumen konvensi | HURUF BESAR, karena alat atau GitHub mencarinya dengan nama itu | `README.md`, `AGENTS.md`, `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md` |
| Komponen React | File `kebab-case.tsx`, ekspor `PascalCase` | `site-header.tsx` mengekspor `SiteHeader` |
| Hook | `use-<nama>.ts`, ekspor `use<Nama>` | `use-reveal.ts` |
| Modul TypeScript lain | `kebab-case.ts` | `scrollspy.ts`, `logo-paths.ts` |
| Unit test | Di samping file yang diuji: `<nama>.test.ts(x)` | `inquiry.test.ts` |
| Tes end-to-end | `tests/e2e/<area>.spec.ts` | `navigation.spec.ts` |
| Aset merek | `<merek>-<jenis>-<varian>.<ext>` | `solveit-logo-full.svg`, `solveit-logo-icon.svg` |
| Gambar lain | `<konteks>-<isi>.<ext>`, tanpa spasi atau huruf besar | `solveit-og.png` |
| File konvensi platform | Pertahankan nama yang dituntut platform | `favicon.svg`, `apple-touch-icon.png`, `site.webmanifest` |
| Skrip | `kebab-case`, kata kerja di depan | `generate-brand-assets.mjs`, `subset-font.py` |
| Branch | `main`, `staging`, lalu satu branch per aplikasi (`frontend`, `backend`) | |
| Commit | `(type) deskripsi singkat` dalam bahasa Inggris, huruf kecil, tanpa titik akhir dan tanpa co-author. Type: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `update`, `release` | `(refactor) group docs by topic and consolidate agent configuration` |

## 4. `docs/`

```text
docs/
├── README.md               Peta dokumentasi (wajib)
├── PRODUCT.md              Fakta produk, sumber kebenaran konten
├── DESIGN.md               Spesifikasi desain dari kode yang dirilis
├── project-structure.md    Dokumen ini
├── api/                    Kontrak endpoint yang sudah dibangun (satu file per sumber daya)
├── architecture/           Gambaran sistem, batas sistem, rencana integrasi, keputusan teknis
├── design/                 Design system: token, komponen, motion, aksesibilitas
├── development/            Panduan pengembangan lokal, environment, deployment
├── product/                Penamaan produk, peta jalan, keputusan produk
├── seo/                    Strategi SEO/GEO dan konten pencarian
└── qa/                     Laporan QA, hasil tes, bukti audit
```

Aturan:

- Setiap dokumen berada di satu folder topik. Tingkat atas `docs/` hanya untuk `README.md`, `PRODUCT.md`, `DESIGN.md`, dan dokumen lintas topik seperti file ini.
- `PRODUCT.md` dan `DESIGN.md` harus tepat di `docs/` (atau di root), tidak di subfolder: skill desain impeccable hanya mencarinya di dua tempat itu.
- Folder topik baru dibuat bila topik itu belum cocok dengan folder mana pun; tambahkan juga ke `docs/README.md`. Contoh yang lazim: `decisions/` (catatan keputusan arsitektur bernomor, `0001-<judul>.md`), `operations/` (runbook, deployment, monitoring).
- Dokumen ditulis dalam bahasa tim (**proyek ini:** Bahasa Indonesia). Instruksi agent (`AGENTS.md`, `CLAUDE.md`, `.ai/`) ditulis dalam bahasa Inggris agar dipahami semua alat.
- Rujukan antar-dokumen memakai path dari root repo dalam backtick (`docs/qa/qa-report.md`) atau tautan relatif yang benar. Setiap pemindahan dokumen wajib memperbarui semua rujukan.
- Laporan berkala (QA, audit) ditambahkan sebagai bagian baru di atas file yang sama, bukan file baru per putaran. Catatan sejarah tidak ditulis ulang.
- Bukti mentah (screenshot, hasil Lighthouse) tidak di-commit; simpan di folder yang diabaikan Git (**proyek ini:** `.impeccable/review/`) dan rangkum angkanya di laporan.
- Kontrak API ditulis sekali di `docs/api/` (`README.md` untuk konvensi bersama, `<sumber-daya>.md` per endpoint) dan hanya untuk endpoint yang sudah dibangun. Rencana endpoint tetap di `docs/architecture/`, dan dokumen lain menautkan kontrak, tidak menyalinnya.

## 5. `.ai/`

```text
.ai/
├── README.md           Tujuan folder dan urutan baca
├── project-status.md   Status terkini: yang sudah rilis, kondisi branch, keputusan terbuka, tugas berikutnya
└── workflow.md         Setup, perubahan, verifikasi, dan rilis tanpa alat khusus satu agent
```

- Folder ini untuk serah terima antar-agent (**proyek ini:** Claude Code dan Codex) dan antar-sesi, untuk seluruh repository.
- Jangan disamakan dengan `.ai/` di dalam aplikasi Laravel (`backend/.ai/`), yang dipakai Laravel Boost untuk guideline, skill, dan rule aplikasi itu (bagian 9.6).
- Isinya status yang berubah dari tugas ke tugas. Aturan tetap berada di `AGENTS.md`, fakta produk di `docs/PRODUCT.md`.
- `project-status.md` diperbarui di akhir setiap tugas, hanya dengan fakta yang sudah diverifikasi.
- Tidak boleh berisi rahasia, data pribadi, atau path khusus satu mesin.

## 6. Konfigurasi agent

| Lokasi | Isi | Di-commit |
|---|---|---|
| `AGENTS.md` | Aturan bersama semua agent | Ya |
| `CLAUDE.md` | `@AGENTS.md` dan catatan khusus Claude Code | Ya |
| `.claude/settings.json` | Izin perintah (allow/deny), server MCP yang diaktifkan | Ya |
| `.claude/rules/<area>.md` | Aturan yang berlaku untuk path tertentu (frontmatter `paths:`) | Ya |
| `.claude/skills/<nama>/SKILL.md` | Prosedur berulang (misalnya urutan verifikasi) | Ya |
| `.mcp.json`, `.codex/config.toml` | Definisi server MCP proyek per agent, dengan path relatif ke root repository | Ya |
| `.impeccable/surfaces/`, `.impeccable/design.json`, `.impeccable/critique/` | Kontrak desain dan catatan kritik skill impeccable | Ya |
| `.impeccable/review/`, `build/`, `mocks/`, `config.local.json` | Bukti dan hasil kerja lokal | Tidak |
| `CLAUDE.local.md`, `.claude/settings.local.json`, `.claude/worktrees/` | Catatan dan pengaturan pribadi | Tidak (hindari; gabungkan ke file bersama bila berlaku untuk tim) |
| File Laravel Boost di dalam aplikasi Laravel | Lihat bagian 9.8 | Sebagian |

Satu sumber per cakupan, tanpa menyalin aturan ke lokasi lain:

| Cakupan | Sumber | Dibaca oleh |
|---|---|---|
| Aturan bersama repository | `AGENTS.md` | Codex langsung; Claude Code lewat `CLAUDE.md` |
| Catatan khusus Claude Code | `CLAUDE.md`, `.claude/rules/`, `.claude/skills/` | Claude Code |
| Status dan serah terima | `.ai/` | Keduanya (ditautkan dari `AGENTS.md`) |
| Guideline Laravel | `backend/AGENTS.md` (dibuat Boost dari `backend/.ai/`) | Codex yang dimulai di `backend/`; Claude Code lewat `backend/CLAUDE.md` |
| Frontend | Root `AGENTS.md` dan aturan path-scoped | `frontend/AGENTS.md` hanya dibuat bila ada kebutuhan yang tidak tertampung di sana |

**(proyek ini)** `frontend/AGENTS.md` tidak dibuat: aturan frontend sudah ada di root `AGENTS.md` (konten, desain, motion, SEO, logo) dan `.claude/rules/frontend.md`, dan Codex membaca root `AGENTS.md` dari folder mana pun di repository.

Izin di `.claude/settings.json` mengikuti prinsip hak minimum:

- `allow` hanya untuk perintah verifikasi yang aman dan tidak mengubah data (lint, test, build, `git status/diff/log`, `php artisan test`, `route:list`, `pint`, `composer validate/audit`).
- `deny` menolak `git push --force`/`-f` dan pembacaan file rahasia: `.env`, `.env.local`, `.env.*.local`, `.env.{backup,bak,dev,development,prod,production,staging,test,testing}`, dan `auth.json` (token Composer). Aturan `deny` selalu mengalahkan `allow`, jadi pola lebar `.env.*` tidak dipakai: pola itu ikut memblokir `.env.example`, template tanpa rahasia yang harus dapat dibaca dan diubah agent (diverifikasi 2026-10-15). Bila tim memakai nama file rahasia baru, tambahkan polanya ke `deny`.
- `enabledMcpjsonServers` menyebut setiap server MCP proyek yang sudah ditinjau satu per satu (**proyek ini:** `playwright`, `laravel-boost`). Jangan memakai `enableAllProjectMcpServers: true`: server baru yang ditambahkan ke `.mcp.json` harus disetujui sadar, tidak otomatis.

## 7. `frontend/` (React, TypeScript, Vite, React Router)

```text
frontend/
├── public/                 File statis yang disajikan apa adanya di URL yang sama
│   ├── brand/              Logo asli (satu-satunya salinan di repo)
│   ├── og/                 Gambar Open Graph
│   └── favicon.svg, favicon-32.png, apple-touch-icon.png, icon-512.png, site.webmanifest
├── scripts/                Skrip build dan perawatan (generate aset, postbuild, server preview)
├── src/
│   ├── assets/             Aset yang diimpor kode dan diberi hash saat build (font subset)
│   ├── components/         Komponen presentasi, dikelompokkan per domain
│   │   ├── brand/          Logo, mark, loader bermerek
│   │   ├── layout/         Header, footer, kontrol global
│   │   ├── ui/             Primitif lintas halaman (PageIntro, FaqList)
│   │   ├── sections/<halaman>/  Seksi yang hanya dipakai satu halaman
│   │   └── <domain>/       portfolio, contact, assistant, feedback
│   ├── config/             Konfigurasi situs yang dibaca dari environment
│   ├── data/               Konten bertipe; teks per bahasa di data/locales/<bahasa>/
│   ├── hooks/              React hooks bersama
│   ├── i18n/               Bahasa, peta path, pesan antarmuka per bahasa
│   ├── layouts/            Layout route
│   ├── lib/                Utilitas tanpa UI (motion, SEO, tema, scrollspy)
│   ├── pages/              Route module, satu file per halaman
│   ├── services/           Lapisan akses data; satu-satunya tempat yang nanti memanggil API
│   ├── styles/             CSS global dan token desain
│   ├── test/               Setup Vitest
│   ├── types/              Tipe domain bersama
│   ├── root.tsx, routes.ts, entry.client.tsx
├── tests/e2e/              Playwright: spec per area, fixtures, daftar route
└── package.json, package-lock.json, tsconfig.json, vite.config.ts, vitest.config.ts,
    playwright.config.ts, react-router.config.ts, eslint.config.js, .prettierrc.json,
    .prettierignore, .env.example
```

Aturan:

- Konten tidak ditulis langsung di banyak komponen. Data ada di `src/data/` dan dibaca lewat `src/services/`; teks antarmuka ada di `src/i18n/messages/`.
- Komponen yang dipakai lebih dari satu halaman tidak boleh berada di `sections/<halaman>/`; pindahkan ke `ui/` atau folder domainnya.
- `public/` hanya untuk file yang harus punya URL tetap (logo, ikon, manifest, OG). Aset yang diimpor kode masuk `src/assets/`.
- File hasil build (`build/`, `.react-router/`, `test-results/`, `playwright-report/`) tidak di-commit.
- Konfigurasi alat tetap di root `frontend/`, tempat alat mencarinya.

## 8. Aplikasi Laravel (`backend/`)

Aturan ini berlaku di mana pun aplikasi Laravel berada. **Root aplikasi Laravel** adalah folder yang berisi `artisan` dan `composer.json`: `backend/` di repository ini, atau root repository pada proyek Laravel mandiri (bagian 9.13). Struktur bawaan Laravel dipertahankan; tidak ada folder dasar baru tanpa alasan.

Tanda: **[W]** wajib (bawaan Laravel atau aturan ini), **[P]** ditambahkan proyek bila dibutuhkan, **[B]** sumber atau hasil Laravel Boost yang di-commit, **[L]** dibuat di mesin lokal dan tidak di-commit, **[O]** opsional, hanya ada bila dipakai. Tidak setiap folder selalu ada; folder **[L]** dan **[O]** bergantung pada agent yang dipilih saat `boost:install` dan pada fitur yang dipakai.

```text
<root aplikasi Laravel>/        backend/ di repository ini
├── .ai/                        [B] Sumber Laravel Boost milik aplikasi ini (bukan handoff repository, lihat 9.6)
│   ├── guidelines/             [O] Guideline kustom (*.md atau *.blade.php), digabung ke AGENTS.md saat boost:update
│   ├── skills/<nama>/SKILL.md  [O] Skill kustom, disalin ke folder skill setiap agent
│   └── rules/                  [O] Project rule dari tool MCP record-rule; index.md dikelola Boost
├── .agents/skills/             [L] Salinan skill untuk Codex
├── .claude/skills/             [L] Salinan skill untuk Claude Code
├── .codex/config.toml          [L] MCP Codex untuk sesi yang dimulai di root aplikasi
├── app/                        [W] Http/{Controllers,Requests,Resources,Middleware}, Models, Providers
│   ├── Actions/                [P] Satu operasi bisnis per kelas (SubmitInquiry)
│   ├── Enums/                  [P] Nilai domain yang terbatas (backed enum)
│   ├── Exceptions/             [P] Exception dengan render()/context() sendiri
│   └── Rules/                  [P] Aturan validasi kustom
├── bootstrap/app.php           [W] Routing (api:), middleware, penanganan exception
├── config/                     [W] Ditambah config proyek (cors.php, trustedproxy.php, <domain>.php) dan boost.php [B]
├── database/                   [W] migrations, factories, seeders; *.sqlite tidak di-commit
├── public/                     [W] index.php, .htaccess, robots.txt
├── resources/views/            [W] Boleh kosong (.gitkeep) pada aplikasi API
├── routes/                     [W] api.php (/api/v1/...), web.php, console.php
├── storage/                    [W] Hanya file .gitignore bawaannya yang di-commit
├── tests/Feature/, tests/Unit/ [W] Path tes mengikuti path kelas yang dites
├── vendor/                     [L] Hasil composer install
├── .env                        [L] Rahasia lokal, tidak pernah di-commit
├── .env.example                [W] Semua variabel terdokumentasi, tanpa nilai rahasia
├── .env.testing                [L] Kredensial database tes lokal, tidak pernah di-commit
├── .mcp.json                   [L] MCP Claude Code untuk sesi yang dimulai di root aplikasi
├── AGENTS.md                   [B] Pengantar proyek di luar blok + guideline Boost di dalam blok
├── CLAUDE.md                   [B] @AGENTS.md dan catatan khusus Claude Code
├── boost.json                  [B] Agent, fitur, paket pihak ketiga, dan skill yang dipilih
├── README.md                   [W] Setup, environment, perintah, keamanan
└── artisan, composer.json, composer.lock, phpunit.xml, .editorconfig, .gitattributes, .gitignore   [W]
```

Aturan:

- Logika bisnis di `app/Actions` (atau `app/Services` untuk layanan yang dipakai banyak operasi), bukan di controller. Controller hanya mengoordinasi request, operasi, dan respons.
- Validasi di Form Request (`app/Http/Requests/Api/V1/...`), bentuk respons di API Resource. Data yang diteruskan hanya dari `validated()`/`safe()`, dan model membatasi mass assignment (`#[Fillable]`).
- Endpoint selalu berversi (`routes/api.php` mengelompokkan di bawah `v1`; Laravel menambahkan `/api`) dan didokumentasikan di `docs/api/` dalam commit yang sama.
- `env()` hanya dipanggil di `config/`; kode membaca `config()`.
- File dibuat dengan `php artisan make:*` agar namespace dan stub sesuai versi Laravel.
- `vendor/`, `.env`, `.env.testing`, file database, dan dump tidak di-commit.
- **(proyek ini)** API saja: tanpa Vite, Tailwind, atau Blade (`package.json`, `vite.config.js`, `resources/css|js` dibuang setelah scaffolding). Frontend website ada di `frontend/`.

### 8.1 Database dan runtime

- Pengembangan, tes, dan CI memakai engine dan versi mayor yang sama dengan target produksi. **(proyek ini)** MySQL 8.4 LTS (Oracle MySQL; MariaDB tidak dianggap setara) dan PHP 8.5 minimal 8.5.7.
- Versi PHP minimum dinyatakan di `composer.json` (`"php": "^<minimum>"`) dan `config.platform.php` disamakan dengan minimum itu, agar lock tetap dapat dipasang pada minimum. Jangan mengunci ke satu patch; patch keamanan yang lebih baru boleh dipakai. CI menegaskan minimum dan mencatat versi aktual yang diuji.
- Satu database per peran, masing-masing dengan pengguna sendiri dan hak minimum: pengembangan, tes (satu nama tetap, **proyek ini:** `solveit_indonesia_testing`), dan di produksi pengguna migrasi (DDL) terpisah dari pengguna aplikasi (DML saja). Tidak pernah `root`, database proyek lain, atau database bersama. Di MySQL, `_` adalah wildcard pada grant tingkat database; tulis nama dengan garis bawah yang di-escape (`` `nama\_db`.* ``) agar grant hanya berlaku untuk database itu.
- `phpunit.xml` mengunci `APP_ENV`, driver, dan nama database tes lewat `<server>` dan `<env force="true">` (Laravel membaca `$_SERVER` lebih dulu), sehingga variabel shell tidak dapat memindahkan tes ke database atau driver lain.
- Sebelum trait tes berjalan (`setUpTraits()` di `tests/TestCase.php`, sebelum `RefreshDatabase` menghapus tabel), pengaman tes memverifikasi identitas yang eksplisit, bukan pola nama: environment `testing`, koneksi dan driver yang diharapkan tanpa `DB_URL`, nama database persis, database yang benar-benar dipilih server (`SELECT DATABASE()`), dan `SHOW GRANTS FOR CURRENT_USER()` yang hanya berisi `USAGE` global dan hak pada database tes itu. Pengguna dengan hak global (termasuk `root`), hak pada database lain, grant wildcard, role, atau proxy ditolak. Pengaman ini punya tes regresi sendiri. **(proyek ini)** `tests/Support/TestDatabaseGuard.php`.
- Tes tidak menjalankan DDL untuk mensimulasikan kegagalan; MySQL melakukan commit implisit untuk DDL. Buat database menolak baris (misalnya nilai melebihi panjang kolom dalam strict mode) atau tabrakan indeks `UNIQUE` sungguhan.
- `migrate:fresh`, `migrate:reset`, `migrate:rollback`, `db:wipe`, dan `DROP` hanya pada database sekali pakai yang memang dibuat untuk itu.
- Document root web server adalah `public/` aplikasi Laravel, tidak pernah root aplikasi.

## 9. Official Laravel Boost & AI Agent Development Standards

Standar ini berlaku untuk setiap aplikasi Laravel Solveit yang dikerjakan dengan bantuan coding agent. **(proyek ini)** Diterapkan di `backend/` dengan Laravel 13.36 dan Laravel Boost 2.10.3 pada 2026-10-15; hasil verifikasinya ada di `docs/qa/qa-report.md`.

### 9.1 Kewajiban

1. **Laravel Boost wajib** untuk pengembangan Laravel berbantuan AI di Solveit. Agent yang mengubah kode Laravel memakai guideline, skill, dan tool MCP Boost (terutama `search-docs` untuk dokumentasi sesuai versi yang terpasang) sebelum menulis kode yang bergantung pada API framework.
2. Hanya paket resmi **`laravel/boost`** dari Composer. Bukan fork, paket bernama mirip, server MCP buatan sendiri, atau pengganti lain.
3. Boost adalah alat pengembangan: masuk `require-dev`, **tidak pernah** `require`. Ia bukan aplikasi runtime tambahan dan bukan sistem bisnis.

### 9.2 Instalasi setelah scaffolding Laravel

Jalankan dari root aplikasi Laravel, setelah `composer create-project` dan sebelum menulis fitur:

1. `composer require laravel/boost --dev`, lalu periksa `composer.json` (`require-dev`) dan `composer.lock`.
2. Buang dulu paket dan file yang tidak dipakai (misalnya Vite/Tailwind pada aplikasi API), karena Boost memilih guideline dan skill dari paket yang terpasang. Jangan memasang Livewire, Inertia, Filament, atau paket lain hanya karena Boost mendukungnya.
3. `php artisan vendor:publish --tag=boost-config`, lalu sesuaikan `config/boost.php`:
   - `agents.claude_code.guidelines_path => 'AGENTS.md'`, agar semua agent berbagi satu file guideline (9.7).
   - `enforce_tests => true` bila aplikasi punya suite tes dan CI (tanpa ini Boost hanya menegakkan tes bila sudah ada minimal enam tes).
   - `guidelines.exclude` untuk guideline yang bertentangan dengan keputusan proyek (**proyek ini:** `deployments`, karena hosting belum diputuskan).
   - `browser_logs_watcher => false` pada aplikasi tanpa halaman browser.
4. `php artisan boost:install`. Secara interaktif, pilih fitur **AI Guidelines**, **Agent Skills**, dan **Boost MCP Server Configuration**, lalu agent yang dipakai tim. Tanpa terminal interaktif (agent, CI), tulis dulu `boost.json` berisi `agents` dan `"cloud": false` (integrasi Laravel Cloud aktif secara default), lalu jalankan `php artisan boost:install --guidelines --skills --mcp --no-interaction`. Selalu periksa `php artisan boost:install --help` pada versi yang terpasang; jangan menebak opsi.
5. Tulis aturan proyek di `.ai/guidelines/<proyek>.md` (9.5), tambahkan pengantar di luar blok `AGENTS.md`, lalu `php artisan boost:update --no-discover`.
6. Daftarkan MCP untuk sesi dari root repository (9.4), atur izin (9.9), dan verifikasi (9.12).

### 9.3 Agent yang didukung

Boost 2.10 mendukung banyak agent (`vendor/laravel/boost/src/Install/Agents/`). Pilih hanya yang benar-benar dipakai tim, catat di `boost.json`, dan hapus konfigurasi agent yang tidak lagi dipakai (file di repository dan salinan lokal yang dibuat Boost). **(proyek ini)** Claude Code dan Codex.

| Agent | Guideline | Skill | MCP dari root aplikasi | **(proyek ini)** status |
|---|---|---|---|---|
| Claude Code | `AGENTS.md` lewat `CLAUDE.md` (`@AGENTS.md`) | `.claude/skills/` | `.mcp.json` | Diverifikasi: `claude mcp list` dari root repository melaporkan `laravel-boost` dan `playwright` Connected; skill di `backend/.claude/skills/` ditemukan saat sesi di root bekerja di `backend/` |
| Codex | `AGENTS.md` | `.agents/skills/` | `.codex/config.toml` | Konfigurasi diverifikasi (CLI 0.160): setelah dipercaya, root memuat `php backend/artisan boost:mcp`, `backend/` memuat `php artisan boost:mcp`; tanpa kepercayaan tidak ada server. Pemanggilan tool dari sesi Codex yang login belum diuji |

Codex membaca `AGENTS.md` dari root repository **turun** sampai folder kerja dan skill dari folder kerja **naik** sampai root (dokumentasi resmi Codex). Untuk pekerjaan Laravel di repository dengan `backend/`, Codex dimulai di root aplikasi; dari root repository ia tidak melihat `backend/AGENTS.md` maupun `backend/.agents/skills/`.

### 9.4 MCP: root repository dan root aplikasi

Perintah resmi `php artisan boost:mcp` mengasumsikan direktori kerja adalah root aplikasi Laravel. Sesi agent biasanya dimulai di root repository, sehingga:

| Lokasi sesi | Claude Code | Codex | Perintah |
|---|---|---|---|
| Root repository (repository dengan `backend/`) | `<repo>/.mcp.json` | `<repo>/.codex/config.toml` | `php backend/artisan boost:mcp` |
| Root aplikasi (`backend/`, atau proyek mandiri) | `.mcp.json` | `.codex/config.toml` | `php artisan boost:mcp` (dibuat `boost:install`) |

- `artisan` mem-bootstrap aplikasi dari lokasinya sendiri, jadi `php backend/artisan boost:mcp` dari root repository memakai `backend/.env`, database, dan path yang benar (diverifikasi dengan `application-info`).
- Konfigurasi root repository ditulis tangan dan di-commit, dengan path relatif (tanpa path mesin). Konfigurasi di root aplikasi dibuat ulang oleh `php artisan boost:install --mcp` dan tidak di-commit. Keduanya tidak pernah dimuat bersamaan: setiap agent hanya membaca konfigurasi proyek untuk folder tempat sesi dimulai (Codex memilih yang terdekat), jadi tidak ada registrasi ganda dalam satu sesi.
- Nama server selalu `laravel-boost`. Server MCP lain di file yang sama (**proyek ini:** `playwright`) dipertahankan; gabungkan entri, jangan menimpa file.
- Mulai sesi dari root repository atau dari root aplikasi. Sesi yang dimulai di subfolder lain (misalnya `frontend/`) tidak menemukan `backend/artisan` dengan path relatif.
- Windows: `php` harus ada di `PATH` (misalnya folder `php` dari XAMPP). Bila tidak, set `BOOST_PHP_EXECUTABLE_PATH` di `.env` sebelum `boost:install`, atau pakai path absolut hanya di konfigurasi lokal yang tidak di-commit. `php` dijalankan langsung, tanpa `cmd /c` (berbeda dengan `npx` untuk Playwright).

### 9.5 Guideline, skill, dan project rule

| Jenis | Dimuat | Isi | Sumber yang ditulis manusia |
|---|---|---|---|
| Guideline | Di awal setiap sesi | Konvensi dasar Laravel, PHP, tes, Pint, dan aturan proyek | `.ai/guidelines/*.md`; Boost menggabungkannya ke blok `<laravel-boost-guidelines>` di `AGENTS.md` |
| Skill | Saat relevan dengan tugas | Pola rinci (praktik terbaik Laravel, desain tes, `infer-conventions`) | `.ai/skills/<nama>/SKILL.md` untuk skill kustom; skill bawaan berasal dari paket |
| Project rule | Saat file yang cocok dengan glob disentuh | Keputusan, jebakan, dan batasan aplikasi yang tidak terlihat dari kode | Dicatat dengan tool MCP `record-rule` (bukan ditulis tangan) ke `.ai/rules/`, yang di-commit |

Guideline kustom yang namanya sama dengan guideline Boost menggantikannya; skill kustom yang namanya sama dengan skill Boost juga. Aturan proyek yang lebih tinggi (batas sistem, Git, kerahasiaan) tetap ditulis di root `AGENTS.md`; guideline kustom hanya menambahkan aturan Laravel dan menyatakan bahwa root `AGENTS.md` didahulukan.

### 9.6 Dua `.ai/` dengan tugas berbeda

| Folder | Pemilik | Isi | Jangan |
|---|---|---|---|
| `<repo>/.ai/` | Tim, untuk seluruh repository | `README.md`, `project-status.md`, `workflow.md`: handoff, status, alur kerja | Menaruh guideline atau skill Laravel di sini |
| `<root aplikasi Laravel>/.ai/` (`backend/.ai/`) | Laravel Boost, untuk satu aplikasi | `guidelines/`, `skills/`, `rules/` | Menaruh status proyek atau handoff di sini |

Boost membaca `.ai/` relatif terhadap root aplikasi Laravel, jadi sumber Boost tidak boleh dipindah ke `<repo>/.ai/` hanya karena namanya sama. Pada proyek mandiri kedua peran berbagi satu folder (9.13).

### 9.7 `AGENTS.md` dan `CLAUDE.md`

- Root repository: `AGENTS.md` adalah satu-satunya sumber aturan bersama; `CLAUDE.md` berisi `@AGENTS.md` lalu catatan khusus Claude Code. Root `AGENTS.md` menyatakan bahwa Boost wajib untuk backend dan menunjuk ke `backend/AGENTS.md`, tanpa menyalin isi guideline Boost.
- Root aplikasi: `AGENTS.md` dibuat Boost. Boost hanya mengganti isi di dalam blok `<laravel-boost-guidelines>`; teks di luar blok (pengantar dan rujukan ke root `AGENTS.md`) dipertahankan (diverifikasi). Jangan mengedit isi blok dengan tangan.
- Root aplikasi: `CLAUDE.md` berisi `@AGENTS.md` dan catatan Claude Code, karena `config/boost.php` mengarahkan guideline Claude Code ke `AGENTS.md`. Tanpa pengaturan itu Boost menulis salinan guideline kedua ke `CLAUDE.md`.
- `boost:install` tidak boleh mengubah batas sistem, aturan Git, atau keamanan. Periksa diff `AGENTS.md` setiap kali Boost dijalankan.

### 9.8 Apa yang di-commit

| File (di root aplikasi Laravel kecuali disebut lain) | Di-commit | Alasan |
|---|---|---|
| `composer.json` (`laravel/boost` di `require-dev`), `composer.lock` | Ya | Versi Boost yang sama untuk semua orang |
| `config/boost.php` | Ya | Path guideline, pengecualian, penegakan tes |
| `boost.json` | Ya | Pilihan agent dan fitur; `boost:update` gagal tanpanya |
| `AGENTS.md`, `CLAUDE.md` | Ya | Guideline yang dibaca agent sejak clone, dapat ditinjau di PR, dibuat ulang identik dari lock yang sama (diverifikasi) |
| `.ai/guidelines/`, `.ai/skills/`, `.ai/rules/` | Ya | Sumber yang ditulis tim; dokumentasi resmi Boost meminta `.ai/rules` di-commit |
| `<repo>/.mcp.json`, `<repo>/.codex/config.toml` | Ya | Registrasi MCP dari root repository, path relatif |
| `.mcp.json`, `.codex/` di root aplikasi | Tidak | Dibuat `boost:install --mcp`; `.codex/` sudah diabaikan `.gitignore` bawaan Laravel |
| `.claude/skills/`, `.agents/skills/` | Tidak | Salinan per agent, dibuat `boost:update` dari `boost.json` |
| `.env`, `auth.json`, `vendor/` | Tidak | Rahasia atau hasil instalasi |

Dokumentasi Boost juga mengizinkan `AGENTS.md`, `CLAUDE.md`, dan `boost.json` diabaikan Git karena dapat dibuat ulang. Solveit memilih meng-commit ketiganya agar agent punya guideline sejak clone, perubahan guideline terlihat di PR, dan `boost:update` dapat dijalankan tanpa pertanyaan interaktif. Pada proyek mandiri (9.13) yang juga menyimpan skill tulisan tim di `.claude/skills/`, abaikan hanya nama skill buatan Boost, bukan seluruh folder.

### 9.9 Izin agent dan kerahasiaan

- Tool Boost dapat membaca skema dan log, menjalankan query, dan (pada konfigurasi tertentu) mengeksekusi kode. Pakai hanya pada lingkungan lokal tepercaya dan database pengembangan atau tes yang terisolasi. Jangan pernah mengarahkan Boost ke database bersama atau produksi; Boost sendiri hanya aktif bila `APP_ENV=local` atau `APP_DEBUG=true`.
- Agent tidak menampilkan isi `.env`, token, kredensial, data pribadi (misalnya isi inquiry), atau log yang memuatnya. Pembacaan file rahasia ditolak di `.claude/settings.json` (bagian 6); `.env.example` tetap dapat dibaca.
- Izinkan server MCP satu per satu (`enabledMcpjsonServers`), jangan `enableAllProjectMcpServers`. Codex hanya memuat konfigurasi proyek setelah repository dipercaya pengguna; jangan mengakalinya.
- Tidak ada path mesin, nama pengguna, atau rahasia di file yang di-commit. Path khusus mesin hanya di `.env` atau konfigurasi lokal yang diabaikan Git.
- Bila tool MCP diblokir izin, cari cakupan izin yang tepat; jangan mematikan pengaman.

### 9.10 Memperbarui Boost

- `php artisan boost:update --no-discover` memperbarui guideline dan skill dari paket yang terpasang. Jalankan setelah `composer update` (terutama `laravel/framework`, `laravel/boost`, atau paket ekosistem lain), setelah mengubah `.ai/guidelines/`, `.ai/skills/`, atau `config/boost.php`, dan setelah clone baru (untuk membuat salinan skill lokal). Tanpa `--no-discover`, perintah itu menawarkan guideline untuk paket baru secara interaktif.
- `boost:update` tidak menulis ulang konfigurasi MCP. Untuk itu: `php artisan boost:install --mcp --no-interaction`.
- Commit perubahan `AGENTS.md` dan `boost.json` bersama perubahan `composer.lock` yang menyebabkannya.
- Jangan menambahkan `@php artisan boost:update` ke script Composer seperti `post-update-cmd` atau `post-install-cmd` (contoh di dokumentasi Boost): perintah itu tidak ada pada instalasi `--no-dev`, dan script yang gagal menggagalkan instalasi.

### 9.11 Onboarding dari clone baru

```bash
cd backend                               # atau root repository pada proyek mandiri
composer install
cp .env.example .env && php artisan key:generate   # isi DB_* untuk database pengembangan
php artisan migrate                      # database pengembangan sudah dibuat (bagian 8.1)
php artisan boost:update --no-discover   # salinan skill per agent
php artisan boost:install --mcp --no-interaction   # MCP untuk sesi yang dimulai di folder ini (wajib untuk Codex)
php artisan test                         # database tes sekali pakai, kredensial di .env.testing
```

Lalu mulai Claude Code di root repository dan Codex di root aplikasi untuk pekerjaan Laravel (9.3). Claude Code menanyakan persetujuan server proyek bila belum ada di `enabledMcpjsonServers`; Codex perlu repository dipercaya. Setelah mengubah konfigurasi MCP, mulai ulang sesi agent: server MCP hanya dibaca saat sesi dimulai.

### 9.12 Verifikasi bahwa Boost berfungsi

Jangan melaporkan Boost tersedia tanpa bukti berikut:

1. `composer show laravel/boost` menampilkan versi 2.x dan `composer.json` mencantumkannya di `require-dev`.
2. `php artisan list boost` menampilkan `boost:install`, `boost:mcp`, `boost:update`.
3. Server MCP menjawab handshake dari lokasi sesi: `claude mcp list` (Claude Code) atau `codex mcp list` (Codex) menampilkan `laravel-boost` terhubung atau aktif.
4. Satu tool baca-saja berhasil: `application-info` menyebut versi Laravel dan PHP yang benar serta driver database.
5. `search-docs` mengembalikan dokumentasi dengan label versi yang terpasang (misalnya `laravel/framework@13.x`).
6. `AGENTS.md` berisi blok guideline dan aturan proyek, dan skill tersedia untuk agent.
7. Bila agent yang sedang berjalan belum melihat server baru, mulai ulang sesi dan ulangi langkah 3; jangan menganggap server tersedia.

### 9.13 Proyek Laravel mandiri

Bila Laravel menempati root repository, root aplikasi dan root repository sama:

- `artisan` di root; MCP memakai `php artisan boost:mcp`, dan konfigurasi yang dibuat `boost:install` sekaligus menjadi konfigurasi root repository. Bila tim ingin membagikannya, hapus `/.codex` dari `.gitignore` bawaan Laravel dan commit file MCP-nya saja.
- Satu `.ai/`: file di tingkat atas (`README.md`, `project-status.md`, `workflow.md`) adalah handoff repository, subfolder `guidelines/`, `skills/`, `rules/` milik Boost. Nama keduanya tidak bertabrakan.
- Satu `AGENTS.md`: aturan repository ditulis di luar blok `<laravel-boost-guidelines>`, guideline Boost di dalam blok. `CLAUDE.md` tetap `@AGENTS.md`.
- Jangan membuat folder `frontend/` atau `backend/` hanya demi mengikuti repository ini; aturan bagian 8 dan 9 berlaku untuk root aplikasi di mana pun ia berada.

### 9.14 Produksi: `composer install --no-dev`

- Produksi memasang `composer install --no-dev --optimize-autoloader`; Boost, `laravel/mcp`, `laravel/roster`, PHPUnit, dan Pint tidak terpasang. Aplikasi harus tetap boot, route tetap terdaftar, dan `config:cache` tetap berhasil (diverifikasi di CI pada setiap PR backend).
- Tidak ada kode aplikasi yang mengimpor kelas `Laravel\Boost\...`. `config/boost.php` boleh tetap ada karena hanya dibaca oleh paket.
- Server MCP Boost tidak pernah dijalankan di produksi atau sebagai bagian dari deployment.

### 9.15 Menjaga dokumentasi dan rule tetap selaras

- Satu sumber untuk setiap hal: aturan repository di root `AGENTS.md`, aturan Laravel proyek di `.ai/guidelines/`, keputusan per area kode lewat `record-rule` di `.ai/rules/`, kontrak API di `docs/api/`, status di `<repo>/.ai/project-status.md`. File lain menautkan, tidak menyalin.
- Jangan menyalin isi guideline Boost ke dokumen root atau ke `docs/`; tautkan `backend/AGENTS.md`.
- Bila guideline Boost bertentangan dengan keputusan proyek, kecualikan lewat `config/boost.php` atau timpa dengan guideline kustom bernama sama, lalu jalankan `boost:update`; jangan mengedit blok yang dibuat.
- Tinjau diff `AGENTS.md` setelah setiap `boost:update`, sama seperti diff kode.

## 10. `.github/`

- `workflows/<aplikasi>-ci.yml` untuk CI per aplikasi, dipicu oleh perubahan path aplikasinya (`frontend/**`, `backend/**`). **(proyek ini)** `backend-ci.yml` juga dipicu oleh `frontend/src/types/**`, karena tes kontrak membaca tipe frontend.
- Setiap workflow menyatakan `permissions` minimum (`contents: read` bila hanya membaca); jangan bergantung pada izin bawaan repository.
- CI Laravel minimal: kebijakan PHP (minimum ditegaskan, versi aktual dicatat), `composer validate --strict`, `composer install`, `composer check-platform-reqs`, Pint, migrasi naik-turun-naik pada database sekali pakai dengan engine yang sama dengan produksi (**proyek ini:** service container MySQL 8.4 yang versinya ditegaskan), `php artisan test` pada database tes terpisah, `composer audit`, dan instalasi `--no-dev` yang tetap boot. Kredensial database CI dibuat acak per run dan disamarkan; tidak pernah ditulis di repository dan tidak pernah memakai database produksi.
- Workflow berat atau manual diberi nama sesuai tujuannya (`cross-browser-qa.yml`) dan dijalankan lewat `workflow_dispatch`.
- Template PR atau issue (`pull_request_template.md`, `ISSUE_TEMPLATE/`) bila tim membutuhkannya.

## 11. Di mana saya menaruh ...?

| Saya punya | Letakkan di |
|---|---|
| Logo atau aset merek baru | `frontend/public/brand/<merek>-<jenis>-<varian>.svg`, perbarui `logo-paths.ts` bila bentuknya dipakai komponen |
| Gambar yang diimpor komponen | `frontend/src/assets/<jenis>/` |
| Teks baru di halaman | `frontend/src/i18n/messages/{id,en}.ts` atau `frontend/src/data/locales/{id,en}/` |
| Halaman baru | `frontend/src/pages/<nama>.tsx`, daftarkan di `src/routes.ts` dan `pagePaths` |
| Komponen untuk satu halaman | `frontend/src/components/sections/<halaman>/` |
| Komponen bersama | `frontend/src/components/ui/` atau folder domainnya |
| Panggilan API | `frontend/src/services/` |
| Endpoint backend | `backend/routes/api.php` dan `backend/app/`, kontraknya di `docs/api/` |
| Konfigurasi backend baru | `backend/config/<domain>.php`, variabelnya di `backend/.env.example` |
| Aturan Laravel untuk agent | `backend/.ai/guidelines/` (umum) atau `record-rule` (per area kode), lalu `php artisan boost:update` |
| Dokumen arsitektur atau keputusan teknis | `docs/architecture/` |
| Aturan desain | `docs/design/` (spesifikasi turunan kode tetap di `docs/DESIGN.md`) |
| Fakta produk baru | `docs/PRODUCT.md` |
| Hasil QA | Bagian baru di `docs/qa/qa-report.md` |
| Status atau serah terima | `.ai/project-status.md` |
| Aturan untuk agent | `AGENTS.md` (khusus Claude Code: `CLAUDE.md` atau `.claude/rules/`) |
| Server MCP proyek | `.mcp.json` dan `.codex/config.toml` di root repository, dan nama server di `enabledMcpjsonServers` |
| Rancangan fitur yang belum dibangun | `docs/architecture/<topik>.md` dengan status jelas (Planned, Owner decision required), tidak di `docs/api/` |
| Skrip perawatan | `frontend/scripts/` atau `backend/` (perintah Artisan) |
| Rahasia | `.env` lokal saja; nama variabelnya di `.env.example` |
| Screenshot atau bukti audit | Folder yang diabaikan Git, angkanya di laporan QA |

## 12. Daftar periksa untuk proyek baru

1. Salin struktur root (bagian 2) dan isi `README.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.gitattributes`, `.editorconfig`, `.nvmrc`.
2. Buat `docs/README.md`, `docs/PRODUCT.md`, dan folder topik yang dibutuhkan saja; jangan membuat folder kosong.
3. Buat `.ai/` dengan tiga file di bagian 5 dan isi `project-status.md` sejak hari pertama.
4. Letakkan logo asli sekali saja di `frontend/public/brand/` dengan pola nama aset merek.
5. Untuk aplikasi Laravel: scaffold ke folder kosong (bagian 8), tetapkan database dan versi PHP (8.1), pasang Laravel Boost sesuai bagian 9.2, daftarkan MCP (9.4), dan verifikasi (9.12) sebelum fitur pertama.
6. Siapkan branch `main`, `staging`, dan branch per aplikasi, CI per aplikasi, dan proteksi branch bila tim lebih dari satu orang.
7. Salin dokumen ini ke `docs/project-structure.md` dan sesuaikan bagian bertanda **(proyek ini)**.
