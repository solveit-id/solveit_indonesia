# Walkthrough presentasi: website Solveit Indonesia dan Solveit Admin

Panduan urutan presentasi untuk tim non-teknis (sekitar 25 menit). Persiapan teknis ada di [`cloudflare-demo.md`](cloudflare-demo.md); jalankan `manage-demo.ps1 check` sampai `SIAP` sebelum mulai.

Pesan utama yang perlu ditangkap tim:

1. Website sudah jadi dan dua bahasa, tetapi **belum online di domain sendiri**.
2. Admin sudah bisa mengelola permintaan konsultasi (inquiry) dengan aman, tetapi **belum dipakai untuk data nyata**: semua yang terlihat hari ini adalah contoh.
3. Keamanan diutamakan: masuk dengan kata sandi dan kode autentikator, setiap tindakan penting tercatat.

## Sebelum mulai (5 menit sebelumnya)

- [ ] Website terbuka di `https://<kata-acak>.trycloudflare.com` (bagian 4 runbook).
- [ ] Admin terbuka dan **sudah masuk** sebagai owner demo, di jendela browser terpisah. Mode lokal: `https://admin.solveit-demo.localhost:8543`. Mode tunnel: URL tunnel Admin.
- [ ] Ponsel dengan aplikasi autentikator ada di dekat Anda (untuk menunjukkan langkah masuk).
- [ ] Jendela PowerShell yang memuat tautan aktivasi sudah ditutup. Notifikasi pribadi dimatikan.
- [ ] Bila tim mencoba sendiri lewat tunnel: email mereka sudah ada di `--allowed-mail`, dan undangan Admin untuk mereka sudah disiapkan (bagian C.6).

## A. Website (7 menit)

| Langkah | Yang dibuka | Yang disampaikan |
|---|---|---|
| A.1 | Beranda | Website profil perusahaan Solveit Indonesia, dua bahasa (Indonesia di `/`, Inggris di `/en/`). Tampilan terang secara default, ada pilihan gelap. |
| A.2 | Layanan, lalu Proses | Layanan yang ditawarkan dan cara kerja tim, dalam bahasa yang mudah dipahami calon klien. |
| A.3 | Portofolio, satu studi kasus | Studi kasus diberi label **contoh/demo**: belum ada proyek klien yang boleh dipublikasikan, jadi tidak ada klaim hasil atau nama klien. |
| A.4 | Kontak | Calon klien menghubungi lewat WhatsApp atau email resmi. Pengiriman formulir langsung ke sistem **sudah dibangun tetapi sengaja dimatikan** sampai kebijakan privasi, masa simpan data, dan hosting diputuskan. |
| A.5 | Ganti bahasa ke English | Semua halaman tersedia dalam bahasa Inggris. |

Pertanyaan yang sering muncul: "Kapan online?" Jawab: menunggu keputusan domain dan hosting; demo ini berjalan dari komputer lokal lewat tautan sementara Cloudflare.

## B. Masuk ke Admin (3 menit)

| Langkah | Yang dilakukan | Yang disampaikan |
|---|---|---|
| B.1 | Tunjukkan halaman **Masuk ke konsol admin** (buka di jendela privat, atau keluar dulu lewat tombol Keluar) | Admin terpisah dari website. Hanya orang yang diundang bisa masuk. |
| B.2 | Masukkan email `@example.test` dan kata sandi, lalu kode 6 digit dari ponsel | Masuk selalu dua langkah: kata sandi **dan** kode autentikator yang berganti setiap 30 detik. Tidak ada "ingat saya". Sesi berakhir sendiri setelah 30 menit tidak aktif. |
| B.3 | **Beranda konsol** | Ringkasan akun dan sesi, serta tahap pembangunan: semua tahap sampai B4b sudah dirilis, **belum di-deploy** ke internet. |

Jangan perlihatkan kata sandi, kode QR, atau kode pemulihan di layar.

## C. Mengelola inquiry (10 menit)

Data di bawah adalah contoh. Nama pengirim seperti "Contoh Pengirim Satu" dan organisasi bertanda "(data demo)" sengaja dibuat jelas fiktif.

| Langkah | Yang dibuka | Yang disampaikan |
|---|---|---|
| C.1 | Navigasi **Inquiry** | Kotak masuk permintaan konsultasi, terbaru di atas. Status: **Baru**, **Ditinjau**, **Dihubungi**, **Selesai**. Filter menurut status, layanan, tanggal, atau nomor referensi. Kontak dan isi pesan tidak tampil di daftar. |
| C.2 | Filter status **Baru** | Dua permintaan belum ditangani. Hapus filter setelahnya. |
| C.3 | Buka **Contoh Pengirim Empat** (Dihubungi) | Detail: isi permintaan, kontak yang **disamarkan**, panel Status, riwayat status (siapa memindahkan dan kapan), catatan internal tim. Semua dikerjakan oleh persona contoh "Operator Demo". |
| C.4 | Buka **Contoh Pengirim Satu** (Baru), tekan **Tandai ditinjau**, konfirmasi | Perubahan status selalu dikonfirmasi dan dicatat. Bila dua orang mengubah inquiry yang sama bersamaan, yang kedua diberi tahu dan tidak menimpa. |
| C.5 | Tulis catatan di **Catatan baru**, tekan **Tambah catatan** | Catatan internal hanya bisa ditambah, tidak bisa diubah atau dihapus, supaya riwayat tetap jujur. Pakai kalimat contoh, jangan data nyata. |
| C.6 | Tekan **Buka kontak lengkap**, centang pernyataan, masukkan kata sandi lagi, tekan lagi | Kontak lengkap hanya dibuka dengan sengaja, butuh konfirmasi kata sandi, dibatasi jumlahnya, dan **selalu tercatat di audit log**. Kontak hilang lagi saat tab disembunyikan atau ditinggalkan. |

## D. Audit dan pengguna (5 menit, khusus owner)

| Langkah | Yang dibuka | Yang disampaikan |
|---|---|---|
| D.1 | **Audit log** | Catatan permanen setiap tindakan penting: masuk, perubahan status, catatan, pembukaan kontak, undangan. Tidak bisa diubah atau dihapus, bahkan oleh owner. Kejadian dari data contoh memakai identitas browser "Solveit demo seed (data sintetis)". |
| D.2 | Buka kejadian **Kontak inquiry dibuka** | Terlihat siapa, kapan, dan inquiry mana, tanpa menampilkan kontaknya. |
| D.3 | **Pengguna** | Dua peran: **Owner** (mengelola pengguna dan audit) dan **Admin** (menangani inquiry). Persona "Operator Demo (persona contoh)" adalah akun Admin contoh yang tidak bisa dipakai masuk. |
| D.4 | **Undangan**, lalu undangan baru dengan alamat `nama.demo@example.test` dan peran Admin | Akun baru hanya lewat undangan sekali pakai yang diserahkan langsung (tidak ada email otomatis). Tautan tampil sekali saja. Bila tunnel dipakai dan anggota tim ingin mencoba, serahkan tautan itu lewat jalur pribadi; mereka mendaftarkan autentikator sendiri. Bila berbagi layar, cukup tunjukkan lalu cabut undangannya. |
| D.5 | **Keamanan** (akun sendiri) | Ganti kata sandi, kode pemulihan, dan daftar sesi aktif yang bisa diakhiri dari jarak jauh. |

## E. Penutup (2 menit)

Yang **sudah**: website dua bahasa, Admin dengan masuk dua langkah, pengelolaan inquiry, audit log, pengelolaan pengguna.

Yang **belum** dan menunggu keputusan pemilik: domain dan hosting, deployment produksi, aktivasi formulir website, kebijakan privasi dan masa simpan data, ekspor dan penghapusan data, integrasi dengan Solveit OpsHub.

Setelah presentasi: hentikan cloudflared (`Ctrl+C`), jalankan `manage-demo.ps1 stop`, dan cabut undangan yang tidak dipakai (runbook bagian 9 dan 13).

## Bila sesuatu tidak berjalan saat presentasi

| Kejadian | Tindakan cepat |
|---|---|
| Tim yang memakai tunnel terus diminta email Cloudflare atau terlempar keluar | Lanjutkan dengan berbagi layar dari komputer Anda (runbook bagian 8) |
| Halaman Admin "Permintaan ditolak" | Buka Admin lewat alamat yang ditulis `manage-demo.ps1 status` |
| "Sesi berakhir" | Masuk lagi; sesi berakhir setelah 30 menit tidak aktif |
| Hitungan mundur di layar masuk | Rate limit masuk; tunggu sampai selesai |
| Lainnya | Jalankan `manage-demo.ps1 check` dan lihat baris `AWAS`; tabel Troubleshooting di runbook bagian 11 |
