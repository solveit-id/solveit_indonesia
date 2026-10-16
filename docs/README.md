# Dokumentasi Solveit Indonesia

Peta seluruh dokumentasi proyek. Aturan penempatan dan penamaan file ada di [project-structure.md](project-structure.md).

## Tingkat atas

| File | Isi |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Fakta produk yang sudah dikonfirmasi: pengguna, layanan, batasan, komitmen merek. Sumber kebenaran konten |
| [DESIGN.md](DESIGN.md) | Spesifikasi desain yang diturunkan dari kode yang sudah dirilis (token, tipografi, komponen, motion) |
| [project-structure.md](project-structure.md) | Aturan struktur folder dan file yang dapat dipakai ulang di proyek lain, termasuk standar Laravel Boost dan coding agent (bagian 9) serta infrastruktur monorepo dan Docker (bagian 11) |

`PRODUCT.md` dan `DESIGN.md` sengaja berada di tingkat atas `docs/`: skill desain impeccable hanya mencari keduanya di root proyek atau tepat di `docs/`, bukan di subfolder.

## Per kelompok

| Folder | File | Isi |
|---|---|---|
| [api/](api) | [README.md](api/README.md) | Daftar endpoint backend yang sudah dibangun, format galat, CORS, rate limit, health check |
| | [inquiries.md](api/inquiries.md) | Kontrak `POST /api/v1/inquiries`: validasi, respons, proteksi spam, penyimpanan, privasi |
| | [admin-auth.md](api/admin-auth.md) | Kontrak API admin B3.1a: tautan akses, masuk dengan TOTP, sesi, CSRF, keamanan akun sendiri |
| [architecture/](architecture) | [architecture-overview.md](architecture/architecture-overview.md) | Gambaran repository, lapisan backend dan frontend, routing dan prerender, keputusan teknis |
| | [integration-plan.md](architecture/integration-plan.md) | Batas sistem dengan Solveit OpsHub, endpoint usulan, peta jalan backend |
| | [admin-dashboard.md](architecture/admin-dashboard.md) | Dashboard admin website: identitas backend B3.1a (dibangun), keputusan autentikasi, sesi, peran, audit; aplikasi admin, modul, desain, dan performa (Planned) |
| | [visitor-analytics.md](architecture/visitor-analytics.md) | Rancangan (Planned) analitik pengunjung first-party: definisi metrik, privasi dan UU PDP, penyimpanan, near-real-time |
| | [github-integration.md](architecture/github-integration.md) | Rancangan (Planned) integrasi GitHub organisasi `solveit-id`: kepemilikan OpsHub, GitHub App, webhook, tindakan berisiko |
| [design/](design) | [design-system.md](design/design-system.md) | Prinsip visual, token, komponen, aturan motion dan aksesibilitas |
| [development/](development) | [development-guide.md](development/development-guide.md) | Prasyarat, perintah, environment, aset, cara mengganti konten, deployment statis; setup backend native dengan MySQL 8.4, CI, MCP Laravel Boost untuk Claude Code dan Codex, pemecahan masalah |
| | [docker-development.md](development/docker-development.md) | Pengembangan penuh di Docker: setup sekali jalan, perintah harian, MySQL yang dipakai bersama, hot reload, pemecahan masalah |
| | [docker-production.md](development/docker-production.md) | Konfigurasi Docker produksi (disiapkan, belum di-deploy): arsitektur, rahasia, TLS, migrasi, pembaruan dan rollback, backup, uji lokal |
| [product/](product) | [product-naming.md](product/product-naming.md) | Arsitektur nama ekosistem (Solveit Orbit, OpsHub, usulan nama lain) dan pemeriksaan sebelum peluncuran |
| [seo/](seo) | [seo-geo.md](seo/seo-geo.md) | Strategi SEO/GEO, kata kunci per halaman, pekerjaan yang menunggu domain |
| [qa/](qa) | [qa-report.md](qa/qa-report.md) | Laporan QA per putaran: hasil tes, Lighthouse, bukti, keputusan |

## Di luar `docs/`

- [`../AGENTS.md`](../AGENTS.md): instruksi untuk semua coding agent; [`../CLAUDE.md`](../CLAUDE.md) memuatnya untuk Claude Code.
- [`../.ai/`](../.ai/README.md): status proyek terkini dan alur kerja untuk Codex (dan Claude Code tanpa skill khususnya).
- [`../backend/README.md`](../backend/README.md): setup, environment, perintah, dan keamanan backend Laravel; [`../backend/AGENTS.md`](../backend/AGENTS.md): guideline Laravel Boost untuk agent.
