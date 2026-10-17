import type { Locale } from "~/i18n/i18n";

/**
 * Copy of the component reference, kept beside the page instead of in the message catalogue,
 * so production builds (which drop the page) carry none of it. Sample text, labelled as such.
 */
const id = {
  title: "Referensi komponen",
  lede: "Komponen dasar konsol dengan semua keadaannya, untuk pengembangan dan QA. Halaman ini tidak ada di build produksi, dan isinya contoh, bukan data.",
  buttons: "Tombol",
  primary: "Simpan perubahan",
  secondary: "Batalkan",
  quiet: "Lihat detail",
  danger: "Tangguhkan akun",
  busy: "Menyimpan",
  disabled: "Tidak tersedia",
  fields: "Isian",
  emailLabel: "Alamat email",
  emailHint: "Contoh isian; tidak dikirim ke mana pun.",
  emailError: "Masukkan alamat email yang valid.",
  statuses: "Status",
  states: "Keadaan tampilan",
  loading: "Memuat",
  empty: "Kosong",
  emptyTitle: "Belum ada undangan",
  emptyBody: "Undangan yang diterbitkan owner akan tampil di sini, dengan statusnya.",
  failed: "Gagal",
  failedTitle: "Daftar gagal dimuat",
  failedBody: "API admin tidak menjawab. Coba lagi; tidak ada yang berubah.",
  retry: "Coba lagi",
  feedback: "Pesan dan langkah",
  noticeInfo: "Contoh pesan informasi tentang keadaan layar.",
  noticeSuccess: "Contoh pesan berhasil setelah tindakan selesai.",
  noticeWarning: "Contoh peringatan yang perlu diperhatikan.",
  noticeDanger: "Contoh galat yang menyebut masalah dan langkah berikutnya.",
  stepsLabel: "Contoh langkah",
  steps: ["Langkah satu", "Langkah dua", "Langkah tiga"],
  passwordLabel: "Kata sandi contoh",
  dialogOpen: "Buka dialog contoh",
  dialogTitle: "Dialog contoh",
  dialogBody: "Contoh keputusan yang harus dikonfirmasi. Tidak ada yang dikirim.",
  dialogConfirm: "Konfirmasi",
  dialogCancel: "Batal",
  connection: {
    title: "Koneksi ke API admin (pengembangan)",
    body: "Satu permintaan nyata, GET /api/v1/admin/auth/csrf-cookie, lewat proxy satu origin. Permintaan ini memulai sesi anonim dan tidak memasukkan siapa pun. Hanya ada di build pengembangan dan QA.",
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
};

export type ReferenceCopy = typeof id;

const en: ReferenceCopy = {
  title: "Component reference",
  lede: "The console's base components in all their states, for development and QA. This page is not part of production builds, and its content is sample text, not data.",
  buttons: "Buttons",
  primary: "Save changes",
  secondary: "Cancel",
  quiet: "View details",
  danger: "Suspend account",
  busy: "Saving",
  disabled: "Not available",
  fields: "Fields",
  emailLabel: "Email address",
  emailHint: "Sample field; nothing is sent anywhere.",
  emailError: "Enter a valid email address.",
  statuses: "Statuses",
  states: "View states",
  loading: "Loading",
  empty: "Empty",
  emptyTitle: "No invitations yet",
  emptyBody: "Invitations an owner issues will appear here, with their status.",
  failed: "Failed",
  failedTitle: "The list failed to load",
  failedBody: "The admin API did not answer. Try again; nothing has changed.",
  retry: "Try again",
  feedback: "Messages and steps",
  noticeInfo: "Sample information about the state of a screen.",
  noticeSuccess: "Sample success message after an action finished.",
  noticeWarning: "Sample warning that needs attention.",
  noticeDanger: "Sample error that names the problem and the next step.",
  stepsLabel: "Sample steps",
  steps: ["Step one", "Step two", "Step three"],
  passwordLabel: "Sample password",
  dialogOpen: "Open sample dialog",
  dialogTitle: "Sample dialog",
  dialogBody: "A sample decision that must be confirmed. Nothing is sent.",
  dialogConfirm: "Confirm",
  dialogCancel: "Cancel",
  connection: {
    title: "Admin API connection (development)",
    body: "One real request, GET /api/v1/admin/auth/csrf-cookie, through the same-origin proxy. It starts an anonymous session and signs nobody in. Only in development and QA builds.",
    action: "Check connection",
    checking: "Checking connection",
    idle: "Not checked yet.",
    reachable: "The admin API answered (204). Host and origin match ADMIN_URL.",
    refused: (status: number, origin: string) =>
      `Refused by the admin boundary (${status}). The backend's ADMIN_URL must equal this origin: ${origin}.`,
    unavailable: "The admin API refuses to run (503): the backend session driver is not database.",
    rateLimited: (seconds: number | undefined) =>
      seconds === undefined
        ? "Checked too often. Try again shortly."
        : `Checked too often. Try again in ${seconds} seconds.`,
    unreachable:
      "Laravel is not answering. Start {command} in {path} or the Docker backend service, then check again.",
    unexpected: (status: number | null) =>
      `Unexpected answer${status === null ? "" : ` (${status})`}. Check the Laravel log.`,
    checkedAt: (time: string) => `Checked at ${time}`,
  },
};

export const referenceCopy: Record<Locale, ReferenceCopy> = { id, en };
