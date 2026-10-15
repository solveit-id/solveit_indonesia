# Integrasi GitHub Organisasi Solveit

Status (2026-10-15): **Planned, rancangan kepemilikan dan kontrak saja.** Tidak ada GitHub App, token, private key, webhook, atau kode integrasi. Tidak ada repository yang dibuat, diubah, diarsipkan, atau dihapus. Private key GitHub App tidak diminta dan tidak disimpan sebelum implementasi dimulai.

Organisasi target: [`solveit-id`](https://github.com/solveit-id).

## 1. Kepemilikan

Orkestrasi GitHub dan pelacakan proyek atau revisi adalah pekerjaan **operasional**, jadi dimiliki **Solveit OpsHub** (atau aplikasi ekosistem yang ditunjuk), bukan website ini.

| Kemampuan | Pemilik | Website ini |
|---|---|---|
| Pengajuan dan persetujuan repository baru untuk proyek klien yang disetujui | OpsHub | Tidak ada |
| Metadata repository, branch, commit, pull request, issue | OpsHub | Tidak ada |
| Akses repository per peran | OpsHub | Tidak ada |
| Mengaitkan progres dengan milestone bisnis dan revisi klien | OpsHub | Tidak ada |
| Notifikasi ke klien | OpsHub atau produk klien | Tidak ada |
| Titik masuk dari admin website | Admin website | Tautan ke OpsHub; opsional ringkasan baca-saja lewat API berversi OpsHub |

Aturan batas (`integration-plan.md`): kode OpsHub tidak masuk `backend/` website, tidak ada database bersama, dan komunikasi antarsistem lewat API, event, atau webhook berversi.

## 2. GitHub App

Memakai GitHub App resmi milik organisasi, bukan personal access token dan bukan OAuth App.

### Dua App dengan hak berbeda

| App | Tugas | Izin (diverifikasi ulang terhadap dokumentasi GitHub saat implementasi) |
|---|---|---|
| **Solveit Monitor** (baca-saja) | Sinkronisasi metadata, branch, commit, PR, issue; menerima webhook | Repository: Metadata read, Contents read, Pull requests read, Issues read. Organization: Members read bila pemetaan tim diperlukan |
| **Solveit Provisioner** (tulis, jarang dipakai) | Membuat repository private dari template setelah persetujuan; mengatur akses tim | Hak minimum untuk `POST /orgs/{org}/repos` atau `POST /repos/{template_owner}/{template_repo}/generate`. Dokumentasi GitHub mencantumkan endpoint itu di bawah izin "Repository creation" dan "Administration" (write). **Administration write juga mengizinkan `DELETE /repos/{owner}/{repo}`**, jadi bila izin "Repository creation" saja cukup, Administration tidak diberikan |

Pemisahan ini membuat sinkronisasi harian tidak pernah memegang hak tulis, dan hak yang dapat menghapus repository (bila tidak dapat dihindari) terisolasi di App yang hanya dipanggil oleh alur persetujuan.

### Token

| Jenis | Bertindak sebagai | Dipakai untuk |
|---|---|---|
| Installation access token | App itu sendiri, terbatas pada instalasi dan izinnya; berlaku sekitar 1 jam | Sinkronisasi latar dan tindakan yang sudah disetujui. Dibuat sesaat sebelum dipakai, tidak disimpan di database |
| User access token | Pengguna GitHub tertentu, dibatasi irisan izin pengguna dan App | Hanya bila tindakan harus tercatat atas nama orang tertentu di GitHub. Tidak dipakai di tahap awal |

### Rahasia

- Private key App dan secret webhook hanya di secret manager atau environment hosting OpsHub, tidak di Git, tidak di database, tidak di log.
- Rotasi: GitHub App dapat memiliki lebih dari satu private key; buat key baru, deploy, verifikasi, lalu hapus key lama. Secret webhook dirotasi dengan periode tumpang tindih.
- Kebocoran: cabut key di pengaturan App, buat baru, tinjau audit log organisasi.

## 3. Alur pembuatan repository

1. Proyek klien berstatus disetujui di OpsHub.
2. Permintaan repository: nama mengikuti konvensi (usulan `client-<klien>-<proyek>`), template, tim yang mendapat akses.
3. Persetujuan eksplisit oleh peran berwenang (usulan: owner); permintaan dan persetujuan tercatat di audit log.
4. Provisioner membuat repository **private** dari template dengan kunci idempotensi (permintaan yang diulang tidak membuat repository kedua), memasang proteksi branch default, dan memberi akses tim.
5. OpsHub mencatat hasil (ID repository, URL) dan memberi tahu pihak terkait.

Visibilitas publik, kolaborator luar (termasuk klien), dan perubahan proteksi branch adalah tindakan terpisah yang masing-masing butuh persetujuan.

## 4. Tindakan berisiko tinggi

- **Penghapusan repository tidak pernah otomatis**, termasuk saat proyek dibatalkan. Default saat proyek berakhir atau batal: arsipkan (baca-saja), setelah persetujuan.
- Penghapusan hanya lewat permintaan manual dengan alasan, persetujuan eksplisit pemilik, konfirmasi kedua (mengetik nama repository), dan masa tunggu. Dicatat di audit log. Lebih aman dilakukan manual oleh admin organisasi di GitHub daripada lewat App.
- Mengubah visibilitas ke publik, mentransfer repository, dan menghapus proteksi branch diperlakukan sama.

## 5. Webhook

- Diterima oleh OpsHub, tidak oleh website.
- Verifikasi `X-Hub-Signature-256` (HMAC SHA-256 atas body mentah dengan secret webhook) dengan perbandingan waktu-konstan sebelum memproses apa pun; tolak bila tidak cocok.
- Deduplikasi dengan `X-GitHub-Delivery` (GUID per pengiriman) yang disimpan dengan constraint unik; pengiriman ulang diabaikan.
- Jawab `2xx` cepat, proses di antrean; daftar event yang diterima dibatasi (allowlist) sesuai kebutuhan.
- Event yang gagal diproses dicatat dan dapat diulang; tidak ada data rahasia di log.

## 6. Rate limit dan ketahanan

- Installation token memiliki kuota per jam per instalasi (minimal 5.000 permintaan, dapat lebih tinggi untuk organisasi besar). Utamakan webhook daripada polling, dan request bersyarat (`ETag`, `If-None-Match`) untuk sinkronisasi.
- Pada `403`/`429` karena batas, hormati `Retry-After` atau `x-ratelimit-reset`, lalu ulangi dengan backoff eksponensial dan jitter; tindakan tulis hanya diulang bila idempoten.

## 7. Audit

Setiap permintaan, persetujuan, penolakan, dan tindakan tulis dicatat: pelaku, waktu, tindakan, repository, hasil, ID permintaan GitHub. Audit log hanya-tambah. Audit log organisasi GitHub tetap menjadi sumber kedua.

## 8. Kontrak dengan website

Website tidak memanggil GitHub. Kontrak yang mungkin dibutuhkan (semuanya berversi, dimiliki penyedianya):

| Arah | Kontrak | Status |
|---|---|---|
| Website ke OpsHub | Event `inquiry.received.v1` (nomor referensi dan field yang disepakati) | Planned (`integration-plan.md`) |
| OpsHub ke admin website | `GET /api/v1/...` milik OpsHub untuk ringkasan baca-saja (misalnya jumlah proyek aktif), dengan token layanan berizin baca | Planned, menunggu OpsHub |
| OpsHub ke website | Publikasi studi kasus nyata setelah izin tertulis klien (misalnya `case-study.published.v1`) | Planned; label demo dan aturan konten tetap berlaku sampai izin ada |

## 9. Tahapan

1. OpsHub memiliki autentikasi, peran, dan audit log.
2. Monitor App (baca-saja) dan webhook dengan verifikasi dan deduplikasi.
3. Alur permintaan dan persetujuan repository, lalu Provisioner App.
4. Pengaitan progres dengan milestone dan revisi; notifikasi klien.
5. Titik masuk dari admin website.
