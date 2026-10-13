/** Every public page in both languages, with its expected headline and twin. */
export const pages = [
  { path: "/", lang: "id", twin: "/en", h1: /Solusi digital yang dibangun untuk bertahan/ },
  {
    path: "/tentang",
    lang: "id",
    twin: "/en/about",
    h1: /Software house yang membangun untuk jangka panjang/,
  },
  { path: "/layanan", lang: "id", twin: "/en/services", h1: /Layanan pengembangan software/ },
  { path: "/portofolio", lang: "id", twin: "/en/portfolio", h1: /Portofolio dan studi kasus/ },
  {
    path: "/portofolio/sistem-antrean-klinik",
    lang: "id",
    twin: "/en/portfolio/clinic-queue-records-system",
    h1: /Sistem Antrean dan Rekam Medis Klinik/,
  },
  { path: "/proses", lang: "id", twin: "/en/process", h1: /Proses kerja dalam tujuh langkah/ },
  { path: "/kontak", lang: "id", twin: "/en/contact", h1: /Mulai konsultasi/ },
  { path: "/en", lang: "en", twin: "/", h1: /Digital solutions built to last/ },
  { path: "/en/about", lang: "en", twin: "/tentang", h1: /builds for the long term/ },
  { path: "/en/services", lang: "en", twin: "/layanan", h1: /Software development services/ },
  { path: "/en/portfolio", lang: "en", twin: "/portofolio", h1: /Portfolio and case studies/ },
  {
    path: "/en/portfolio/clinic-queue-records-system",
    lang: "en",
    twin: "/portofolio/sistem-antrean-klinik",
    h1: /Clinic Queue and Medical Records System/,
  },
  { path: "/en/process", lang: "en", twin: "/proses", h1: /Our process, in seven clear steps/ },
  { path: "/en/contact", lang: "en", twin: "/kontak", h1: /Start a consultation/ },
] as const;
