import type { PhaseCode, PhaseStatus } from "~/app/phases";

/**
 * Interface copy, Indonesian (default). Every string exists in English too (en.ts); TypeScript
 * fails the build when one is missing. Rules: sentence case, no em dash, no claim the console
 * cannot back (docs/design/design-system.md, Aturan konten). Error copy names the problem and
 * the next step, never a server message, a status code alone, or request data.
 */
export const id = {
  meta: {
    product: "Konsol admin",
    owner: "Solveit Indonesia",
  },
  shell: {
    skipToContent: "Langsung ke konten",
    consoleName: "Konsol admin",
    environmentLead: "Konsol B4b",
    environmentDetail: "belum di-deploy",
    navigation: "Navigasi utama",
    openMenu: "Menu",
    loadingRoute: "Memuat halaman",
    signedInAs: "Masuk sebagai",
    signOut: "Keluar",
    signingOut: "Sedang keluar",
    signOutUncertain:
      "Keluar belum dapat dipastikan karena server tidak menjawab. Coba lagi, atau tutup browser: sesi juga berakhir saat browser ditutup.",
    preferences: "Tampilan",
    restrictedNote:
      "Hanya untuk owner dan admin yang diundang. Setiap akun masuk dengan kata sandi dan aplikasi autentikator.",
  },
  nav: {
    home: "Beranda",
    account: "Akun",
    security: "Keamanan",
    users: "Pengguna",
    invitations: "Undangan",
    audit: "Audit log",
    inquiries: "Inquiry",
    invite: "Undang admin",
    reference: "Referensi komponen",
  },
  roles: {
    owner: "Owner",
    admin: "Admin",
    none: "Tanpa peran",
  },
  theme: {
    label: "Tema",
    toDark: "Ganti ke tema gelap",
    toLight: "Ganti ke tema terang",
    light: "Terang",
    dark: "Gelap",
  },
  locale: {
    label: "Bahasa",
    id: "Indonesia",
    en: "English",
  },
  common: {
    showPassword: "Tampilkan kata sandi",
    cancel: "Batal",
    close: "Tutup",
    retry: "Coba lagi",
    copied: "Disalin.",
    copyFailed: "Browser menolak menyalin otomatis. Pilih teksnya lalu salin manual.",
    stepDone: "selesai",
    stepCurrent: "langkah sekarang",
    stepNext: "berikutnya",
    stepOf: (step: number, total: number) => `Langkah ${step} dari ${total}`,
    notRecorded: "Tidak tercatat",
  },
  errors: {
    rateLimited: (seconds: number) =>
      seconds > 0
        ? `Terlalu banyak percobaan. Coba lagi dalam ${seconds} detik.`
        : "Batas percobaan sudah lewat. Silakan coba lagi.",
    resendNeeded:
      "Pengaman sesi diperbarui dan permintaan tadi belum diproses server. Periksa isian lalu kirim lagi.",
    unreachable:
      "Server admin tidak menjawab. Periksa koneksi Anda lalu coba lagi; tidak ada yang dikirim ulang otomatis.",
    unavailable: "Server admin sedang tidak dapat melayani. Coba lagi sebentar lagi.",
    forbidden:
      "Batas keamanan admin menolak permintaan ini. Buka konsol dari alamat resminya, lalu coba lagi.",
    unexpected:
      "Server memberi jawaban yang tidak terduga. Coba lagi; bila terus terjadi, catat waktunya.",
  },
  signIn: {
    title: "Masuk ke konsol admin",
    lede: "Masukkan email dan kata sandi akun admin Solveit Anda, lalu kode dari aplikasi autentikator. Kedua langkah wajib untuk setiap akun.",
    stepsLabel: "Langkah masuk",
    steps: ["Email dan kata sandi", "Kode autentikator"],
    email: "Email",
    password: "Kata sandi",
    continue: "Lanjut",
    checking: "Memeriksa",
    emailMissing: "Isi email akun Anda.",
    emailInvalid: "Tulis email lengkap, misalnya nama@domain.co.id.",
    passwordMissing: "Isi kata sandi Anda.",
    rejected:
      "Email atau kata sandi tidak cocok, atau akun ini belum dapat masuk. Periksa ejaannya lalu coba lagi.",
    passwordUncertain:
      "Server tidak memberi jawaban yang pasti, jadi Anda belum masuk. Coba lagi saat koneksi pulih.",
    codeTitle: "Masukkan kode autentikator",
    codeLede: (email: string) =>
      `Kata sandi untuk ${email} benar. Buka aplikasi autentikator dan masukkan kode 6 digit untuk Konsol admin Solveit.`,
    code: "Kode 6 digit",
    codeHint: "Kode berganti setiap 30 detik. Masukkan dalam 5 menit setelah kata sandi.",
    recoveryCode: "Kode pemulihan",
    recoveryHint:
      "Satu kode dari daftar yang Anda simpan saat aktivasi. Setiap kode hanya berlaku sekali.",
    useRecovery: "Pakai kode pemulihan",
    useAuthenticator: "Pakai kode autentikator",
    submit: "Masuk",
    verifying: "Memverifikasi",
    changeAccount: "Ganti akun",
    codeFormat: "Kode autentikator terdiri dari 6 angka.",
    recoveryMissing: "Isi satu kode pemulihan.",
    wrongCode:
      "Kode tidak cocok. Tunggu kode berikutnya di aplikasi lalu coba lagi, dan pastikan jam perangkat Anda tepat.",
    wrongRecovery: "Kode pemulihan tidak cocok atau sudah pernah dipakai.",
    expired:
      "Upaya masuk sudah kedaluwarsa: lebih dari 5 menit sejak kata sandi, atau sesi browser berganti. Masukkan kata sandi lagi.",
    codeUncertain:
      "Server tidak memberi jawaban yang pasti, jadi kode ini mungkin sudah terpakai. Periksa sesi dulu sebelum memasukkan kode baru.",
    checkSession: "Periksa sesi",
    notSignedInYet: "Anda belum masuk. Masukkan kode berikutnya dari aplikasi.",
    sessionUnverified:
      "Kode diterima, tetapi sesi belum dapat diperiksa. Periksa koneksi lalu periksa sesi lagi.",
    notices: {
      expired: "Sesi Anda berakhir. Masuk lagi untuk melanjutkan.",
      "signed-out": "Anda sudah keluar dari konsol.",
      elsewhere: "Anda keluar di tab lain browser ini.",
    },
    helpTitle: "Tidak bisa masuk?",
    helpAccounts: "Akun admin hanya dibuat lewat undangan owner. Tidak ada pendaftaran mandiri.",
    helpRecovery:
      "Lupa kata sandi atau kehilangan autentikator dan kode pemulihan? Minta owner membuat tautan reset akses. Tidak ada pemulihan lewat email.",
  },
  access: {
    pageTitle: "Tautan akses",
    stepsLabel: "Langkah aktivasi",
    steps: ["Tautan", "Kata sandi", "Autentikator", "Kode pemulihan"],
    resetSteps: ["Tautan", "Kata sandi baru", "Autentikator baru", "Kode pemulihan"],
    checkingTitle: "Memeriksa tautan akses",
    checking: "Memeriksa tautan",
    activationTitle: "Aktifkan akun admin",
    resetTitle: "Atur ulang akses akun",
    missingTitle: "Tautan akses tidak lengkap",
    missingBody:
      "Halaman ini hanya bekerja lewat tautan akses lengkap yang Anda terima. Buka tautannya sekali lagi persis seperti yang dikirim. Setelah dibuka, tautan tidak tersimpan di browser, jadi memuat ulang halaman tidak memakainya lagi.",
    invalidTitle: "Tautan ini tidak dapat dipakai",
    invalidBody:
      "Tautan akses tidak dikenal, sudah kedaluwarsa, sudah dipakai, atau sudah dicabut. Setiap tautan hanya berlaku sekali.",
    newLinkTitle: "Cara mendapatkan tautan baru",
    newLinkInvitation: "Undangan: minta owner yang mengundang Anda membuat undangan baru.",
    newLinkReset: "Reset akses: minta owner lain membuat tautan reset baru untuk akun Anda.",
    newLinkServer:
      "Owner pertama, atau bila tidak ada owner lain yang dapat masuk: pengelola server membuat tautan lewat perintah admin di server.",
    inspectFailed:
      "Tautan belum dapat diperiksa. Memeriksa tidak memakai tautan, jadi aman untuk mencoba lagi.",
    signedInTitle: "Anda sedang masuk di browser ini",
    signedInBody:
      "Tautan akses hanya dapat dipakai saat tidak ada akun yang masuk di browser ini. Keluar dulu; tautan ini lalu diperiksa lagi.",
    signOutAndContinue: "Keluar dan lanjutkan",
    toConsole: "Ke konsol",
    forAccount: "Untuk akun",
    validUntil: "Berlaku sampai",
    activationLede:
      "Tetapkan nama dan kata sandi. Setelah itu Anda mendaftarkan aplikasi autentikator; akun aktif setelah kode pertamanya dikonfirmasi.",
    resetLede:
      "Reset ini mengganti kata sandi dan autentikator akun Anda. Autentikator dan kode pemulihan lama sudah tidak berlaku sejak reset dibuat, dan akun tidak dapat masuk sampai langkah ini selesai.",
    name: "Nama",
    nameHint: "Nama yang terlihat oleh owner di konsol. Maksimal 120 karakter.",
    nameMissing: "Isi nama Anda.",
    nameTooLong: "Nama maksimal 120 karakter.",
    newPassword: "Kata sandi baru",
    confirmPassword: "Ulangi kata sandi baru",
    passwordHint:
      "Minimal 12 karakter dan maksimal 72 byte (huruf beraksen dan emoji memakai lebih dari satu byte). Frasa panjang yang mudah diingat lebih kuat daripada kata pendek yang rumit.",
    tooShort: "Kata sandi minimal 12 karakter.",
    tooLong: "Kata sandi maksimal 72 byte. Persingkat sedikit.",
    mismatch: "Kedua kata sandi belum sama.",
    serverRejectedPassword:
      "Server menolak kata sandi ini. Pakai minimal 12 karakter dan maksimal 72 byte, lalu ulangi persis sama.",
    submitNote: "Tautan dipakai saat Anda menekan tombol ini, bukan sebelumnya.",
    submit: "Simpan dan lanjut",
    saving: "Menyimpan",
    redeemUncertain:
      "Server tidak memberi jawaban yang pasti, jadi tautan mungkin sudah terpakai. Periksa tautan dulu: bila masih berlaku, Anda dapat mengirim lagi.",
    checkLink: "Periksa tautan",
    stillValid: "Tautan masih berlaku dan belum dipakai. Anda dapat mengirim lagi.",
  },
  enrollment: {
    title: "Daftarkan aplikasi autentikator",
    lede: "Pindai kode QR dengan aplikasi autentikator berbasis waktu (TOTP) di ponsel Anda, lalu masukkan kode 6 digit yang muncul di aplikasi.",
    qrAlt: "Kode QR untuk mendaftarkan Konsol admin Solveit di aplikasi autentikator",
    manualTitle: "Tidak bisa memindai?",
    manualBody:
      "Masukkan kunci ini secara manual di aplikasi autentikator, dengan jenis berbasis waktu.",
    setupKey: "Kunci pengaturan",
    copyKey: "Salin kunci",
    deadline: (time: string) =>
      `Selesaikan sebelum pukul ${time}. Setelah itu tautan baru diperlukan.`,
    shownOnce:
      "Kode QR dan kunci ini hanya ditampilkan sekali dan tidak disimpan konsol. Bila halaman dimuat ulang sebelum selesai, minta tautan baru.",
    code: "Kode 6 digit dari aplikasi",
    submitActivation: "Konfirmasi dan aktifkan akun",
    submitReset: "Konfirmasi autentikator baru",
    confirming: "Mengonfirmasi",
    wrongCode: "Kode tidak cocok. Belum ada yang berubah; masukkan kode berikutnya dari aplikasi.",
    gone: "Pendaftaran ini tidak dapat diselesaikan: waktunya habis, tautannya dicabut, atau browser kehilangan sesinya. Minta tautan baru.",
    uncertain:
      "Server tidak memberi jawaban yang pasti. Periksa apakah akun sudah aktif sebelum memasukkan kode lagi.",
    checkAccount: "Periksa akun",
    notYet: "Akun belum aktif. Masukkan kode berikutnya dari aplikasi.",
    activeWithoutCodes:
      "Akun sudah aktif dan Anda sudah masuk, tetapi kode pemulihannya tidak dapat ditampilkan lagi. Buat kode pemulihan baru di halaman Keamanan sekarang.",
    toSecurity: "Buka Keamanan",
  },
  recoveryCodes: {
    title: "Simpan kode pemulihan Anda",
    lede: "Setiap kode dapat dipakai sekali untuk masuk bila aplikasi autentikator tidak tersedia. Ini satu-satunya saat kode ditampilkan: konsol tidak menyimpannya dan tidak dapat menampilkannya lagi.",
    where:
      "Simpan di pengelola kata sandi, atau cetak dan simpan di tempat aman, di luar konsol ini dan terpisah dari perangkat autentikator.",
    listLabel: "Kode pemulihan",
    copyAll: "Salin semua kode",
    acknowledge: "Saya sudah menyimpan kode ini di tempat aman di luar konsol",
    acknowledgeFirst: "Centang konfirmasi di atas setelah kode tersimpan.",
    continueToConsole: "Lanjut ke konsol",
    done: "Selesai",
    previousInvalid: "Kode pemulihan lama sudah tidak berlaku.",
    leaveTitle: "Kode pemulihan belum disimpan",
    leaveBody:
      "Bila Anda meninggalkan halaman ini sekarang, kode tidak dapat ditampilkan lagi dan Anda harus membuat kode baru.",
    stay: "Tetap di sini",
    leave: "Tinggalkan halaman",
  },
  home: {
    title: "Beranda konsol",
    lede: (name: string, role: string) => `Anda masuk sebagai ${name}, ${role}.`,
    sessionTitle: "Sesi ini",
    signedInAt: "Masuk pada",
    endsBy: "Berakhir paling lambat",
    idleRule: (minutes: number) => `Berakhir lebih awal setelah ${minutes} menit tanpa aktivitas.`,
    shortcutsTitle: "Akun Anda",
    accountLink: "Akun",
    authenticatorOn: "autentikator aktif",
    authenticatorOff: "autentikator belum terkonfirmasi",
    securityLink: "Keamanan",
    operationsTitle: "Operasional",
    inquiriesLink: "Inquiry",
    inquiriesDetail: "Pesan dari formulir website, status, dan catatan tim",
    administrationTitle: "Administrasi",
    usersLink: "Pengguna",
    usersDetail: "Akun, peran, penangguhan, dan reset kredensial",
    invitationsLink: "Undangan",
    invitationsDetail: "Tautan aktivasi untuk akun baru",
    auditLink: "Audit log",
    auditDetail: "Kejadian keamanan dan administrasi",
    lowCodes: (count: number) =>
      count === 0
        ? "Kode pemulihan Anda sudah habis. Buat kode baru di Keamanan sebelum Anda membutuhkannya."
        : `Tersisa ${count} kode pemulihan. Buat kode baru di Keamanan sebelum habis.`,
  },
  account: {
    title: "Akun",
    lede: "Data akun Anda seperti yang tercatat di server. Nama dan email belum dapat diubah dari konsol.",
    profileTitle: "Profil",
    name: "Nama",
    email: "Email",
    role: "Peran",
    roleDetail: {
      owner:
        "Mengelola pengguna, undangan, peran, penangguhan, dan reset kredensial, membaca audit log, dan menangani inquiry.",
      admin: "Mengelola keamanan akun sendiri dan menangani inquiry.",
      none: "Akun tanpa peran tidak dapat memakai konsol.",
    },
    authenticatorTitle: "Autentikator",
    totp: "Aplikasi autentikator",
    totpActive: (since: string) => `Aktif sejak ${since}`,
    totpMissing: "Belum terkonfirmasi",
    recoveryCodes: "Kode pemulihan",
    recoveryRemaining: (count: number) => `${count} kode tersisa`,
    sessionTitle: "Sesi ini",
    manageSecurity: "Kelola keamanan",
  },
  security: {
    title: "Keamanan akun",
    lede: "Kata sandi, kode pemulihan, dan perangkat yang sedang masuk. Setiap perubahan dicatat di audit log.",
    password: {
      title: "Ganti kata sandi",
      body: "Sesi di perangkat lain berakhir saat kata sandi diganti; sesi ini tetap berjalan.",
      current: "Kata sandi sekarang",
      currentMissing: "Isi kata sandi sekarang.",
      currentWrong: "Kata sandi sekarang tidak cocok.",
      newRejected:
        "Server menolak kata sandi baru: pakai minimal 12 karakter, maksimal 72 byte, dan berbeda dari kata sandi lama.",
      submit: "Ganti kata sandi",
      submitting: "Mengganti",
      changed: (ended: number) =>
        ended === 0
          ? "Kata sandi diganti. Tidak ada sesi lain yang perlu diakhiri."
          : `Kata sandi diganti. ${ended} sesi lain diakhiri.`,
      uncertain:
        "Server tidak memberi jawaban yang pasti, jadi kata sandi mungkin sudah diganti. Bila Anda mengirim lagi dan kata sandi sekarang ditolak, berarti kata sandi baru sudah berlaku.",
    },
    recovery: {
      title: "Kode pemulihan",
      remaining: (count: number) =>
        count === 1 ? "1 kode pemulihan tersisa." : `${count} kode pemulihan tersisa.`,
      body: "Membuat kode baru membatalkan semua kode lama. Kode baru ditampilkan sekali.",
      action: "Buat kode pemulihan baru",
      confirmTitle: "Buat kode pemulihan baru?",
      confirmBody:
        "Semua kode pemulihan lama berhenti berlaku saat kode baru dibuat. Siapkan tempat aman untuk menyimpan yang baru.",
      confirmAction: "Buat kode baru",
      creating: "Membuat kode",
      uncertain:
        "Server tidak memberi jawaban yang pasti. Kode lama mungkin sudah tidak berlaku; buat kode baru sekali lagi agar Anda memegang kode yang pasti berlaku.",
    },
    reauth: {
      title: "Konfirmasi kata sandi",
      body: "Tindakan ini butuh konfirmasi kata sandi dalam 15 menit terakhir.",
      password: "Kata sandi",
      submit: "Konfirmasi",
      confirming: "Mengonfirmasi",
      wrong: "Kata sandi tidak cocok.",
      confirmedTitle: "Kata sandi dikonfirmasi",
      confirmedBody:
        "Belum ada kode yang dibuat. Tekan tombol di bawah untuk membuat kode pemulihan baru; kode lama lalu berhenti berlaku.",
    },
    sessions: {
      title: "Perangkat yang sedang masuk",
      body: "Sesi akun ini seperti yang dicatat server. Mengakhiri sesi membuat perangkat itu harus masuk lagi.",
      loading: "Memuat daftar sesi",
      loadFailed: "Daftar sesi belum dapat dimuat.",
      current: "Perangkat ini",
      lastActive: "Aktif terakhir",
      ipAddress: "Alamat IP",
      browser: "Identitas browser",
      unknownDevice: "Perangkat tidak dikenali",
      end: "Akhiri sesi",
      ending: "Mengakhiri",
      endAll: "Akhiri semua sesi lain",
      none: "Tidak ada sesi lain. Hanya perangkat ini yang sedang masuk.",
      endTitle: "Akhiri sesi ini?",
      endBody:
        "Perangkat itu harus masuk lagi dengan kata sandi dan kode autentikator. Sesi ini tidak terpengaruh.",
      endAllTitle: "Akhiri semua sesi lain?",
      endAllBody: "Semua perangkat lain harus masuk lagi. Sesi ini tetap berjalan.",
      ended: "Sesi diakhiri.",
      endedAll: (count: number) =>
        count === 0 ? "Tidak ada sesi lain yang perlu diakhiri." : `${count} sesi lain diakhiri.`,
      alreadyGone: "Sesi itu sudah berakhir sebelumnya.",
      uncertain:
        "Server tidak memberi jawaban yang pasti. Muat ulang daftar untuk melihat keadaan sekarang sebelum mencoba lagi.",
      refresh: "Muat ulang daftar",
    },
  },
  idle: {
    title: "Sesi akan berakhir",
    body: (time: string) =>
      `Tidak ada aktivitas di konsol selama hampir 30 menit. Sesi berakhir dalam ${time} kecuali Anda tetap masuk.`,
    stay: "Tetap masuk",
    staying: "Memperpanjang",
    signOut: "Keluar sekarang",
    absoluteTitle: "Batas sesi 12 jam hampir tercapai",
    absoluteBody: (time: string) =>
      `Sesi ini berakhir dalam ${time} dan tidak dapat diperpanjang. Selesaikan pekerjaan Anda, lalu masuk lagi.`,
    understood: "Mengerti",
  },
  sessionCheck: {
    checking: "Memeriksa sesi",
    unavailableTitle: "Sesi belum dapat diperiksa",
    unavailableBody:
      "Server tidak memberi jawaban yang dapat dipercaya, jadi konsol tidak menampilkan data akun. Coba lagi sebentar lagi.",
    forbiddenTitle: "Permintaan ditolak",
    forbiddenBody:
      "Batas keamanan admin menolak pemeriksaan sesi. Data akun tidak ditampilkan. Buka konsol dari alamat resminya.",
    toSignIn: "Ke halaman masuk",
  },
  phases: {
    title: "Tahap pembangunan",
    intro: "API dan konsol admin sudah dirilis ke main, tetapi belum di-deploy ke mana pun.",
    status: {
      released: "Dirilis, belum di-deploy",
      current: "Sedang dibangun",
      planned: "Direncanakan",
    } satisfies Record<PhaseStatus, string>,
    items: {
      b31a: {
        title: "Identitas backend",
        detail:
          "Tautan akses sekali pakai, TOTP wajib, sesi database, peran owner dan admin, audit log hanya-tambah.",
      },
      b31b: {
        title: "Administrasi pengguna dan audit (API)",
        detail:
          "Undangan, perubahan peran, penangguhan, reset kredensial, dan pembacaan audit khusus owner.",
      },
      b32a: {
        title: "Fondasi konsol",
        detail:
          "Kerangka aplikasi, design system bersama website, klien API dengan CSRF, pengembangan native dan Docker, CI.",
      },
      b32b: {
        title: "Masuk, aktivasi, dan pemulihan",
        detail:
          "Masuk dengan kata sandi dan TOTP, aktivasi dan reset lewat tautan, keamanan akun sendiri.",
      },
      b32c: {
        title: "Ruang kerja administrasi",
        detail: "Pengguna, undangan, peran, penangguhan, dan audit log untuk owner.",
      },
      b32d: {
        title: "Rilis admin privat",
        detail:
          "Image produksi, listener admin terpisah (loopback secara default), header keamanan, smoke test.",
      },
      b4a: {
        title: "Pengelolaan inquiry (API)",
        detail:
          "Kontak disamarkan, alur status dengan riwayat, catatan internal hanya-tambah, pembukaan kontak yang dicatat.",
      },
      b4b: {
        title: "Konsol inquiry",
        detail:
          "Daftar dan detail inquiry, perubahan status yang aman dari tabrakan, catatan tim, dan pembukaan kontak yang disengaja.",
      },
    } satisfies Record<PhaseCode, { title: string; detail: string }>,
  },
  notFound: {
    title: "Halaman tidak ditemukan",
    body: "Alamat ini tidak ada di konsol admin. Periksa ejaannya, atau kembali ke beranda konsol.",
    back: "Ke beranda konsol",
  },
  error: {
    title: "Halaman gagal dimuat",
    body: "Terjadi kesalahan di konsol. Muat ulang halaman; bila terus terjadi, catat waktunya untuk pemeriksaan.",
    reload: "Muat ulang",
    back: "Ke beranda konsol",
  },
};

export type Messages = typeof id;
