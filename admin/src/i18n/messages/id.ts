import type { PhaseCode, PhaseStatus } from "~/app/phases";

/**
 * Interface copy, Indonesian (default). Every string exists in English too (en.ts); TypeScript
 * fails the build when one is missing. Rules: sentence case, no em dash, no claim the console
 * cannot back (docs/design/design-system.md, Aturan konten).
 */
export const id = {
  meta: {
    product: "Konsol admin",
    owner: "Solveit Indonesia",
  },
  shell: {
    skipToContent: "Langsung ke konten",
    consoleName: "Konsol admin",
    environmentLead: "Fondasi B3.2a",
    environmentDetail: "belum untuk produksi",
    navigation: "Navigasi utama",
    openMenu: "Menu",
    loadingRoute: "Memuat halaman",
  },
  nav: {
    foundation: "Ikhtisar fondasi",
    reference: "Referensi komponen",
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
  foundation: {
    title: "Fondasi konsol admin",
    lede: "Kerangka aplikasi, design system, dan klien API untuk mengelola website Solveit. Belum ada layar masuk dan belum ada data: keduanya datang setelah alurnya dibangun dan dites.",
    phasesTitle: "Tahap pembangunan",
    phasesIntro:
      "API admin sudah dirilis ke main, tetapi belum di-deploy ke mana pun. Konsol ini menyusul per fase.",
    phaseStatus: {
      released: "Dirilis, belum di-deploy",
      current: "Sedang dibangun",
      planned: "Direncanakan",
    } satisfies Record<PhaseStatus, string>,
    phases: {
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
    } satisfies Record<PhaseCode, { title: string; detail: string }>,
    connection: {
      title: "Koneksi ke API admin",
      body: "Satu permintaan nyata, GET /api/v1/admin/auth/csrf-cookie, lewat proxy satu origin. Permintaan ini memulai sesi anonim dan tidak memasukkan siapa pun.",
      action: "Periksa koneksi",
      checking: "Memeriksa koneksi",
      idle: "Belum diperiksa.",
      reachable: "API admin menjawab (204). Host dan origin cocok dengan ADMIN_URL.",
      refused: (status: number, origin: string) =>
        `Ditolak oleh batas admin (${status}). ADMIN_URL di backend harus sama dengan origin ini: ${origin}.`,
      unavailable: "API admin menolak berjalan (503): driver sesi backend bukan database.",
      rateLimited: (seconds: number | undefined) =>
        seconds === undefined
          ? "Terlalu sering diperiksa. Coba lagi sebentar lagi."
          : `Terlalu sering diperiksa. Coba lagi dalam ${seconds} detik.`,
      // {command} and {path} are set as code by the screen.
      unreachable:
        "Laravel tidak menjawab. Jalankan {command} di {path} atau layanan backend Docker, lalu periksa lagi.",
      unexpected: (status: number | null) =>
        `Jawaban tidak terduga${status === null ? "" : ` (${status})`}. Periksa log Laravel.`,
      checkedAt: (time: string) => `Diperiksa pukul ${time}`,
    },
  },
  notFound: {
    title: "Halaman tidak ditemukan",
    body: "Alamat ini tidak ada di konsol admin. Layar masuk dan administrasi belum dibangun, jadi tautan ke sana belum berfungsi.",
    back: "Kembali ke ikhtisar",
  },
  error: {
    title: "Halaman gagal dimuat",
    body: "Terjadi kesalahan di konsol. Muat ulang halaman; bila terus terjadi, catat waktunya untuk pemeriksaan.",
    reload: "Muat ulang",
    back: "Kembali ke ikhtisar",
  },
};

export type Messages = typeof id;
