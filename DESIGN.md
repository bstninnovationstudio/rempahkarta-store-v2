# DESIGN.md: REMPAHKARTA Commerce UI

Dokumen ini adalah sumber acuan visual tunggal untuk storefront, akun pelanggan, checkout, pusat resolusi, dan panel admin REMPAHKARTA. Implementasi baru wajib mengikuti token, pola komponen, aturan state, dan kriteria penerimaan di bawah ini. Perubahan visual tidak boleh mengubah kontrak API, state machine, aturan stok, pembayaran, pengiriman, retur, atau refund.

## 1. Prinsip desain

### 1.1 Karakter visual

REMPAHKARTA memakai gaya editorial yang hangat, modern, minimal, dan bersih. Foto produk menjadi fokus utama. Antarmuka memakai canvas krem muda, permukaan putih hangat, teks cokelat gelap, border tipis, serta aksen gelap #120800 dan aksen emas (#d5a63e / #caa052). Efek visual harus tenang. Ornamen yang tidak mendukung pemahaman dilarang.

### 1.2 Prioritas pengalaman

1. Informasi terpenting harus terlihat dalam satu kali pemindaian.
2. Aksi utama hanya satu pada setiap konteks.
3. Status harus terbaca melalui teks, warna, dan bentuk.
4. Error harus menjelaskan masalah dan tindakan pemulihan.
5. Informasi operasional lebih penting daripada dekorasi.
6. Mobile tidak boleh menjadi versi desktop yang diperkecil.
7. UI tidak boleh menutupi ketidakpastian data dengan klaim palsu.

### 1.3 Batas perubahan

Perubahan struktur markup diperbolehkan hanya untuk hierarki, aksesibilitas, responsivitas, dan pengelompokan visual. Tidak boleh membuat route baru. Tidak boleh mengubah query, payload, validasi, state machine, kalkulasi harga, stok, pengiriman, atau hak akses.

## 2. Token kanonis

Semua warna antarmuka wajib berasal dari CSS custom properties. Hex acak di komponen tidak diperbolehkan, kecuali warna pihak ketiga yang wajib dipertahankan.

```css
:root {
  --canvas: #f8f6f1;
  --surface: #fffefa;
  --surface-muted: #f1ede5;
  --surface-raised: #ffffff;

  --ink: #211b17;
  --ink-soft: #4e4741;
  --ink-muted: #756d65;

  --line: #e4ded4;
  --line-strong: #cbc2b6;

  --accent: #120800;
  --accent-hover: #83402c;
  --accent-soft: #f5e6df;

  --success: #276b4b;
  --success-soft: #e8f3ec;
  --warning: #956315;
  --warning-soft: #f8eedc;
  --danger: #aa4039;
  --danger-soft: #f8e9e7;
  --info: #426989;
  --info-soft: #eaf0f5;

  --radius-sm: 7px;
  --radius: 11px;
  --radius-lg: 16px;

  --shadow-sm: 0 1px 2px rgb(40 31 24 / 4%),
               0 8px 24px rgb(40 31 24 / 4%);
  --shadow: 0 18px 52px rgb(40 31 24 / 9%);

  --content: 1180px;
  --content-wide: 1320px;

  --control-height: 48px;
  --control-height-compact: 40px;
  --touch-target: 44px;
}
```

### 2.1 Makna warna

| Token | Fungsi | Tidak boleh dipakai untuk |
| --- | --- | --- |
| `accent` | identitas, tautan penting, pilihan aktif | error atau status stok |
| `success` | selesai, dibayar, tersedia, berhasil | aksi primer umum |
| `warning` | menunggu, perlu perhatian, stok rendah | error terminal |
| `danger` | gagal, ditolak, dibatalkan, destruktif | dekorasi |
| `info` | diproses, dalam pengiriman, informasi netral | promosi |

## 3. Tipografi

Font utama adalah Manrope. Font fallback adalah Arial dan sans-serif.

| Elemen | Ukuran | Bobot | Line-height | Catatan |
| --- | ---: | ---: | ---: | --- |
| Hero | 44 sampai 80 px | 650 | 1.02 | letter-spacing negatif, maksimal dua fokus baris |
| H1 halaman | 34 sampai 44 px | 700 | 1.12 | satu judul per halaman |
| H2 section | 26 sampai 38 px | 700 | 1.2 | tidak memakai huruf kapital penuh |
| H3 card | 15 sampai 18 px | 700 | 1.35 | maksimal dua baris |
| Body | 14 sampai 16 px | 400 sampai 500 | 1.6 sampai 1.8 | warna `ink` atau `ink-muted` |
| Label | 11 sampai 12 px | 700 | 1.4 | ringkas dan spesifik |
| Eyebrow | 11 px | 700 | 1.4 | uppercase, tracking 0.14em |
| Tabel admin | 10 sampai 12 px | 500 sampai 700 | 1.45 | data tidak boleh terpotong tanpa akses detail |

Angka harga memakai tabular alignment bila tersedia. Huruf kapital penuh hanya untuk eyebrow, label tabel, dan kode pendek.

## 4. Spacing, grid, dan elevasi

Skala spacing adalah 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, dan 120 px. Nilai di luar skala hanya boleh dipakai untuk kebutuhan geometri ikon atau alignment satu piksel.

Container storefront memiliki lebar maksimal 1320 px. Container form dan akun memiliki lebar maksimal 1180 px. Padding horizontal desktop 24 sampai 32 px. Padding horizontal mobile 12 sampai 16 px.

Shadow hanya dipakai pada elemen yang benar-benar berada di atas permukaan lain, seperti dropdown, modal, sticky summary, dan sidebar mobile. Card biasa memakai border dan `shadow-sm` yang sangat halus. Shadow besar dekoratif dilarang.

## 5. Komponen dasar

### 5.1 Button

Tinggi standar 48 px. Tinggi kompak 40 px. Target sentuh tidak boleh kurang dari 44 px pada mobile. Isi button selalu dipusatkan secara horizontal dan vertikal. Ikon berada sebelum label dengan gap 8 sampai 10 px dan tidak boleh menyusut.

| Varian | Class | Penggunaan |
| --- | --- | --- |
| Primer | `button-dark` | satu aksi utama pada konteks aktif |
| Sekunder | `button-light` | kembali, sinkronisasi, pilihan pendamping |
| Destruktif lembut | `button-danger` | membuka atau mengonfirmasi alur berisiko |
| Destruktif tegas | `button-danger-solid` | keputusan destruktif final di dalam panel konfirmasi |
| Tenang | `button-quiet` | aksi kecil non-primer di dalam baris data |
| Penuh | `button-block` | card sempit, mobile, dan action rail |

Outline kosong tanpa background hanya boleh dipakai pada `button-quiet`; aksi sekunder memakai permukaan krem agar tetap terlihat sebagai kontrol. Button disabled memakai opacity 48 persen, tidak bergerak saat hover, dan tetap menyampaikan label. Loading mempertahankan lebar button agar layout tidak bergeser. Button ikon wajib memiliki label aksesibel dan area 44 kali 44 px, kecuali tombol hapus yang berada tepat di atas thumbnail dapat berukuran 28 sampai 32 px selama thumbnail bukan satu-satunya cara menghapus pada mobile.

### 5.2 Input

Input memiliki tinggi minimum 48 px, border `line-strong`, radius 7 px, dan background putih. Focus memakai border `accent` serta halo transparan. Label selalu terlihat. Placeholder tidak menggantikan label. Error ditempatkan dekat field dan harus tetap terbaca oleh screen reader.

### 5.3 Card dan panel

Card utama memakai `surface-raised`, border `line`, radius 11 px, serta padding 20 sampai 24 px. Card tidak boleh bersarang lebih dari dua tingkat. Pengelompokan data sederhana memakai divider, bukan card tambahan.

### 5.4 Status pill

Status pill memiliki titik, teks, warna semantik, dan background lembut. Warna bukan satu-satunya indikator.

| Kelompok | Contoh state | Warna |
| --- | --- | --- |
| Sukses | paid, completed, delivered, finished, refunded | hijau |
| Proses | processing, shipment_booked, handed_over, in_transit | biru |
| Menunggu | pending, awaiting_payment, awaiting_processing, handover_pending, requested | kuning kecokelatan |
| Gagal | failed, cancelled, rejected, refund_pending | merah |

Label pelanggan wajib memakai bahasa Indonesia. Nilai state mentah hanya boleh muncul pada konteks audit atau teknis admin.

### 5.5 Modal, dropdown, dan toast

Modal memakai overlay 50 persen, blur ringan, radius 16 px, dan satu tombol close yang memiliki label aksesibel. Dropdown harus terkait langsung dengan pemicu, memiliki shadow tipis, dan dapat ditutup melalui aksi yang jelas. Toast boleh ditambahkan untuk feedback mutasi, tetapi tidak boleh menjadi satu-satunya tempat error penting ditampilkan.

### 5.6 Empty, loading, dan error state

Empty state menjelaskan apa yang kosong dan menawarkan aksi yang relevan. Loading state menjaga bentuk layout agar tidak terjadi pergeseran besar. Error state menyebut masalah, dampak, dan langkah berikutnya. Dilarang hanya menampilkan kata "Error".

## 6. Fotografi dan media

Seluruh foto commerce memakai rasio 1:1: kartu katalog, galeri detail, hero, editorial, thumbnail keranjang, thumbnail ringkasan, media varian, bukti retur, dan bukti refund. Foto harus berhubungan dengan produk yang ditampilkan. Background netral, krem, putih, atau material alami diperbolehkan. Foto pakaian, placeholder generik, watermark pihak lain, dan klaim promosi yang tidak relevan dilarang.

Foto produk utama memakai `object-fit: cover`. Kemasan yang memiliki teks penting dan seluruh bukti refund atau retur memakai `object-fit: contain` bila pemotongan dapat menghilangkan informasi. Thumbnail tidak boleh menentukan tinggi card secara bebas. Alt text menjelaskan isi dan konteks, bukan sekadar "gambar".

## 7. Storefront

### 7.1 Header

Header memiliki tinggi 70 px desktop dan 60 px mobile. Wordmark REMPAHKARTA menjadi pusat identitas. Navigasi desktop memakai underline halus saat hover. Mobile memakai menu layar penuh. Keranjang menampilkan jumlah hanya bila lebih dari nol. Menu akun memiliki fokus, aria label, dan state expanded.

### 7.2 Beranda

Hero memakai satu foto utama 1:1, satu foto pendukung desktop, satu eyebrow lokasi, headline, deskripsi, dan satu CTA primer. Trust strip memuat maksimal tiga bukti layanan. Grid produk memakai tiga kolom desktop dan dua kolom mobile. Filter kategori menjadi scroll horizontal pada mobile.

### 7.3 Product card

Urutan informasi adalah kategori, nama, atribut ringkas, harga, diskon jika valid, lalu bukti sosial. Badge hanya digunakan bila didukung data. Hover memperbesar foto maksimal 3.5 persen. Card tidak memakai shadow.

### 7.4 Detail produk

Desktop memakai galeri 58 persen dan informasi 42 persen. Galeri sticky, rasio 1:1. Informasi sticky tidak boleh melampaui viewport tanpa tetap dapat di-scroll. Mobile memakai satu kolom dan action bar sticky di bagian bawah. Pilihan varian disabled harus tetap terbaca tetapi tidak dapat dipilih.

State yang wajib diperiksa: tersedia, stok rendah, habis, satu varian, dua tingkat varian, gambar tunggal, multi-image, diskon, tanpa diskon, dan konfirmasi masuk keranjang.

### 7.5 Keranjang dan checkout

Keranjang menampilkan gambar, nama, varian, harga unit, kuantitas, dan aksi hapus. Summary sticky pada desktop dan statis pada mobile. Checkout memakai urutan kontak, alamat, area, kurir, persetujuan, dan pembayaran. Hasil area hanya muncul setelah aksi pencarian. Perubahan harga ongkir harus terlihat jelas sebelum pelanggan melanjutkan.

State yang wajib diperiksa: keranjang kosong, satu item, multi-item, stok maksimum, alamat tersimpan, alamat baru, area kosong, area gagal, ongkir kosong, tarif terpilih, persetujuan kosong, loading, dan error API.

### 7.6 Login dan akun

Login memakai satu card fokus. Branding konsisten dengan REMPAHKARTA. Panel akun memakai sidebar sticky desktop dan navigasi horizontal mobile. Dashboard pelanggan memprioritaskan total pesanan, total belanja, pembayaran tertunda, dan pesanan terbaru.

State yang wajib diperiksa: belum login, login Google tersedia, mode demo development, profil belum lengkap, akun tanpa pesanan, akun dengan pesanan, alamat kosong, alamat tersimpan, rekening refund kosong, dan rekening refund tersimpan.

### 7.7 Pesanan, pembayaran, dan retur

Detail pesanan memprioritaskan nomor order, pembayaran, fulfillment, timeline, item, alamat, dan aksi yang valid. Timeline tidak boleh memalsukan timestamp. Pembayaran QRIS memusatkan kode, nominal, waktu kedaluwarsa, dan status. Pusat resolusi memisahkan informasi status, bukti, data refund, serta aksi pelanggan.

State yang wajib diperiksa: awaiting payment, paid, failed, processing, packed, shipment booked, handover pending, in transit, completed, cancelled, cancellation requested, cancellation rejected, return requested, return rejected, refund pending, refund processed, issue order, dan finished.

## 8. Panel admin

### 8.1 Shell

Desktop memakai sidebar 260 px dan topbar 70 px. Sidebar memisahkan menu operasional dan sistem. Active state memakai accent soft. Sidebar desktop wajib dapat diciutkan tanpa menutupi isi; tombol topbar membuka kembali sidebar dan mengumumkan `aria-expanded`. Mobile memakai drawer off-canvas dengan scrim, menutup setelah navigasi, dan tidak mewarisi state collapse desktop. Semua route admin harus dapat dijangkau pada mobile.

### 8.2 Dashboard

Dashboard menampilkan metrik operasional, pesanan terbaru, dan antrean tindakan. Grafik dekoratif tidak digunakan. Nilai metrik besar harus tetap muat pada layar sempit. Tanggal statis dilarang jika tidak berasal dari data aktual.

### 8.3 Tabel

Tabel memakai header muted, row divider, hover halus, status pill, dan satu tautan detail yang jelas. Tabel lebar memakai horizontal scroll pada mobile. Kolom PII harus tetap diminimalkan. Search dan filter berada di toolbar yang dapat membungkus.

### 8.4 Detail dan form

Detail order memakai kolom utama dan rail aksi. Form produk mengelompokkan informasi dasar, media, variasi, harga, dimensi, stok, dan publikasi. Aksi destruktif ditempatkan terpisah dari save. Input SKU, harga, stok, berat, dan dimensi tetap mengikuti validasi domain yang ada.

State admin yang wajib diperiksa: daftar kosong, data padat, stok aman, stok rendah, stok habis, order bermasalah, pembatalan menunggu, shipment tersedia, shipment gagal, retur menunggu keputusan, retur ditolak, refund diproses, user tanpa alamat, user tanpa rekening, dan integrasi belum siap.

## 9. Responsivitas

Breakpoint kanonis adalah 640, 760, 1024, dan 1280 px. Implementasi mobile-first dianjurkan untuk komponen baru.

| Lebar | Aturan utama |
| --- | --- |
| 320 sampai 389 px | satu kolom penuh, label boleh wrap, metrik maksimal dua kolom, tombol aksi utama selebar container |
| 390 sampai 639 px | satu kolom form, target sentuh 44 px, padding 12 sampai 16 px, katalog dua kolom |
| 640 sampai 759 px | dua kolom produk, card ringkas, navigasi horizontal akun |
| 760 sampai 1023 px | grid dua kolom, summary dapat tetap berdampingan bila muat, admin memakai drawer |
| 1024 sampai 1279 px | layout desktop padat, gap diperkecil |
| 1280 px ke atas | container maksimal, whitespace diperluas |

Tidak boleh ada horizontal overflow pada body. Pengecualian hanya untuk tabel admin, filter chip, progress step, dan navigasi akun yang sengaja dapat di-scroll.

### 9.1 Kontrak mobile

- Gunakan `minmax(0, 1fr)` pada kolom yang memuat teks dinamis.
- Nomor pesanan, SKU, email, resi, dan URL harus dapat membungkus atau dipotong dengan akses detail yang tetap tersedia.
- Sticky action tidak boleh menutupi konten terakhir; tambahkan ruang bawah termasuk `env(safe-area-inset-bottom)`.
- Tabel admin tetap berupa tabel dan ditempatkan di container scroll horizontal. Jangan menyembunyikan kolom data secara acak.
- Filter, tab, dan progress yang di-scroll harus memakai `overscroll-behavior-inline: contain`.
- Modal memakai tinggi maksimal berbasis `100dvh`, body modal dapat di-scroll, dan action tetap terlihat.
- Grid bukti dan media memakai dua sampai tiga thumbnail persegi pada ponsel.
- Sidebar, menu, dropdown, dan modal harus memiliki aksi tutup eksplisit; tap pada scrim menutup lapisan.

## 10. Aksesibilitas

Kontras teks normal minimal 4.5:1. Teks besar minimal 3:1. Fokus keyboard harus terlihat. Semua icon-only button wajib memiliki `aria-label`. Status tidak bergantung pada warna. Target sentuh minimal 44 kali 44 px. Heading mengikuti urutan logis. Modal dan menu harus dapat ditutup secara eksplisit.

Animasi maksimal 220 ms. `prefers-reduced-motion` menonaktifkan animasi, transform, dan smooth scroll. Autoplay, parallax, flashing, dan countdown agresif dilarang.

## 11. Bahasa antarmuka

Bahasa pelanggan singkat, konkret, dan berorientasi tindakan. Istilah provider tidak ditampilkan bila tidak membantu. Istilah yang diutamakan adalah "pengiriman", "pembayaran QRIS", "refund", "retur", dan "nomor resi". Gunakan sentence case. Hindari jargon internal dan campuran bahasa tanpa alasan.

## 12. Larangan tetap

- Tidak ada promo, rating, stok, countdown, atau testimoni palsu.
- Tidak ada gradient dekoratif.
- Tidak ada dark admin.
- Tidak ada glassmorphism berat.
- Tidak ada shadow besar pada semua card.
- Tidak ada warna baru di luar token tanpa keputusan desain terdokumentasi.
- Tidak ada imitasi logo atau layout marketplace.
- Tidak ada route baru untuk menyelesaikan masalah layout.
- Tidak ada perubahan logic bisnis yang dibungkus sebagai perbaikan UI.

## 13. Kriteria penerimaan visual

Perubahan dianggap selesai hanya bila seluruh poin berikut terpenuhi.

1. Branding REMPAHKARTA konsisten pada metadata, header, login, footer, dan admin.
2. Foto demo relevan dengan rempah dan seluruh media commerce memakai rasio 1:1.
3. Semua route memiliki heading, spacing, surface, dan aksi yang konsisten.
4. Status utama memiliki teks dan warna semantik.
5. Storefront, akun, order, retur, dan admin dapat digunakan pada mobile.
6. Tidak ada overflow body pada viewport sempit.
7. Focus ring terlihat pada link, button, input, select, dan textarea.
8. Reduced motion dihormati.
9. Lint, test, TypeScript, dan production build lulus.
10. Tidak ada perubahan pada API, schema, state machine, payload, atau aturan bisnis.

## 14. Prosedur audit halaman

Untuk setiap route, lakukan urutan berikut.

1. Baca source dan identifikasi seluruh kondisi render.
2. Catat state kosong, loading, berhasil, warning, error, dan disabled.
3. Periksa desktop dan mobile.
4. Periksa fokus keyboard dan label aksesibel.
5. Periksa konsistensi token, spacing, radius, dan status.
6. Periksa bahwa perubahan hanya bersifat presentasional.
7. Jalankan lint, test, dan build setelah iterasi visual selesai.

## 15. Matriks state lintas fitur

Matriks ini wajib digunakan bersama audit route. Perbedaan status tidak boleh hanya mengganti warna; susunan informasi dan aksi harus tetap masuk akal.

| Domain | State | Presentasi wajib | Aksi yang boleh terlihat |
| --- | --- | --- | --- |
| Pembayaran | pending | warning, nominal, tenggat atau instruksi | bayar, sinkronkan, batalkan bila diizinkan logic |
| Pembayaran | paid | success, waktu atau referensi bila ada | lihat detail pesanan |
| Pembayaran | failed/expired | danger, penyebab yang tersedia | ulang sesuai logic atau kembali |
| Fulfillment | awaiting/processing/packed | progress aktif tunggal, timeline faktual | hanya transisi yang diberikan logic |
| Pengiriman | booked/handover/in_transit | info, kurir dan resi bila ada | tracking atau sinkronisasi |
| Fulfillment | completed | success, timeline final | ajukan masalah bila masih valid |
| Pembatalan | requested/provider_failed | warning atau danger, alasan, dampak | keputusan admin yang tersedia |
| Pembatalan | approved/rejected/cancelled | keputusan final dan alasan | tidak menampilkan aksi yang sudah tidak valid |
| Retur | requested/rejected/in_transit | status, item terdampak, bukti | aksi sesuai role dan state |
| Refund | pending/processed | rekening, nominal, referensi dan bukti bila ada | proses atau lihat bukti |
| Data | kosong | empty state berjudul dan penjelasan | CTA relevan jika ada |
| Mutasi | busy/success/error | label stabil, disabled saat busy, feedback dekat aksi | tidak memicu request ganda |

## 16. Tata letak pusat resolusi dan timeline

Timeline memakai satu sumbu vertikal pada riwayat rinci dan progress horizontal hanya untuk tahap ringkas. Timestamp hanya dirender bila data tersedia. Marker aktif, selesai, warning, dan danger memakai token semantik; garis tidak boleh berlanjut setelah node terakhir. Pada mobile, kolom waktu dipadatkan tetapi isi kejadian tidak dipotong.

Pusat resolusi menempatkan ringkasan masalah lebih dahulu, lalu item terdampak, bukti 1:1, data pengiriman balik, data refund, dan aksi. Rail aksi desktop berubah menjadi alur satu kolom pada mobile. Aksi destruktif selalu berada dalam panel konfirmasi yang berbeda dari aksi operasional biasa.

## 17. Kepemilikan CSS dan pengecualian gaya

`app/globals.css` adalah implementasi token dan pola lintas halaman. Inline style hanya diperbolehkan untuk nilai geometri yang benar-benar dihitung saat runtime, seperti posisi slider dan background image berbasis data. Style lokal tidak boleh mendefinisikan ulang button, input, status, panel, tabel, sidebar, timeline, atau rasio media. Pengecualian komponen lama harus dipindahkan bertahap ke class bernama dan tidak boleh mengubah kontrak logic.
