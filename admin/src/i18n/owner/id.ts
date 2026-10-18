import type {
  AdminAccessLinkPurpose,
  AdminConflictCode,
  AdminRole,
} from "~/services/admin-api/contracts";
import type {
  AdminAccessLinkStatus,
  AdminAccountStatus,
  AdminActorType,
  AdminAuditAction,
} from "~/services/admin-api/owner-contracts";

/**
 * Copy of the owner administration workspace (B3.2c), Indonesian. Kept apart from the core
 * catalogues (src/i18n/messages/) so it travels in the lazy owner chunks, not the initial
 * JavaScript; read it through useOwnerI18n (src/i18n/owner.ts). Same rules as id.ts: sentence
 * case, no em dash, no claim the console cannot back; errors name the problem and the next step.
 */
export const ownerId = {
  accountStatus: {
    pending: "Tertunda",
    active: "Aktif",
    "credential-reset-pending": "Reset tertunda",
    suspended: "Ditangguhkan",
  } satisfies Record<AdminAccountStatus, string>,
  accountStatusDetail: {
    pending: "Belum aktif: menunggu orangnya menerima undangan.",
    active: "Dapat masuk dengan kata sandi dan autentikator.",
    "credential-reset-pending":
      "Tidak dapat masuk sampai tautan reset diselesaikan dengan kata sandi dan autentikator baru.",
    suspended: "Tidak dapat masuk sampai owner mengaktifkannya ulang.",
  } satisfies Record<AdminAccountStatus, string>,
  linkStatus: {
    pending: "Menunggu",
    redeemed: "Sedang didaftarkan",
    completed: "Diterima",
    expired: "Kedaluwarsa",
    revoked: "Dicabut",
  } satisfies Record<AdminAccessLinkStatus, string>,
  linkPurpose: {
    activation: "Undangan",
    "credential-reset": "Reset kredensial",
  } satisfies Record<AdminAccessLinkPurpose, string>,
  owner: {
    you: "Anda",
    accountNumber: (id: number) => `Akun #${id}`,
    linkNumber: (id: number) => `Tautan akses #${id}`,
    shell: "Shell server",
    anonymous: "Tanpa akun",
    never: "Belum pernah",
    unnamed: "Nama belum ditetapkan",
    clearFilters: "Hapus filter",
    allRoles: "Semua peran",
    allStatuses: "Semua status",
    roleFilter: "Peran",
    statusFilter: "Status",
    filtersLabel: "Saring daftar",
    loadMore: "Muat lebih banyak",
    loadingMore: "Memuat",
    moreFailed: "Halaman berikutnya belum dapat dimuat.",
    refreshing: "Memperbarui daftar",
    filterRefused:
      "Server menolak filter atau penanda halaman ini. Hapus filter lalu coba lagi; tidak ada data yang diubah.",
    forbiddenTitle: "Khusus owner",
    forbiddenBody:
      "Layar ini hanya untuk akun berperan owner, dan server tidak memberi akun ini izin untuk membukanya. Bila peran Anda baru saja berubah, masuk lagi agar konsol memakai peran terbaru.",
    toHome: "Ke beranda konsol",
  },
  users: {
    title: "Pengguna",
    lede: "Akun owner dan admin konsol ini seperti yang tercatat di server. Akun baru hanya dibuat lewat undangan.",
    invite: "Undang admin",
    listLabel: "Daftar akun admin",
    columns: {
      account: "Akun",
      role: "Peran",
      status: "Status",
      authenticator: "Autentikator",
      lastLogin: "Masuk terakhir",
    },
    authenticatorOn: "Terkonfirmasi",
    authenticatorOff: "Belum ada",
    showing: (count: number, more: boolean) =>
      more ? `Menampilkan ${count} akun pertama.` : `Menampilkan ${count} akun.`,
    loading: "Memuat daftar akun",
    loadFailed: "Daftar akun belum dapat dimuat.",
    emptyFiltered: "Tidak ada akun yang cocok",
    emptyFilteredBody:
      "Tidak ada akun dengan peran dan status ini. Hapus filter untuk melihat semua akun.",
    empty: "Belum ada akun",
    emptyBody: "Akun admin muncul di sini setelah diundang.",
  },
  userDetail: {
    back: "Pengguna",
    loading: "Memuat akun",
    loadFailed: "Akun belum dapat dimuat.",
    notFoundTitle: "Akun tidak ditemukan",
    notFoundBody:
      "Tidak ada akun admin dengan alamat ini. Mungkin tautannya salah ketik; akun admin tidak pernah dihapus dari konsol.",
    yourAccount:
      "Ini akun Anda. Owner tidak dapat mengubah peran, menangguhkan, atau mereset akunnya sendiri; kelola kata sandi, kode pemulihan, dan sesi Anda di Keamanan.",
    summaryTitle: "Ringkasan",
    role: "Peran",
    status: "Status",
    authenticator: "Autentikator",
    activatedAt: "Aktif sejak",
    lastLogin: "Masuk terakhir",
    createdAt: "Dibuat",
    suspendedAt: "Ditangguhkan sejak",
    sessions: "Sesi aktif",
    sessionsValue: (count: number) =>
      count === 0 ? "Tidak ada" : count === 1 ? "1 sesi" : `${count} sesi`,
    sessionsNote: "Hanya jumlah. Perangkat dan alamat IP hanya terlihat oleh pemilik akun.",
    openLinkTitle: "Tautan akses terbuka",
    openLinkNone: "Tidak ada tautan undangan atau reset yang masih terbuka untuk akun ini.",
    linkPurpose: "Jenis",
    linkStatus: "Status",
    linkIssued: "Dibuat",
    linkIssuedBy: "Oleh",
    linkExpires: "Berlaku sampai",
    linkNote:
      "Tautannya sendiri tidak pernah tersimpan di konsol. Bila hilang atau tidak sampai, terbitkan yang baru; tautan lama berhenti bekerja.",
    actionsTitle: "Tindakan",
    actionsNote:
      "Setiap tindakan dicatat di audit log dan butuh konfirmasi kata sandi dalam 15 menit terakhir.",
    roleTitle: "Peran",
    roleBody: (target: string) =>
      `Menjadikan akun ini ${target}. Semua sesinya berakhir, sehingga peran baru berlaku saat ia masuk lagi.`,
    makeRole: (target: string) => `Jadikan ${target}`,
    roleUnavailable: "Akun yang belum aktif mendapat perannya dari undangan.",
    suspendTitle: "Penangguhan",
    suspendBody:
      "Akun tidak dapat masuk, semua sesinya berakhir, dan tautan yang masih terbuka dicabut.",
    suspend: "Tangguhkan akun",
    reactivateBody:
      "Akun dapat masuk lagi dengan kata sandi dan autentikatornya. Tidak ada sesi yang dibuat.",
    reactivate: "Aktifkan ulang",
    resetTitle: "Reset kredensial",
    resetBody:
      "Autentikator dan kode pemulihan akun ini langsung dihapus dan semua sesinya berakhir. Anda menerima tautan reset 24 jam untuk diserahkan.",
    reset: "Reset kredensial",
    resetAgain: "Terbitkan reset baru",
    resetUnavailablePending: "Akun yang belum aktif dipulihkan dengan undangan baru di Undangan.",
    resetUnavailableSuspended: "Aktifkan ulang akun ini dulu sebelum mereset kredensialnya.",
    recentTitle: "Aktivitas terbaru",
    recentBody: "Kejadian audit yang mengenai akun ini, terbaru dulu.",
    recentEmpty: "Belum ada kejadian audit yang mengenai akun ini.",
    recentFailed: "Aktivitas belum dapat dimuat.",
    recentAll: "Lihat semua di audit log",
    changed: {
      role: (name: string, role: string) =>
        `${name} sekarang ${role}. Semua sesinya sudah diakhiri.`,
      roleSame: (name: string, role: string) => `${name} sudah ${role}; tidak ada yang berubah.`,
      suspended: (name: string) => `${name} ditangguhkan. Semua sesinya sudah diakhiri.`,
      reactivated: (name: string) =>
        `${name} diaktifkan ulang. Ia masuk lagi dengan kata sandi dan autentikatornya.`,
    },
    uncertain:
      "Server tidak memberi jawaban yang pasti, jadi tindakan tadi mungkin sudah berlaku. Periksa keadaan akun sebelum mencoba lagi.",
    checkState: "Periksa keadaan akun",
    checked: "Keadaan akun di bawah ini adalah yang tercatat di server sekarang.",
    resetUncertainApplied:
      "Reset sudah berlaku: akun ini menunggu tautan reset, tetapi tautannya tidak dapat ditampilkan lagi. Terbitkan reset baru untuk mendapatkan tautan; tautan yang hilang berhenti bekerja.",
  },
  invitations: {
    title: "Undangan",
    lede: "Tautan aktivasi untuk akun baru. Tautan hanya tampil sekali saat dibuat dan Anda serahkan sendiri; konsol tidak mengirim email.",
    invite: "Undang admin",
    listLabel: "Daftar undangan",
    columns: {
      address: "Alamat",
      role: "Peran",
      status: "Status",
      issued: "Dibuat",
      expires: "Berlaku sampai",
      actions: "Tindakan",
    },
    issuedBy: (who: string) => `oleh ${who}`,
    showing: (count: number, more: boolean) =>
      more ? `Menampilkan ${count} undangan terbaru.` : `Menampilkan ${count} undangan.`,
    loading: "Memuat undangan",
    loadFailed: "Daftar undangan belum dapat dimuat.",
    emptyFiltered: "Tidak ada undangan dengan status ini",
    emptyFilteredBody: "Hapus filter untuk melihat semua undangan.",
    empty: "Belum ada undangan",
    emptyBody:
      "Undangan pertama Anda muncul di sini. Tautannya hanya tampil sekali, saat dibuat; daftar ini menyimpan statusnya saja.",
    noAccount: "Akun tidak tersedia",
    revoke: "Cabut",
    revokeFor: (email: string) => `Cabut undangan untuk ${email}`,
    revokeTitle: "Cabut undangan ini?",
    revokeBody: (email: string) =>
      `Tautan untuk ${email} langsung berhenti bekerja, juga bila pendaftarannya sedang berjalan. Akunnya tetap tertunda dan dapat diundang lagi.`,
    revoking: "Mencabut",
    revoked: (email: string) => `Undangan untuk ${email} dicabut.`,
    revokeUncertain:
      "Server tidak memberi jawaban yang pasti, jadi undangan mungkin sudah dicabut. Muat ulang daftar untuk melihat statusnya sebelum mencoba lagi.",
    reload: "Muat ulang daftar",
  },
  invite: {
    back: "Undangan",
    title: "Undang admin",
    lede: "Undangan membuat tautan aktivasi yang berlaku 48 jam. Anda menyerahkannya sendiri lewat kanal tepercaya; konsol tidak mengirim email.",
    email: "Email orang yang diundang",
    emailHint: "Nama ditetapkan oleh orangnya sendiri saat menerima undangan.",
    emailMissing: "Isi email orang yang diundang.",
    emailInvalid: "Tulis email lengkap, misalnya nama@domain.co.id.",
    emailTooLong: "Email maksimal 254 karakter.",
    role: "Peran",
    roleOptions: {
      admin: {
        title: "Admin",
        detail: "Mengelola keamanan akunnya sendiri. Belum ada modul lain untuk admin.",
      },
      owner: {
        title: "Owner",
        detail:
          "Semua yang dapat dilakukan admin, ditambah mengelola pengguna dan membaca audit log.",
      },
    } satisfies Record<AdminRole, { title: string; detail: string }>,
    review: "Tinjau undangan",
    confirmTitle: "Buat undangan ini?",
    confirmBody: (email: string, role: string) =>
      `Undangan ${role} untuk ${email}. Tautan aktivasi 48 jam dibuat dan tampil sekali di layar ini; belum ada yang dikirim ke siapa pun.`,
    confirm: "Buat undangan",
    creating: "Membuat undangan",
    serverInvalid: "Server menolak isian ini. Periksa email dan peran.",
    uncertain:
      "Server tidak memberi jawaban yang pasti, jadi undangan mungkin sudah dibuat tanpa tautannya sampai ke sini. Periksa daftar undangan sebelum mencoba lagi.",
    check: "Periksa undangan",
    checking: "Memeriksa",
    checkFound: (email: string) =>
      `Undangan untuk ${email} sudah ada, tetapi tautannya tidak dapat ditampilkan lagi. Cabut undangan itu di daftar Undangan, lalu buat yang baru.`,
    checkNotFound: (email: string) =>
      `Belum ada undangan yang menunggu untuk ${email}. Anda dapat membuatnya lagi.`,
    checkPartial: (email: string) =>
      `Undangan untuk ${email} tidak ada di 100 undangan menunggu terbaru. Periksa daftar Undangan sebelum membuatnya lagi.`,
    toInvitations: "Buka daftar undangan",
    another: "Undang orang lain",
  },
  linkReveal: {
    invitationTitle: (email: string) => `Tautan undangan untuk ${email}`,
    resetTitle: (name: string) => `Tautan reset untuk ${name}`,
    lede: "Ini satu-satunya saat tautan ditampilkan. Konsol tidak menyimpannya, dan setelah Anda menekan Selesai tautan tidak dapat dilihat lagi.",
    linkLabel: "Tautan akses",
    copy: "Salin tautan",
    validUntil: (time: string) => `Berlaku sampai ${time}.`,
    handOver:
      "Serahkan sendiri ke orangnya lewat kanal tepercaya, misalnya pesan langsung. Jangan kirim ke grup atau kanal publik: siapa pun yang memegang tautan ini dapat memakainya sekali.",
    lostInvitation: "Tautan hilang atau tidak sampai? Cabut undangan ini lalu buat yang baru.",
    lostReset:
      "Tautan hilang atau tidak sampai? Terbitkan reset baru; tautan ini lalu berhenti bekerja.",
    acknowledge: "Saya sudah menyalin atau menyerahkan tautan ini",
    acknowledgeFirst: "Centang konfirmasi di atas setelah tautan aman di tangan Anda.",
    done: "Selesai",
    leaveTitle: "Tautan belum diamankan",
    leaveBody:
      "Bila Anda meninggalkan halaman ini sekarang, tautan tidak dapat ditampilkan lagi dan harus dibuat ulang.",
    stay: "Tetap di sini",
    leave: "Tinggalkan halaman",
  },
  sensitive: {
    sending: "Memproses",
    reauthTitle: "Konfirmasi kata sandi",
    reauthBody:
      "Tindakan administrasi butuh konfirmasi kata sandi dalam 15 menit terakhir. Belum ada yang diubah.",
    password: "Kata sandi Anda",
    confirmPassword: "Konfirmasi kata sandi",
    confirmingPassword: "Mengonfirmasi",
    wrongPassword: "Kata sandi tidak cocok.",
    reauthedTitle: "Kata sandi dikonfirmasi",
    reauthedBody: (action: string) =>
      `Belum ada yang diubah. Tekan ${action} sekali lagi bila Anda tetap ingin melanjutkan.`,
    resend:
      "Pengaman sesi diperbarui dan permintaan tadi belum diproses server. Tekan tombolnya sekali lagi bila Anda tetap ingin melanjutkan.",
    forbidden:
      "Server menolak tindakan ini untuk akun Anda. Peran Anda mungkin baru berubah; data akun dimuat ulang.",
    notFound: "Data ini sudah tidak ada di server. Data dimuat ulang.",
    conflict: {
      own_account:
        "Ini akun Anda sendiri. Kelola kata sandi, kode pemulihan, dan sesi Anda di halaman Keamanan.",
      last_active_owner:
        "Tindakan ini akan meninggalkan konsol tanpa owner aktif. Jadikan akun lain owner yang aktif dulu.",
      not_activated: "Akun ini belum aktif. Akun tertunda diatur lewat undangan.",
      suspended: "Akun ini ditangguhkan. Aktifkan ulang dulu.",
      not_admin_account: "Alamat ini milik akun di luar konsol admin dan tidak dapat diundang.",
      account_exists: "Alamat ini sudah dipakai akun yang aktif. Kelola akun itu di Pengguna.",
      invitation_pending:
        "Alamat ini masih punya undangan yang berlaku. Cabut undangan itu dulu, lalu undang lagi.",
      invitation_completed:
        "Undangan ini sudah diterima dan tidak dapat dicabut. Kelola akunnya di Pengguna.",
    } satisfies Record<AdminConflictCode, string>,
    conflictUnknown: "Keadaan berubah dan server menolak tindakan ini. Data dimuat ulang.",
    acknowledgeRequired: "Centang pernyataan di atas sebelum melanjutkan.",
  },
  reset: {
    confirmTitle: (name: string) => `Reset kredensial ${name}?`,
    confirmBody:
      "Akun ini langsung kehilangan akses: autentikator dan kode pemulihannya dihapus dan semua sesinya berakhir. Ia baru dapat masuk lagi setelah menyelesaikan tautan reset dengan kata sandi dan autentikator baru.",
    acknowledge: "Saya paham akun ini tidak dapat masuk sampai tautan reset diselesaikan",
    confirm: "Reset kredensial",
    resetting: "Mereset",
  },
  roleChange: {
    confirmTitle: (name: string, role: string) => `Jadikan ${name} ${role}?`,
    toOwner:
      "Owner dapat mengelola semua pengguna, termasuk Anda, dan membaca seluruh audit log. Semua sesi akun ini berakhir sekarang.",
    toAdmin:
      "Akun ini kehilangan akses ke administrasi pengguna dan audit log. Semua sesinya berakhir sekarang.",
    changing: "Mengubah peran",
  },
  suspension: {
    confirmTitle: (name: string) => `Tangguhkan ${name}?`,
    confirmBody:
      "Akun ini tidak dapat masuk sampai diaktifkan ulang. Semua sesinya berakhir sekarang, dan tautan undangan atau reset yang masih terbuka dicabut.",
    suspending: "Menangguhkan",
    reactivateTitle: (name: string) => `Aktifkan ulang ${name}?`,
    reactivateBody:
      "Akun ini dapat masuk lagi dengan kata sandi dan autentikatornya. Tautan yang dicabut saat penangguhan tidak hidup lagi.",
    reactivating: "Mengaktifkan ulang",
  },
  audit: {
    title: "Audit log",
    lede: "Kejadian keamanan dan administrasi, terbaru dulu. Hanya owner yang dapat membacanya, dan konsol tidak dapat mengubah atau menghapusnya.",
    filtersTitle: "Saring kejadian",
    action: "Tindakan",
    allActions: "Semua tindakan",
    actorType: "Jenis pelaku",
    allActorTypes: "Semua jenis",
    actorTypes: {
      user: "Akun admin",
      cli: "Shell server",
      anonymous: "Tanpa akun",
    } satisfies Record<AdminActorType, string>,
    actor: "Pelaku",
    subject: "Akun terdampak",
    anyAccount: "Semua akun",
    from: "Dari tanggal",
    to: "Sampai tanggal",
    dateHint: "Menurut zona waktu perangkat ini.",
    rangeInvalid: "Tanggal akhir tidak boleh sebelum tanggal awal.",
    groups: {
      administration: "Administrasi owner",
      signIn: "Masuk dan sesi",
      links: "Tautan dan aktivasi",
      security: "Keamanan akun",
    },
    actions: {
      "owner.bootstrap-issued": "Tautan owner pertama diterbitkan",
      "owner.bootstrap-refused": "Penerbitan owner pertama ditolak",
      "credentials.reset-issued": "Reset kredensial diterbitkan",
      "access-link.redeemed": "Tautan akses ditebus",
      "access-link.rejected": "Tautan akses ditolak",
      "account.activated": "Akun diaktifkan",
      "credentials.reset-completed": "Reset kredensial selesai",
      "mfa.enrollment-failed": "Pendaftaran autentikator gagal",
      "login.succeeded": "Masuk berhasil",
      "login.failed": "Masuk gagal",
      "mfa.challenge-failed": "Kode autentikator ditolak",
      "mfa.recovery-code-used": "Kode pemulihan dipakai",
      "mfa.recovery-codes-regenerated": "Kode pemulihan dibuat ulang",
      "password.changed": "Kata sandi diganti",
      logout: "Keluar",
      "session.revoked": "Sesi diakhiri",
      "session.others-revoked": "Sesi lain diakhiri",
      "session.expired": "Sesi kedaluwarsa",
      "session.ended-inactive-account": "Sesi diakhiri karena akun tidak aktif",
      "invitation.issued": "Undangan diterbitkan",
      "invitation.revoked": "Undangan dicabut",
      "account.role-changed": "Peran diubah",
      "account.suspended": "Akun ditangguhkan",
      "account.reactivated": "Akun diaktifkan ulang",
    } satisfies Record<AdminAuditAction, string>,
    unknownAction: (action: string) => `Kejadian ${action}`,
    legendLabel: "Arti penanda",
    legend: {
      administration: "Tindakan owner",
      failure: "Penolakan atau kegagalan",
      routine: "Masuk, sesi, dan keamanan",
    },
    by: "Pelaku",
    on: "Sasaran",
    details: "Detail teknis",
    eventId: "ID kejadian",
    actionId: "Kode tindakan",
    ip: "Alamat IP",
    userAgent: "Identitas browser",
    metadata: {
      purpose: (value: string) => `Jenis: ${value}`,
      roles: (from: string | null, to: string) =>
        from ? `Peran: ${from} ke ${to}` : `Peran: ${to}`,
      fingerprint: (value: string) => `Sidik jari alamat ${value}`,
      recoveryRemaining: (count: number) => `${count} kode pemulihan tersisa`,
      sessionsEnded: (count: number) => `${count} sesi diakhiri`,
      accessLink: (id: number | string) => `Tautan #${id}`,
      linksRevoked: (count: number) => `${count} tautan dicabut`,
      accountCreated: "Akun baru dibuat",
      accountExisting: "Akun tertunda yang sudah ada",
      reason: (value: string) => `Alasan: ${value}`,
    },
    reasons: {
      "active-owner-exists": "sudah ada owner aktif",
      "another-owner-pending": "owner lain menunggu aktivasi",
      "email-taken": "alamat milik akun lain",
      redeem: "saat penebusan",
      confirm: "saat konfirmasi kode",
      "absolute-lifetime": "batas 12 jam tercapai",
    } as Record<string, string>,
    showing: (count: number, more: boolean) =>
      more ? `Menampilkan ${count} kejadian terbaru.` : `Menampilkan ${count} kejadian.`,
    loading: "Memuat audit log",
    loadFailed: "Audit log belum dapat dimuat.",
    emptyFiltered: "Tidak ada kejadian yang cocok",
    emptyFilteredBody: "Tidak ada kejadian untuk saringan ini. Ubah atau hapus saringannya.",
    empty: "Belum ada kejadian",
    emptyBody: "Kejadian keamanan dan administrasi muncul di sini begitu terjadi.",
    loadOlder: "Muat kejadian lebih lama",
    retention:
      "Masa simpan audit log, termasuk alamat IP dan identitas browser, belum diputuskan pemilik; sampai itu tidak ada kejadian yang dihapus.",
  },
};

export type OwnerMessages = typeof ownerId;
