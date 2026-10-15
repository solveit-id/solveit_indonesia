# `POST /api/v1/inquiries`

Menyimpan satu permintaan konsultasi dari formulir kontak website. Ini satu-satunya sumber kontrak inquiry; dokumen lain menautkan ke sini.

Implementasi: `backend/routes/api.php`, `app/Http/Requests/Api/V1/StoreInquiryRequest.php` (validasi), `app/Actions/SubmitInquiry.php` (penyimpanan), `app/Http/Resources/InquiryResource.php` (respons). Tes: `backend/tests/Feature/Http/Controllers/Api/V1/InquiryControllerTest.php`.

Frontend belum memanggil endpoint ini. Kanal `api` di `frontend/src/services/inquiry.ts` adalah tugas B2; sampai API di-deploy, formulir tetap menyusun pesan WhatsApp atau email.

## Permintaan

```http
POST /api/v1/inquiries
Content-Type: application/json
Accept: application/json
```

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

Satu perbedaan yang disengaja: frontend memakai `\s` (spasi apa pun) di pola telepon, server hanya menerima spasi biasa. Input formulir satu baris tidak dapat menghasilkan tab atau baris baru, jadi pengguna nyata tidak terdampak.

## Respons

### `201 Created`

Dikirim **hanya** setelah baris tersimpan di database.

```json
{ "id": "INQ-7K3M-9QX2-HD4T", "status": "received" }
```

- `id` adalah nomor referensi publik: `INQ-` lalu 12 karakter acak Crockford base32 (tanpa `I`, `L`, `O`, `U`, sehingga aman dibacakan) dalam tiga kelompok. 60 bit acak dari `random_int`, kolom `UNIQUE` di database, dan hingga tiga percobaan bila terjadi tabrakan. Tidak berurutan dan tidak menyingkap ID internal.
- `status` selalu `received` untuk inquiry baru.

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

Pesan dalam bahasa Inggris (bawaan Laravel). Frontend menampilkan pesannya sendiri per field dalam bahasa halaman; teks server cukup sebagai cadangan. Tidak ada yang disimpan saat validasi gagal.

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

## Proteksi spam

1. **Batas laju** per IP (di atas).
2. **Honeypot `homepage`.** Frontend B2 menambahkan input `homepage` yang tersembunyi dari manusia (di luar layar, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"`) dan mengirimnya kosong. Bot yang mengisi semua field mendapat `422` dengan `errors.homepage: ["The submission could not be accepted."]` dan tidak ada yang disimpan. Server tidak pernah berpura-pura menerima kiriman yang ditolak.
3. **Batas ukuran** body dan panjang field.

Keputusan yang menunggu deployment: CAPTCHA tanpa biaya (misalnya Cloudflare Turnstile) bila spam lolos dari tiga lapis di atas, rate limiting tambahan di CDN atau firewall, dan pemantauan volume. Tidak ada layanan pihak ketiga yang dipasang sekarang.

## Penyimpanan

Tabel `inquiries` di MySQL 8.4 (migrasi `backend/database/migrations/*_create_inquiries_table.php`, tidak berubah pada B1.1). InnoDB, `utf8mb4` dengan collation `utf8mb4_unicode_ci`, strict mode; tipe di bawah adalah hasil `SHOW CREATE TABLE` pada MySQL 8.4.11.

| Kolom | Tipe MySQL | Catatan |
|---|---|---|
| `id` | `bigint unsigned`, auto increment, primary key | Internal saja, tidak pernah dikirim ke klien |
| `public_id` | `varchar(18)`, `UNIQUE` | `INQ-XXXX-XXXX-XXXX`. Tabrakan menghasilkan galat 1062, yang memicu percobaan ulang (dites) |
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
- **Log.** Inquiry yang tersimpan hanya mencatat nomor referensinya (`Inquiry received.` dengan `inquiry: INQ-...`). Bila channel log gagal (misalnya `storage/logs` tidak dapat ditulis), inquiry yang sudah tersimpan tetap mendapat `201`, karena respons gagal akan membuat pengunjung mengirim ulang (dites). Nama, kontak, dan pesan tidak pernah masuk log. Kegagalan database dicatat sebagai `InquiryNotStoredException` dengan kode SQLSTATE saja, karena pesan `QueryException` asli memuat nilai SQL (data pribadi); dites. Coding agent tidak boleh mencetak isi inquiry, `.env`, atau log berisi data pribadi.
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
