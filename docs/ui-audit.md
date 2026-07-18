# Audit UI REMPAHKARTA

Tanggal: 18 Juli 2026, Asia/Jakarta

## Ruang lingkup

Audit mencakup seluruh page route, komponen presentasi, conditional render, status pembayaran, status fulfillment, status pembatalan, status retur, state form, empty state, loading state, dan responsive layout. Putaran 18 Juli berfokus pada 17 route UI admin (16 route terlindungi dan satu route login), termasuk detail dinamis terdalam serta komponen aksi/form yang dipakai route tersebut. API, schema Prisma, aturan stok, state machine, payload, serta integrasi provider tidak diubah.

## Storefront dan halaman publik

| Route | Area yang diaudit | State utama | Verifikasi HTTP demo |
| --- | --- | --- | --- |
| `/` | header, hero, trust strip, filter, grid, editorial, footer | katalog terisi, badge opsional, diskon, tanpa diskon | 200 |
| `/products/[slug]` | breadcrumb, galeri, varian, stok, CTA, accordion, rekomendasi | single image, multi-image, tersedia, rendah, habis, varian satu dan dua tingkat | 200 untuk produk demo |
| `/cart` | daftar item, varian, kuantitas, hapus, summary | loading, kosong, satu item, multi-item, batas stok | 200 |
| `/checkout` | kontak, alamat, area, kurir, kebijakan, summary | tanpa login, alamat tersimpan, area kosong, area ditemukan, tarif kosong, tarif aktif, error, loading | redirect/login atau butuh database |
| `/login` | Google sign-in, simulasi development, error, loading, security note | Google tersedia, client ID kosong, simulasi, request gagal | 200 |
| `/pages/shipping` | kebijakan pengiriman | konten statis | 200 |
| `/pages/returns` | kebijakan retur dan refund | konten statis | 200 |

## Pesanan, pembayaran, dan pusat resolusi

| Route | Area yang diaudit | State utama | Verifikasi HTTP demo |
| --- | --- | --- | --- |
| `/orders/[number]` | header status, progress, timeline, item, alamat, total, bantuan | awaiting payment, paid, processing, packed, handover, in transit, completed, cancelled | 200 |
| `/orders/[number]` | pembatalan | requested, approved, rejected, seller cancelled, provider failed | source audit |
| `/orders/[number]` | retur dan refund | requested, rejected, refund pending, refunded, issue order, rekening belum lengkap | source audit |
| `/orders/[number]/payment` | QRIS, nominal, countdown, sync, status | pending, expired, paid, gagal, mock | source audit dan build |
| `/orders/[number]/mock-payment` | kontrol mock | paid, failed, busy, error | source audit dan build |
| `/orders/[number]/return` | wizard empat langkah | item belum dipilih, bukti kosong, deskripsi pendek, konfirmasi, sukses | 200 |

## Akun pelanggan

| Route | Area yang diaudit | State utama | Verifikasi |
| --- | --- | --- | --- |
| `/user` | profil, metrik, pesanan terbaru | profil lengkap, telepon kosong, pesanan kosong, pesanan tersedia | source audit dan build |
| `/user/orders` | daftar pesanan dan dua status pill | daftar kosong, paid, pending, refund pending, fulfillment berbeda | source audit dan build |
| `/user/addresses` | list dan form alamat | kosong, list, tambah, edit, hapus, cari area, error, sukses | source audit dan build |
| `/user/payment` | rekening refund | kosong, bank, e-wallet, edit, error, sukses | source audit dan build |

Render runtime halaman akun memerlukan session pelanggan dan MySQL. Tidak ada bypass autentikasi yang dipertahankan dalam hasil akhir.

## Panel admin

| Route | Area yang diaudit | State utama | Verifikasi akhir |
| --- | --- | --- | --- |
| `/admin-login` | identitas produk, label field, status error/busy, catatan keamanan | kosong, kredensial salah, jaringan gagal, submit | source, TypeScript, lint, build |
| `/admin` | shell, metrik, pesanan terbaru, antrean operasional | data terisi, nilai nol, nominal panjang, antrean kosong | source, TypeScript, lint, build |
| `/admin/orders` | filter URL, issue order, tabel, status | semua, issue, payment, fulfillment, kosong, data padat | source, TypeScript, lint, build |
| `/admin/orders/[number]` | timeline, item, shipment, alamat, ringkasan, action rail, developer disclosure | payment sync, transisi, cancel, shipment, issue resolution | source, TypeScript, lint, build |
| `/admin/products` | daftar, stok, status, aksi | aktif, draft, diarsipkan, stok rendah, stok habis, kosong | source, TypeScript, lint, build |
| `/admin/products/new` | form produk bersama | tanpa varian, varian tingkat I/II, media, dimensi, marketplace, publish | source, TypeScript, lint, build |
| `/admin/products/[id]` | form produk bersama | data ada, tidak ditemukan, varian nonaktif, data panjang | source, TypeScript, lint, build |
| `/admin/categories` | tambah, daftar, hapus | kosong, terisi, create, delete error | source, TypeScript, lint, build |
| `/admin/categories/[id]` | informasi dan assignment produk | kategori ada, produk kosong, produk terpilih | source, TypeScript, lint, build |
| `/admin/inventory` | metrik, tabel, disclosure adjustment | aman, rendah, habis, reserved, validation error | source, TypeScript, lint, build |
| `/admin/shipments` | daftar dan tautan pesanan | waybill ada, belum ada, pickup/drop-off, status berbeda | source, TypeScript, lint, build |
| `/admin/returns` | metrik, filter URL, tabel | requested, in transit, refund pending, selesai, kosong | source, TypeScript, lint, build |
| `/admin/returns/[id]` | bukti, item, rekening, refund, action rail | buyer issue, admin issue, rejected, refund diproses | source, TypeScript, lint, build |
| `/admin/users` | avatar, identitas, statistik pelanggan | kosong, data terisi, avatar/fallback, teks panjang | source, TypeScript, lint, build |
| `/admin/users/[id]` | profil, alamat, rekening, order | tanpa alamat, rekening, atau order; data lengkap | source, TypeScript, lint, build |
| `/admin/settings` | konfigurasi dan readiness | payment mock, BSTN, Biteship, MySQL siap atau kosong | source, TypeScript, lint, build |
| `/admin/audit` | jejak perubahan | empty state jujur; tidak menampilkan log statis/fiktif | source, TypeScript, lint, build |

### Masalah utama dan penyempurnaan

| Temuan kode | Risiko UI/operasional | Penyempurnaan yang diterapkan |
| --- | --- | --- |
| Sidebar desktop masih dipakai pada lebar tablet | area konten dan rail detail terjepit | breakpoint shell dipindah ke 1024 px; tablet dan mobile memakai drawer fokus-terkelola dengan scrim, Escape, scroll lock, serta `inert` saat tertutup |
| Cascade lama mengembalikan beberapa detail grid menjadi dua kolom | rail detail dan form dapat overlap pada 768–1023 px | override akhir menyatukan detail, produk, kategori, dan pelanggan ke satu kolom sampai 1023 px |
| Canvas admin krem dan permukaan tidak seragam | hierarki visual berat dan berbeda dari arahan light UI | canvas utama putih, surface sekunder tipis, border/shadow/radius dikonsolidasikan dalam kontrak admin |
| Toolbar pencarian, ekspor, rekonsiliasi, dan notifikasi tanpa handler | kontrol tampak aktif tetapi tidak bekerja | kontrol semu dihapus; hanya filter URL, link, dan action dengan handler nyata yang dipertahankan |
| Dashboard/audit memuat angka atau baris statis | informasi operasional dapat menyesatkan | diganti dengan state kosong atau nilai tidak tersedia yang jujur |
| Form produk panjang dengan konfigurasi tercampur | scanning lambat, tombol simpan jauh, tabel varian sulit dipakai | informasi dasar/media, rail penjualan, tabel varian penuh, marketplace, dan action bar bawah dipisahkan tanpa mengubah payload atau submit handler |
| Tabel kurang semantik dan kontrol kecil | navigasi keyboard/screen reader lemah; risiko salah tap | caption tersembunyi, `scope`, nama aksi, region scroll fokus, label kontekstual, dan target sentuh 44 px ditambahkan |
| Status mentah/tidak konsisten | operator sulit membaca prioritas | label Indonesia serta tone sukses/info/peringatan/bahaya dipusatkan pada status pill |
| Developer mock terlalu dominan | berisiko terpicu dalam pekerjaan rutin | dipindah ke disclosure tertutup dengan peringatan dan konteks eksplisit |

## Audit komponen lintas halaman

| Komponen | Perbaikan presentasi |
| --- | --- |
| Store header | wordmark REMPAHKARTA, hover nav, focus, akun, dropdown, mobile menu |
| Store footer | branding, hierarchy, kontras, spacing, tautan bantuan |
| Product card | rasio 1:1, hover terkendali, typographic hierarchy, badge |
| Product detail | galeri 1:1, sticky layout, stock state, mobile action bar |
| Form controls | border, focus halo, label, placeholder, disabled, error |
| Status pill | titik dan teks, warna semantik, state tambahan |
| Order timeline | marker, hierarchy, responsive columns, issue progress |
| Admin shell | active state, sidebar desktop collapsible, drawer tablet/mobile, focus return, Escape, scrim, scroll lock |
| Admin table | caption/scope, header muted, row hover, empty state jujur, overflow terlokalisasi |
| User panel | sticky sidebar desktop, nav horizontal mobile, card consistency |
| Login | branding, surface, form hierarchy, responsive spacing |

## Audit responsif lintas route

| Viewport target | Pemeriksaan | Hasil implementasi |
| --- | --- | --- |
| 320 px | topbar admin, judul panjang, metrik, tombol dua aksi, timeline | kolom dapat menyusut, label wrap, metrik dua kolom, aksi berubah satu kolom bila perlu |
| 360–390 px | katalog, keranjang, return wizard, rekening refund | media 1:1, item tidak overlap, field satu kolom, target sentuh 44 px |
| 640–760 px | account navigation, filter chip, tabel admin, sidebar | navigasi dan chip scroll terkontrol, tabel punya wrapper, admin memakai drawer |
| 768–1023 px | detail order/admin, form produk, kategori, pelanggan | admin memakai drawer dan seluruh rail/detail turun ke satu kolom tanpa overlap |
| mulai 1024 px | sticky gallery, summary, account sidebar, admin rail | sticky dibatasi viewport, sidebar admin dapat diciutkan, content memakai batas maksimal 1320 px |

Pengecualian overflow hanya dipakai pada tabel, filter chip, progress ringkas, dan navigasi akun. `body` memakai proteksi overflow horizontal, tetapi komponen tetap diperbaiki pada sumbernya agar konten tidak sekadar terpotong.

## Audit state dan komponen putaran kedua

- Media kartu, galeri, hero, editorial, cart, checkout, varian, bukti retur, dan bukti refund memakai rasio 1:1.
- Enam aset demo divalidasi sebagai PNG persegi yang dapat dibaca penuh.
- Sidebar admin memisahkan state collapse desktop dan drawer mobile; tombol membuka kembali sidebar memiliki `aria-controls` dan `aria-expanded`.
- Button primer, sekunder, tenang, dan destruktif memakai tinggi, alignment, padding, loading, dan disabled state yang sama.
- Inline style statis dipindahkan ke class lintas halaman. Inline style tersisa hanya geometri slider dan background image yang dihitung atau dipilih saat runtime.
- Timeline order tidak lagi menerima style global dari halaman; jumlah tahap, warna issue, dan garis akhir dikendalikan modifier class.
- Return wizard memiliki progress, pilihan item, upload 1:1, review, success, error, dan action bar responsif.
- Seluruh tabel admin, termasuk audit log, berada di wrapper scroll horizontal dan memiliki empty state jika datanya dapat kosong.
- Login, alamat, rekening refund, profil, cart, checkout, pembayaran QRIS/mock, dan action rail admin memakai feedback yang dekat dengan pemicu.

## Hasil otomatis

| Pemeriksaan | Hasil |
| --- | --- |
| TypeScript | lulus |
| ESLint | lulus, exit code 0; 41 warning lama di luar file UI admin yang diubah tidak memblokir |
| Unit/domain test | 13 dari 13 lulus |
| Production build | lulus |
| Validasi media | 6 dari 6 PNG demo valid dan 1:1 |
| Perlindungan API/lib | `app/api` dan `lib` identik dengan sumber sebelum perubahan |

## Keterbatasan

Sesuai arahan pekerjaan ini, validasi visual tidak bergantung pada login/database atau screenshot runtime. Detail retur, pelanggan, dan edit produk tetap memerlukan MySQL serta autentikasi nyata; bypass autentikasi atau data palsu tidak ditambahkan. Verifikasi dilakukan berlapis melalui pembacaan source dan conditional render, audit cascade di breakpoint 320/390/760/768/1023/1024/1280 px, perbandingan area logic/API, TypeScript, lint, unit test, dan production build.
