# `POST /api/v1/inquiries`

Menyimpan satu permintaan konsultasi dari formulir kontak website. Ini satu-satunya sumber kontrak inquiry; dokumen lain menautkan ke sini.

Implementasi: `backend/routes/api.php`, `app/Http/Requests/Api/V1/StoreInquiryRequest.php` (validasi dan header `Idempotency-Key`), `app/Actions/SubmitInquiry.php` (penyimpanan dan idempotensi), `app/Http/Resources/InquiryResource.php` (respons). Tes: `backend/tests/Feature/Http/Controllers/Api/V1/InquiryControllerTest.php` dan `InquiryIdempotencyTest.php` di folder yang sama, serta `backend/tests/Feature/Actions/SubmitInquiryTest.php` dan `SubmitInquiryConcurrencyTest.php`.

Klien frontend (B2) sudah dibangun, tetapi **nonaktif secara default**: kanal **Kirim melalui website** hanya muncul pada build dengan `VITE_INQUIRY_API_ENABLED=true` dan `VITE_API_BASE_URL` yang valid (lihat Klien frontend di bawah). Build produksi saat ini tidak mengaktifkannya dan API belum di-deploy, jadi website publik tetap hanya menyusun pesan WhatsApp atau email.

## Permintaan

```http
POST /api/v1/inquiries
Content-Type: application/json
Accept: application/json
Idempotency-Key: 3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b42
```

`Idempotency-Key` opsional (B2.1, lihat [Idempotensi](#idempotensi-b21)). Tanpa header ini perilakunya sama dengan B1 dan tidak ada perlindungan dari kiriman ganda.

```json
{
  "name": "Rina Pratiwi",
  "organization": "Toko Sinar Jaya",
  "contact": "rina@example.com",
  "service": "sistem-informasi",
  "budget": "10-50jt",
  "timeline": "1-3-bulan",
  "message": "Kami butuh sistem stok untuk tiga cabang toko."
}
```

Bentuknya sama dengan `InquiryPayload` di `frontend/src/types/inquiry.ts`, sehingga frontend dapat mengirim objek formulirnya apa adanya.

| Field | Wajib | Aturan |
|---|---|---|
| `name` | Ya | String, 2 sampai 120 karakter |
| `organization` | Tidak | String, maksimal 160 karakter. Tidak dikirim, `""`, atau hanya spasi disimpan sebagai `null` |
| `contact` | Ya | String, maksimal 254 karakter, berupa email **atau** nomor telepon (lihat di bawah) |
| `service` | Ya | Salah satu: `website`, `aplikasi-web`, `sistem-informasi`, `custom-software`, `dukungan-teknis` (`ServiceId` di `frontend/src/types/content.ts`) |
| `budget` | Ya | Salah satu: `belum-tahu`, `di-bawah-10jt`, `10-50jt`, `50-150jt`, `di-atas-150jt` (`BudgetRange`) |
| `timeline` | Ya | Salah satu: `fleksibel`, `1-3-bulan`, `segera` (`Timeline`) |
| `message` | Ya | String, 20 sampai 5000 karakter |
| `homepage` | Tidak | Honeypot. Harus tidak dikirim atau kosong (lihat Proteksi spam) |

- Panjang dihitung dalam karakter Unicode, bukan byte. Teks Unicode (aksen, aksara non-Latin, emoji) disimpan apa adanya.
- Spasi di awal dan akhir setiap string dibuang sebelum validasi (middleware `TrimStrings` Laravel), sama seperti `trim()` di frontend; `"  A  "` gagal batas minimal nama.
- Nilai enum harus persis (huruf kecil, dengan tanda hubung). Label tampilan seperti `"Sistem Informasi"` ditolak. `backend/tests/Unit/Enums/FrontendContractTest.php` membaca tipe frontend dan gagal bila daftar nilai kedua sisi berbeda.
- `budget` dan `timeline` wajib karena frontend selalu mengirimnya (default `belum-tahu` dan `fleksibel`).
- Field lain diabaikan. `id`, `public_id`, `status`, dan timestamp tidak dapat diisi klien (dites).
- Batas body: 64 KB (`INQUIRY_MAX_BODY_BYTES`), cukup untuk pesan 5000 karakter non-ASCII yang di-escape JSON. Di atasnya: `413`.

### Format kontak

Sama dengan `validateInquiry()` di `frontend/src/services/inquiry.ts`:

- Email: `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$` (contoh `rina@example.com`).
- Telepon: `^\+?[0-9][0-9 -]{7,16}$`, yaitu `+` opsional, diawali angka, total 8 sampai 17 karakter setelah `+` (contoh `+62 877-5964-1358`, `081230252499`).

Sejak B2 pola telepon frontend juga hanya menerima spasi biasa (sebelumnya `\s`), sehingga kedua sisi sama persis.

## Respons

### `201 Created`

Dikirim **hanya** setelah baris tersimpan di database.

```json
{ "id": "INQ-7K3M-9QX2-HD4T", "status": "received" }
```

- `id` adalah nomor referensi publik: `INQ-` lalu 12 karakter acak Crockford base32 (tanpa `I`, `L`, `O`, `U`, sehingga aman dibacakan) dalam tiga kelompok. 60 bit acak dari `random_int`, kolom `UNIQUE` di database, dan hingga tiga percobaan bila terjadi tabrakan. Tidak berurutan dan tidak menyingkap ID internal.
- `status` selalu `received` untuk inquiry baru.

Percobaan ulang dengan `Idempotency-Key` dan isi yang setara mendapat `201` dengan body yang sama persis (nomor referensi inquiry yang sudah tersimpan) ditambah header `Idempotent-Replayed: true`. Tidak ada baris baru.

### `400 Bad Request`

Header `Idempotency-Key` ada tetapi bukan tepat satu UUID versi 4 (lihat Idempotensi). Diperiksa sebelum validasi body; tidak ada yang disimpan, dan nilai header tidak dikembalikan atau di-log.

```json
{ "message": "The Idempotency-Key header must be a single UUID (version 4)." }
```

### `409 Conflict`

`Idempotency-Key` sudah dipakai oleh inquiry tersimpan yang isinya **berbeda**. Tidak ada yang disimpan, dan nomor referensi inquiry lain itu tidak diungkap.

```json
{ "message": "This Idempotency-Key was already used for a different inquiry. Send a new submission with a new key." }
```

### `422 Unprocessable Content`

Format validasi Laravel, dipetakan ke `InquiryErrors` di frontend (ambil elemen pertama per field):

```json
{
  "message": "The name field must be at least 2 characters.",
  "errors": {
    "name": ["The name field must be at least 2 characters."]
  }
}
```

Pesan dalam bahasa Inggris (bawaan Laravel). Frontend hanya memakai nama field-nya dan menampilkan pesannya sendiri dalam bahasa halaman; teks server tidak ditampilkan. Tidak ada yang disimpan saat validasi gagal.

### `429 Too Many Attempts`

Per alamat IP: 5 per menit dan 20 per jam (`INQUIRY_RATE_LIMIT_PER_MINUTE`, `INQUIRY_RATE_LIMIT_PER_HOUR`). Setiap percobaan dihitung, termasuk yang ditolak validasi. Respons berisi `Retry-After` (detik). Tidak ada yang disimpan.

### `503 Service Unavailable`

Database menolak atau tidak dapat menyimpan baris:

```json
{ "message": "The inquiry could not be saved. Please try again later or contact us by WhatsApp or email." }
```

Tidak ada `id` dan tidak ada `status`. Frontend B2 harus menganggapnya gagal dan menawarkan kanal WhatsApp atau email.

### Lainnya

`413` (body terlalu besar), `500` (galat tak terduga, tanpa detail), dan format galat bersama ada di [README.md](README.md).

## Idempotensi (B2.1)

Status: **dibangun dan dites di backend (B2.1); dipakai klien website sejak B2.2.** Setiap kiriman lewat kanal **Kirim melalui website** membawa kunci (lihat [Penerapan di frontend](#penerapan-di-frontend-b22)). Kanal itu tetap nonaktif secara default, jadi build yang dirilis belum mengirim apa pun ke API.

**Masalah yang diselesaikan.** Bila jaringan putus setelah server menyimpan inquiry, pengunjung tidak menerima nomor referensi dan mungkin mengirim lagi. Dengan kunci idempotensi, kiriman ulang yang sama mengembalikan hasil pertama alih-alih membuat inquiry kedua.

**Format kunci.** Header `Idempotency-Key` berisi tepat satu UUID versi 4 dalam bentuk kanonis `xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx` (huruf besar atau kecil; server menormalkan ke huruf kecil). UUID v4 dari `crypto.randomUUID()` membawa 122 bit acak, sehingga kunci tidak dapat ditebak. Header kosong, ganda, atau format lain mendapat `400`.

| Situasi | Hasil |
|---|---|
| Kunci baru, payload valid | `201`, satu inquiry baru |
| Kunci sama, payload setara | `201` dengan `id` yang sama dan `Idempotent-Replayed: true`, tanpa baris baru |
| Kunci sama, payload berbeda | `409`, tidak ada yang disimpan |
| Kunci berbeda, payload identik | Inquiry terpisah yang sah (masing-masing `201`) |
| Tanpa kunci | Perilaku B1: setiap kiriman menjadi inquiry baru, tanpa perlindungan duplikat |
| Kunci rusak | `400` sebelum validasi |
| Permintaan bersamaan dengan kunci sama | Tepat satu baris; yang lain mendapat `201` dengan referensi yang sama (isi setara) atau `409` (isi berbeda) |
| Penyimpanan gagal (`503`) atau payload ditolak (`422`) | Tidak ada yang tersimpan dan kunci belum terpakai, sehingga kunci yang sama boleh dipakai lagi |
| Batas laju | Percobaan ulang tetap dihitung; `429` berlaku seperti biasa |

**Payload setara** ditentukan dari nilai yang sudah divalidasi dan dikanonkan, dibandingkan per field dengan baris yang tersimpan: spasi di awal dan akhir dibuang, `organization` kosong atau tidak dikirim sama dengan `null`, urutan field dan field yang diabaikan tidak berpengaruh. Huruf besar dan kecil di nilai field **berpengaruh**.

**Penyimpanan.** Kolom `idempotency_key_hash` (`char(64)` ASCII, nullable, `UNIQUE`) pada tabel `inquiries` berisi SHA-256 heksadesimal dari kunci yang dinormalkan, bukan kuncinya. Karena kunci adalah 122 bit acak, hash tanpa garam sudah cukup, dan hash tidak bergantung pada `APP_KEY` (rotasi `APP_KEY` tidak memutus percobaan ulang). Tidak ada salinan kedua atau sidik jari data pribadi: perbandingan memakai kolom inquiry itu sendiri. Baris lama dan kiriman tanpa kunci berisi `NULL`, dan MySQL mengizinkan banyak `NULL` pada indeks `UNIQUE`. Satu tabel tambahan untuk kunci dipertimbangkan dan tidak dipilih: karena kunci melekat pada satu `INSERT`, penyimpanan inquiry dan kuncinya selalu atomik tanpa transaksi lintas tabel atau status "sedang diproses".

**Konkurensi.** Pemeriksaan adalah `INSERT` itu sendiri, bukan baca-lalu-tulis. InnoDB membuat `INSERT` kedua dengan hash yang sama menunggu transaksi pertama. Bila yang pertama commit, yang kedua gagal dengan galat 1062, lalu server membaca baris pemilik kunci (locking read) dan menjawab `201` replay atau `409`. Bila yang pertama rollback, yang kedua tersimpan sebagai inquiry baru. Tabrakan nomor referensi (`public_id`) dibedakan dari tabrakan kunci dengan memeriksa apakah ada baris pemilik hash itu, bukan dengan membaca pesan galat (yang memuat data pribadi). Deadlock di antara beberapa penunggu dicoba ulang hingga tiga kali. Dites dengan proses PHP terpisah yang masing-masing punya koneksi MySQL sendiri (`SubmitInquiryConcurrencyTest`): enam permintaan serentak dengan satu kunci, isi yang berbeda, dan `INSERT` yang tertahan transaksi lain lalu commit atau rollback.

**Siklus hidup kunci.** Hash melekat pada baris inquiry dan hilang bersamanya. Tidak ada kedaluwarsa terpisah dan tidak ada penghapusan otomatis; masa simpan inquiry masih keputusan pemilik (bagian Privasi). Akibat teknisnya: selama baris ada, kunci yang sama selalu mengembalikan inquiry itu. Bila suatu saat inquiry dihapus sesuai kebijakan retensi, kunci lamanya dapat dipakai lagi dan akan membuat inquiry baru. Bila admin (fase B3) mengubah field yang dikirim pengunjung, percobaan ulang dengan isi asli akan mendapat `409`, jadi field kiriman pengunjung sebaiknya tidak diubah. Rotasi kunci tidak relevan bagi server: setiap kiriman logis membawa kunci baru dari klien.

### Penerapan di frontend (B2.2)

Implementasi: `nextSubmission`, `keepsSubmission`, `createIdempotencyKey`, dan `submitInquiry` di `frontend/src/services/inquiry-api.ts`; `canonicalInquiry` dan `sameInquiry` di `frontend/src/services/inquiry.ts`; siklusnya di `frontend/src/components/contact/inquiry-form.tsx`.

1. **Kiriman logis.** Satu kiriman logis adalah pasangan kunci dan salinan kanonis isian yang dikirim bersamanya (`LogicalSubmission`). Kunci dibuat dengan `crypto.randomUUID()` hanya saat pengunjung menekan **Kirim melalui website** dan validasi lokal lolos; WhatsApp, email, dan merender formulir tidak pernah membuat kunci. Salinan itu tidak berubah setelah kunci dibuat, sehingga satu kunci tidak pernah dikirim dengan isi lain.
2. **Kanonis.** Isian dibandingkan dengan nilai yang diterima Laravel: string di-trim, `organization` kosong tetap `""` (server menyimpannya sebagai `null`), nilai enum apa adanya, huruf besar dan kecil berpengaruh, per field (urutan field dan identitas objek tidak berpengaruh). `Str::trim` Laravel membuang semua karakter yang dibuang `String.prototype.trim` dan beberapa lagi, jadi isian yang sama menurut frontend juga sama menurut server: memakai ulang kunci tidak pernah menghasilkan `409` karena perbedaan trim.
3. **Memakai ulang atau membuat kunci.** Saat dikirim, isian yang sama dengan kiriman logis yang masih disimpan memakai kunci yang **sama** (termasuk bila pengunjung sempat mengubah lalu mengembalikan isian). Isian lain mendapat kunci **baru**.
4. **Kapan kiriman logis dilepas.** Setelah `201` (selesai; tombol website nonaktif sampai isian berubah), `400`, dan `409` (kuncinya sendiri bermasalah). Setelah hasil tidak pasti kiriman disimpan untuk percobaan ulang. Setelah penolakan yang tidak memakai kunci (`413`, `422`, `429`, `503` dari Laravel, `4xx` lain) kiriman juga disimpan; memakai kunci yang sama lagi untuk isi yang sama tidak berbahaya.
5. **Tidak ada retry otomatis**, sama sekali. Hasil tidak pasti menampilkan tombol **Kirim ulang permintaan yang sama** / **Retry the same request** selama isian sama dengan percobaan tadi; tombol **Kirim melalui website** melakukan hal yang sama. Bila isian sudah berubah, tombol ulang disembunyikan dan formulir menjelaskan bahwa isian baru dicatat sebagai permintaan terpisah.
6. **Sedang mengirim.** Satu request pada satu waktu (`ref` sinkron, `aria-busy`, `aria-disabled`). Perubahan isian selama request berjalan tetap ada di formulir, tidak masuk request itu, dan ditandai belum terkirim setelah jawabannya datang. Jawaban yang datang setelah formulir di-unmount atau dibatalkan diabaikan.
7. **`409`**: pesan umum tanpa teks server, kunci dilepas, tidak ada pengiriman ulang otomatis; menekan tombol lagi adalah kiriman baru dengan kunci baru. **`400`**: sama, dengan pesan bahwa tidak ada yang tercatat.
8. **`429`**: `Retry-After` dihormati. Sebelum waktunya lewat, menekan tombol hanya mengulang pesan batas laju tanpa request. Kiriman logis tetap disimpan, jadi percobaan setelahnya memakai kunci yang sama.
9. **`201` dengan `Idempotent-Replayed: true`** ditampilkan sama dengan `201` biasa (nomor referensi asli, satu kali), ditambah satu kalimat bahwa percobaan sebelumnya ternyata sudah tercatat. Tanpa header itu (CORS tidak mengeksposnya) tampilannya sama dengan `201` biasa.
10. **Tanpa Web Crypto** (browser lama atau halaman yang bukan secure context, misalnya `http://` ke alamat IP LAN): tidak ada request; formulir menyarankan WhatsApp atau email. Tidak ada cadangan `Math.random`, timestamp, atau penghitung.
11. **Privasi.** Kunci dan isian hanya ada di memori komponen. Tidak masuk URL, body, log konsol, analitik, `localStorage`, `sessionStorage`, IndexedDB, atau cookie (dites).

**Keterbatasan yang disengaja.** Kunci hilang bila halaman dimuat ulang, tab ditutup, atau pengunjung berpindah halaman. Bila percobaan pertama ternyata tersimpan dan pengunjung mengirim lagi setelah memuat ulang, itu menjadi inquiry kedua. Menyimpan kunci dan isian di penyimpanan browser akan menutup celah itu tetapi menaruh data pribadi di perangkat, jadi tidak dilakukan. Hanya satu kiriman logis disimpan: setelah pengunjung mengirim isian lain, percobaan yang tidak pasti sebelumnya tidak dapat diperiksa lagi dari formulir.

## Klien frontend (B2)

Implementasi: `frontend/src/config/site.ts` (konfigurasi), `frontend/src/services/inquiry-api.ts` (klien), `frontend/src/components/contact/inquiry-form.tsx` (formulir). Tes: `src/config/site.test.ts`, `src/services/inquiry.test.ts`, `src/services/inquiry-api.test.ts`, `src/components/contact/inquiry-form.api.test.tsx`, `tests/e2e-api/inquiry-api.spec.ts`.

**Aktivasi.** `siteConfig.inquiryApiUrl` berisi `<origin>/api/v1/inquiries` hanya bila `VITE_INQUIRY_API_ENABLED` persis `true` dan `VITE_API_BASE_URL` adalah origin yang valid: tanpa path, query, fragment, atau kredensial; HTTPS, kecuali `localhost`, `127.0.0.1`, atau `[::1]` lewat HTTP untuk pengembangan. Selain itu kanal tidak dirender dan tidak ada request. Nilai dibaca saat build (Vite), sehingga mode aktif dan nonaktif dites dengan dua build terpisah. Merender formulir tidak pernah memanggil API; request hanya dikirim setelah pengunjung menekan **Kirim melalui website** dan validasi lokal lolos.

**Request.** `fetch` bawaan: `POST`, `Accept` dan `Content-Type` `application/json`, `credentials: "omit"`, `cache: "no-store"`, `redirect: "error"`, tanpa token. Body berisi field `InquiryPayload` yang sudah dikanonkan (`canonicalInquiry`) plus `homepage` dari input honeypot (kosong untuk manusia). Header `Idempotency-Key` berisi kunci kiriman logis (B2.2); `submitInquiry` menolak mengirim tanpa UUID v4 yang valid. Batas waktu 15 detik lewat `AbortController`; request juga dibatalkan bila formulir di-unmount. **Tidak ada retry otomatis.** Kunci dan isi inquiry tidak pernah di-log atau dikirim ke analitik.

**Pemetaan respons.**

| Respons | Arti bagi formulir |
|---|---|
| `201` dengan `id` berpola `INQ-XXXX-XXXX-XXXX` (Crockford base32) dan `status: "received"` | Diterima. Nomor referensi asli ditampilkan; tidak ada klaim sudah dibaca, dibalas, atau ada notifikasi. Dengan `Idempotent-Replayed: true` ditambah kalimat bahwa percobaan sebelumnya sudah tercatat |
| `201` dengan body lain atau tidak terbaca (juga bila replay) | Hasil tidak pasti (bukan sukses) |
| `400` | Tidak tersimpan; kunci dilepas, kiriman berikutnya memakai kunci baru |
| `409` | Tidak tersimpan; pesan umum tanpa teks server, kunci dilepas, tidak ada pengiriman ulang otomatis |
| `422` dengan field yang dikenal | Galat per field dengan teks lokal (ID/EN) milik frontend; teks server tidak pernah ditampilkan |
| `422` `errors.homepage` | Ditolak; disarankan WhatsApp atau email |
| `429` | Batas laju; `Retry-After` (detik atau tanggal HTTP, maksimal 24 jam) dibulatkan ke menit, tanpa hitung mundur. Sebelum waktunya lewat tidak ada request baru |
| `413` | Pesan terlalu besar |
| `503` dengan body Laravel yang terdokumentasi (persis) | Tidak tersimpan; coba lagi nanti atau pakai WhatsApp atau email |
| `503` lain (gateway, proxy, mode maintenance, body tidak terbaca) | Hasil tidak pasti, karena hanya jawaban Laravel sendiri yang membuktikan tidak ada yang tersimpan |
| `4xx` lain | Tidak terkirim; pakai WhatsApp atau email |
| `500`, `502`, `504`, `5xx` lain, `2xx` lain, galat jaringan, timeout | Hasil tidak pasti: permintaan mungkin sudah sampai. Pengunjung dapat mengirim ulang isian yang sama dengan kunci yang sama untuk memeriksanya, atau bertanya lewat WhatsApp atau email |

Pada semua kegagalan isian formulir tetap ada. WhatsApp dan email tetap pilihan terpisah yang hanya dibuka oleh pengunjung sendiri, tidak pernah otomatis. Selama request berjalan, tombol memakai `aria-busy` dan `aria-disabled` dan sebuah `ref` sinkron menolak kiriman kedua. Setelah `201`, tombol website nonaktif sampai isian berubah; perubahan setelah pengiriman ditandai belum terkirim.

**CORS.** Origin website harus masuk `CORS_ALLOWED_ORIGINS` di backend. Konfigurasi CORS mengizinkan header request `Idempotency-Key` (tanpanya browser memblokir setiap kiriman B2.2 di preflight) dan mengekspos `Idempotent-Replayed` serta `Retry-After` (README). Lokal, `http://localhost:4174` (build varian dengan kanal aktif) sudah ada di `.env.example`; uji nyata browser ke Laravel ke MySQL tercatat di `docs/qa/qa-report.md` (bagian B2.2 dan MySQL 8.4 lokal permanen).

## Proteksi spam

1. **Batas laju** per IP (di atas).
2. **Honeypot `homepage`.** Frontend B2 menambahkan input `homepage` yang tersembunyi dari manusia (di luar layar, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"`) dan mengirimnya kosong. Bot yang mengisi semua field mendapat `422` dengan `errors.homepage: ["The submission could not be accepted."]` dan tidak ada yang disimpan. Server tidak pernah berpura-pura menerima kiriman yang ditolak.
3. **Batas ukuran** body dan panjang field.

Keputusan yang menunggu deployment: CAPTCHA tanpa biaya (misalnya Cloudflare Turnstile) bila spam lolos dari tiga lapis di atas, rate limiting tambahan di CDN atau firewall, dan pemantauan volume. Tidak ada layanan pihak ketiga yang dipasang sekarang.

## Penyimpanan

Tabel `inquiries` di MySQL 8.4 (migrasi `backend/database/migrations/*_create_inquiries_table.php`, ditambah kolom idempotensi pada B2.1). InnoDB, `utf8mb4` dengan collation `utf8mb4_unicode_ci`, strict mode; tipe di bawah adalah hasil `SHOW CREATE TABLE` pada MySQL 8.4.11.

| Kolom | Tipe MySQL | Catatan |
|---|---|---|
| `id` | `bigint unsigned`, auto increment, primary key | Internal saja, tidak pernah dikirim ke klien |
| `public_id` | `varchar(18)`, `UNIQUE` | `INQ-XXXX-XXXX-XXXX`. Tabrakan menghasilkan galat 1062, yang memicu percobaan ulang (dites) |
| `idempotency_key_hash` | `char(64)` ASCII (`ascii_bin`), nullable, `UNIQUE` | SHA-256 dari `Idempotency-Key` (B2.1, migrasi `*_add_idempotency_key_hash_to_inquiries_table.php`); `NULL` tanpa kunci. Tidak pernah dikirim ke klien atau diserialisasi |
| `name` | `varchar(120)` | Batas dalam karakter, bukan byte (`utf8mb4`) |
| `organization` | `varchar(160)`, nullable | |
| `contact` | `varchar(254)` | Email atau telepon |
| `service`, `budget`, `timeline` | `varchar(32)` | Nilai enum (`app/Enums/`) |
| `message` | `text` (maksimal 65.535 byte) | 5000 karakter emoji (4 byte) = 20.000 byte, masih muat (dites) |
| `status` | `varchar(32)`, index, default `received` | `app/Enums/InquiryStatus.php`; status lain didefinisikan pada fase admin |
| `created_at`, `updated_at` | `timestamp`, nullable | Ditulis dalam zona waktu aplikasi (UTC) |

Strict mode membuat MySQL menolak nilai yang melebihi kolom alih-alih memotongnya diam-diam; penolakan itu menjadi `503` tanpa nomor referensi (dites).

Tidak ada alamat IP, user agent, atau data pelacakan yang disimpan.

## Privasi

Inquiry berisi data pribadi (nama, kontak, isi kebutuhan). Aturan yang berlaku sekarang:

- **Akses.** Tidak ada endpoint publik untuk membaca, mengubah, atau menghapus inquiry (dites: `GET`, `PUT`, `PATCH`, `DELETE` mengembalikan 404 atau 405 tanpa data). Hanya tim Solveit yang berwenang yang boleh membaca data, melalui panel admin terautentikasi yang akan dibangun nanti. Sampai panel itu ada, data hanya dibaca langsung dari database oleh pengelola server.
- **Minimalisasi.** Hanya field formulir yang disimpan. Tidak ada IP, user agent, cookie, atau sesi.
- **Log.** Inquiry yang tersimpan hanya mencatat nomor referensinya (`Inquiry received.` dengan `inquiry: INQ-...`). Percobaan ulang yang dijawab dari baris tersimpan mencatat `Inquiry retry answered with the stored reference.` dengan referensi yang sama, dan konflik kunci hanya `Inquiry idempotency key reused with different content.`, tanpa kunci, referensi, atau isi. Bila channel log gagal (misalnya `storage/logs` tidak dapat ditulis), inquiry yang sudah tersimpan tetap mendapat `201`, karena respons gagal akan membuat pengunjung mengirim ulang (dites). Nama, kontak, dan pesan tidak pernah masuk log. Kegagalan database dicatat sebagai `InquiryNotStoredException` dengan kode SQLSTATE saja, karena pesan `QueryException` asli memuat nilai SQL (data pribadi); dites. Coding agent tidak boleh mencetak isi inquiry, `.env`, atau log berisi data pribadi.
- **Alat agent.** Tool database Laravel Boost hanya dipakai pada database MySQL pengembangan atau tes milik proyek ini, tidak pernah pada data bersama atau produksi.
- **Database produksi.** MySQL 8.4 LTS (keputusan pemilik, B1.1); hosting belum dipilih. Saat deployment: akses jaringan hanya dari aplikasi, pengguna aplikasi tanpa hak DDL dan pengguna migrasi terpisah, kredensial di secret store hosting (bukan Git), TLS ke database bila server tidak berada di host yang sama (`MYSQL_ATTR_SSL_CA`), enkripsi saat diam bila tersedia, backup terenkripsi dengan akses terbatas, `APP_DEBUG=false`, `LOG_LEVEL` minimal `info`, document root `backend/public/`.

Keputusan yang masih menunggu persetujuan pemilik:

- Masa simpan inquiry dan jadwal penghapusan otomatis.
- Prosedur permintaan ekspor atau penghapusan data oleh orang yang mengirim inquiry (dan siapa yang menanganinya).
- Teks pemberitahuan privasi di formulir dan halaman kebijakan privasi. Belum ada kebijakan privasi resmi; dokumen ini bukan kebijakan privasi.
- Apakah dan bagaimana inquiry diteruskan ke Solveit OpsHub (event atau webhook berversi, lihat `docs/architecture/integration-plan.md`).

## Contoh

```bash
curl -i http://localhost:8000/api/v1/inquiries \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"name":"Rina Pratiwi","contact":"rina@example.com","service":"website","budget":"belum-tahu","timeline":"fleksibel","message":"Kami ingin website profil untuk usaha katering."}'
```
