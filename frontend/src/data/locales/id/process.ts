import type { FaqItem, ProcessStepCopy, ProcessStepId } from "~/types/content";

export const process: Record<ProcessStepId, ProcessStepCopy> = {
  konsultasi: {
    name: "Konsultasi",
    description:
      "Kita membahas tujuan bisnis, masalah yang ingin diselesaikan, pengguna, dan batasan waktu atau anggaran.",
    output: "Ringkasan kebutuhan dan rekomendasi awal",
    clientRole: "Menjelaskan tujuan, kendala, dan contoh proses yang berjalan saat ini.",
  },
  analisis: {
    name: "Analisis kebutuhan",
    description:
      "Kami memetakan proses yang berjalan, data yang dikelola, dan fitur yang benar-benar diperlukan pada tahap pertama.",
    output: "Ruang lingkup tertulis, estimasi waktu, dan estimasi biaya",
    clientRole: "Meninjau ruang lingkup dan menentukan prioritas fitur tahap pertama.",
  },
  desain: {
    name: "Desain",
    description:
      "Alur pengguna dan antarmuka dirancang lebih dulu, sehingga Anda bisa melihat dan menyetujui arah produk sebelum dibangun.",
    output: "Alur pengguna dan desain antarmuka untuk disetujui",
    clientRole: "Memberi masukan pada desain dan menyetujui arah sebelum pengembangan.",
  },
  pengembangan: {
    name: "Pengembangan",
    description:
      "Sistem dibangun bertahap. Setiap tahap bisa Anda tinjau melalui versi pratinjau, sehingga masukan masuk lebih awal.",
    output: "Akses pratinjau berkala dan catatan progres",
    clientRole: "Mencoba versi pratinjau dan menyampaikan masukan di setiap tahap.",
  },
  pengujian: {
    name: "Pengujian",
    description:
      "Fitur diuji pada skenario nyata, di berbagai perangkat dan ukuran layar, termasuk kasus yang jarang terjadi.",
    output: "Daftar hasil uji dan perbaikan yang sudah dilakukan",
    clientRole: "Melakukan uji penerimaan bersama pengguna yang akan memakai sistem.",
  },
  implementasi: {
    name: "Implementasi",
    description:
      "Sistem dipasang di lingkungan produksi, data awal disiapkan, dan tim Anda dibekali cara menggunakannya.",
    output: "Sistem siap pakai, serah terima, dan panduan penggunaan",
    clientRole: "Menyiapkan data awal dan menunjuk pengguna yang akan dilatih.",
  },
  dukungan: {
    name: "Dukungan",
    description:
      "Setelah rilis, kami menangani pemeliharaan, pembaruan keamanan, dan pengembangan lanjutan sesuai kesepakatan.",
    output: "Pemeliharaan terjadwal dan rencana pengembangan berikutnya",
    clientRole: "Melaporkan kendala dan menyampaikan kebutuhan yang muncul setelah rilis.",
  },
};

export const processFaq: FaqItem[] = [
  {
    question: "Berapa lama proses pembuatan website atau aplikasi?",
    answer:
      "Durasi ditentukan oleh ruang lingkup. Website profil biasanya lebih singkat daripada sistem informasi atau aplikasi dengan banyak peran pengguna. Estimasi waktu dicantumkan di ruang lingkup tertulis setelah tahap analisis.",
  },
  {
    question: "Apakah saya bisa melihat progres selama pengembangan?",
    answer:
      "Bisa. Pengembangan dilakukan bertahap dan setiap tahap dapat ditinjau melalui versi pratinjau. Ke depan, progres dan revisi akan dapat dipantau langsung melalui Solveit OpsHub.",
  },
  {
    question: "Bagaimana jika ada revisi di tengah pengerjaan?",
    answer:
      "Revisi dicatat dan dibandingkan dengan ruang lingkup yang disepakati. Revisi yang masih di dalam ruang lingkup dikerjakan langsung, sedangkan perubahan besar dibahas bersama dampaknya pada waktu dan biaya.",
  },
  {
    question: "Apa yang saya terima di akhir proyek?",
    answer:
      "Sistem yang berjalan di lingkungan produksi, akses administrator, panduan penggunaan, dan dokumentasi teknis yang dibutuhkan untuk pemeliharaan.",
  },
];
