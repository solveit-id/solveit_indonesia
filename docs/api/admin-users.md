# Admin API: administrasi pengguna dan audit (B3.1b)

Kontrak endpoint owner di `/api/v1/admin` yang dibangun pada B3.1b: daftar dan detail akun admin, undangan, perubahan peran, penangguhan dan aktivasi ulang, reset kredensial oleh owner, dan pembacaan audit log. Status: **dibangun dan dites, belum di-deploy**. Konsol admin memanggilnya sejak B3.2c (ruang kerja owner di branch `admin`, menunggu tinjauan pemilik; `admin/README.md`, Ruang kerja owner); belum ada akun produksi, dan retensi audit masih menunggu keputusan pemilik.

Konvensi B3.1a tetap berlaku tanpa perubahan (satu origin `ADMIN_URL`, sesi cookie database, CSRF, `Cache-Control: no-store, private`, `401` tanpa sesi): `admin-auth.md`. Arsitektur dan keputusan: `docs/architecture/admin-dashboard.md` bagian 4 dan 6. Implementasi: `backend/routes/admin.php`, `app/Http/Controllers/Api/V1/Admin/{UserController,InvitationController,AuditEventController}.php`, `app/Actions/Admin/{InviteAdminAccount,RevokeAdminInvitation,ChangeAdminRole,SuspendAdminAccount,ResetAdminCredentials,ActiveOwners}.php`. Tes: `backend/tests/Feature/Admin/` (`AdminUserAdministrationTest`, `AdminInvitationTest`, `AdminCredentialRecoveryTest`, `AdminAuditReaderTest`, `AdminAdministrationConcurrencyTest`).

## Keputusan pemilik (disetujui 2026-10-16)

1. Undangan **tidak dikirim lewat email**. Tautan mentah hanya muncul sekali, di respons kepada owner yang menerbitkannya, dan owner itu menyerahkannya sendiri lewat kanal tepercaya.
2. Hanya peran `owner` yang membaca seluruh audit log.
3. Masa berlaku tautan undangan **48 jam**; tautan reset kredensial yang diterbitkan owner **24 jam**. Tautan dari shell (`admin:bootstrap-owner`, `admin:reset-credentials`) tetap 30 menit.
4. Retensi audit belum diputuskan: tidak ada penghapusan, pemangkasan, atau ekspor.

## Izin dan peran

| Izin | owner | admin | Route |
|---|---|---|---|
| `account.manage-own` | Ya | Ya | Route akun sendiri (`admin-auth.md`) |
| `users.view` | Ya | Tidak | `GET users`, `GET users/{id}`, `GET invitations`, `GET invitations/{id}` |
| `users.invite` | Ya | Tidak | `POST invitations`, `DELETE invitations/{id}` |
| `users.change-role` | Ya | Tidak | `PUT users/{id}/role` |
| `users.suspend` | Ya | Tidak | `POST users/{id}/suspension`, `DELETE users/{id}/suspension` |
| `users.reset-credentials` | Ya | Tidak | `POST users/{id}/credential-reset` |
| `audit.view-all` | Ya | Tidak | `GET audit-events` |

- Setiap route meminta tepat satu izin (`can:`); izin yang tidak didefinisikan ditolak untuk semua orang. Peran tetap hanya `owner` dan `admin`; tidak ada registrasi publik.
- Tanpa izin: `403 {"message":"This action is unauthorized."}`, diperiksa **sebelum** akun atau undangan dicari, sehingga `admin` mendapat jawaban yang sama untuk ID yang ada dan tidak ada.
- **Setiap penulisan** (undangan, pencabutan, peran, penangguhan, aktivasi ulang, reset) juga butuh konfirmasi kata sandi dalam 15 menit terakhir (`POST auth/confirm-password`), diperiksa setelah izin: tanpa itu `423 {"message":"Password confirmation required."}`. Penulisan dibatasi 20 per menit per akun (`admin-administration`, `429` dengan `Retry-After`), selain batas umum 120 per menit.
- **Owner aktif** berarti owner yang dapat masuk: sudah aktif, tidak ditangguhkan, dan autentikatornya terkonfirmasi. Setiap operasi mengunci baris owner aktif di MySQL dan memeriksa ulang bahwa pelaku masih owner aktif saat itu (bukan saat request diotorisasi); bila tidak, `403`. Owner yang sedang direset atau ditangguhkan tidak dihitung, sehingga dua owner yang saling menurunkan, menangguhkan, atau mereset pada waktu bersamaan tidak dapat sama-sama berhasil.

## Galat

Selain galat umum (`admin-auth.md`), konflik keadaan dijawab `409` dengan kode yang stabil:

```json
{ "message": "At least one active owner must remain.", "code": "last_active_owner" }
```

| `code` | Arti |
|---|---|
| `own_account` | Mengubah peran, menangguhkan, mengaktifkan ulang, atau mereset akun sendiri |
| `last_active_owner` | Tindakan akan meninggalkan nol owner aktif |
| `not_activated` | Akun belum aktif (perubahan peran, reset: pakai undangan) |
| `suspended` | Akun ditangguhkan (reset, undangan: aktifkan ulang dulu) |
| `not_admin_account` | Alamat milik baris pengguna tanpa peran |
| `account_exists` | Alamat sudah dipakai akun yang aktif (termasuk yang sedang reset) |
| `invitation_pending` | Akun tertunda itu masih punya undangan hidup; cabut dulu |
| `invitation_completed` | Undangan sudah diterima dan tidak dapat dicabut |

Akun atau undangan yang tidak ditemukan: `404 {"message":"Account not found."}` atau `404 {"message":"Invitation not found."}`. Baris pengguna tanpa peran tidak pernah terlihat di sini. Galat tak terduga: `500 {"message":"Server Error"}` tanpa detail; tindakan yang gagal di tengah jalan (termasuk gagal menulis audit) dibatalkan seluruhnya dan tidak pernah mengembalikan tautan.

## Daftar dan pagination

`GET users`, `GET invitations`, dan `GET audit-events` memakai **cursor pagination** dari Laravel:

```json
{
  "data": [ ... ],
  "links": { "first": null, "last": null, "prev": null, "next": "http://.../api/v1/admin/users?per_page=25&cursor=eyJ..." },
  "meta": { "path": "...", "per_page": 25, "next_cursor": "eyJ...", "prev_cursor": null }
}
```

- `per_page` 1 sampai 100, bawaan 25. `cursor` adalah nilai `meta.next_cursor` atau `prev_cursor` apa adanya; cursor yang rusak atau dimanipulasi: `422`.
- Urutan hanya `id`: pengguna naik, undangan dan audit turun (terbaru dulu). `id` unik dan bertambah, jadi halaman deterministik dan kejadian baru tidak menggeser halaman berikutnya.
- Parameter query yang tidak dikenal ditolak (`422`, misalnya `sort`, `order`, `metadata`), sehingga filter yang salah eja tidak diam-diam mengembalikan semuanya. Filter ikut terbawa di link `next` dan `prev`.

## Akun

### `GET users`

Filter: `role` (`owner`, `admin`), `status` (`pending`, `active`, `credential-reset-pending`, `suspended`).

```json
{
  "id": 2,
  "name": "Nama Admin",
  "email": "admin@example.com",
  "role": "admin",
  "status": "active",
  "is_current_user": false,
  "two_factor_confirmed": true,
  "activated_at": "2026-10-16T05:31:00+00:00",
  "suspended_at": null,
  "last_login_at": "2026-10-16T06:02:00+00:00",
  "created_at": "2026-10-16T05:20:00+00:00"
}
```

`status` diturunkan dari kolom akun: `suspended` bila ditangguhkan; selain itu `pending` bila belum aktif (undangan atau bootstrap), `credential-reset-pending` bila reset belum diselesaikan (autentikator dihapus), `active` bila dapat masuk. Tidak pernah ada hash kata sandi, rahasia TOTP, kode pemulihan, remember token, atau ID sesi.

### `GET users/{id}`

Field daftar, ditambah:

```json
{
  "active_sessions": 1,
  "open_access_link": {
    "id": 7, "purpose": "credential-reset", "status": "pending", "issued_by_user_id": 1,
    "created_at": "...", "expires_at": "...", "redeemed_at": null
  }
}
```

`active_sessions` hanya jumlah sesi dalam batas idle (tanpa ID, IP, atau perangkat; daftar sesi tetap hanya untuk pemiliknya, `GET me/sessions`). `open_access_link` adalah tautan yang belum selesai dan belum dicabut, hanya metadata, atau `null`.

### `PUT users/{id}/role`

`{ "role": "owner" }` atau `{ "role": "admin" }` → `200` dengan detail akun. Semua sesi akun itu berakhir seketika, sehingga peran baru berlaku pada request berikutnya. Peran yang sama: `200` tanpa perubahan dan tanpa audit. Ditolak: akun sendiri (`own_account`), akun belum aktif (`not_activated`), owner aktif terakhir (`last_active_owner`).

### `POST users/{id}/suspension` dan `DELETE users/{id}/suspension`

Menangguhkan: `200`, semua sesi berakhir, tautan yang masih terbuka (undangan atau reset) dicabut, masuk ditolak. Mengaktifkan ulang: `200`, **tidak** membuat sesi; orang itu masuk lagi dengan kata sandi dan TOTP. Tautan yang dicabut saat penangguhan tidak hidup lagi: owner menerbitkan yang baru bila perlu. Keduanya idempoten (keadaan yang sama: `200` tanpa audit). Ditolak untuk akun sendiri dan owner aktif terakhir.

### `POST users/{id}/credential-reset`

```json
{ "acknowledge_access_loss": true }
```

Wajib: reset **langsung** menghapus autentikator dan kode pemulihan akun itu dan mengakhiri semua sesinya, jadi akun tidak dapat masuk sampai tautan diselesaikan. Tanpa persetujuan itu: `422` dengan pesan `Confirm that the account loses access until the reset link is completed.`

`201`:

```json
{
  "data": {
    "account": { "...": "detail akun, status credential-reset-pending" },
    "access_link": { "id": 7, "purpose": "credential-reset", "url": "ADMIN_URL/access#token=<43 karakter>", "expires_at": "..." }
  }
}
```

- Penebusan memakai alur B3.1a (`access-links/inspect`, `redeem`, `confirm`): kata sandi baru **dan** autentikator baru. Kata sandi lama tidak berguna lagi, dan tidak ada jalan masuk dengan satu faktor. Tidak ada reset "hanya kata sandi" atau "hanya MFA".
- **Tautan hilang, tidak sampai, kedaluwarsa, atau ditinggal setengah jalan:** akun tetap terkunci (aman), dan owner menerbitkan reset lagi untuk akun yang sama. Tautan lama, termasuk pendaftaran yang sudah ditebus tetapi belum dikonfirmasi, berhenti bekerja.
- Ditolak: akun sendiri (`own_account`; ganti kata sandi atau kode pemulihan di pengaturan akun), akun belum aktif (`not_activated`; pakai undangan), akun ditangguhkan (`suspended`). Pemulihan darurat tanpa owner aktif tetap lewat shell: `php artisan admin:reset-credentials <email>`.

## Undangan

Undangan adalah tautan akses `activation` (B3.1a) untuk akun baru atau akun tertunda: token 256 bit acak di fragmen URL (bukan query string), disimpan hanya sebagai SHA-256, sekali pakai, kedaluwarsa 48 jam, dapat dicabut. Akun tidak dapat masuk sebelum orangnya menetapkan kata sandi dan mengonfirmasi kode TOTP pertama. Tidak ada email yang dikirim.

### `POST invitations`

```json
{ "email": "calon.admin@example.com", "role": "admin" }
```

Alamat dinormalkan (huruf kecil, tanpa spasi), maksimal 254 karakter, sintaks RFC (tanpa pengecekan DNS). Field lain (nama, kata sandi, status) diabaikan: nama ditetapkan oleh orang yang diundang saat menerima.

`201`, **satu-satunya** saat tautan terlihat:

```json
{
  "data": {
    "invitation": { "...": "seperti GET invitations/{id}" },
    "access_link": { "url": "ADMIN_URL/access#token=<43 karakter>", "expires_at": "2026-10-18T07:00:00+00:00" }
  }
}
```

| Alamat milik | Hasil |
|---|---|
| Tidak ada akun | Akun baru (tertunda, kata sandi acak yang tidak diketahui siapa pun) dan undangan |
| Akun tertunda tanpa undangan hidup | Undangan baru untuk akun yang sama (tidak ada duplikat); peran disetel ke yang diminta |
| Akun tertunda dengan undangan hidup | `409 invitation_pending`: cabut dulu, lalu undang lagi |
| Akun aktif atau sedang reset | `409 account_exists` |
| Akun ditangguhkan | `409 suspended` |
| Baris tanpa peran | `409 not_admin_account` |

Undangan **hidup** berarti belum dipakai dan belum kedaluwarsa, atau sudah ditebus dan masih dalam jendela 15 menit untuk kode pertama. Undangan yang kedaluwarsa atau ditinggal setelah jendela itu tidak menghalangi undangan baru, dan undangan baru mencabutnya.

**Konkurensi.** Pemeriksaan dan penerbitan berjalan dalam satu transaksi di bawah kunci owner aktif, kunci baris akun, dan pembacaan terkunci atas undangan akun itu. Dua undangan bersamaan untuk alamat baru diputuskan oleh index `UNIQUE` pada `users.email`; percobaan yang kalah diulang dan menjawab dari akun yang ditemukan. Di bawah semua itu MySQL sendiri menegakkan **satu tautan terbuka per akun**: kolom tergenerasi `admin_access_links.open_for_user_id` berisi ID akun selama tautan belum selesai dan belum dicabut, dengan index `UNIQUE`. Deadlock InnoDB antara dua owner diulang otomatis (maksimal tiga kali). Diuji dengan proses PHP dan koneksi MySQL terpisah.

### `GET invitations` dan `GET invitations/{id}`

Filter: `status` (`pending`, `redeemed`, `completed`, `expired`, `revoked`). Hanya tautan `activation`; tautan reset tidak terlihat di sini (lihat `open_access_link` di detail akun).

```json
{
  "id": 9,
  "status": "pending",
  "account": { "id": 4, "email": "calon.admin@example.com", "role": "admin", "status": "pending" },
  "issued_by_user_id": 1,
  "created_at": "...", "expires_at": "...", "redeemed_at": null, "completed_at": null, "revoked_at": null
}
```

`issued_by_user_id` `null` berarti diterbitkan dari shell (bootstrap). Token, hash, dan URL tidak pernah ada di daftar, detail, audit, atau log.

### `DELETE invitations/{id}`

`200` dengan undangan berstatus `revoked`. Tautan berhenti seketika, termasuk pendaftaran yang sudah ditebus (konfirmasinya ditolak). Akun tertunda tetap ada, tidak dapat masuk, dan dapat diundang lagi. Mencabut lagi: `200` tanpa perubahan dan tanpa audit. Undangan yang sudah diterima: `409 invitation_completed`. Tautan reset: `404`.

## Audit log (owner saja)

### `GET audit-events`

Hanya baca. Tidak ada endpoint yang mengubah, menghapus, memangkas, atau mengekspor kejadian (`POST`, `PUT`, `PATCH`, `DELETE` pada path ini: `405`; `audit-events/{id}` dan `audit-events/export` tidak ada).

Filter (masing-masing memakai kolom berindeks; tidak ada pencarian bebas di metadata, IP, atau user agent):

| Parameter | Nilai |
|---|---|
| `action` | Nilai `AdminAuditAction`, misalnya `login.failed`, `account.role-changed`, `invitation.issued` |
| `actor_type` | `user`, `cli`, `anonymous` |
| `actor_user_id` | ID akun pelaku |
| `subject_user_id` | ID akun yang dikenai tindakan |
| `occurred_from`, `occurred_to` | Tanggal ISO 8601, inklusif, `occurred_to` tidak sebelum `occurred_from` |

```json
{
  "id": 120,
  "occurred_at": "2026-10-16T07:41:12.512345+00:00",
  "action": "account.suspended",
  "actor": { "type": "user", "user_id": 1 },
  "subject": { "type": "user", "id": 2 },
  "ip_address": "203.0.113.5",
  "user_agent": "Mozilla/5.0 ...",
  "metadata": { "sessions_ended": 1, "access_links_revoked": 0 }
}
```

- `metadata` disaring lagi dengan daftar kunci yang sama seperti saat ditulis (`RecordAdminAuditEvent::ALLOWED_METADATA_KEYS`), jadi kunci di luar daftar tidak pernah tampil, bahkan bila sebuah baris ditulis di luar aplikasi.
- Isinya tidak pernah memuat kata sandi, kode TOTP, rahasia TOTP, kode pemulihan, token atau URL tautan, ID sesi, payload request, atau isi inquiry. Login gagal hanya menyimpan sidik jari HMAC dari alamat yang diketik.
- IP dan user agent ditampilkan karena owner membutuhkannya untuk investigasi; keduanya data pribadi dan masa simpannya ikut keputusan retensi yang masih tertunda.
- Kejadian baru B3.1b: `invitation.issued` (metadata `to_role`, `from_role` bila peran akun tertunda berubah, `account_created`, `access_link_id`), `invitation.revoked` (`access_link_id`). `credentials.reset-issued` dari owner tercatat dengan `actor_type` `user` dan `access_link_id`; `account.suspended` menambah `access_links_revoked`.
- **Batas jaminan:** trigger MySQL menolak `UPDATE` dan `DELETE` untuk setiap pengguna, dan pengguna aplikasi tidak punya hak DDL. Pemegang hak DDL (pengguna migrasi, root, DBA penyedia) tetap dapat `DROP TRIGGER`, `DROP TABLE`, atau `TRUNCATE` (yang tidak menjalankan trigger). Audit log ini bukan bukti yang tidak dapat diubah terhadap mereka.

## Yang tidak ada

Registrasi publik, pengiriman email atau SMS, peran lain (`editor`, `analyst`), menghapus akun, mengubah alamat email atau nama akun orang lain, melihat atau mengakhiri sesi orang lain satu per satu, mematikan MFA, endpoint audit publik, ekspor CSV, penghapusan atau pemangkasan audit. Konsol admin (B3.2c) memanggil endpoint ini hanya dari origin `ADMIN_URL`; endpoint tidak disajikan di listener publik gateway.
