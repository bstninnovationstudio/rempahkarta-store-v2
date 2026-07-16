# Audit UI REMPAHKARTA

Tanggal: 16 Juli 2026, Asia/Jakarta

## Ruang lingkup

Audit mencakup seluruh page route, komponen presentasi, conditional render, status pembayaran, status fulfillment, status pembatalan, status retur, state form, empty state, loading state, dan responsive layout. API, schema Prisma, aturan stok, state machine, payload, serta integrasi provider tidak diubah.

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

| Route | Area yang diaudit | State utama | Verifikasi HTTP demo |
| --- | --- | --- | --- |
| `/admin-login` | form akses, error, busy | kosong, kredensial salah, submit | build |
| `/admin` | shell, metrics, order terbaru, antrean | data terisi, nilai nol, nominal panjang | 200 |
| `/admin/orders` | filter, issue order, tabel, status | semua, issue, payment, fulfillment, data padat | 200 |
| `/admin/orders/[number]` | timeline, item, shipment, alamat, summary, actions | payment sync, transisi, cancel, shipment, issue resolution | source audit dan build |
| `/admin/products` | toolbar, tabel, stok, status | aktif, draft, stok rendah, stok habis | 200 |
| `/admin/products/new` | form produk | tanpa varian, varian tingkat I dan II, media, dimensi, publish | source audit dan build |
| `/admin/products/[id]` | edit produk | data ada, tidak ditemukan, varian nonaktif | source audit dan build |
| `/admin/categories` | manager kategori | kosong, terisi, create, delete error | 200 |
| `/admin/categories/[id]` | editor dan assignment | kategori ada, produk kosong, produk terpilih | source audit dan build |
| `/admin/inventory` | metrics, tabel, adjustment | aman, rendah, habis, reserved, validation error | 200 |
| `/admin/shipments` | daftar shipment | waybill ada, belum ada, pickup, drop-off, status berbeda | 200 |
| `/admin/returns` | metrics, filter, tabel | requested, in transit, refund pending, selesai | 200 |
| `/admin/returns/[id]` | bukti, item, rekening, refund, action | buyer issue, admin issue, rejected, refund diproses | source audit dan build |
| `/admin/users` | search, avatar, statistik pelanggan | kosong, data terisi, avatar fallback | source audit, runtime butuh MySQL |
| `/admin/users/[id]` | profil, alamat, rekening, order | tanpa alamat, tanpa rekening, tanpa order, data lengkap | source audit dan build |
| `/admin/settings` | konfigurasi dan readiness | payment mock, BSTN, Biteship, MySQL siap atau kosong | 200 |
| `/admin/audit` | tabel audit | kosong dan data padat | 200 |

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
| Admin shell | active state, sidebar desktop collapsible, drawer mobile independen, scrim |
| Admin table | toolbar wrapping, header muted, row hover, mobile overflow |
| User panel | sticky sidebar desktop, nav horizontal mobile, card consistency |
| Login | branding, surface, form hierarchy, responsive spacing |

## Audit responsif lintas route

| Viewport target | Pemeriksaan | Hasil implementasi |
| --- | --- | --- |
| 320 px | topbar admin, judul panjang, metrik, tombol dua aksi, timeline | kolom dapat menyusut, label wrap, metrik dua kolom, aksi berubah satu kolom bila perlu |
| 360–390 px | katalog, keranjang, return wizard, rekening refund | media 1:1, item tidak overlap, field satu kolom, target sentuh 44 px |
| 640–760 px | account navigation, filter chip, tabel admin, sidebar | navigasi dan chip scroll terkontrol, tabel punya wrapper, admin memakai drawer |
| 768–1024 px | checkout summary, detail produk, detail order/admin | grid memakai `minmax(0,1fr)` dan turun menjadi satu kolom saat ruang tidak cukup |
| di atas 1024 px | sticky gallery, summary, account sidebar, admin rail | sticky dibatasi viewport, sidebar admin dapat diciutkan, content tetap memakai batas maksimal |

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
| ESLint | lulus, exit code 0, warning lama tidak memblokir |
| Unit/domain test | 13 dari 13 lulus |
| Production build | lulus |
| Validasi media | 6 dari 6 PNG demo valid dan 1:1 |
| HTTP smoke test | 19 route utama merespons 200; 4 route akun redirect aman ke login |

## Keterbatasan

Cloud browser tidak mengizinkan akses ke URL lokal runtime. Halaman edit produk demo mengembalikan 404 karena repository demo tidak menyediakan detail editor, sedangkan detail retur dan pelanggan membutuhkan MySQL. Bypass autentikasi atau data palsu tidak ditinggalkan karena perubahan dibatasi pada presentasi. Source, conditional render, HTTP demo yang tersedia, TypeScript, lint, unit test, dan production build telah diverifikasi.
