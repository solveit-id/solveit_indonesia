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
- **Skena fisik:** pemilik bisnis menilai vendor di ponsel atau laptop kantor pada siang hari, sehingga tema terang menjadi default untuk semua pengunjung (preferensi OS tidak diikuti). Tema gelap tersedia lewat tombol tema di header, disimpan, dan dipulihkan sebelum paint.
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
| `--danger` | `#B42318` | `#FF9C8F` | Pesan dan border kesalahan formulir |

Kolom "Gelap" berlaku pada `:root[data-theme="dark"]`, bukan pada `prefers-color-scheme`.

Tile bento dan panel proses memakai `--accent` serta satu tile navy literal (`#082A56`, teks `#E9EFFA` / `#C3D0E4`) yang sengaja tetap navy di kedua mode.

**Tipografi:** Archivo variable (OFL), di-subset sendiri, sumbu lebar 100 sampai 120 persen dan berat 400 sampai 800. Display `font-stretch: 112-118%`, berat 720, tracking -0.03em. Teks 17px, lebar normal. Skala: display `clamp(2.5rem, 4.7vw, 4.4rem)`, title `clamp(2rem, 4.2vw, 3.6rem)`, heading `clamp(1.4rem, 2.1vw, 1.85rem)`, lede `clamp(1.125rem, 1.5vw, 1.375rem)`.

**Bentuk:** kontrol satu baris (tombol, chip, input) berbentuk kapsul penuh; panel dan textarea memakai `--radius-panel` 28px / `--radius-field` 20px.

**Ruang:** wadah 88rem, gutter `clamp(1rem, 4vw, 3rem)`, ritme seksi `clamp(5rem, 11vw, 9.5rem)`, grid 12 kolom pada `lg`.

## Komposisi per seksi (Beranda)

| Seksi | Pola layout | Motion dan tujuannya |
|---|---|---|
| Hero | Split asimetris 7/5 dengan form pemilih layanan yang berfungsi tanpa JS | Mark merakit dari empat kapsul (cerita: bagian menjadi solusi); kedalaman pointer; parallax berlapis saat hero ditinggalkan (lattice paling dalam, mark di tengah, teks paling dekat; mulai 768px); kapsul merenggang |
| Tagline | Tipografi kinetik full-width | Kata menyala mengikuti scroll (ritme baca pengunjung) |
| Layanan | Indeks tipografis + panel pratinjau sticky | Pratinjau berganti saat baris disorot atau difokus |
| Portofolio | Baris horizontal; pan ter-pin di desktop | Scroll vertikal menggeser studi kasus; native swipe di layar kecil |
| Cerita klien | Split 4/7: tanda kutip dua kapsul sticky, judul dan janji | Kapsul tanda kutip menyatu di sepanjang sumbu 33 derajat; baris slot masuk dari kiri |
| Cara kerja | Bento 4 sel dengan latar berbeda | Wipe diagonal 33 derajat per sel |
| Proses | Rail sticky | Garis terisi dan penanda menyala saat dilewati |
| Penutup | Bidang cobalt penuh | Bidang naik dengan clip diagonal; mark monokrom merakit |

## Aturan motion

- Animasi GSAP hanya memakai `transform`, `opacity`, `color`, dan `clip-path`. Transisi CSS state (hover, fokus) juga mengubah `background-color`, `border-color`, `box-shadow`, dan `background-size` (garis bawah link). Tanpa scroll listener manual; semua lewat ScrollTrigger.
- Header adaptif (lihat di bawah). Indikator aktif navigasi adalah satu kapsul cobalt yang bergeser (transform saja).
- Parallax scroll nyata hanya di tiga tempat: lapisan hero, sampul di Portofolio dan studi kasus (`useParallax`, separuh jarak di bawah 768px), dan mark di Tentang yang terakit tepat di tengah layar. Tidak ada pin baru, tidak ada scroll hijacking, tidak ada library smooth scroll (Lenis dievaluasi dan ditolak, lihat `docs/qa-report.md`).
- Tidak ada `scroll-behavior: smooth` global: aturan itu ikut menghaluskan pemulihan scroll router dan membuat tombol Back kembali ke atas halaman. Scroll halus diminta per aksi (tombol kembali ke atas).
- Proses: panel yang tertumpuk mengecil dan meredup lewat lapisan bayangan ber-opacity (komposit), bukan `filter: brightness` yang memaksa repaint tiap frame.
- Pergantian tema: satu View Transition yang menyapu di sepanjang sumbu 33 derajat (600 ms). Malam datang dari kiri atas, siang kembali dari kanan bawah. Menekan lagi di tengah sapuan menyelesaikan sapuan berjalan lalu memulai yang baru, sehingga tidak pernah menumpuk. Instan di bawah reduced motion dan tanpa dukungan View Transitions.
- Konten terlihat secara default. Reveal memakai opacity (bukan `visibility`) agar konten tetap ada di accessibility tree. Konten utama tidak pernah hilang saat pengunjung scroll bolak-balik; hanya penanda proses yang berbalik saat dilewati ke atas.
- `prefers-reduced-motion: reduce` mematikan gerak spasial; pergantian state yang bermakna (ikon tema, label bahasa) tetap tampil sebagai crossfade 160 ms. Perangkat terbatas melewati pin dan parallax pointer.

### Kosakata motion

Token durasi di `:root` (`src/styles/app.css`). Keluar selalu lebih cepat dari masuk.

| Peran | Token | Nilai | Kurva | Contoh |
|---|---|---|---|---|
| Tekan | `--dur-instant` | 100 ms | expo-out | Kapsul mengecil 0,92 sampai 0,95 |
| Umpan balik cepat | `--dur-quick` | 180 ms | expo-out | Transform hover kecil |
| Perubahan state | `--dur-state` | 280 ms | expo-out | Warna, border, latar hover |
| Keluar | `--dur-exit` | 220 ms | `--ease-in-quart` | Menu seluler, panel asisten, kartu WhatsApp (170 ms), tombol ke atas |
| Overlay masuk | `--dur-overlay` | 420 ms | expo-out | Panel asisten, chip status, dock |
| Momen utama | `--dur-focal` | 700 ms | expo-out | Wipe kutipan testimoni, dial tema (620 ms) |

Arah: elemen bergerak di sepanjang sumbu 33 derajat logo bila arahnya bermakna (kapsul loader, kutipan, mark Tentang); selain itu naik pendek (0,5 sampai 0,75 rem).

## Komponen interaksi

| Komponen | Perilaku | Catatan |
|---|---|---|
| Tombol tema | Matahari dan bulan berada di satu dial yang berputar setengah putaran di sekitar poros di bawah tombol: matahari terbenam, bulan terbit; arah sebaliknya memutar balik jalur yang sama. Hover: latar porselen tenggelam dan putaran kecil 33 derajat; tekan: 0,92 | Ukuran 44 px tetap, ikon dipotong oleh kapsul sehingga tidak ada pergeseran |
| Pemilih bahasa | Thumb tinta bergeser ke bahasa tujuan saat diklik (dari `navigation.location`, bukan setelah route selesai dimuat), meregang 1,18 sepanjang sumbunya selama bergerak, dan "bernapas" (opacity) bila pemuatan lambat. Di ponsel, satu kapsul yang menggulung label EN/ID | Fokus tetap di pemilih; konten tidak di-fade penuh, hanya opacity 0,55 ke 1 dalam 350 ms |
| Header adaptif | Tiga keadaan pada satu kotak 72 px: terbuka di atas hero, permukaan penuh setelah 8 px, kapsul mengambang setelah 96 px (kembali hanya di bawah 40 px: histeresis). Kapsul dibentuk dengan `clip-path: inset(... round 9999px)` pada pelat latar, garis rambut kapsul memudar masuk, logo mengecil 0,9. Di bawah 768 px tetap permukaan penuh karena kapsul terlalu sempit untuk kontrol | Tidak ada perubahan tinggi atau layout; atribut hanya ditulis saat keadaan berganti |
| Menu seluler | Masuk dengan stagger (GSAP), keluar 220 ms ke atas sebelum `hidden`. Navigasi ke halaman lain menutup instan | |
| Umpan balik pemuatan | Tidak ada overlay layar penuh. Runner cobalt tipis tak-tentu di tepi atas setelah 150 ms; chip "Memuat halaman" dengan kapsul logo yang merakit diri, plus pengumuman `role="status"`, hanya setelah 900 ms. Muatan pertama tidak pernah menampilkan apa pun | Tidak ada persentase palsu |
| Dock mengambang | Kanan bawah, menghormati safe area. Tombol kembali ke atas (44 px) muncul setelah 1,2 tinggi layar, di atas peluncur asisten. Disembunyikan saat panel asisten terbuka. Keduanya menyingkir saat `[data-floating-avoid]` (tombol kirim formulir Kontak) berada di 28 persen bawah layar. Baris akhir footer diberi ruang bawah | Dirender setelah hydration, jadi tidak pernah tampil sebagai tombol mati |
| Asisten Solveit | Peluncur kapsul navy dengan mark bergradasi; label "Tanya Solveit" berganti "Tutup". Panel mengambang 24 rem di desktop, bottom sheet modal dengan scrim di bawah 640 px. Topik, FAQ, tautan halaman, eskalasi WhatsApp/email | Lihat `docs/architecture.md` |
| Cerita klien | Tanpa testimoni yang diizinkan: janji tertulis dengan slot kapsul putus-putus. Dengan testimoni: kutipan besar di samping tanda kutip dua kapsul, tombol, panah kiri/kanan, geser; tanpa autoplay | Tidak pernah menerbitkan Review atau AggregateRating |

## Aturan konten

- Satu label per niat: "Mulai konsultasi" (kontak), "Lihat portofolio" (portofolio).
- Tanpa em dash, tanpa eyebrow, tanpa angka atau klaim yang tidak bisa dibuktikan. Diuji otomatis di `src/data/content.test.ts`.
- Studi kasus demo selalu berlabel "Konsep demonstrasi, bukan proyek klien" dan tidak menerbitkan JSON-LD `CreativeWork`.
- Dua bahasa dengan struktur yang sama. Teks Inggris ditulis ulang untuk pembaca bisnis, bukan diterjemahkan kata per kata. Nama merek, tagline resmi, kontak, URL eksternal, dan fakta proyek identik di kedua bahasa.
- Tiga nomor WhatsApp tampil sebagai pilihan setara di satu menu atau satu daftar; tidak ada nama PIC, divisi, atau jam layanan karena belum dikonfirmasi.
