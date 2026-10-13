import type { ProjectKey } from "~/data/projects";
import type { ProjectCategory, ProjectCopy } from "~/types/content";

/** Demonstration concepts only: `results` stays empty (see src/data/projects.ts). */
export const projects: Record<ProjectKey, ProjectCopy> = {
  "sistem-antrean-klinik": {
    title: "Sistem Antrean dan Rekam Medis Klinik",
    sector: "Layanan kesehatan",
    summary:
      "Konsep sistem yang menyatukan pendaftaran, antrean, dan rekam medis klinik pratama dalam satu alur.",
    context:
      "Klinik pratama dengan satu meja pendaftaran dan beberapa ruang periksa. Pendaftaran dicatat di buku, antrean dipanggil manual, dan riwayat pasien tersimpan di map fisik.",
    problem:
      "Pasien tidak tahu perkiraan waktu tunggu, petugas menulis data yang sama berulang kali, dan dokter sulit melihat riwayat kunjungan sebelumnya.",
    solution:
      "Pendaftaran daring dan di tempat masuk ke satu antrean. Layar ruang tunggu menampilkan nomor yang dipanggil, sementara dokter membuka rekam medis pasien dari ruang periksa.",
    flow: [
      "Pasien mendaftar",
      "Nomor antrean terbit",
      "Dipanggil ke ruang periksa",
      "Dokter mencatat pemeriksaan",
      "Riwayat tersimpan",
    ],
    features: [
      {
        name: "Antrean multi-poli",
        description: "Satu antrean per poli dengan layar panggilan untuk ruang tunggu.",
      },
      {
        name: "Rekam medis elektronik",
        description: "Riwayat kunjungan, diagnosis, dan tindakan dalam satu halaman pasien.",
      },
      {
        name: "Peran pengguna",
        description: "Hak akses berbeda untuk petugas pendaftaran, dokter, dan pengelola klinik.",
      },
      { name: "Laporan harian", description: "Rekap kunjungan per poli yang dapat diekspor." },
    ],
    system: {
      actors: ["Meja pendaftaran", "Antrean dan layar panggil", "Ruang periksa", "Rekam medis"],
      handoffs: ["Data pasien", "Nomor dipanggil", "Catatan pemeriksaan"],
    },
    results: [],
    metricsToTrack: [
      "Rata-rata waktu tunggu pasien",
      "Waktu pendaftaran per pasien",
      "Kelengkapan data rekam medis",
    ],
  },
  "pemesanan-katering-harian": {
    title: "Platform Pemesanan Katering Harian",
    sector: "Kuliner dan UMKM",
    summary:
      "Konsep aplikasi web untuk usaha katering rumahan: menu mingguan, pemesanan berlangganan, dan rekap produksi dapur.",
    context:
      "Usaha katering yang menerima pesanan lewat pesan singkat. Pemilik merekap pesanan setiap malam untuk menentukan belanja bahan dan jumlah porsi.",
    problem:
      "Pesanan mudah terlewat, perubahan menu sulit diumumkan, dan rekap manual menyita waktu yang seharusnya dipakai untuk produksi.",
    solution:
      "Pelanggan memilih menu dan jadwal langganan dari ponsel. Sistem menyusun rekap porsi per hari dan daftar pengantaran secara otomatis.",
    flow: [
      "Menu mingguan terbit",
      "Pelanggan memesan",
      "Pesanan terkonfirmasi",
      "Rekap produksi disusun",
      "Pesanan diantar",
    ],
    features: [
      { name: "Menu mingguan", description: "Pengelolaan menu dan kuota porsi per hari." },
      { name: "Langganan", description: "Pesanan berulang untuk beberapa hari sekaligus." },
      {
        name: "Rekap dapur",
        description: "Jumlah porsi dan kebutuhan bahan per tanggal produksi.",
      },
      { name: "Daftar pengantaran", description: "Urutan alamat pengantaran untuk kurir." },
    ],
    system: {
      actors: ["Pelanggan", "Menu dan pesanan", "Dapur", "Kurir"],
      handoffs: ["Pilihan menu", "Rekap porsi", "Daftar antar"],
    },
    results: [],
    metricsToTrack: [
      "Pesanan yang terlewat per minggu",
      "Waktu rekap harian",
      "Pelanggan berlangganan aktif",
    ],
  },
  "inventori-gudang-distribusi": {
    title: "Integrasi Inventori Gudang Distribusi",
    sector: "Distribusi dan logistik",
    summary:
      "Konsep perangkat lunak yang menghubungkan stok gudang, pesanan masuk, dan pengiriman dengan pemindaian barcode.",
    context:
      "Distributor dengan dua gudang yang mencatat stok di spreadsheet terpisah. Pesanan dari tim penjualan dicek manual ke masing-masing gudang.",
    problem:
      "Selisih stok baru diketahui saat barang akan dikirim, dan tim penjualan tidak tahu stok aktual tanpa menghubungi gudang.",
    solution:
      "Setiap barang masuk dan keluar dipindai. Stok kedua gudang tampil di satu layar, dan pesanan otomatis diarahkan ke gudang yang stoknya cukup.",
    flow: [
      "Barang masuk dipindai",
      "Stok diperbarui",
      "Pesanan diterima",
      "Gudang dipilih otomatis",
      "Barang keluar dipindai",
    ],
    features: [
      {
        name: "Pemindaian barcode",
        description: "Pencatatan barang masuk dan keluar dari perangkat genggam.",
      },
      { name: "Stok multi-gudang", description: "Posisi stok seluruh gudang dalam satu tampilan." },
      {
        name: "Alokasi pesanan",
        description: "Aturan pemilihan gudang berdasarkan stok dan lokasi.",
      },
      { name: "Riwayat pergerakan", description: "Jejak setiap perubahan stok untuk audit." },
    ],
    system: {
      actors: ["Pemindai gudang", "Stok multi-gudang", "Alokasi pesanan", "Pengiriman"],
      handoffs: ["Barang masuk dan keluar", "Posisi stok", "Gudang terpilih"],
    },
    results: [],
    metricsToTrack: [
      "Selisih stok saat stock opname",
      "Waktu pengecekan stok",
      "Pesanan tertunda karena stok",
    ],
  },
  "portal-akademik-sekolah": {
    title: "Portal Akademik Sekolah",
    sector: "Pendidikan",
    summary:
      "Konsep sistem informasi akademik untuk jadwal, nilai, dan komunikasi antara sekolah, guru, dan orang tua.",
    context:
      "Sekolah menengah yang membagikan jadwal dan nilai lewat berkas cetak, sementara pengumuman tersebar di banyak grup pesan.",
    problem:
      "Orang tua sering tertinggal informasi, guru mengisi nilai di beberapa format, dan rekap rapor memakan waktu di akhir semester.",
    solution:
      "Guru mengisi nilai di satu tempat, rapor disusun otomatis, dan orang tua menerima pengumuman serta perkembangan anak melalui portal.",
    flow: [
      "Jadwal disusun",
      "Guru mengisi nilai",
      "Rapor tersusun",
      "Orang tua memantau",
      "Pengumuman terkirim",
    ],
    features: [
      {
        name: "Jadwal dan kelas",
        description: "Pengelolaan rombongan belajar, mata pelajaran, dan jadwal.",
      },
      { name: "Penilaian", description: "Input nilai per kompetensi dengan rekap otomatis." },
      { name: "Portal orang tua", description: "Akses perkembangan nilai dan kehadiran anak." },
      {
        name: "Pengumuman",
        description: "Informasi sekolah yang tersampaikan ke kelompok yang tepat.",
      },
    ],
    system: {
      actors: ["Guru", "Nilai dan jadwal", "Rapor", "Portal orang tua"],
      handoffs: ["Input nilai", "Rekap otomatis", "Perkembangan anak"],
    },
    results: [],
    metricsToTrack: [
      "Waktu penyusunan rapor",
      "Keterbacaan pengumuman",
      "Kelengkapan nilai per semester",
    ],
  },
  "profil-perusahaan-manufaktur": {
    title: "Website Profil Perusahaan Manufaktur",
    sector: "Manufaktur",
    summary:
      "Konsep website profil untuk produsen komponen: katalog kemampuan produksi, sertifikasi, dan jalur permintaan penawaran.",
    context:
      "Produsen yang selama ini mengandalkan brosur PDF dan jaringan relasi. Calon pembeli kesulitan menemukan informasi kapasitas dan jenis produk.",
    problem:
      "Informasi produk tidak dapat ditemukan di mesin pencari, dan permintaan penawaran masuk tanpa detail yang cukup untuk ditindaklanjuti.",
    solution:
      "Website dengan katalog kemampuan yang terstruktur, halaman per lini produk, dan formulir permintaan penawaran yang menanyakan detail teknis sejak awal.",
    flow: [
      "Calon pembeli mencari",
      "Menemukan lini produk",
      "Membaca spesifikasi",
      "Mengajukan penawaran",
      "Tim penjualan menindaklanjuti",
    ],
    features: [
      {
        name: "Katalog kemampuan",
        description: "Lini produk, material, dan proses produksi yang dapat dijelajahi.",
      },
      {
        name: "Permintaan penawaran",
        description: "Formulir terarah dengan lampiran gambar teknis.",
      },
      {
        name: "SEO teknis",
        description: "Struktur halaman dan data terstruktur untuk setiap lini produk.",
      },
      {
        name: "Pengelolaan konten",
        description: "Tim internal memperbarui katalog tanpa bantuan developer.",
      },
    ],
    system: {
      actors: ["Calon pembeli", "Katalog kemampuan", "Permintaan penawaran", "Tim penjualan"],
      handoffs: ["Pencarian", "Spesifikasi", "Detail teknis lengkap"],
    },
    results: [],
    metricsToTrack: [
      "Permintaan penawaran yang lengkap",
      "Kunjungan dari mesin pencari",
      "Waktu respons tim penjualan",
    ],
  },
};

export const categories: Record<ProjectCategory, string> = {
  website: "Website",
  "aplikasi-web": "Aplikasi web",
  "sistem-informasi": "Sistem informasi",
  "custom-software": "Custom software",
};
