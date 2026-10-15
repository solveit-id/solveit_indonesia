# Dokumentasi Solveit Indonesia

Peta seluruh dokumentasi proyek. Aturan penempatan dan penamaan file ada di [project-structure.md](project-structure.md).

## Tingkat atas

| File | Isi |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Fakta produk yang sudah dikonfirmasi: pengguna, layanan, batasan, komitmen merek. Sumber kebenaran konten |
| [DESIGN.md](DESIGN.md) | Spesifikasi desain yang diturunkan dari kode yang sudah dirilis (token, tipografi, komponen, motion) |
| [project-structure.md](project-structure.md) | Aturan struktur folder dan file yang dapat dipakai ulang di proyek lain |

`PRODUCT.md` dan `DESIGN.md` sengaja berada di tingkat atas `docs/`: skill desain impeccable hanya mencari keduanya di root proyek atau tepat di `docs/`, bukan di subfolder.

## Per kelompok

| Folder | File | Isi |
|---|---|---|
| [architecture/](architecture) | [architecture-overview.md](architecture/architecture-overview.md) | Gambaran repository, lapisan frontend, routing dan prerender, keputusan teknis |
| | [integration-plan.md](architecture/integration-plan.md) | Batas sistem dengan Solveit OpsHub, kontrak API awal, peta jalan backend |
| [design/](design) | [design-system.md](design/design-system.md) | Prinsip visual, token, komponen, aturan motion dan aksesibilitas |
| [development/](development) | [development-guide.md](development/development-guide.md) | Prasyarat, perintah, environment, aset, cara mengganti konten, deployment |
| [product/](product) | [product-naming.md](product/product-naming.md) | Arsitektur nama ekosistem (Solveit Orbit, OpsHub, usulan nama lain) dan pemeriksaan sebelum peluncuran |
| [seo/](seo) | [seo-geo.md](seo/seo-geo.md) | Strategi SEO/GEO, kata kunci per halaman, pekerjaan yang menunggu domain |
| [qa/](qa) | [qa-report.md](qa/qa-report.md) | Laporan QA per putaran: hasil tes, Lighthouse, bukti, keputusan |

## Di luar `docs/`

- [`../AGENTS.md`](../AGENTS.md): instruksi untuk semua coding agent; [`../CLAUDE.md`](../CLAUDE.md) memuatnya untuk Claude Code.
- [`../.ai/`](../.ai/README.md): status proyek terkini dan alur kerja untuk agent lain.
- [`../backend/README.md`](../backend/README.md): rencana dan cara memulai backend Laravel.
