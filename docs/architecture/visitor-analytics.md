# Analitik Pengunjung First-Party

Status (2026-10-15): **Planned, rancangan saja. Tidak ada pelacakan yang aktif.** Website saat ini tidak memuat skrip analitik pihak ketiga maupun pihak pertama (diperiksa: tidak ada `gtag`, Tag Manager, Plausible, Umami, Clarity, `sendBeacon`, atau sejenisnya di `frontend/src`). Aktivasi produksi menunggu tinjauan hukum dan privasi (bagian 6).

Terkait: `admin-dashboard.md` (tempat data ditampilkan), `docs/api/inquiries.md` (data inquiry).

## 1. Prinsip

- Angka hanya ditampilkan dengan definisi yang tertulis. Page view tidak pernah disebut pengunjung, dan perkiraan selalu diberi label perkiraan.
- Minimalisasi data: tidak ada alamat IP, user agent lengkap, cookie pelacak, atau identitas lintas hari yang disimpan.
- Halaman publik tidak boleh melambat: pengiriman event terjadi setelah halaman siap, tidak memblokir, dan tidak pernah menahan navigasi.
- Data mentah berumur pendek; yang disimpan lama hanya agregat.

## 2. Definisi metrik

| Metrik | Definisi | Catatan akurasi |
|---|---|---|
| Page view | Satu event `pageview` yang diterima server untuk satu muatan halaman atau satu navigasi klien ke path lain | Tidak termasuk crawler yang tidak menjalankan JavaScript, pengunjung yang memblokir skrip, dan event yang ditolak filter bot |
| Kunjungan (visit, sesi) | Rangkaian page view dengan ID sesi yang sama. ID sesi acak dibuat di `sessionStorage` per tab dan hilang saat tab ditutup; kunjungan berakhir setelah 30 menit tanpa event | Dua tab menghasilkan dua kunjungan. Tidak disebut "pengunjung" |
| Pengunjung unik (perkiraan) | Jumlah hash harian berbeda dalam satu hari: `hash(salt_harian, ip, user_agent, host)`. Salt acak dibuat setiap hari, disimpan hanya di server, dan dibuang setelah hari berakhir, sehingga hash tidak dapat dihubungkan antarhari dan IP tidak dapat dipulihkan | Hanya per hari; tidak dijumlahkan menjadi "pengunjung unik bulanan". Orang yang sama di dua perangkat dihitung dua; satu jaringan kantor dengan perangkat sama dapat dihitung satu. Selalu berlabel perkiraan |
| Pengunjung aktif | Jumlah ID sesi berbeda dengan event dalam **5 menit terakhir** | Bukan "orang online sekarang". Tanpa heartbeat, pembaca yang diam lebih dari 5 menit tidak terhitung; dinyatakan di UI |
| Sumber (referrer) | Host dari `document.referrer` (tanpa path dan query) atau parameter `utm_source`, `utm_medium`, `utm_campaign`; tanpa referrer: "langsung" | Banyak browser memotong referrer; tidak lengkap secara definisi |
| Halaman populer | Page view per path ternormalisasi (tanpa query, tanpa fragmen), per bahasa | |
| Wilayah | Hanya negara, dan hanya bila hosting atau CDN menyediakan header negara (misalnya `CF-IPCountry`). Tanpa database geolokasi IP | Ditampilkan sebagai agregat; tidak dipakai bila header tidak tersedia |
| Tren | Agregat harian dari metrik di atas | |
| Konversi inquiry | `jumlah inquiry tersimpan (201)` dibagi `jumlah kunjungan`, per hari | Rasio agregat. Inquiry **tidak** dihubungkan dengan sesi atau page view, agar data kontak tidak terkait jejak penelusuran |

## 3. Pengumpulan

Frontend (setelah disetujui):

- Modul kecil (target di bawah 1 KB gzip) yang dimuat setelah `load` dan saat browser idle, lalu mengirim satu event per page view dengan `navigator.sendBeacon` (cadangan `fetch` dengan `keepalive`). Tidak ada polling, heartbeat, atau listener scroll di halaman publik.
- Navigasi klien React Router mengirim event setelah route berganti.
- Payload: path, bahasa, referrer host, parameter UTM, kelas perangkat (lebar viewport dibulatkan ke `mobile`/`tablet`/`desktop`), ID sesi. Tanpa judul halaman, input formulir, atau teks bebas.
- Tidak mengirim apa pun bila `navigator.globalPrivacyControl` aktif, di halaman `noindex` (pratinjau), atau untuk pengguna admin yang login.
- Tanpa JavaScript tidak ada event; konten tetap lengkap.

Backend (setelah disetujui):

- `POST /api/v1/analytics/events` (usulan; belum dibangun dan belum ada di `docs/api/`). Respons `202` tanpa isi. Body maksimal 2 KB, rate limit per IP (misalnya 60 per menit), CORS hanya origin website, validasi ketat setiap field.
- Filter bot: pola user agent bot dan headless, `Sec-Purpose: prefetch`, path di luar daftar route yang dikenal, laju yang tidak wajar. User agent hanya dibaca saat request untuk filter dan hash, tidak disimpan.
- Hash pengunjung harian dihitung di server; IP tidak pernah ditulis ke database atau log aplikasi.
- Penulisan satu baris per event langsung (murah di MySQL), atau `dispatch()->afterResponse()` agar tidak menambah waktu respons. Tidak butuh worker antrean yang selalu berjalan.

## 4. Penyimpanan, agregasi, dan retensi

| Tabel (usulan) | Isi | Retensi |
|---|---|---|
| `analytics_events` | `occurred_at`, `path`, `locale`, `referrer_host`, `utm_*`, `device_class`, `session_id` (acak), `visitor_hash` (harian), `country` (opsional) | Pendek, misalnya 30 hari. **Owner decision required** |
| `analytics_daily` | Per tanggal dan dimensi (path, sumber, perangkat, negara): page view, kunjungan, perkiraan pengunjung unik | Jangka panjang (agregat tanpa data pribadi) |

- Index: `analytics_events(occurred_at)`, `(occurred_at, path)`, `(session_id, occurred_at)` untuk pengunjung aktif.
- Agregasi harian dan penghapusan data mentah lewat scheduler Laravel (`schedule:run` dari cron setiap menit, tersedia juga di shared hosting). Partisi bulanan MySQL hanya bila volume membutuhkannya.
- Dashboard membaca `analytics_daily` dan cache hasilnya sekitar 60 detik; hanya pengunjung aktif yang membaca `analytics_events`.

## 5. Tampilan near-real-time

| Pilihan | Penilaian |
|---|---|
| Polling ringan (admin saja) | **Dipilih.** Setiap 30 sampai 60 detik, hanya saat tab admin terlihat; satu query terindeks dengan cache singkat. Bekerja di hosting mana pun |
| Server-Sent Events | Butuh koneksi PHP yang terbuka lama; boros worker pada shared hosting atau PHP-FPM kecil |
| WebSocket (Laravel Reverb) | Butuh proses yang selalu berjalan dan konfigurasi proxy; tidak sebanding untuk satu angka |

Pilihan dapat ditinjau ulang setelah hosting diputuskan.

## 6. Privasi dan hukum (UU PDP)

Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi berlaku penuh sejak Oktober 2024. Hash harian, ID sesi, dan data perangkat dapat dianggap data pribadi bila dapat dihubungkan dengan seseorang. Sebelum aktivasi produksi, **wajib**:

1. Tinjauan oleh pihak yang kompeten secara hukum (dokumen ini bukan nasihat hukum): dasar pemrosesan (persetujuan atau kepentingan yang sah), kebutuhan banner persetujuan, dan kewajiban lain sesuai skala pemrosesan.
2. Pemberitahuan privasi dan halaman kebijakan privasi yang menjelaskan apa yang dikumpulkan, tujuan, retensi, dan hak subjek data. Saat ini website belum memiliki kebijakan privasi resmi.
3. Keputusan retensi data mentah dan agregat, serta prosedur permintaan subjek data.
4. Bila ada penyimpanan atau layanan di luar Indonesia, tinjauan transfer data lintas negara.

Sampai langkah di atas selesai, pelacakan yang mengidentifikasi pengunjung tidak diaktifkan, termasuk hash harian. Bila pemilik menginginkan angka sebelum tinjauan selesai, tingkat paling ringan (page view dan referrer host, tanpa ID sesi dan tanpa hash) dapat dipertimbangkan, tetap setelah persetujuan pemilik.

## 7. Alternatif

Layanan pihak ketiga (Google Analytics 4, Cloudflare Web Analytics, Plausible yang di-hosting sendiri) dapat menggantikan sebagian rancangan ini. Konsekuensinya: data diproses pihak lain (perlu tinjauan transfer data), skrip tambahan di halaman publik (GA4 jauh lebih berat), dan angka tidak dapat digabung langsung dengan inquiry. **Owner decision required** bila ingin memakai salah satunya.
