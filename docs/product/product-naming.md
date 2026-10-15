# Penamaan Produk Ekosistem Solveit

Status: **usulan kerja** (2026-10-14). Nama-nama di bawah belum diperiksa sebagai merek dagang dan belum boleh dipakai secara komersial sebelum validasi hukum dan merek. Di website, semuanya diberi label rencana; tidak ada yang ditampilkan sebagai produk yang sudah tersedia.

## Arsitektur nama

| Nama | Status nama | Tanggung jawab | Status produk (di website) |
|---|---|---|---|
| Solveit Indonesia | Mapan (nama perusahaan) | Perusahaan dan website ini | Website: sedang berjalan |
| **Solveit Orbit** | Usulan | Nama payung untuk ekosistem layanan Solveit yang saling terhubung. Bukan satu aplikasi monolitik | Tidak berlaku (nama ekosistem) |
| **Solveit OpsHub** | **Mapan** | Operasional internal, pemantauan, dan pemeliharaan proyek | Sedang dirancang |
| Solveit Connect | Usulan | Akses dan komunikasi klien | Direncanakan |
| Solveit Scope | Usulan | Ruang lingkup, penawaran, dan proposal | Direncanakan |
| Solveit Accord | Usulan | Kontrak dan perjanjian digital | Direncanakan |
| Solveit Ledger | Usulan | Invoice dan catatan tagihan | Direncanakan |
| Solveit Pulse | Usulan | Progres, milestone, dan revisi | Direncanakan |
| Solveit Care | Usulan | Dukungan dan pemeliharaan | Direncanakan |

Hubungan Orbit dan OpsHub: Orbit adalah nama ekosistemnya, OpsHub adalah pusat operasional internal di dalamnya. Bagian untuk klien (Connect sampai Care) dapat menjadi aplikasi atau modul tersendiri, bergantung pada lingkup produk yang sudah tervalidasi; keputusan itu belum dibuat. Semua sistem tetap terpisah dari website ini dan terhubung lewat kontrak API atau event (lihat `docs/architecture/integration-plan.md`).

## Yang tidak berubah

- Repository `solveit_opshub`, identifier paket, kunci integrasi, dan path sistem operasi **tidak** diganti nama.
- Nama resmi perusahaan, tagline, kontak, deskripsi layanan, dan klaim faktual tidak berubah.
- Pernyataan visi perusahaan (`company.vision` di `frontend/src/i18n/messages/*.ts`) diperbarui pemilik pada 2026-10-15 dan tidak lagi menyebut nama produk:
  - ID: "Membangun ekosistem layanan digital yang saling terhubung untuk mendampingi pelanggan dari konsultasi dan perencanaan hingga pengembangan, pengelolaan proyek, serta pemeliharaan berkelanjutan."
  - EN: "To build a connected ecosystem of digital services that supports clients from consultation and planning through development, project management, and ongoing maintenance."

  Visi lama menyebut seluruh perjalanan berjalan "melalui Solveit OpsHub", padahal OpsHub adalah sistem operasional internal dan Orbit masih usulan. Visi baru menjelaskan arah ekosistem tanpa mengikat ke nama mana pun, sehingga tetap berlaku apa pun keputusan akhir soal nama. Deskripsi meta halaman Tentang Kami (`meta.aboutDescription`) yang mengulang visi lama ikut diselaraskan.

## Di mana nama dipakai di website

| Lokasi | Pemakaian |
|---|---|
| Tentang Kami, "Arah pengembangan" | Peta ekosistem: website (fondasi, sedang berjalan), OpsHub (pusat operasional, sedang dirancang), enam bagian untuk klien (direncanakan), dengan catatan bahwa nama masih usulan. Data di `frontend/src/data/ecosystem.ts` |
| Beranda, tile "Satu ekosistem untuk seluruh perjalanan proyek." | Menyebut Solveit Orbit dan OpsHub sebagai pusat operasionalnya; tahapan alur tetap kata generik |
| FAQ Proses (revisi) | "kami merencanakan" pemantauan progres di ekosistem Solveit Orbit |

Kapabilitas generik (konsultasi, proposal, invoice, dan seterusnya) tetap ditulis sebagai kata biasa di tempat lain; nama produk hanya dipakai bila membantu pemahaman.

## Tinjauan nama

| Nama | Kejelasan dan pelafalan (ID/EN) | Pembeda | Risiko tabrakan yang perlu diperiksa |
|---|---|---|---|
| Orbit | Mudah dilafalkan di kedua bahasa; metafora "sistem yang mengitari pusat" cocok dengan OpsHub sebagai pusat | Kuat sebagai payung | Kata umum; banyak produk perangkat lunak memakai "Orbit". Selalu pakai bentuk lengkap "Solveit Orbit" |
| OpsHub | Sudah mapan | Kuat | Istilah "OpsHub" juga dipakai produk lain; sudah menjadi nama internal yang mapan, tetap perlu diperiksa sebelum komersial |
| Connect | Sangat jelas | Lemah (generik) | Sangat umum di nama produk |
| Scope | Jelas bagi klien bisnis; "skop" lazim dalam bahasa proyek | Sedang | Umum di perangkat lunak manajemen proyek |
| Accord | Kurang akrab bagi sebagian pembaca Indonesia (dilafalkan "akord") | Sedang | Nama produk otomotif terkenal dan proyek kontrak digital terbuka memakai "Accord"; periksa kelas merek perangkat lunak |
| Ledger | Kurang akrab di luar bidang keuangan; maknanya tepat untuk catatan tagihan | Sedang | Merek perangkat keras kripto terkenal memakai "Ledger"; risiko kebingungan paling tinggi di daftar ini |
| Pulse | Jelas, mudah dilafalkan | Sedang | Sangat umum di produk pemantauan dan survei |
| Care | Jelas | Lemah (generik) | Umum di layanan dukungan |

Catatan pembeda: Connect, Care (sama-sama berawalan C) dan Scope, Pulse (kata pendek satu suku) cukup berbeda saat dibaca, tetapi dua nama berawalan C sebaiknya diuji pada daftar menu yang pendek.

## Sebelum peluncuran komersial

1. Penelusuran merek di PDKI (DJKI, Indonesia) untuk kelas 9 dan 42, dan WIPO Global Brand Database bila ada rencana di luar Indonesia.
2. Ketersediaan domain atau subdomain dan akun media sosial.
3. Keputusan lingkup: mana yang menjadi aplikasi terpisah dan mana yang modul.
4. Visi perusahaan sudah netral terhadap nama produk (lihat di atas); tidak perlu diubah bila nama disetujui.
5. Setelah disetujui, ubah status kolom "Status nama" di dokumen ini dan label "usulan" di website.
