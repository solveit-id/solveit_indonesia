# Runbook demo Cloudflare: website dan Solveit Admin dari komputer lokal

Status (B5a, 2026-10-19): **alat demo dibangun dan dites lokal dengan data sintetis; jalur Cloudflare untuk Admin belum diuji dari jaringan luar.** Ini panduan untuk memperlihatkan website Solveit Indonesia dan Solveit Admin kepada tim dari komputer pemilik, lewat Cloudflare Quick Tunnel gratis atau berbagi layar.

Demo **bukan** deployment produksi dan **bukan** aktivasi kanal inquiry publik. Semua akun dan inquiry di Admin demo adalah data contoh. Tunnel Cloudflare **tidak menggantikan** keamanan Admin: kata sandi, TOTP wajib, peran, sesi, CSRF, pemeriksaan Host dan Origin, CSP, dan audit log tetap berjalan seperti di produksi.

Isi:

1. [Ringkasan dalam satu menit](#1-ringkasan-dalam-satu-menit)
2. [Prasyarat](#2-prasyarat)
3. [Memasang dan memperbarui cloudflared](#3-memasang-dan-memperbarui-cloudflared)
4. [Website: build, preview, dan Quick Tunnel](#4-website-build-preview-dan-quick-tunnel)
5. [Admin: setup pertama](#5-admin-setup-pertama)
6. [Admin: owner demo dan TOTP](#6-admin-owner-demo-dan-totp)
7. [Admin lewat Quick Tunnel dengan email allowlist](#7-admin-lewat-quick-tunnel-dengan-email-allowlist)
8. [Uji tunnel sebelum demo pertama](#8-uji-tunnel-sebelum-demo-pertama)
9. [Hari demo: menjalankan dan menghentikan](#9-hari-demo-menjalankan-dan-menghentikan)
10. [Ketika URL tunnel berubah](#10-ketika-url-tunnel-berubah)
11. [Troubleshooting](#11-troubleshooting)
12. [Cleanup yang aman](#12-cleanup-yang-aman)
13. [Security checklist](#13-security-checklist)
14. [Batasan dan larangan](#14-batasan-dan-larangan)
15. [Referensi: Named Tunnel dan Cloudflare Access bila nanti ada domain](#15-referensi-named-tunnel-dan-cloudflare-access-bila-nanti-ada-domain)
16. [Cara kerja (untuk yang ingin tahu)](#16-cara-kerja-untuk-yang-ingin-tahu)

Urutan presentasi untuk tim ada di [`demo-walkthrough.md`](demo-walkthrough.md).

## 1. Ringkasan dalam satu menit

| Bagian | Cara demo | Status |
|---|---|---|
| Website | Build statis, `npm run preview`, Quick Tunnel ke `http://localhost:4173` | Sudah dipakai pemilik dan berhasil. Tidak diubah. |
| Admin lewat berbagi layar | `manage-demo.ps1 prepare`, buka `https://admin.solveit-demo.localhost:8543` di komputer sendiri, bagikan layar | Diuji lokal end to end (browser nyata, data sintetis) |
| Admin lewat Quick Tunnel | cloudflared ke `http://127.0.0.1:8190` **dengan** `--allowed-mail`, lalu `manage-demo.ps1 tunnel <URL>` | Sisi lokal diuji dengan pengganti tunnel; **Cloudflare sendiri belum diuji**. Ada laporan bug Cloudflare yang membuat sesi email berakhir beberapa detik setelah login (bagian 8). |

Keputusan aman: **mulailah dengan berbagi layar.** Pakai tunnel Admin hanya bila uji di bagian 8 lulus. Bila gagal, jangan membuka tunnel Admin tanpa `--allowed-mail`; tetap berbagi layar.

Semua perintah Admin dijalankan di **PowerShell**, dari **folder repository** (`D:\PROYEK\PORTOFOLIO\solveit_indonesia`), dengan satu skrip: `.\infra\docker\scripts\manage-demo.ps1 <perintah>`. Skrip itu tidak pernah membuka tunnel sendiri, tidak menyentuh database pengembangan (`solveit-mysql`), dan tidak mengubah `backend/.env`.

## 2. Prasyarat

| Kebutuhan | Cara memeriksa (PowerShell) | Catatan |
|---|---|---|
| Windows 11, PowerShell | `$PSVersionTable.PSVersion` | Windows PowerShell 5.1 cukup |
| Git for Windows (menyertakan Git Bash dan openssl) | `git --version` | Skrip demo memakai Git Bash di belakang layar |
| Docker Desktop berjalan | `docker info --format '{{.ServerVersion}}'` | Ikon Docker berwarna hijau, "Engine running" |
| Node 22 (hanya untuk website) | `node --version` | `v22.x` |
| cloudflared 2026.9.3 atau lebih baru | `cloudflared --version` | `--allowed-mail` baru ada sejak 2026.9.3 (bagian 3) |
| Ruang disk sekitar 3 GB | | Image backend dan admin, volume database demo |
| Aplikasi autentikator di ponsel | | Google Authenticator, Microsoft Authenticator, 2FAS, atau sejenisnya |

Bila PowerShell menolak menjalankan skrip ("running scripts is disabled"), izinkan **hanya untuk jendela ini**:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Port yang dipakai demo, semuanya hanya di `127.0.0.1` (tidak terlihat dari jaringan lain): `8190` (Admin untuk cloudflared), `8543` (Admin lokal dengan TLS), `4173` (preview website). Tidak bentrok dengan pengembangan (`8000`, `5173`, `5174`, `3307`).

## 3. Memasang dan memperbarui cloudflared

Periksa versi:

```powershell
cloudflared --version
```

Bila perintah tidak dikenal tetapi cloudflared sudah terpasang lewat installer MSI, panggil dengan path lengkap:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" --version
```

Memasang atau memperbarui (pilih salah satu):

- Dengan winget, bila tersedia: `winget install --id Cloudflare.cloudflared` atau `winget upgrade --id Cloudflare.cloudflared`.
- Tanpa winget: unduh `cloudflared-windows-amd64.msi` terbaru dari <https://github.com/cloudflare/cloudflared/releases/latest>, jalankan, lalu buka PowerShell baru.

Versi minimum untuk email allowlist: **2026.9.3**. Versi di komputer pemilik saat B5a: 2026.10.1 (lihat bagian 8 tentang bug sesi).

Jangan membuat file `config.yml` di `%USERPROFILE%\.cloudflared\`: menurut dokumentasi Cloudflare, Quick Tunnel tidak didukung bila file konfigurasi itu ada.

## 4. Website: build, preview, dan Quick Tunnel

Alur ini sudah berhasil dipakai pemilik; B5a tidak mengubahnya. Website demo adalah build statis: formulir kontaknya hanya mengarahkan ke WhatsApp dan email, karena kanal "kirim lewat website" tetap nonaktif (`VITE_INQUIRY_API_ENABLED=false`). Jangan menyetel variabel itu untuk demo.

**Jendela PowerShell 1** (folder `frontend`):

```powershell
cd D:\PROYEK\PORTOFOLIO\solveit_indonesia\frontend
npm run build
npm run preview
```

Output normal: `Serving ...\build\client at http://localhost:4173`. Biarkan jendela ini terbuka.

**Jendela PowerShell 2**:

```powershell
cloudflared tunnel --url http://localhost:4173
```

Output normal: beberapa baris log, lalu kotak berisi `https://<kata-acak>.trycloudflare.com`. **Salin URL itu** dan bagikan ke tim. Website bersifat publik, jadi tunnel ini tidak wajib memakai email allowlist; bila ingin terbatas, tambahkan `--allowed-mail` seperti di bagian 7.

Menghentikan: tekan `Ctrl+C` di jendela 2 (tunnel), lalu di jendela 1 (preview).

## 5. Admin: setup pertama

Lakukan sekali, idealnya sehari sebelum demo (build pertama memakan beberapa menit).

**Jendela PowerShell 3** (folder repository):

```powershell
cd D:\PROYEK\PORTOFOLIO\solveit_indonesia
.\infra\docker\scripts\manage-demo.ps1 prepare
```

Yang dilakukan `prepare`, tanpa perlu mengedit apa pun:

1. Membuat folder status demo di luar repository: `%LOCALAPPDATA%\solveit-demo\solveit-demo` (berisi `demo.env`, folder `secrets`, sertifikat lokal). Rahasia dibuat acak dan tidak pernah ditampilkan.
2. Membangun image produksi backend dan konsol admin (tag `demo`).
3. Menjalankan MySQL demo di volume sendiri (`solveit-demo_mysql-data`), menjalankan migrasi, lalu Laravel, konsol admin, dan listener admin, semuanya hanya di `127.0.0.1`.
4. Mengisi data contoh: enam inquiry sintetis dengan status di konsol Baru (dua), Ditinjau (satu, plus satu yang dibuka kembali setelah Selesai), Dihubungi, dan Selesai, riwayat status, catatan internal, pembukaan kontak yang tercatat di audit log, dan satu persona admin "Operator Demo (persona contoh)" yang tidak bisa dipakai masuk oleh siapa pun.

Output normal di akhir:

```text
OK     pengaman demo menerima stack ini
INFO   mengisi data demo sintetis (yang sudah ada tidak diubah)
SEED   persona Operator Demo (admin, kredensial acak yang tidak diketahui siapa pun) dibuat
SEED   INQ-XXXX-XXXX-XXXX in-review
...
SEED   ditambahkan: 6 inquiry, 9 perubahan status, 6 catatan, 2 pembukaan kontak (0 berarti sudah lengkap)

Demo admin berjalan (data sintetis, bukan deployment).
  Mode     : lokal (untuk berbagi layar)
  Admin    : https://admin.solveit-demo.localhost:8543
             Browser akan memperingatkan sertifikat self-signed: pilih Advanced, lalu Proceed.
  Tunnel   : cloudflared tunnel --url http://127.0.0.1:8190 --allowed-mail "<email-tim>"
             lalu: .\infra\docker\scripts\manage-demo.ps1 tunnel https://<kata-acak>.trycloudflare.com
  Data     : solveit-demo_mysql-data (hanya project ini)
  Periksa  : .\infra\docker\scripts\manage-demo.ps1 check
```

Nomor referensi `INQ-...` berbeda di setiap komputer. Menjalankan `prepare`, `start`, atau `seed` lagi tidak menggandakan data: barisnya menjadi `ditambahkan: 0 inquiry, 0 perubahan status, 0 catatan, 0 pembukaan kontak`.

Lalu periksa:

```powershell
.\infra\docker\scripts\manage-demo.ps1 check
```

Baris terakhir yang diharapkan: `OK     SIAP: semua pemeriksaan lulus`. Sebelum owner demo dibuat, `check` juga menulis `INFO belum ada owner demo yang aktif`.

Setelah `git pull` yang mengubah kode admin atau backend, jalankan `prepare` lagi: image dibangun ulang, data demo tetap.

## 6. Admin: owner demo dan TOTP

Alamat akun demo **harus** memakai domain contoh `example.test` (tidak ada email yang dikirim; alamat itu hanya nama login). Alamat nyata ditolak oleh skrip dan oleh pengaman demo.

Paling andal: aktifkan owner di **mode lokal** (setelah `prepare`, mode lokal sudah aktif).

```powershell
.\infra\docker\scripts\manage-demo.ps1 owner pemilik.demo@example.test
```

Output memuat satu baris seperti `https://admin.solveit-demo.localhost:8543/access#token=...`. Tautan itu **sekali pakai, berlaku 30 menit, dan tidak pernah ditampilkan lagi**. Jangan disimpan, difoto, atau dibagikan.

1. Salin tautan, buka di Chrome atau Edge di komputer ini.
2. Browser memperingatkan sertifikat (self-signed untuk alamat lokal). Pilih **Advanced**, lalu **Proceed to admin.solveit-demo.localhost (unsafe)**. Ini wajar untuk alamat lokal demo; jangan lakukan ini di situs lain.
3. Isi nama (misalnya "Pemilik Demo") dan kata sandi baru minimal 12 karakter.
4. Pindai kode QR dengan aplikasi autentikator di ponsel. Beri nama entri yang jelas, misalnya "Solveit DEMO".
5. Masukkan kode 6 digit, lalu simpan **kode pemulihan** (di pengelola kata sandi atau kertas). Centang konfirmasi, lalu **Lanjut ke konsol**.

Bila tautan kedaluwarsa sebelum dipakai, jalankan perintah `owner` yang sama lagi. Bila owner yang sudah aktif kehilangan ponsel dan kode pemulihan:

```powershell
.\infra\docker\scripts\manage-demo.ps1 recover pemilik.demo@example.test
```

Tautan baru meminta kata sandi dan autentikator baru; akses lama langsung berhenti.

Peran Admin untuk tim: di konsol, owner membuka **Undangan**, mengundang alamat `nama.demo@example.test` dengan peran Admin, lalu menyerahkan tautan sekali pakai itu. Tautan memakai alamat Admin saat itu (lokal atau tunnel), jadi buat undangan **setelah** memilih mode.

## 7. Admin lewat Quick Tunnel dengan email allowlist

Lakukan hanya setelah uji di bagian 8 lulus.

**Jendela PowerShell 4** (cloudflared untuk Admin). Ganti alamat email dengan alamat **nyata** anggota tim yang boleh masuk (ini email untuk kode Cloudflare, berbeda dari akun demo `@example.test`):

```powershell
cloudflared tunnel --url http://127.0.0.1:8190 --allowed-mail "nama1@gmail.com,nama2@gmail.com"
```

Seluruh domain boleh juga ditulis `"*@namadomain.com"` (selalu dengan tanda kutip). Saat start, cloudflared menulis bahwa email authentication aktif dan jumlah aturannya (tanpa menampilkan alamat). **Salin URL** `https://<kata-acak>.trycloudflare.com` dari kotak di output.

**Jendela PowerShell 3**:

```powershell
.\infra\docker\scripts\manage-demo.ps1 tunnel https://kata-acak-dari-cloudflared.trycloudflare.com
```

Yang dilakukan `tunnel`:

1. Menolak URL yang bukan Quick Tunnel.
2. **Memeriksa lewat internet bahwa tunnel meminta kode email Cloudflare.** Bila tunnel ternyata terbuka tanpa `--allowed-mail`, Admin **tidak** dibuka dan skrip berhenti dengan `GAGAL tunnel ini TIDAK meminta kode email`.
3. Mengganti `ADMIN_URL` demo ke URL tunnel dan menjalankan ulang Laravel serta listener admin (data tetap).
4. Mengukur jalur cloudflared ke listener, supaya rate limit dan audit log melihat alamat IP tiap orang, bukan satu alamat bersama.
5. Memeriksa ulang perlindungan tunnel setelah Admin terbuka.

Output normal: `OK tunnel dilindungi email Cloudflare (302 login.trycloudflare.com)`, lalu ringkasan `Mode : Quick Tunnel`. Lalu jalankan `check` (harus `SIAP`).

Bagikan URL tunnel kepada anggota tim yang emailnya ada di allowlist. Mereka akan:

1. Membuka URL, memasukkan email, lalu memasukkan PIN yang dikirim Cloudflare (tanpa akun Cloudflare).
2. Masuk ke Admin dengan akun demo mereka (kata sandi dan TOTP).

Untuk mengubah daftar email, hentikan cloudflared (`Ctrl+C`) dan jalankan lagi dengan daftar baru; URL akan berubah, jadi lanjutkan ke bagian 10.

Kembali ke mode lokal kapan saja (URL tunnel langsung tidak dilayani Admin lagi):

```powershell
.\infra\docker\scripts\manage-demo.ps1 local
```

## 8. Uji tunnel sebelum demo pertama

Cloudflare menambahkan email allowlist untuk Quick Tunnel (`--allowed-mail`) pada cloudflared 2026.9.3. Per 2026-10-19 ada laporan terbuka [cloudflare/cloudflared#1752](https://github.com/cloudflare/cloudflared/issues/1752): setelah PIN email berhasil, sesi Cloudflare berakhir sekitar 5 detik kemudian; permintaan GET dialihkan ke halaman login lagi dan permintaan POST mendapat `401` polos. Laporan itu juga terjadi pada 2026.10.1, versi yang terpasang di komputer pemilik. Bila bug itu terjadi, Admin (aplikasi satu halaman yang terus memanggil API) tidak dapat dipakai lewat tunnel.

Uji ini membutuhkan dua orang (atau satu orang dengan ponsel di jaringan seluler) dan 10 menit:

1. Siapkan demo dan owner seperti bagian 5 dan 6.
2. Jalankan cloudflared dengan `--allowed-mail` berisi email penguji, lalu `manage-demo.ps1 tunnel <URL>` (bagian 7). Harus `OK tunnel dilindungi`.
3. Dari perangkat lain (sebaiknya jaringan seluler), buka URL tunnel, selesaikan PIN email.
4. Masuk dengan akun demo, buka **Inquiry**, buka satu inquiry, tunggu 1 menit, tambahkan satu catatan, buka **Audit log**.
5. Dari perangkat yang **emailnya tidak ada** di allowlist, buka URL tunnel: harus tertahan di halaman email Cloudflare dan tidak pernah melihat Admin.

Hasil:

| Yang terlihat | Keputusan |
|---|---|
| Semua langkah berjalan, sesi bertahan | Tunnel Admin boleh dipakai untuk demo interaktif |
| Diminta email lagi berulang-ulang, halaman setengah termuat tanpa gaya, atau "Sesi berakhir" segera setelah masuk | **BLOCKED** untuk demo interaktif jarak jauh. Jalankan `manage-demo.ps1 local`, tutup cloudflared, dan demo dengan berbagi layar. Jangan membuka tunnel Admin tanpa `--allowed-mail`. |
| Perangkat di luar allowlist bisa melihat Admin | Hentikan cloudflared segera, jalankan `local`, laporkan |

Catat hasil, tanggal, dan versi cloudflared di `docs/qa/qa-report.md` (bagian B5a) atau sampaikan ke tim pengembang. Periksa kembali issue #1752 dan catatan rilis cloudflared sebelum menguji ulang dengan versi baru.

## 9. Hari demo: menjalankan dan menghentikan

Mulai (komputer jangan dibiarkan tidur selama demo; tunnel ikut mati bila komputer tidur):

1. Buka Docker Desktop, tunggu "Engine running".
2. Jendela 3: `cd D:\PROYEK\PORTOFOLIO\solveit_indonesia`, lalu `.\infra\docker\scripts\manage-demo.ps1 start`, lalu `.\infra\docker\scripts\manage-demo.ps1 check` (harus `SIAP`).
3. Website: jendela 1 dan 2 seperti bagian 4.
4. Admin lewat berbagi layar: buka `https://admin.solveit-demo.localhost:8543` dan bagikan layar. Admin lewat tunnel (hanya bila bagian 8 lulus): jendela 4 dan perintah `tunnel` seperti bagian 7.

Selesai:

1. `Ctrl+C` di jendela cloudflared (Admin dan website). Akses tim langsung berakhir.
2. Jendela 3: `.\infra\docker\scripts\manage-demo.ps1 stop`. Data demo tetap untuk demo berikutnya.
3. `Ctrl+C` di jendela preview website.

## 10. Ketika URL tunnel berubah

URL Quick Tunnel berubah setiap kali cloudflared dijalankan ulang. Tidak perlu mengedit file apa pun:

1. Jalankan cloudflared lagi (bagian 7), salin URL baru.
2. `.\infra\docker\scripts\manage-demo.ps1 tunnel <URL-baru>`.
3. Bagikan URL baru. Setiap orang masuk lagi (sesi terikat ke alamat lama). Akun dan TOTP tetap sama.

Tautan undangan atau reset yang dibuat untuk URL lama tidak berlaku di URL baru: buat ulang.

## 11. Troubleshooting

Mulailah selalu dengan `.\infra\docker\scripts\manage-demo.ps1 check`. Setiap baris `AWAS` menunjuk masalahnya.

| Gejala | Penyebab paling mungkin | Tindakan |
|---|---|---|
| `GAGAL Docker belum berjalan` | Docker Desktop belum siap | Buka Docker Desktop, tunggu "Engine running", ulangi |
| `GAGAL pengaman demo menolak` | Baris `REFUSED:` di atasnya menyebut alasannya (misalnya data bukan `@example.test`, port di luar loopback, file `demo.env` diubah) | Perbaiki penyebabnya; jangan melemahkan pengaman. Bila ragu, `stop` lalu hubungi pengembang |
| Halaman Admin `403` / "Permintaan ditolak" | Admin dibuka lewat alamat lain dari `ADMIN_URL` (misalnya URL tunnel lama, atau `127.0.0.1:8190` langsung) | Buka persis alamat yang ditulis `status`; setelah tunnel baru, jalankan `tunnel <URL-baru>` |
| `421` / `{"message":"Misdirected Request."}` | URL tunnel baru belum didaftarkan | `manage-demo.ps1 tunnel <URL-baru>` |
| `404` pada `/api/v1/inquiries` | Disengaja: API inquiry publik tidak ada di host Admin | Tidak perlu tindakan |
| `419` atau "Halaman kedaluwarsa, tekan lagi" | Token CSRF habis (tab lama, lama tidak aktif) | Muat ulang halaman lalu ulangi aksi |
| `429` di layar masuk | Rate limit masuk (5 percobaan per menit per email, 20 per jam per alamat IP) | Tunggu hitungan mundur; di mode tunnel `check` harus lulus "alamat pengunjung", supaya tiap orang dihitung sendiri |
| `429` dari Cloudflare | Batas Quick Tunnel 200 permintaan bersamaan | Kurangi tab yang terbuka; tunggu sebentar |
| `502` JSON "The admin API is unavailable." | Laravel belum siap atau berhenti | `manage-demo.ps1 start`, lalu `check` |
| `502` / `530` / error 1033 dari Cloudflare | cloudflared mati, atau tidak bisa mencapai `127.0.0.1:8190` | Pastikan jendela cloudflared masih jalan dan `start` sudah dijalankan; jalankan cloudflared ulang lalu `tunnel <URL-baru>` |
| Peringatan sertifikat di `admin.solveit-demo.localhost` | Sertifikat lokal self-signed (wajar) | Advanced, lalu Proceed |
| Diminta email Cloudflare berulang, halaman tanpa gaya, `401` polos, atau keluar sendiri segera setelah masuk | Bug sesi `--allowed-mail` (bagian 8) | BLOCKED: `manage-demo.ps1 local`, tutup cloudflared, berbagi layar |
| PIN Cloudflare tidak datang | Email tidak ada di allowlist, atau masuk folder spam | Periksa ejaan email di perintah cloudflared; cek spam; ulangi |
| Langsung kembali ke halaman masuk setelah login | Cookie diblokir atau alamat berganti | Izinkan cookie untuk alamat itu; jangan berpindah antara URL lokal dan tunnel di tab yang sama |
| `AWAS ... tunnel admin TANPA perlindungan email` | cloudflared berjalan tanpa `--allowed-mail` | `Ctrl+C` di jendela cloudflared **sekarang**, lalu `manage-demo.ps1 local` |
| Lupa kata sandi atau kehilangan autentikator | | `manage-demo.ps1 recover <alamat@example.test>` |

## 12. Cleanup yang aman

- **Menghentikan saja** (data tetap): `.\infra\docker\scripts\manage-demo.ps1 stop`.
- **Menghapus data demo** (akun demo, inquiry contoh, audit demo) untuk mulai dari nol:

  ```powershell
  .\infra\docker\scripts\manage-demo.ps1 reset
  ```

  Skrip memeriksa bahwa volume `solveit-demo_mysql-data` memang milik project demo, tidak dipakai project lain, dan (bila berjalan) hanya berisi data sintetis, lalu meminta Anda **mengetik nama project** `solveit-demo`. Yang dihapus hanya volume itu. Folder status dan secret tetap. Setelah itu `start` membuat database demo baru; owner perlu dibuat ulang.
- **Menghapus semuanya** setelah reset: hapus folder `%LOCALAPPDATA%\solveit-demo\solveit-demo` lewat File Explorer, dan bila ingin menghemat disk, image `solveit-indonesia/backend:demo` dan `solveit-indonesia/admin:demo` lewat Docker Desktop (Images). Jangan memakai `docker system prune`, `docker volume prune`, atau `docker compose down -v`: perintah itu bisa menghapus data project lain, termasuk database pengembangan.

## 13. Security checklist

Sebelum demo:

- [ ] `manage-demo.ps1 check` menulis `SIAP`.
- [ ] Semua akun demo memakai `@example.test`; tidak ada data client nyata yang dimasukkan atau diketik saat demo.
- [ ] cloudflared Admin dijalankan **dengan** `--allowed-mail` berisi hanya email tim yang diundang; `tunnel` melaporkan `OK tunnel dilindungi`.
- [ ] Uji bagian 8 lulus, atau diputuskan memakai berbagi layar.
- [ ] Tautan aktivasi, kata sandi, kode TOTP, dan kode pemulihan tidak dibagikan di chat, tidak difoto, dan tidak tampil saat berbagi layar (tutup jendela PowerShell yang memuat tautan sebelum berbagi layar).
- [ ] Notifikasi pribadi di layar dimatikan saat berbagi layar.

Setelah demo:

- [ ] cloudflared dihentikan (`Ctrl+C`), `manage-demo.ps1 stop` dijalankan.
- [ ] Undangan yang tidak terpakai dicabut di konsol, atau data demo di-`reset`.

## 14. Batasan dan larangan

- Ini **demo**, bukan produksi: satu komputer, tanpa jaminan uptime, berhenti bila komputer mati atau tidur.
- **Dilarang** memasukkan data client atau inquiry nyata, menyalin database pengembangan atau produksi, atau memakai alamat email nyata untuk akun demo.
- **Dilarang** membuka tunnel Admin tanpa `--allowed-mail`, menghubungkan cloudflared ke port lain selain `8190` untuk Admin, atau memakai `--hello-world`/opsi yang mematikan pemeriksaan.
- Kanal inquiry publik tetap nonaktif; demo tidak pernah menjalankan gateway publik yang memuat `POST /api/v1/inquiries` (skrip menolak bila itu berjalan).
- Quick Tunnel: tanpa SLA, maksimal 200 permintaan bersamaan, tidak mendukung Server-Sent Events, URL acak berganti setiap start.
- Audit log demo menyimpan alamat IP dan identitas browser anggota tim yang masuk lewat tunnel; data itu hilang saat `reset`.
- Sertifikat lokal hanya untuk `admin.solveit-demo.localhost`, self-signed, 30 hari, diperbarui otomatis oleh `start`.

## 15. Referensi: Named Tunnel dan Cloudflare Access bila nanti ada domain

Bila nanti pemilik punya domain yang DNS-nya dikelola Cloudflare, demo berulang lebih stabil dengan **Named Tunnel** (hostname tetap) dan **Cloudflare Access** (kebijakan email atau penyedia identitas, durasi sesi yang dapat diatur). Ini **belum dibangun** dan membutuhkan keputusan pemilik.

Garis besar (dokumentasi Cloudflare Zero Trust):

1. Akun Cloudflare dan Zero Trust (paket gratis tersedia untuk tim kecil; periksa ketentuan saat itu).
2. `cloudflared tunnel login`, `cloudflared tunnel create solveit-admin-demo`, lalu file konfigurasi **di luar** `%USERPROFILE%\.cloudflared\config.yml` (agar Quick Tunnel website tetap bisa dipakai), dengan ingress `admin-demo.<domain>` ke `http://127.0.0.1:8190`, dan `cloudflared tunnel route dns solveit-admin-demo admin-demo.<domain>`.
3. Aplikasi Access tipe self-hosted untuk `admin-demo.<domain>` dengan kebijakan Allow berisi email tim, durasi sesi misalnya 8 jam.
4. Perubahan repository yang perlu ditinjau: pengaman demo (`check-demo-stack.sh`) dan `manage-demo.sh` saat ini hanya menerima `*.trycloudflare.com` dan alamat lokal. Menambahkan hostname tetap adalah keputusan sadar: hostname itu harus tercatat, dan `ADMIN_URL` produksi tetap terpisah.

Access tetap lapisan tambahan: Admin tetap meminta kata sandi dan TOTP.

## 16. Cara kerja (untuk yang ingin tahu)

```text
Browser tim ── HTTPS ──> Cloudflare (PIN email, --allowed-mail)
                              │
                         cloudflared (komputer pemilik)
                              │ HTTP, Host = URL tunnel, X-Forwarded-For = IP pengunjung
                              ▼
              127.0.0.1:8190  admin-gateway (nginx)  ── hanya Host = ADMIN_URL, lainnya 421
                 │ /api/v1/admin/*  FastCGI ──> backend (Laravel, image produksi)
                 │ selain itu        ──> admin (konsol statis, CSP, no-store)
                 ▼
             mysql (volume solveit-demo_mysql-data, data sintetis)

Berbagi layar: browser pemilik ── HTTPS 127.0.0.1:8543 (TLS di admin-gateway) ── sama seperti di atas
```

- **Origin dan cookie:** `ADMIN_URL` demo adalah alamat yang dilihat browser (URL tunnel atau `https://admin.solveit-demo.localhost:8543`). Laravel memeriksa Host dan Origin terhadapnya, dan karena `https://`, cookie sesi bernama `__Host-solveit-admin-session` dengan `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, tanpa `Domain`. Cloudflare memutus HTTPS di depan; cookie `Secure` tetap diterima browser karena browser melihat HTTPS. CSRF memakai `Sec-Fetch-Site: same-origin` atau token `XSRF-TOKEN`. Tidak ada kontrak autentikasi yang diubah untuk tunnel.
- **Alamat IP:** listener mempercayai `X-Forwarded-For` hanya dari satu alamat, yaitu jalur koneksi loopback yang dipakai cloudflared, yang diukur saat `start`, dan hanya di mode tunnel. Cloudflare menambahkan alamat pengunjung di akhir header itu, jadi nilai palsu dari pengunjung tidak dipakai. Laravel sendiri tidak mempercayai header terusan (`TRUSTED_PROXIES` kosong).
- **Isolasi:** project Docker `solveit-demo`, volume `solveit-demo_mysql-data`, env dan secret di `%LOCALAPPDATA%`, semua port di `127.0.0.1`, gateway publik dan API inquiry publik tidak dijalankan (`infra/docker/compose.prod.demo.yaml`). Pengaman `infra/docker/scripts/check-demo-stack.sh` menolak sebelum ada yang diubah. Skrip smoke test dan drill restore produksi menolak project demo (pengamannya, `check-synthetic-stack.sh`, tidak diubah).
- **Data contoh:** `infra/docker/demo/seed-demo-data.php` memakai aksi aplikasi yang sama dengan API (dengan `Idempotency-Key` tetap per inquiry), jadi menjalankannya berulang tidak menggandakan data, dan perubahan yang dibuat audiens tidak ditimpa. Kejadian audit dari seed tidak memiliki alamat IP dan memakai identitas browser "Solveit demo seed (data sintetis)".
