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
};

export const referenceCopy: Record<Locale, ReferenceCopy> = { id, en };
