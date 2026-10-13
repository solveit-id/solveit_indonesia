import type { FaqItem, ServiceCopy, ServiceId } from "~/types/content";

export const services: Record<ServiceId, ServiceCopy> = {
  website: {
    name: "Pengembangan Website",
    shortName: "Website",
    summary:
      "Website profil perusahaan, landing page, dan katalog yang cepat dibuka, mudah dikelola, dan siap ditemukan di mesin pencari.",
    forWhom:
      "Bisnis dan organisasi yang butuh kehadiran online yang kredibel, atau ingin mengganti website lama yang lambat dan sulit diperbarui.",
    examples: ["Company profile", "Landing page kampanye", "Katalog produk", "Portal informasi"],
    deliverables: [
      "Desain responsif untuk ponsel, tablet, dan desktop",
      "Struktur halaman dan konten yang jelas",
      "SEO teknis dasar: metadata, sitemap, dan data terstruktur",
      "Optimasi kecepatan dan aksesibilitas",
    ],
  },
  "aplikasi-web": {
    name: "Aplikasi Web",
    shortName: "Aplikasi web",
    summary:
      "Aplikasi berbasis browser untuk pelanggan atau tim internal: portal, dashboard, pemesanan, dan alur kerja yang selama ini dikerjakan manual.",
    forWhom:
      "Startup dan perusahaan yang ingin memindahkan proses bisnis ke sistem online tanpa memasang aplikasi di setiap perangkat.",
    examples: [
      "Portal pelanggan",
      "Sistem pemesanan",
      "Dashboard operasional",
      "Aplikasi internal",
    ],
    deliverables: [
      "Analisis alur pengguna dan hak akses",
      "Antarmuka yang dirancang untuk pekerjaan harian",
      "Integrasi API dan basis data",
      "Dokumentasi teknis untuk serah terima",
    ],
  },
  "sistem-informasi": {
    name: "Sistem Informasi",
    shortName: "Sistem informasi",
    summary:
      "Sistem untuk mencatat, mengolah, dan melaporkan data operasional, sehingga keputusan diambil dari data yang rapi dan satu sumber.",
    forWhom:
      "Klinik, sekolah, koperasi, gudang, dan instansi yang datanya masih tersebar di kertas, spreadsheet, atau aplikasi yang tidak saling terhubung.",
    examples: ["Inventori", "Akademik", "Klinik dan antrean", "Kepegawaian"],
    deliverables: [
      "Pemodelan data sesuai proses yang berjalan",
      "Peran pengguna dan hak akses bertingkat",
      "Laporan dan ekspor data",
      "Pelatihan pengguna saat implementasi",
    ],
  },
  "custom-software": {
    name: "Custom Software",
    shortName: "Custom software",
    summary:
      "Perangkat lunak yang dibangun untuk alur kerja yang tidak tertangani produk siap pakai: otomasi, integrasi antarsistem, dan layanan API.",
    forWhom:
      "Tim yang sudah mencoba aplikasi umum, tetapi proses bisnisnya terlalu spesifik untuk disesuaikan tanpa kompromi.",
    examples: ["Integrasi antarsistem", "Otomasi proses", "Layanan API", "Alat internal khusus"],
    deliverables: [
      "Pemetaan proses dan titik integrasi",
      "Arsitektur yang bisa dikembangkan bertahap",
      "Pengujian pada skenario nyata",
      "Kode dan dokumentasi yang dapat dirawat tim lain",
    ],
  },
  "dukungan-teknis": {
    name: "Dukungan Teknis dan Pemeliharaan",
    shortName: "Dukungan teknis",
    summary:
      "Pemeliharaan setelah sistem berjalan: pembaruan keamanan, perbaikan, pemantauan, dan pengembangan fitur lanjutan.",
    forWhom:
      "Pemilik website atau aplikasi yang ingin sistemnya tetap aman, berjalan baik, dan terus berkembang bersama bisnis.",
    examples: ["Pembaruan keamanan", "Perbaikan bug", "Pencadangan data", "Fitur lanjutan"],
    deliverables: [
      "Jadwal pemeliharaan yang disepakati",
      "Penanganan masalah sesuai prioritas",
      "Catatan perubahan untuk setiap pembaruan",
      "Rekomendasi pengembangan berikutnya",
    ],
  },
};

export const serviceFaq: FaqItem[] = [
  {
    question: "Berapa biaya membuat website atau aplikasi di Solveit Indonesia?",
    answer:
      "Biaya bergantung pada ruang lingkup, jumlah fitur, dan integrasi yang dibutuhkan. Setelah konsultasi dan analisis kebutuhan, Anda menerima estimasi tertulis sebelum pekerjaan dimulai.",
  },
  {
    question: "Apakah Solveit Indonesia melayani bisnis kecil dan UMKM?",
    answer:
      "Ya. Kami melayani individu, UMKM, startup, organisasi, dan perusahaan. Ruang lingkup disusun sesuai kebutuhan dan tahap bisnis Anda, termasuk pengembangan bertahap.",
  },
  {
    question: "Apakah website atau sistem bisa dikembangkan lagi setelah selesai?",
    answer:
      "Bisa. Kami menyusun kode dan dokumentasi agar sistem mudah dirawat, lalu menyediakan layanan dukungan teknis dan pengembangan fitur lanjutan.",
  },
];
