# Design System: Precision in Motion

## Analisis logo

| Unsur logo | Temuan | Turunan di website |
|---|---|---|
| Ikon | Empat kapsul membulat yang saling mengunci menjadi huruf S, semuanya sejajar pada sudut sekitar 33 derajat | Kapsul penuh untuk semua kontrol satu baris; 33 derajat sebagai satu-satunya diagonal (lattice hero, sampul proyek, ikon menu, wipe footer, reveal bento) |
| Gradasi ikon | `#124EDC` ke `#178BFF`, `#19B8F2` (cyan), `#1136D6` (deep) | Cobalt `#1452ED` sebagai satu-satunya aksen; cyan hanya muncul di dalam gradasi kapsul |
| Wordmark | Grotesk tebal, navy `#082A56` | Warna tinta utama; tipografi display grotesk semi-expanded |
| Deskriptor | "INDONESIA" spasi lebar, slate `#5C7392` | Warna sekunder (digelapkan ke `#4A6283` agar lolos kontras teks kecil) |

Bentuk logo tidak pernah diubah. Satu-satunya variasi adalah versi monokrom di atas bidang cobalt (footer) dan wordmark yang mengikuti token tinta pada mode gelap.

## Arah kreatif

- **Tesis:** situs dirakit dari geometri logonya sendiri. Empat kapsul yang mengunci menjadi solusi adalah cerita mereknya: hero menampilkan mark yang merakit diri, seksi lain memakai kapsul dan sudut yang sama.
- **Yang ditolak:** template SaaS (headline tengah di atas gradasi ungu, tiga kartu fitur identik, carousel testimoni), glow dekoratif, ikon dekoratif acak. Satu-satunya bayangan adalah angkatan tipis berwarna cobalt pada tombol utama.
- **Skena fisik:** pemilik bisnis menilai vendor di ponsel atau laptop kantor pada siang hari, sehingga dasar terang. Mode gelap mengikuti `prefers-color-scheme`.
- **Dial:** variance 7, motion 6, density 4.

## Token

Spesifikasi lengkap yang diturunkan dari kode ada di [`DESIGN.md`](../DESIGN.md). Token didefinisikan di `frontend/src/styles/app.css` sebagai CSS variables dan dipetakan ke Tailwind lewat `@theme inline`.

| Token | Terang | Gelap | Peran |
|---|---|---|---|
| `--paper` | `#F1F4F9` | `#050F22` | Latar halaman |
| `--paper-raised` / `--paper-sunken` | `#F8FAFD` / `#E6ECF5` | `#0A1830` / `#030A18` | Panel, seksi bertingkat |
| `--ink` | `#082A56` | `#E9EFFA` | Teks utama |
| `--ink-muted` | `#4A6283` | `#A3B5CF` | Teks sekunder (5,5:1 di atas paper) |
| `--ink-faint` | `#6B809D` | `#8094B3` | Hanya teks besar (3,7:1) |
| `--accent` | `#1452ED` | `#1452ED` | Tombol utama (6,1:1 dengan teks putih) |
| `--accent-text` | `#1146D8` | `#6AA6FF` | Teks aksen |
| `--accent-hover` | `#1136D6` | `#2A66FF` | Hover tombol utama |
| `--field` | `#1136D6` | `#0F34CC` | Bidang CTA penutup + footer |
| `--field-ink` / `--field-ink-muted` / `--field-line` | `#F4F7FF` / `#C9D6FB` / putih 22% | sama | Teks dan garis di atas bidang cobalt |
| `--line` / `--line-strong` | navy 13% / 28% | terang 12% / 26% | Garis rambut dan border kontrol |
| `--focus` / `--selection` | `#1452ED` / cobalt 18% | `#6AA6FF` / 30% | Cincin fokus, seleksi teks |

Tile bento dan panel proses memakai `--accent` serta satu tile navy literal (`#082A56`, teks `#E9EFFA` / `#C3D0E4`) yang sengaja tetap navy di kedua mode.

**Tipografi:** Archivo variable (OFL), di-subset sendiri, sumbu lebar 100 sampai 120 persen dan berat 400 sampai 800. Display `font-stretch: 112-118%`, berat 720, tracking -0.03em. Teks 17px, lebar normal. Skala: display `clamp(2.5rem, 4.7vw, 4.4rem)`, title `clamp(2rem, 4.2vw, 3.6rem)`, heading `clamp(1.4rem, 2.1vw, 1.85rem)`, lede `clamp(1.125rem, 1.5vw, 1.375rem)`.

**Bentuk:** kontrol satu baris (tombol, chip, input) berbentuk kapsul penuh; panel dan textarea memakai `--radius-panel` 28px / `--radius-field` 20px.

**Ruang:** wadah 88rem, gutter `clamp(1rem, 4vw, 3rem)`, ritme seksi `clamp(5rem, 11vw, 9.5rem)`, grid 12 kolom pada `lg`.

## Komposisi per seksi (Beranda)

| Seksi | Pola layout | Motion dan tujuannya |
|---|---|---|
| Hero | Split asimetris 7/5 dengan form pemilih layanan yang berfungsi tanpa JS | Mark merakit dari empat kapsul (cerita: bagian menjadi solusi); kedalaman pointer; kapsul merenggang saat hero ditinggalkan |
| Tagline | Tipografi kinetik full-width | Kata menyala mengikuti scroll (ritme baca pengunjung) |
| Layanan | Indeks tipografis + panel pratinjau sticky | Pratinjau berganti saat baris disorot atau difokus |
| Portofolio | Baris horizontal; pan ter-pin di desktop | Scroll vertikal menggeser studi kasus; native swipe di layar kecil |
| Cara kerja | Bento 4 sel dengan latar berbeda | Wipe diagonal 33 derajat per sel |
| Proses | Rail sticky | Garis terisi dan penanda menyala saat dilewati |
| Penutup | Bidang cobalt penuh | Bidang naik dengan clip diagonal; mark monokrom merakit |

## Aturan motion

- Animasi GSAP hanya memakai `transform`, `opacity`, `color`, dan `clip-path`. Transisi CSS state (hover, fokus) juga mengubah `background-color`, `border-color`, `box-shadow`, dan `background-size` (garis bawah link). Tanpa scroll listener manual; semua lewat ScrollTrigger.
- Header menjadi permukaan porselen semi-transparan dengan `backdrop-blur` setelah halaman di-scroll, dan bersembunyi saat membaca ke bawah.
- Konten terlihat secara default. Reveal memakai opacity (bukan `visibility`) agar konten tetap ada di accessibility tree.
- `prefers-reduced-motion: reduce` mematikan seluruh animasi; perangkat terbatas melewati pin dan parallax pointer.

## Aturan konten

- Satu label per niat: "Mulai konsultasi" (kontak), "Lihat portofolio" (portofolio).
- Tanpa em dash, tanpa eyebrow, tanpa angka atau klaim yang tidak bisa dibuktikan. Diuji otomatis di `src/data/content.test.ts`.
- Studi kasus demo selalu berlabel "Konsep demonstrasi, bukan proyek klien" dan tidak menerbitkan JSON-LD `CreativeWork`.
