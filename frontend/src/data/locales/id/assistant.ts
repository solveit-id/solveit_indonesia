import type { AssistantCopy } from "~/types/assistant";

/**
 * Indonesian wording for the automated guide. Every answer restates facts
 * already published on the site; nothing here adds prices, timelines,
 * clients, or capabilities. Loaded only with the assistant panel.
 */
export const assistant: AssistantCopy = {
  topics: {
    services: {
      label: "Layanan",
      intro:
        "Solveit Indonesia menyediakan lima layanan, dikerjakan oleh tim yang sama dari konsultasi sampai sistem dipakai:",
      keywords: [
        "layanan",
        "jasa",
        "website",
        "situs",
        "aplikasi",
        "web app",
        "sistem informasi",
        "software",
        "perangkat lunak",
        "pemeliharaan",
        "maintenance",
        "dukungan teknis",
        "bikin",
        "membuat",
        "pembuatan",
      ],
    },
    consultation: {
      label: "Konsultasi proyek",
      intro:
        "Konsultasi awal membantu memetakan kebutuhan, prioritas, dan langkah pertama yang paling masuk akal untuk bisnis Anda. Setelah Anda menghubungi kami:",
      keywords: ["konsultasi", "mulai", "proyek", "kerja sama", "diskusi", "pesan", "order", "ide"],
    },
    portfolio: {
      label: "Portofolio",
      intro:
        "Portofolio saat ini berisi studi kasus konsep yang menunjukkan cara kami berpikir. Semuanya ilustratif, bukan proyek klien; portofolio klien akan tampil setelah mendapat izin publikasi.",
      keywords: [
        "portofolio",
        "portfolio",
        "contoh",
        "studi kasus",
        "klien",
        "proyek sebelumnya",
        "hasil kerja",
      ],
    },
    process: {
      label: "Proses kerja",
      intro:
        "Setiap proyek melewati tujuh langkah. Di setiap langkah, Anda tahu apa yang dikerjakan, apa peran Anda, dan apa yang Anda terima:",
      keywords: ["proses", "tahap", "langkah", "alur", "cara kerja", "metode", "prosedur"],
    },
    contact: {
      label: "Kontak",
      intro: "Anda bisa menghubungi Solveit Indonesia lewat kanal resmi berikut:",
      keywords: [
        "kontak",
        "hubungi",
        "whatsapp",
        "wa",
        "email",
        "instagram",
        "telepon",
        "nomor",
        "alamat",
      ],
    },
  },
  faqKeywords: {
    serviceFaq: [
      ["biaya", "harga", "tarif", "budget", "anggaran", "mahal", "murah", "ongkos"],
      ["umkm", "usaha kecil", "bisnis kecil", "perorangan", "individu", "startup"],
      ["dikembangkan", "pengembangan lanjutan", "upgrade", "fitur baru", "setelah selesai"],
    ],
    processFaq: [
      ["berapa lama", "durasi", "lama pengerjaan", "waktu pengerjaan", "deadline"],
      ["progres", "pantau", "memantau", "pratinjau"],
      ["revisi", "perubahan", "ganti fitur"],
      ["serah terima", "akhir proyek", "dokumentasi", "yang saya terima", "yang diterima"],
    ],
  },
  greetings: [
    "halo",
    "hai",
    "hi",
    "hello",
    "pagi",
    "siang",
    "sore",
    "malam",
    "assalamualaikum",
    "permisi",
    "tes",
  ],
  greetingReply:
    "Halo. Silakan pilih topik di bawah, atau tulis pertanyaan tentang layanan, proses kerja, portofolio, atau kontak.",
  fallback:
    "Pertanyaan itu belum bisa saya jawab dari panduan ini. Tim Solveit Indonesia bisa menjawabnya langsung lewat WhatsApp atau email.",
  contactLabels: {
    email: "Email",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    form: "Formulir konsultasi",
  },
};
