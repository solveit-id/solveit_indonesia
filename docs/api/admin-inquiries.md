# Admin API: pengelolaan inquiry (B4a)

Kontrak endpoint inquiry di `/api/v1/admin` yang dibangun pada B4a: daftar dan detail inquiry dengan kontak disamarkan, alur status dengan riwayat, catatan internal, dan pembukaan kontak lengkap yang dicatat. Status: **dibangun, dites, dan dirilis ke `main` (PR #46, rilis PR #47, merge `58cead5`), belum di-deploy**. Konsol admin belum memanggilnya (B4b, sedang dibangun di branch `admin`). Kanal website yang mengirim inquiry tetap nonaktif secara default (`VITE_INQUIRY_API_ENABLED=false`), jadi belum ada inquiry nyata di mana pun.

Konvensi B3.1a tetap berlaku tanpa perubahan (satu origin `ADMIN_URL`, sesi cookie database, CSRF, `Cache-Control: no-store, private`, `401` tanpa sesi): `admin-auth.md`. Cursor pagination, penolakan parameter yang tidak dikenal, dan format `409` dengan `code` sama dengan `admin-users.md`. Data inquiry dan endpoint publiknya: `inquiries.md`. Arsitektur: `docs/architecture/admin-dashboard.md` bagian 4 dan 6.

Implementasi: `backend/routes/admin.php`, `app/Http/Controllers/Api/V1/Admin/{InquiryController,InquiryNoteController}.php`, `app/Actions/Admin/{ChangeInquiryStatus,AddInquiryNote,RevealInquiryContact,InquiryHandler}.php`, `app/Enums/InquiryStatus.php`, `app/Models/{Inquiry,InquiryStatusChange,InquiryNote}.php`. Tes: `backend/tests/Feature/Admin/` (`AdminInquiryManagementTest`, `AdminInquiryContactTest`, `AdminInquiryConcurrencyTest`), `tests/Feature/Models/InquiryRecordsTest.php`, `tests/Unit/Models/InquiryTest.php`, `tests/Unit/Enums/InquiryStatusTest.php`.

## Yang belum diputuskan dan tidak dibangun

Keputusan privasi inquiry masih milik pemilik dan **tidak dianggap disetujui** oleh B4a: masa simpan dan penghapusan otomatis, prosedur ekspor atau penghapusan atas permintaan pengirim, teks pemberitahuan privasi, aktivasi kanal publik, dan penerusan ke Solveit OpsHub. Karena itu tidak ada endpoint ekspor, penghapusan, atau penerusan, dan tidak ada yang memangkas data. Siapa yang menangani inquiry juga belum diputuskan; pembagian izin di bawah mengikuti rencana arsitektur dan dapat dipersempit dengan mengubah satu daftar (`AdminRole::permissions()`).

## Izin dan peran

| Izin | owner | admin | Route |
|---|---|---|---|
| `inquiries.view` | Ya | Ya | `GET inquiries`, `GET inquiries/{id}`, `GET inquiries/{id}/status-changes`, `GET inquiries/{id}/notes` |
| `inquiries.change-status` | Ya | Ya | `PUT inquiries/{id}/status` |
| `inquiries.add-note` | Ya | Ya | `POST inquiries/{id}/notes` |
| `inquiries.reveal-contact` | Ya | Ya | `POST inquiries/{id}/contact-reveal` |

- Setiap route meminta tepat satu izin (`can:`). Tanpa izin: `403 {"message":"This action is unauthorized."}`, diperiksa **sebelum** inquiry dicari, sehingga jawabannya sama untuk ID yang ada dan tidak ada.
- `GET me` kini melaporkan keempat izin ini untuk kedua peran. Peran tetap hanya `owner` dan `admin`; izin owner B3.1b tidak berubah dan tetap tidak dimiliki `admin`.
- **Pemeriksaan ulang di dalam transaksi.** Setiap penulisan (status, catatan, pembukaan kontak) membaca ulang akun pelaku dengan kunci bersama di dalam transaksinya dan memeriksa izinnya lagi. Penangguhan atau perubahan peran yang sudah commit di antara otorisasi route dan penulisan membuat penulisan itu ditolak (`403`) tanpa menulis apa pun. Diuji dengan proses PHP terpisah: tidak ada penulisan yang tercatat setelah penangguhan pelakunya.
- **Batas laju** (per akun, selain batas umum 120 per menit): `admin-inquiry-write` 60 per menit untuk status dan catatan; `admin-inquiry-contact` 10 per menit **dan** 60 per jam untuk pembukaan kontak. `429` dengan `Retry-After`. Baca tidak punya batas tambahan.

## Identitas

`{id}` adalah ID internal inquiry (angka), sama seperti akun dan undangan; ID ini tidak pernah dikirim ke website publik. Setiap respons juga membawa `reference`, nomor referensi publik `INQ-XXXX-XXXX-XXXX` yang diketahui pengirim. Inquiry yang tidak ada: `404 {"message":"Inquiry not found."}`.

## Penyamaran kontak

Kontak **selalu disamarkan** di daftar, detail, dan respons penulisan:

```json
{ "type": "email", "masked": "r•••@e•••.com" }
{ "type": "phone", "masked": "+•••••••358" }
```

- `type` adalah `email` (mengandung `@`) atau `phone`, dua bentuk yang diterima website (`inquiries.md`, Format kontak).
- Email: karakter pertama nama dan domain, lalu domain tingkat atas. Telepon: `+` bila ada, lalu tiga angka terakhir, hanya bila nomornya punya setidaknya delapan angka (selain itu tidak ada angka yang tampil).
- Panjang penanda selalu sama, jadi samaran tidak membocorkan panjang kontak.
- Kolom `contact` juga tersembunyi dari serialisasi model (`#[Hidden]`), sehingga kode yang mengembalikan model apa adanya tidak dapat membocorkannya.
- **Batas:** penyamaran hanya berlaku untuk field `contact`. Nama, organisasi, dan pesan tampil utuh di detail karena dibutuhkan untuk menindaklanjuti; pengirim dapat saja menulis nomor atau email di dalam pesannya.

## Daftar

### `GET inquiries`

Terbaru dulu (`id` turun), cursor pagination (`per_page` 1 sampai 100, bawaan 25). Filter, masing-masing pada kolom berindeks:

| Parameter | Nilai | Index |
|---|---|---|
| `status` | `received`, `in-review`, `contacted`, `closed` | `inquiries_status_index` |
| `service` | Nilai `InquiryService` (`website`, `aplikasi-web`, `sistem-informasi`, `custom-software`, `dukungan-teknis`) | `inquiries_service_index` (B4a) |
| `received_from`, `received_to` | Tanggal ISO 8601, inklusif; `received_to` tidak sebelum `received_from`. Tanggal tanpa jam berarti tengah malam UTC; konsol mengirim batas hari lokal dengan offset | `inquiries_created_at_index` (B4a) |
| `reference` | Persis `INQ-XXXX-XXXX-XXXX` (huruf besar, alfabet Crockford) | `inquiries_public_id_unique` |

Tidak ada pencarian bebas atas nama, kontak, pesan, atau catatan; parameter lain (`q`, `contact`, `sort`, ...) ditolak `422`, begitu juga nilai yang tidak dikenal dan cursor yang rusak atau dimanipulasi. Tes memeriksa rencana `EXPLAIN` dari SQL yang benar-benar dijalankan endpoint: setiap filter dapat memakai index-nya.

```json
{
  "data": [
    {
      "id": 42,
      "reference": "INQ-7K3M-9QX2-HD4T",
      "status": "received",
      "name": "Rina Pratiwi",
      "organization": "Toko Sinar Jaya",
      "contact": { "type": "email", "masked": "r•••@e•••.com" },
      "service": "sistem-informasi",
      "budget": "10-50jt",
      "timeline": "1-3-bulan",
      "received_at": "2026-10-19T03:12:45+00:00",
      "updated_at": "2026-10-19T03:12:45+00:00"
    }
  ],
  "links": { "first": null, "last": null, "prev": null, "next": "..." },
  "meta": { "path": "...", "per_page": 25, "next_cursor": "eyJ...", "prev_cursor": null }
}
```

Daftar tidak memuat `message` (hanya detail) dan tidak pernah memuat kontak lengkap atau hash `Idempotency-Key`.

## Detail

### `GET inquiries/{id}`

Field daftar, ditambah:

```json
{
  "message": "Kami butuh sistem stok untuk tiga cabang toko.",
  "allowed_transitions": ["in-review", "contacted", "closed"],
  "notes_count": 0,
  "status_changes_count": 0
}
```

Riwayat status dan catatan dibaca per halaman lewat endpoint masing-masing. Membaca detail tidak dicatat di audit log (lihat Keputusan yang tertunda).

## Alur status

| Status | Arti | Boleh pindah ke |
|---|---|---|
| `received` | Baru, belum ada yang menangani | `in-review`, `contacted`, `closed` |
| `in-review` | Sedang ditinjau tim | `contacted`, `closed` |
| `contacted` | Tim sudah menghubungi pengirim | `in-review`, `closed` |
| `closed` | Selesai (dijawab, tidak cocok, atau spam); dapat dibuka lagi | `in-review` |

Tidak ada yang kembali ke `received`: inquiry yang sudah disentuh tidak lagi baru. Nilai ini berasal dari usulan teknis B4a (rencana arsitektur menyebut `in_review`, `contacted`, `closed` sebagai contoh; ejaan mengikuti nilai enum proyek yang memakai tanda hubung). Pemilik menyetujui keempat nilai ini untuk B4b (brief B4b, 2026-10-19); transisinya tetap aturan backend di atas (`InquiryStatus::allowedTransitions()`), dan konsol membaca transisi yang berlaku dari `allowed_transitions`, tidak menyalinnya.

**Status internal, tidak publik.** Respons `POST /api/v1/inquiries`, termasuk percobaan ulang idempoten, **selalu** `"status": "received"`, apa pun status alurnya sekarang (`InquiryResource`). Status alur tidak pernah bocor ke pemegang `Idempotency-Key`, dan website B2.2 tetap membaca replay sebagai sukses (dites).

### `PUT inquiries/{id}/status`

```json
{ "status": "contacted", "expected_status": "in-review" }
```

`expected_status` wajib: status yang dibaca pemanggil sebelum memutuskan. Perubahan adalah *compare and set* di bawah kunci baris (`SELECT ... FOR UPDATE`), sehingga dua orang yang bertindak bersamaan tidak saling menimpa tanpa tahu.

| Situasi | Hasil |
|---|---|
| Status sekarang = `expected_status`, transisi diizinkan | `200` dengan detail; satu baris riwayat dan satu kejadian audit, dalam satu transaksi |
| Status sekarang sudah = `status` (juga bila orang lain yang mengubahnya) | `200` tanpa perubahan, tanpa riwayat, tanpa audit. Mengulang perubahan yang ternyata berhasil aman |
| Status sekarang ≠ `expected_status` | `409 {"message":"The inquiry status has changed since it was read. Read it again before changing it.","code":"status_changed"}`, tidak ada yang ditulis |
| Transisi tidak diizinkan dari status sekarang | `409 {"message":"The inquiry cannot move from its current status to the requested one.","code":"transition_not_allowed"}` |
| Nilai kosong, tidak dikenal, label, atau bukan string | `422` |

Field lain di body diabaikan (`name`, `contact`, `public_id`, `changed_by_user_id`, ...): pelaku selalu akun sesi, dan field kiriman pengunjung tidak dapat diubah lewat endpoint apa pun.

### `GET inquiries/{id}/status-changes`

Riwayat, terbaru dulu, cursor pagination tanpa filter:

```json
{
  "id": 7,
  "from_status": "received",
  "to_status": "in-review",
  "changed_by": { "user_id": 3, "name": "Nama Admin" },
  "changed_at": "2026-10-19T04:02:11+00:00"
}
```

Pelaku disebut dengan ID akun dan nama tampilan, tidak pernah alamat email.

## Catatan internal

Catatan hanya untuk tim; tidak pernah dikirim ke pengirim inquiry. **Hanya-tambah:** tidak ada endpoint untuk mengubah atau menghapus catatan; koreksi ditulis sebagai catatan baru.

### `POST inquiries/{id}/notes`

```json
{ "body": "Rina minta ditelepon setelah jam 16.00." }
```

`body` wajib, string, 1 sampai 2000 karakter Unicode setelah spasi di awal dan akhir dibuang. `201`:

```json
{ "data": { "id": 12, "body": "...", "author": { "user_id": 3, "name": "Nama Admin" }, "created_at": "..." } }
```

Catatan dan kejadian auditnya commit bersama. Audit hanya membawa `note_id`, **tidak pernah isi catatan**. Bila database menolak catatan: `503 {"message":"The note could not be saved. Read the notes again before retrying."}`; galat dilaporkan dengan SQLSTATE saja, tanpa isi catatan (pesan `QueryException` asli memuat nilai SQL dan tidak dirantai). Tidak ada kunci idempotensi untuk catatan: setelah hasil yang tidak pasti (jaringan, `5xx`), baca ulang daftar catatan sebelum mengirim lagi.

### `GET inquiries/{id}/notes`

Terbaru dulu, cursor pagination tanpa filter, bentuk seperti di atas.

## Kontak lengkap

### `POST inquiries/{id}/contact-reveal`

```json
{ "acknowledge_personal_data": true }
```

Membuka kontak lengkap adalah akses data pribadi, jadi harus **disengaja, terotorisasi, dan tercatat**:

- **Disengaja:** `POST` (bukan `GET`, sehingga tidak dapat dipicu prefetch, cache, atau tautan), dengan persetujuan eksplisit di body. Tanpa itu: `422` dengan pesan `Confirm that opening the full contact is recorded in the audit log.`
- **Terotorisasi:** izin `inquiries.reveal-contact`, lalu konfirmasi kata sandi dalam 15 menit terakhir (`POST auth/confirm-password`; tanpa itu `423 {"message":"Password confirmation required."}`). Batas `admin-inquiry-contact` dijalankan Laravel sebelum pemeriksaan izin (prioritas middleware `ThrottleRequests` di atas `Authorize`), jadi setiap percobaan, termasuk yang ditolak `403` atau `423`, ikut dihitung.
- **Tercatat, sebelum ditampilkan:** kejadian `inquiry.contact-revealed` (pelaku, inquiry, IP, user agent; metadata kosong) ditulis dan di-commit **lebih dulu**. Bila kejadian itu gagal ditulis, responsnya `500 {"message":"Server Error"}` tanpa kontak. Setiap pembukaan dicatat terpisah, juga bila orang yang sama membuka kontak yang sama lagi.

`200`:

```json
{
  "data": {
    "id": 42,
    "reference": "INQ-7K3M-9QX2-HD4T",
    "contact": { "type": "email", "value": "rina@example.com" },
    "revealed_at": "2026-10-19T04:05:00.123456+00:00"
  }
}
```

`revealed_at` sama dengan `occurred_at` kejadian audit. Respons `no-store, private` seperti semua respons admin; konsol (B4b) sebaiknya menyimpan kontak itu hanya di memori komponen, tidak di penyimpanan browser, alamat, atau log.

## Audit

Kejadian baru di `admin_audit_events` (hanya-tambah, `docs/architecture/admin-dashboard.md` 6.2), dengan `subject` `{"type":"inquiry","id":<id inquiry>}`:

| `action` | Metadata |
|---|---|
| `inquiry.contact-revealed` | Tidak ada |
| `inquiry.status-changed` | `from_status`, `to_status` |
| `inquiry.note-added` | `note_id` |

Owner membacanya lewat `GET audit-events` dengan filter baru `subject_inquiry_id` (tidak boleh digabung dengan `subject_user_id`: `422`), lihat `admin-users.md`. Tidak ada nama, kontak, pesan, atau isi catatan di audit log atau di log aplikasi (dites di setiap endpoint B4a untuk kedua peran).

## Jaminan di database

Berlaku untuk setiap pengguna database, bukan hanya aplikasi:

- **Kiriman pengunjung tidak dapat diubah.** Trigger `inquiries_keep_submission` (`BEFORE UPDATE`) menolak perubahan pada `name`, `organization`, `contact`, `service`, `budget`, `timeline`, `message`, `public_id`, `idempotency_key_hash`, dan `created_at`, dibandingkan secara biner (perubahan huruf besar dan kecil juga ditolak, walau collation tabel tidak membedakannya). Model `Inquiry` menolak hal yang sama sebelum query dikirim. Hanya `status` dan `updated_at` yang dapat berubah. Ini menjaga idempotensi B2.1, yang membandingkan percobaan ulang dengan kolom-kolom itu.
- **Riwayat dan catatan hanya-tambah.** Trigger `BEFORE UPDATE` dan `BEFORE DELETE` pada `inquiry_status_changes` dan `inquiry_notes`, ditambah penjaga model.
- **Menghapus inquiry menghapus semuanya.** Foreign key `ON DELETE CASCADE`; MySQL tidak menjalankan trigger untuk aksi foreign key, sehingga penghapusan inquiry (bila retensi atau permintaan penghapusan suatu saat diputuskan) ikut menghapus riwayat dan catatannya, sementara penghapusan langsung atas baris riwayat atau catatan tetap ditolak. Kejadian audit tidak ikut terhapus dan tidak memuat data pribadi inquiry.
- **Penulis tidak dapat dihapus.** `changed_by_user_id` dan `author_user_id` adalah foreign key ke `users` tanpa cascade (akun memang tidak pernah dihapus).
- **Batas jaminan** sama dengan audit log: pemegang hak DDL (pengguna migrasi, root) dapat `DROP TRIGGER` atau `TRUNCATE`. Pengguna aplikasi produksi hanya punya DML.

## Konkurensi

Diuji dengan proses PHP dan koneksi MySQL terpisah yang dilepas bersamaan (`AdminInquiryConcurrencyTest`, tiga putaran per skenario):

- Enam perubahan status dari bacaan `received` yang sama: tepat satu berubah; yang lain `409 status_changed` atau `200` tanpa perubahan bila targetnya sama; tepat satu baris riwayat dan satu kejadian audit.
- Enam catatan bersamaan: keenamnya tersimpan, masing-masing dengan satu kejadian audit.
- Penangguhan pelaku bersamaan dengan perubahan status, catatan, dan pembukaan kontaknya: setiap penulisan yang berhasil tercatat sebelum penangguhan; sisanya ditolak tanpa menulis apa pun.

Uji mutasi: tanpa kunci baris, keenam perubahan status "berhasil" (pembaruan yang hilang); tanpa kunci bersama pada akun pelaku, perubahan status tercatat setelah penangguhan; tanpa pemeriksaan ulang, akun yang ditangguhkan setelah otorisasi tetap menulis.

## Keputusan yang tertunda (pemilik)

- Masa simpan inquiry, catatan, dan riwayat; penghapusan otomatis; prosedur ekspor dan penghapusan atas permintaan subjek data (UU PDP) dan siapa yang menanganinya. Sampai itu diputuskan, tidak ada yang dihapus atau diekspor. Catatan yang keliru tidak dapat dihapus satu per satu.
- Siapa yang menangani inquiry: kedua peran memegang keempat izin (rencana arsitektur). Mempersempitnya cukup dengan mengubah `AdminRole::permissions()`.
- Apakah membaca daftar atau detail inquiry juga dicatat di audit log (sekarang hanya pembukaan kontak lengkap dan penulisan), bersama keputusan terbuka tentang pencatatan pembacaan audit.
- Batas laju pembukaan kontak (10 per menit, 60 per jam per akun): default teknis.

## Yang tidak ada

Endpoint publik untuk inquiry, ekspor (CSV atau lainnya), penghapusan inquiry, catatan, atau riwayat, pengubahan field kiriman pengunjung, pencarian teks bebas, penugasan inquiry ke orang tertentu, notifikasi atau email, penerusan ke Solveit OpsHub, dan antarmuka konsol (B4b).
