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
| Cara kerja | Bento 4 sel dengan latar berbeda; empat kapsul pratinjau di sel progres, tahapan ekosistem Solveit Orbit sebagai urutan | Mulai 1024 px satu komposisi dalam urutan perjalanan proyek (lingkup, progres, perawatan, portal): sel terbuka diagonal 33 derajat berurutan, teks tiap sel naik setelah permukaannya, lattice sel lingkup mengendap ke kedalaman, kapsul pratinjau mendarat satu per satu, tahapan portal berbaris. Di bawah 1024 px hanya wipe per sel. Hover (pointer halus saja): lattice bergeser di sumbu 33 derajat, pratinjau melangkah satu per satu, tahapan portal menyala berurutan; tanpa angkat, garis, atau kursor pointer karena sel bukan tautan |
| Proses | Rail sticky | Garis terisi dan penanda menyala saat dilewati |
| Penutup | Bidang cobalt penuh | Bidang naik dengan clip diagonal; mark monokrom merakit |

## Aturan motion

- Animasi GSAP hanya memakai `transform`, `opacity`, `color`, dan `clip-path`. Transisi CSS state (hover, fokus) juga mengubah `background-color`, `border-color`, `box-shadow`, dan `background-size` (garis bawah link). Tanpa scroll listener manual; semua lewat ScrollTrigger.
- Header adaptif (lihat di bawah). Indikator aktif navigasi adalah satu kapsul cobalt yang bergeser (transform saja).
- Parallax scroll nyata hanya di tiga tempat: lapisan hero, sampul di Portofolio dan studi kasus (`useParallax`, separuh jarak di bawah 768px), dan mark di Tentang yang terakit tepat di tengah layar. Tidak ada pin baru, tidak ada scroll hijacking, tidak ada library smooth scroll (Lenis dievaluasi dan ditolak, lihat `docs/qa/qa-report.md`).
- Tidak ada `scroll-behavior: smooth` global: aturan itu ikut menghaluskan pemulihan scroll router dan membuat tombol Back kembali ke atas halaman. Scroll halus diminta per aksi (tombol kembali ke atas).
- Proses: panel yang tertumpuk mengecil dan meredup lewat lapisan bayangan ber-opacity (komposit), bukan `filter: brightness` yang memaksa repaint tiap frame.
- Pergantian tema: satu View Transition yang menyapu di sepanjang sumbu 33 derajat (600 ms). Malam datang dari kiri atas, siang kembali dari kanan bawah. Menekan lagi di tengah sapuan menyelesaikan sapuan berjalan lalu memulai yang baru, sehingga tidak pernah menumpuk. Instan di bawah reduced motion dan tanpa dukungan View Transitions.
- Konten terlihat secara default. Reveal memakai opacity (bukan `visibility`) agar konten tetap ada di accessibility tree. Konten utama tidak pernah hilang saat pengunjung scroll bolak-balik. Gerak "masuk dan keluar" yang berbalik arah memakai scrub pada warna, garis, dan penanda saja: frasa Visi menyala dari tinta redup, garis nilai dan sumbu Visi tergambar, penanda proses dan peta ekosistem menyala lalu padam saat dilewati ke atas. Teksnya selalu terbaca.
- Satu pengecualian properti layout: tinggi baris FAQ dianimasikan lewat `::details-content` (peningkatan progresif, dipicu pengguna, satu baris), karena itulah yang diminta interaksinya; tanpa dukungan browser baris membuka instan.
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
| Momen utama | `--dur-focal` | 700 ms | expo-out | Wipe kutipan testimoni, gulungan ikon tema (620 ms), lipatan logo header (620 ms) |
| Muatan pertama | (boot) | penuh sekitar 1,3 s, singkat sekitar 0,6 s | expo-out masuk, in-out keluar | Layar pemuatan bermerek. Penuh (muatan pertama di tab): kapsul merakit 0,52 s (stagger 50 ms), wordmark keluar dari mark, sapuan 33 derajat 0,52 s dimulai begitu kapsul keempat mengunci. Singkat (muatan berikutnya di tab yang sama): ketukan yang sama dalam 0,22 s dan sapuan 0,3 s. Durasi dipangkas dari rancangan awal 1,7 s berdasarkan Speed Index (QA putaran 4) |

Arah: elemen bergerak di sepanjang sumbu 33 derajat logo bila arahnya bermakna (kapsul loader, sapuan keluar layar pemuatan, kutipan, mark Tentang); selain itu naik pendek (0,5 sampai 0,75 rem).

Hover yang menggerakkan sesuatu (ikon tema, gulungan label bahasa, panah kembali ke atas, condongan logo) hanya berlaku di `(hover: hover)`, sehingga ketukan di layar sentuh tidak meninggalkan keadaan hover yang tersangkut.

## Komponen interaksi

| Komponen | Perilaku | Catatan |
|---|---|---|
| Layar pemuatan bermerek | Muatan dokumen di semua route: lembar porselen layar penuh, empat kapsul logo primer datang di sepanjang sumbu 33 derajat dan mengunci, wordmark keluar dari balik mark, INDONESIA turun dari bawah wordmark. Urutan penuh pada muatan pertama di tab, versi singkat pada refresh atau hard reload berikutnya di tab yang sama (`sessionStorage`; tanpa storage selalu penuh). Keluar begitu kapsul keempat mengunci **dan** halaman siap (DOM terurai, font termuat): panggung terangkat, lalu lembar porselen dan pita cobalt menyapu ke kanan bawah. Runner tak-tentu kecil hanya bila menunggu lebih dari 1,5 s | CSS dan SVG statis di HTML (`boot-loader.tsx`), dikendalikan `<html data-boot>` dari skrip head (`src/lib/boot.ts`); tidak menunggu React atau GSAP; batas 2,6 s sejak frame pertama; `pointer-events: none`, `aria-hidden`; tanpa JS tidak tampil; reduced motion: mark diam lalu pudar 280 ms. Entrance di halaman (`.enter`, mark hero) menunggu lembar mulai pergi |
| Tombol tema | Matahari dan bulan bergulir melewati satu sel bertopeng seperti drum: ke gelap, matahari tenggelam ke bawah sambil berputar, bulan turun dari atas dan mendarat dengan sedikit lewatan; ke terang, jalur yang sama diputar balik. Setiap keadaan memiliki transisinya sendiri, jadi klik di tengah gulungan hanya mengganti target. Tombol punya `view-transition-name` sendiri sehingga langsung menjawab di atas sapuan tema. Hover: latar porselen tenggelam, bayangan tipis, matahari berputar 45 derajat atau bulan miring; tekan: 0,9 | Ukuran 44 px tetap, latar porselen terangkat |
| Pemilih bahasa | Setiap label berada di topeng satu baris dengan salinannya menunggu di bawah: hover menggulung label ke atas. Thumb tinta bergeser ke bahasa tujuan saat diklik (dari `navigation.location`), meregang 1,28 x 0,9 selama bergerak, dan kedua label menggulung berlawanan arah seperti roda gigi. Hover pada bahasa lain mencondongkan thumb ke arahnya. Bila pemuatan lambat thumb "bernapas" dan kursor menjadi progress. Di ponsel, satu kapsul: label berikutnya naik dari bawah saat label sekarang keluar ke atas | Fokus tetap di pemilih; konten hanya opacity 0,55 ke 1 dalam 350 ms |
| Header adaptif | Satu kotak tetap `--header-h` (88 px mulai 1024 px, 76 px di bawahnya). Tiga keadaan: terbuka di atas hero, permukaan penuh dengan garis bawah setelah 8 px, kapsul mengambang 60 px setelah 96 px (kembali hanya di bawah 40 px: histeresis). Kapsul memakai satu perlakuan: garis tepi `--capsule-rim` (navy 20 persen, terang 20 persen di gelap) yang ikut berubah bentuk bersama kapsul, isi porselen terangkat 94 persen, dan bayangan overlay tipis yang tiba saat kapsul mendarat; terbaca di atas paper, sunken, tile navy, dan bidang cobalt di kedua tema. Logo primer dipecah menjadi tiga lapisan (mark, wordmark, INDONESIA); saat meringkas, mulai 768 px mark bergerak ke kanan melewati wordmark dan "menelannya" (tepi clip mengikuti mark), INDONESIA mendahului, lalu kapsul pelat menyusut dari kiri mengikuti mark; di ponsel kata-kata ditarik masuk ke mark yang tetap di kiri. Mengembang memutar balik jalur yang sama. Satu durasi dan kurva (`--morph`: 700 ms, `cubic-bezier(0.22, 1, 0.36, 1)`) untuk pelat, garis tepi, dan mark; transisi CSS sehingga berbalik dari posisi saat itu. Putaran 6: mark ditumpuk di atas kata-kata, dan wordmark serta INDONESIA tidak lagi dipotong clip (tepi clip memotong huruf di frame antara); keduanya memudar utuh sambil bergeser sedikit (keluar 200 dan 140 ms, kembali setelah mark lewat). Permukaan kaca terkendali: isi 86 persen (kapsul 88 persen porselen terangkat), blur 14 px (kapsul 20 px, saturasi 1,8), kilau tipis di atas; tanpa dukungan backdrop-filter isi menjadi hampir pekat. Halaman yang dimuat ulang di tengah scroll langsung compact tanpa memutar morph (`data-instant`) | Tidak ada perubahan tinggi atau layout; hanya transform, opacity, clip pelat, dan warna; atribut hanya ditulis saat keadaan berganti; di luar kapsul halaman tetap bisa diklik; area klik logo menyusut ke mark |
| Menu seluler | Masuk dengan stagger (GSAP), keluar 220 ms ke atas sebelum `hidden`. Navigasi ke halaman lain menutup instan | |
| Umpan balik navigasi | Navigasi klien tidak memakai layar penuh. Runner cobalt tipis tak-tentu di tepi atas setelah 150 ms; chip "Memuat halaman" dengan kapsul logo yang merakit diri, plus pengumuman `role="status"`, hanya setelah 900 ms. Halaman baru naik pendek | Tidak ada persentase palsu |
| Dock mengambang | Kanan bawah, satu baris, menghormati safe area: tombol kembali ke atas (44 px) di samping peluncur asisten, muncul setelah 1,2 tinggi layar dengan meluncur keluar dari balik peluncur. Panel asisten terbuka di atas seluruh baris, jadi tombol kembali ke atas tetap terlihat dan bisa dipakai; hanya bottom sheet ponsel (modal) yang menutupinya. Hover: panah keluar ke atas dan masuk lagi dari bawah; tekan 0,9; scroll halus (instan di reduced motion), fokus pindah ke `<main>`. Keduanya menyingkir saat `[data-floating-avoid]` berada di 28 persen bawah layar | Dirender setelah hydration, jadi tidak pernah tampil sebagai tombol mati |
| Asisten Solveit | Peluncur kapsul navy dengan mark bergradasi; label "Tanya Solveit" berganti "Tutup". Saat terbuka kapsul memangkas ekornya yang kosong dari kiri (clip dan transform, tanpa perubahan lebar), dan tombol kembali ke atas ikut bergeser. Panel mengambang 24 rem di desktop, bottom sheet modal dengan scrim di bawah 640 px. Topik, FAQ, tautan halaman, eskalasi WhatsApp/email | Lihat `docs/architecture/architecture-overview.md` |
| Kontrol tutup | Semua "tutup" (`[data-close-control]`: tombol X panel asisten, peluncur yang terbuka, tombol Tutup menu ponsel) menjawab hover, fokus, dan tekan dengan merah terkendali dari token `--danger`: tint `--danger-soft`, glyph merah, cincin fokus merah. Bukan isian merah penuh, karena menutup bukan tindakan destruktif | Glyph `--danger` di atas tint tetap di atas 4,5:1 di kedua tema |
| Kursor | `cursor: pointer` hanya untuk yang benar-benar bertindak saat diklik (tautan, tombol, summary, select, pilihan), I-beam untuk input teks, `not-allowed` untuk yang nonaktif, `progress` untuk `aria-busy`. Badge teknologi dan elemen dekoratif tetap kursor bawaan | Aturan dasar di `app.css`, bukan per komponen |
| Studi kasus | Lembar fakta (kategori, sektor, jenis, teknologi dengan logo). Bab bernomor dengan kapsul 33 derajat, dibaca dari atas ke bawah: konteks lalu permasalahan sebagai dua kartu lebar penuh yang bertumpuk (judul di kolom kiri, teks 60ch di kanan mulai 768 px; permasalahan bergaris putus-putus: masih terbuka), solusi di bidang cobalt yang terbuka dengan clip diagonal, peta sistem sebagai perjalanan data (kapsul memanjang, penghubung 33 derajat tergambar dengan kapsul sinyal di ujungnya, cincin sekali di bagian penerima, tulang punggung vertikal di ponsel), alur utama yang terisi mengikuti scroll dengan penanda menyala dan sedikit menekan saat dicapai, fitur bernomor, teknologi per lapisan, dan indikator yang akan diukur (garis kartu tergambar, slot kosong berputar ke sumbu 33 derajat; tanpa angka atau progres). Rail bab lengket di desktop: satu scrollspy deterministik menandai tepat satu bab (`aria-current="location"`). Studi kasus sebelumnya/berikutnya dengan sampul mini | Semua konten terlihat tanpa JS; GSAP hanya menata ulang yang sudah ada |
| Label demonstrasi | Status, bukan kontrol: kapsul bergaris putus-putus (penanda "belum"), latar porselen terangkat, kapsul berongga di sumbu 33 derajat (garis luar bagian yang belum dibangun), frasa utama tebal tinta penuh dan keterangan setelah koma di tinta redup, 14 px. Tanpa hover dan kursor bawaan. Di kartu sempit hanya patah di koma | Dipakai di daftar, detail, dan studi kasus sebelumnya/berikutnya |
| Tautan editorial | "Kenali kami" di Beranda: label lebar 650, sumur kapsul panah 2,25 rem, garis rambut di bawah dengan segmen cobalt pendek di awalnya seperti tanda ukur. Hover dan fokus menggambar segmen sepanjang garis (transform), label menjadi cobalt, sumur terisi, panah keluar ke kanan lalu masuk dari kiri | Tautan semantik biasa, bukan tombol; tidak dipakai di tengah paragraf |
| FAQ | Satu sistem `<details>` native untuk Layanan dan Proses: baris bergaris rambut, pertanyaan cobalt saat hover dan terbuka, sumur ikon kapsul yang plusnya melipat menjadi minus dan terisi cobalt, garis cobalt tergambar di atas baris yang terbuka, jawaban naik masuk; tinggi baris beranimasi bila `::details-content` didukung | Tanpa JS tetap berfungsi; tidak pernah menutup sendiri saat discroll |
| Pratinjau responsif | Bab 04 studi kasus: saklar Desktop/Tablet/Ponsel, penggeser lebar 320 sampai 1440 px, gagang seret di tepi bingkai. Layar ditata pada lebar asli perangkat (1280, 768, 390) lalu diperkecil agar muat, sehingga container query mengatur ulang isinya dan ponsel tidak pernah scroll ke samping. Ganti perangkat memutar FLIP pada bingkai (transform) | Untuk konsep: wireframe berlabel "Ilustrasi konsep responsif" dari teks studi kasus saja, tanpa data. Model `preview` bertipe (`concept` atau `screenshots`) agar tangkapan layar nyata bisa menggantikannya |
| Tentang: Visi, Nilai, peta ekosistem | Visi dibaca per frasa (warna di-scrub) dengan sumbu cobalt di samping judul; nilai sebagai baris editorial bernomor dengan garis yang tergambar; peta ekosistem dengan tulang punggung dan tiga tingkat (fondasi, pusat operasional, bagian untuk klien), status selalu tertulis | Lihat `docs/product/product-naming.md`; tidak ada status "tersedia" |
| Select formulir | Kapsul input dengan sumur caret; dengan `appearance: base-select` daftar pilihan bergaya porselen dengan centang kapsul 33 derajat; selain itu popup native | Perilaku keyboard dan pembaca layar tetap milik browser |
| Tombol slice | Hanya untuk CTA bernilai tinggi: "Mulai konsultasi" di header (bar dan menu ponsel), submit konsultasi di hero, CTA bidang penutup, "Lihat portofolio" dan "Pelajari prosesnya" di Beranda, serta "Kirim lewat WhatsApp" dan "Kirim lewat email" di formulir (tidak saat nonaktif). Dua bidang memotong kapsul di sepanjang sumbu 33 derajat (`skewX(-57deg)`): sliver terang memimpin, warna akhir menyusul (550 dan 600 ms expo-out); keluar dalam urutan terbalik, lebih cepat (420 ms). Label dan ikon tidak bergerak, ukuran tetap. Pointer halus dan fokus keyboard saja; sentuhan normal; reduced motion menjadi pergantian warna instan | Tidak dipakai di kontrol formulir, pemilih tema/bahasa, tombol tutup, atau tombol utilitas |
| Badge teknologi | Logo resmi (Simple Icons, CC0) dalam sumur porselen, berwarna tinta di kedua tema, dan nama yang selalu tertulis. Bukan tautan atau tombol. Nama generik (REST API) memakai glyph netral. Pada studi kasus demo judulnya "Teknologi yang diusulkan" disertai catatan bahwa ini usulan, bukan stack proyek klien | Hanya lima path yang dibundel (`technology-icons.ts`), tanpa pustaka ikon |
| Cerita klien | Tanpa testimoni yang diizinkan: janji tertulis dengan slot kapsul putus-putus. Dengan testimoni: kutipan besar di samping tanda kutip dua kapsul, tombol, panah kiri/kanan, geser; tanpa autoplay | Tidak pernah menerbitkan Review atau AggregateRating |

## Konsol admin (`admin/`, B3.2a dan B3.2b)

Permukaan Operate di dunia visual yang sama: token merek dibaca dari `frontend/src/styles/tokens.css` (satu sumber dengan website), lapisan admin di `admin/src/styles/admin.css`. Arah kerja "Precision Console" (brief B3.2a); kontrak arah di `.impeccable/surfaces/admin-src-app.md`.

| Unsur | Aturan |
|---|---|
| Shell | Rail navy 17,5 rem mulai 1024 px (lockup asli, kapsul lingkungan putus-putus "Konsol B3.2b, belum di-deploy", navigasi setelah masuk, kaki akun dengan Keluar, tema dan bahasa di kaki); di bawahnya bar navy 64 px dengan tombol kapsul "Menu" (nama tetap, `aria-expanded`, Escape menutup dan mengembalikan fokus). Di dalam rail token tinta berganti ke tinta malam dan `--paper` menjadi navy, sehingga komponen yang sama terbaca di sana. Gelap: rail memakai tanah malam cekung `#030a18` dengan garis rambut |
| Tipe | Archivo yang sama, skala rem tetap: judul halaman 1,875 rem, seksi 1,25 rem, item 1,0625 rem, meta 0,875 rem; judul 720 di lebar 112 persen, teks lebar normal |
| Kontrol | Satu kosakata: tombol kapsul 44 px (utama cobalt dengan angkatan cobalt, satu-satunya bayangan di dalam alur halaman; dialog memakai bayangan overlay untuk lapisan mengambang; sekunder bergaris; tenang; bahaya dengan tint `--danger-soft`), isian kapsul dengan label, petunjuk, dan galat yang terhubung (`aria-describedby`), kontrol segmen berbasis radio native |
| Status | Kapsul logo pada sumbu 33 derajat: penuh (dirilis), separuh (sedang dibangun), berongga putus-putus (direncanakan). Selalu disertai kata; di jalur fase hanya satu glyph per baris (pada tulang punggung) |
| Keadaan | Memuat: skeleton berukuran tetap. Kosong: menjelaskan apa yang akan muncul. Gagal: pesan, langkah berikutnya, tanpa detail teknis. Sibuk: label berganti dan kapsul kecil bergerak di sumbu 33 derajat (transform saja); tidak terlihat nonaktif |
| Motion | 150 sampai 280 ms untuk state; runner rute tipis cobalt hanya setelah 150 ms; tidak ada urutan pemuatan. `prefers-reduced-motion` menghentikan animasi dekoratif |
| Kebenaran isi | Hanya layar yang ada yang masuk navigasi; tanpa angka, KPI, atau data contoh yang tampak nyata; halaman referensi komponen hanya di build pengembangan dan QA dan berlabel contoh |
| Bingkai tanpa akun (B3.2b) | Masuk, tautan akses, 404, dan galat sesi memakai rail navy yang sama tanpa navigasi dan tanpa akun, dengan catatan singkat bahwa konsol hanya untuk akun yang diundang; di bawah 1024 px bar navy dengan mark dan preferensi di kaki halaman |
| Langkah alur | `StepTrack`: kapsul logo 33 derajat penuh (selesai), separuh (sekarang), putus-putus (berikutnya) dihubungkan garis rambut; keadaan juga ditulis untuk pembaca layar, langkah sekarang `aria-current="step"`. Di bawah 640 px hanya "Langkah 3 dari 4" di samping glyph sekarang, sehingga jalur tetap satu baris. Tidak tampil untuk tautan yang gagal: alur yang mati bukan langkah yang berjalan |
| Kotak centang | `check-input`: kotak 22 px radius 6 px bergaris rambut kuat di porselen terangkat; tercentang cobalt dengan tanda centang yang digambar (mask); fokus seperti isian |
| Perangkat | Kartu sesi dinamai dari user agent yang dicatat Laravel ("Chrome 156, Windows", `src/lib/user-agent.ts`), string aslinya tetap di bawahnya; tanpa tebakan bila tidak dikenali |
| Pesan | `Notice` inline: info dan berhasil (porselen terangkat, garis rambut), perhatian (porselen cekung, garis rambut kuat; garis putus-putus tetap khusus untuk "belum"), bahaya (`--danger-soft`, `role="alert"`); ikon dekoratif, kata membawa makna |
| Dialog | `<dialog>` native lewat `showModal()`: panel porselen terangkat radius 28 px dengan bayangan overlay, latar navy 42 persen; fokus awal pada pilihan aman (`data-autofocus`), Escape memilih pilihan aman, klik di luar tidak melakukan apa pun; peringatan idle sebagai `alertdialog` |
| Isian rahasia | Kata sandi dengan tombol tampil/sembunyi di dalam kapsul (`aria-pressed`, nama tetap); kode dan kunci memakai monospace (`field-code`), kunci TOTP per empat karakter yang tidak pernah terpotong; QR dari API sebagai `<img>` berlatar putih di kedua tema |
| Kode pemulihan | Daftar bernomor monospace di panel, satu tombol salin, kalimat tempat menyimpan, kotak centang wajib sebelum lanjut; navigasi keluar dicegah sampai dikonfirmasi |
| Fakta akun | Daftar istilah dan nilai berbaris garis rambut; berdampingan hanya bila wadahnya cukup lebar (container query), menumpuk di panel sempit |

## Aturan konten

- Satu label per niat: "Mulai konsultasi" (kontak), "Lihat portofolio" (portofolio).
- Tanpa em dash, tanpa eyebrow, tanpa angka atau klaim yang tidak bisa dibuktikan. Diuji otomatis di `src/data/content.test.ts`.
- Studi kasus demo selalu berlabel "Konsep demonstrasi, bukan proyek klien" dan tidak menerbitkan JSON-LD `CreativeWork`.
- Dua bahasa dengan struktur yang sama. Teks Inggris ditulis ulang untuk pembaca bisnis, bukan diterjemahkan kata per kata. Nama merek, tagline resmi, kontak, URL eksternal, dan fakta proyek identik di kedua bahasa.
- Tiga nomor WhatsApp tampil sebagai pilihan setara di satu menu atau satu daftar; tidak ada nama PIC, divisi, atau jam layanan karena belum dikonfirmasi.
