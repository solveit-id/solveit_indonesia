import type {
  InquiryBudget,
  InquiryService,
  InquiryStatus,
  InquiryTimeline,
} from "~/services/admin-api/inquiry-contracts";

/**
 * Copy of the inquiry console (B4b), Indonesian. Kept apart from the core catalogues
 * (src/i18n/messages/) so it travels in the lazy inquiry chunks, not the initial JavaScript;
 * read it through useInquiryI18n (src/i18n/inquiry.ts). Same rules as id.ts: sentence case, no
 * em dash, no claim the console cannot back. Messages about a contact or a note never repeat
 * its value: notices, titles, and errors stay free of personal data.
 */
export const inquiryId = {
  status: {
    received: "Baru",
    "in-review": "Ditinjau",
    contacted: "Dihubungi",
    closed: "Selesai",
  } satisfies Record<InquiryStatus, string>,
  statusDetail: {
    received: "Baru masuk dari website; belum ada yang menanganinya.",
    "in-review": "Sedang ditinjau tim.",
    contacted: "Tim sudah menghubungi pengirimnya.",
    closed: "Selesai: sudah dijawab, tidak cocok, atau spam. Dapat dibuka lagi untuk ditinjau.",
  } satisfies Record<InquiryStatus, string>,
  /** The website's own short names (frontend/src/data/locales/id/services.ts). */
  service: {
    website: "Website",
    "aplikasi-web": "Aplikasi web",
    "sistem-informasi": "Sistem informasi",
    "custom-software": "Custom software",
    "dukungan-teknis": "Dukungan teknis",
  } satisfies Record<InquiryService, string>,
  /** The website form's choices (frontend/src/i18n/messages/id.ts, budgetOptions). */
  budget: {
    "belum-tahu": "Belum tahu",
    "di-bawah-10jt": "Di bawah Rp10 juta",
    "10-50jt": "Rp10 sampai 50 juta",
    "50-150jt": "Rp50 sampai 150 juta",
    "di-atas-150jt": "Di atas Rp150 juta",
  } satisfies Record<InquiryBudget, string>,
  timeline: {
    fleksibel: "Fleksibel",
    "1-3-bulan": "Dalam 1 sampai 3 bulan",
    segera: "Secepatnya",
  } satisfies Record<InquiryTimeline, string>,
  contactType: {
    email: "Email",
    phone: "Telepon atau WhatsApp",
  },
  /** Named `inquiry`, not `common`: merged over the core catalogue, it must not hide a key. */
  inquiry: {
    you: "Anda",
    accountNumber: (id: number) => `Akun #${id}`,
    unknownAccount: "Akun tidak diketahui",
    forbiddenTitle: "Tanpa izin inquiry",
    forbiddenBody:
      "Server tidak memberi akun ini izin membaca inquiry. Bila peran atau izin Anda baru saja berubah, masuk lagi agar konsol memakai izin terbaru.",
    toHome: "Ke beranda konsol",
    clearFilters: "Hapus filter",
    refreshing: "Memperbarui daftar",
    filterRefused:
      "Server menolak filter atau penanda halaman ini. Hapus filter lalu coba lagi; tidak ada data yang diubah.",
    privacy:
      "Isi inquiry adalah data pribadi. Masa simpan, ekspor, dan penghapusannya belum diputuskan pemilik; sampai itu konsol tidak mengekspor atau menghapus apa pun.",
  },
  list: {
    title: "Inquiry",
    lede: "Pesan yang dikirim lewat formulir website ke server, terbaru dulu. Kontak selalu disamarkan, dan isi pesan hanya terbaca di detail.",
    listLabel: "Daftar inquiry",
    filtersTitle: "Saring inquiry",
    status: "Status",
    allStatuses: "Semua status",
    service: "Layanan",
    allServices: "Semua layanan",
    from: "Diterima dari",
    to: "Diterima sampai",
    dateHint: "Menurut zona waktu perangkat ini.",
    rangeInvalid: "Tanggal akhir tidak boleh sebelum tanggal awal.",
    reference: "Nomor referensi",
    referenceHint: "Persis seperti yang diterima pengirim, misalnya INQ-7K3M-9QX2-HD4T.",
    referenceInvalid:
      "Tulis nomor referensi lengkap: INQ- lalu tiga kelompok empat huruf atau angka, dipisah tanda hubung.",
    find: "Cari",
    columns: {
      sender: "Pengirim",
      reference: "Referensi",
      service: "Layanan",
      status: "Status",
      received: "Diterima",
    },
    showing: (count: number, more: boolean) =>
      more ? `Menampilkan ${count} inquiry terbaru.` : `Menampilkan ${count} inquiry.`,
    loading: "Memuat inquiry",
    loadFailed: "Daftar inquiry belum dapat dimuat.",
    emptyFiltered: "Tidak ada inquiry yang cocok",
    emptyFilteredBody: "Tidak ada inquiry untuk saringan ini. Ubah atau hapus saringannya.",
    empty: "Belum ada inquiry",
    emptyBody:
      "Inquiry yang dikirim lewat formulir website ke server muncul di sini, terbaru dulu.",
    loadMore: "Muat inquiry lebih lama",
  },
  detail: {
    back: "Inquiry",
    loading: "Memuat inquiry",
    loadFailed: "Inquiry belum dapat dimuat.",
    notFoundTitle: "Inquiry tidak ditemukan",
    notFoundBody:
      "Tidak ada inquiry dengan alamat ini. Periksa tautannya, atau kembali ke daftar inquiry.",
    submissionTitle: "Kiriman",
    submissionNote: "Seperti yang dikirim pengunjung; konsol tidak dapat mengubahnya.",
    reference: "Referensi",
    name: "Nama",
    organization: "Organisasi",
    noOrganization: "Tidak diisi",
    contact: "Kontak",
    service: "Layanan",
    budget: "Anggaran",
    timeline: "Waktu",
    received: "Diterima",
    updated: "Diperbarui",
    messageTitle: "Pesan",
    messageNote:
      "Ditulis pengunjung dan dapat memuat data pribadi, termasuk nomor atau alamat yang tidak disamarkan. Jangan salin ke kanal lain tanpa keperluan.",
    statusTitle: "Status",
    statusNote: "Hanya untuk tim; pengirim tidak pernah melihat status ini.",
    move: {
      "in-review": "Tandai ditinjau",
      contacted: "Tandai sudah dihubungi",
      closed: "Tutup inquiry",
    },
    reopen: "Buka lagi untuk ditinjau",
    movesNote: "Setiap perpindahan dicatat di riwayat status dan audit log atas nama Anda.",
    noMoves: "Tidak ada perpindahan status yang tersedia dari sini.",
    cannotChange: "Akun Anda tidak mendapat izin mengubah status inquiry.",
    confirmTitle: (to: string) => `Pindahkan ke ${to}?`,
    confirmBody: (from: string, to: string) =>
      `Status berubah dari ${from} ke ${to}. Perubahan dicatat di riwayat status dan audit log atas nama Anda.`,
    changing: "Mengubah status",
    changed: (to: string) => `Status inquiry sekarang ${to}.`,
    changedSame: (to: string) => `Inquiry ini sudah ${to}; tidak ada perubahan baru yang dicatat.`,
    reloaded: (to: string) =>
      `Status dimuat ulang dari server: sekarang ${to}. Periksa lalu putuskan lagi.`,
    uncertain:
      "Server tidak memberi jawaban yang pasti, jadi status mungkin sudah berubah. Periksa keadaan inquiry sebelum mencoba lagi.",
    checkState: "Periksa keadaan inquiry",
    checking: "Memeriksa",
    checked: (to: string) => `Status yang tercatat di server sekarang: ${to}.`,
    auditLink: "Lihat kejadiannya di audit log",
  },
  contact: {
    reveal: "Buka kontak lengkap",
    cannotReveal: "Akun Anda tidak mendapat izin membuka kontak lengkap.",
    revealTitle: "Buka kontak lengkap?",
    revealBody:
      "Kontak lengkap adalah data pribadi. Setiap pembukaan dicatat di audit log atas nama Anda, juga bila Anda membuka kontak yang sama lagi. Konsol hanya menampilkannya di layar ini dan tidak menyimpannya.",
    acknowledge: "Saya membuka kontak ini untuk menindaklanjuti inquiry ini",
    acknowledgeRequired: "Centang pernyataan di atas sebelum membuka kontak.",
    revealing: "Membuka kontak",
    reauthBody:
      "Membuka kontak lengkap butuh konfirmasi kata sandi dalam 15 menit terakhir. Kontak belum dibuka dan belum ada yang dicatat.",
    revealed: (time: string) => `Kontak lengkap dibuka dan dicatat di audit log pukul ${time}.`,
    fullLabel: "Kontak lengkap",
    onlyHere:
      "Hanya tampil di layar ini selama Anda membukanya; tidak disimpan di browser atau di alamat halaman.",
    copy: "Salin kontak",
    hide: "Sembunyikan",
    hidden: "Kontak lengkap disembunyikan lagi. Membukanya lagi dicatat sebagai pembukaan baru.",
    uncertain:
      "Kontak belum dapat dibuka karena server tidak memberi jawaban yang pasti. Bila server sempat mencatat pembukaannya, catatan itu tetap ada di audit log. Buka lagi bila masih perlu.",
  },
  history: {
    title: "Riwayat status",
    body: "Setiap perpindahan status, terbaru dulu. Riwayat tidak dapat diubah atau dihapus.",
    loading: "Memuat riwayat status",
    loadFailed: "Riwayat status belum dapat dimuat.",
    empty: "Belum ada perpindahan status",
    emptyBody: "Inquiry ini belum berpindah status sejak diterima.",
    move: (from: string, to: string) => `${from} ke ${to}`,
    by: "Oleh",
    showing: (count: number, more: boolean) =>
      more ? `Menampilkan ${count} perpindahan terbaru.` : `Menampilkan ${count} perpindahan.`,
    loadMore: "Muat riwayat lebih lama",
  },
  notes: {
    title: "Catatan internal",
    body: "Hanya untuk tim, tidak pernah dikirim ke pengirim. Catatan tidak dapat diubah atau dihapus; koreksi ditulis sebagai catatan baru.",
    field: "Catatan baru",
    hint: (left: number) =>
      `Tersisa ${left} karakter. Tulis hanya yang dibutuhkan tim; jangan pernah kata sandi.`,
    missing: "Tulis catatannya dulu.",
    tooLong: "Catatan maksimal 2000 karakter.",
    add: "Tambah catatan",
    adding: "Menyimpan catatan",
    added: "Catatan ditambahkan.",
    cannotAdd: "Akun Anda tidak mendapat izin menambah catatan.",
    resend:
      "Pengaman sesi diperbarui dan catatan tadi belum diproses server. Tekan Tambah catatan sekali lagi bila Anda tetap ingin menyimpannya.",
    forbidden:
      "Server menolak catatan ini untuk akun Anda. Izin Anda mungkin baru berubah; data akun dimuat ulang.",
    gone: "Inquiry ini sudah tidak ada di server, jadi catatan tidak disimpan.",
    serverInvalid: "Server menolak catatan ini. Periksa panjangnya lalu coba lagi.",
    uncertain:
      "Server tidak memberi jawaban yang pasti, jadi catatan ini mungkin sudah tersimpan. Periksa catatan sebelum mengirimnya lagi; teksnya tetap di kolom.",
    check: "Periksa catatan",
    checking: "Memeriksa",
    checkFound:
      "Catatan Anda sudah tersimpan. Kolomnya dikosongkan; tidak ada yang perlu dikirim lagi.",
    checkNotFound:
      "Catatan Anda belum ada di catatan terbaru. Tekan Tambah catatan bila Anda tetap ingin menyimpannya.",
    loading: "Memuat catatan",
    loadFailed: "Catatan belum dapat dimuat.",
    empty: "Belum ada catatan",
    emptyBody: "Catatan tim untuk inquiry ini muncul di sini, terbaru dulu.",
    by: "Oleh",
    showing: (count: number, more: boolean) =>
      more ? `Menampilkan ${count} catatan terbaru.` : `Menampilkan ${count} catatan.`,
    loadMore: "Muat catatan lebih lama",
  },
};

export type InquiryMessages = typeof inquiryId;
