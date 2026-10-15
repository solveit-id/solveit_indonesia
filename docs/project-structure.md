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
| `AGENTS.md` | Aturan untuk semua agent: konteks proyek, perintah, verifikasi, aturan konten, desain, Git. Dibaca Codex, Cursor, dan agent lain | Wajib bila memakai agent |
| `CLAUDE.md` | Baris `@AGENTS.md` lalu hanya catatan khusus Claude Code (skill, MCP). Tidak mengulang isi `AGENTS.md` | Wajib bila memakai Claude Code |
| `.gitignore` | Dependensi, hasil build, artefak tes, `.env*`, file lokal agent, file OS/editor | Wajib |
| `.gitattributes` | `* text=auto eol=lf` dan atribut biner bila perlu | Wajib |
| `.editorconfig` | UTF-8, LF, indentasi 2 spasi (4 untuk PHP dan Python), baris akhir kosong | Wajib |
| `.nvmrc` | Versi mayor Node yang dipakai CI dan developer | Wajib bila ada Node |
| `.mcp.json` | Server MCP yang dibagikan ke semua agent proyek | Opsional |

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
- Folder topik baru dibuat bila topik itu belum cocok dengan folder mana pun; tambahkan juga ke `docs/README.md`. Contoh yang lazim: `api/` (kontrak dan referensi endpoint), `decisions/` (catatan keputusan arsitektur bernomor, `0001-<judul>.md`), `operations/` (runbook, deployment, monitoring).
- Dokumen ditulis dalam bahasa tim (**proyek ini:** Bahasa Indonesia). Instruksi agent (`AGENTS.md`, `CLAUDE.md`, `.ai/`) ditulis dalam bahasa Inggris agar dipahami semua alat.
- Rujukan antar-dokumen memakai path dari root repo dalam backtick (`docs/qa/qa-report.md`) atau tautan relatif yang benar. Setiap pemindahan dokumen wajib memperbarui semua rujukan.
- Laporan berkala (QA, audit) ditambahkan sebagai bagian baru di atas file yang sama, bukan file baru per putaran. Catatan sejarah tidak ditulis ulang.
- Bukti mentah (screenshot, hasil Lighthouse) tidak di-commit; simpan di folder yang diabaikan Git (**proyek ini:** `.impeccable/review/`) dan rangkum angkanya di laporan.

## 5. `.ai/`

```text
.ai/
├── README.md           Tujuan folder dan urutan baca
├── project-status.md   Status terkini: yang sudah rilis, kondisi branch, keputusan terbuka, tugas berikutnya
└── workflow.md         Setup, perubahan, verifikasi, dan rilis tanpa alat khusus satu agent
```

- Folder ini untuk serah terima antar-agent (Codex, Cursor, Claude Code, dan lainnya) dan antar-sesi.
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
| `.mcp.json` | Definisi server MCP proyek | Ya |
| `.impeccable/surfaces/`, `.impeccable/design.json`, `.impeccable/critique/` | Kontrak desain dan catatan kritik skill impeccable | Ya |
| `.impeccable/review/`, `build/`, `mocks/`, `config.local.json` | Bukti dan hasil kerja lokal | Tidak |
| `CLAUDE.local.md`, `.claude/settings.local.json`, `.claude/worktrees/` | Catatan dan pengaturan pribadi | Tidak (hindari; gabungkan ke file bersama bila berlaku untuk tim) |

Izin di `.claude/settings.json` mengikuti prinsip hak minimum: izinkan perintah verifikasi yang aman, tolak `git push --force` dan pembacaan `.env`.

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

## 8. `backend/` (Laravel)

Mengikuti struktur bawaan Laravel tanpa perubahan nama folder:

```text
backend/
├── app/                    Http/Controllers, Http/Requests, Http/Resources, Models, Services, Actions, Policies
├── bootstrap/
├── config/
├── database/               migrations, factories, seeders
├── public/                 Hanya index.php dan aset publik backend
├── resources/
├── routes/                 api.php (berversi: /api/v1/...), console.php
├── storage/                Tidak di-commit kecuali .gitignore bawaannya
├── tests/                  Feature/ dan Unit/
├── .env.example            Semua variabel terdokumentasi; .env tidak di-commit
├── artisan, composer.json, composer.lock, phpunit.xml
└── README.md
```

- Logika bisnis di `app/Services` atau `app/Actions`, bukan di controller.
- Validasi di Form Request, bentuk respons di API Resource.
- Endpoint selalu berversi dan didokumentasikan (`docs/architecture/integration-plan.md`, atau `docs/api/` bila sudah banyak).
- `vendor/` dan `.env` tidak di-commit.

## 9. `.github/`

- `workflows/<aplikasi>-ci.yml` untuk CI per aplikasi, dipicu oleh perubahan path aplikasinya (`frontend/**`, `backend/**`).
- Workflow berat atau manual diberi nama sesuai tujuannya (`cross-browser-qa.yml`) dan dijalankan lewat `workflow_dispatch`.
- Template PR atau issue (`pull_request_template.md`, `ISSUE_TEMPLATE/`) bila tim membutuhkannya.

## 10. Di mana saya menaruh ...?

| Saya punya | Letakkan di |
|---|---|
| Logo atau aset merek baru | `frontend/public/brand/<merek>-<jenis>-<varian>.svg`, perbarui `logo-paths.ts` bila bentuknya dipakai komponen |
| Gambar yang diimpor komponen | `frontend/src/assets/<jenis>/` |
| Teks baru di halaman | `frontend/src/i18n/messages/{id,en}.ts` atau `frontend/src/data/locales/{id,en}/` |
| Halaman baru | `frontend/src/pages/<nama>.tsx`, daftarkan di `src/routes.ts` dan `pagePaths` |
| Komponen untuk satu halaman | `frontend/src/components/sections/<halaman>/` |
| Komponen bersama | `frontend/src/components/ui/` atau folder domainnya |
| Panggilan API | `frontend/src/services/` |
| Endpoint backend | `backend/routes/api.php` dan `backend/app/` |
| Dokumen arsitektur atau keputusan teknis | `docs/architecture/` |
| Aturan desain | `docs/design/` (spesifikasi turunan kode tetap di `docs/DESIGN.md`) |
| Fakta produk baru | `docs/PRODUCT.md` |
| Hasil QA | Bagian baru di `docs/qa/qa-report.md` |
| Status atau serah terima | `.ai/project-status.md` |
| Aturan untuk agent | `AGENTS.md` (khusus Claude Code: `CLAUDE.md` atau `.claude/rules/`) |
| Skrip perawatan | `frontend/scripts/` atau `backend/` (perintah Artisan) |
| Rahasia | `.env` lokal saja; nama variabelnya di `.env.example` |
| Screenshot atau bukti audit | Folder yang diabaikan Git, angkanya di laporan QA |

## 11. Daftar periksa untuk proyek baru

1. Salin struktur root (bagian 2) dan isi `README.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.gitattributes`, `.editorconfig`, `.nvmrc`.
2. Buat `docs/README.md`, `docs/PRODUCT.md`, dan folder topik yang dibutuhkan saja; jangan membuat folder kosong.
3. Buat `.ai/` dengan tiga file di bagian 5 dan isi `project-status.md` sejak hari pertama.
4. Letakkan logo asli sekali saja di `frontend/public/brand/` dengan pola nama aset merek.
5. Siapkan branch `main`, `staging`, dan branch per aplikasi, CI per aplikasi, dan proteksi branch bila tim lebih dari satu orang.
6. Salin dokumen ini ke `docs/project-structure.md` dan sesuaikan bagian bertanda **(proyek ini)**.
