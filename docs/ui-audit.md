# Audit UI REMPAHKARTA v1.3.0

Tanggal audit source: 19 Juli 2026 (Asia/Jakarta)

## Metode dan batas verifikasi

Audit dilakukan dari struktur page/component, conditional render, query yang membentuk state UI, dan cascade CSS. Sesuai batas pekerjaan, audit ini tidak memakai screenshot atau mengklaim render runtime halaman yang membutuhkan Google session/MySQL. Hasil lint, TypeScript, test, build, dan validasi database hanya dicatat di `docs/test-report.md` setelah benar-benar dijalankan.

Inventaris 34 page route berada di `docs/system-map.md`. Audit ini berfokus pada perubahan UI dan risiko layout, terutama panel pelanggan.

## Temuan utama panel pelanggan sebelum penyempurnaan

| Temuan struktur | Dampak | Penyempurnaan pada v1.3.0 |
| --- | --- | --- |
| Kontak, alamat, dan rekening berada di flow/page terpisah | User tidak memahami data mana yang wajib dan harus berpindah konteks | `/user/settings` menjadi satu halaman universal dengan tiga section, anchor, completion chip, progress, dan CTA kembali. |
| Tidak ada gate kelengkapan yang konsisten setelah login | User dapat tiba di checkout sebelum data siap | Respons login membawa completeness; account layout mengarahkan user belum lengkap; checkout page dan API mengulang gate. |
| Sidebar hanya berfungsi sebagai kumpulan link dan editor profil terpisah | Identitas, navigasi, dan readiness akun tidak memiliki hierarki | Sidebar dikelompokkan menjadi identity card, tiga navigasi utama, status readiness, dan logout. Tombol profil menuju section kontak settings. |
| Dashboard mencampur data list dan statistik | Risiko load banyak transaksi dan hierarki konten lemah | Statistik memakai count/aggregate; recent order dibatasi tiga; quick action dipisah dari activity list. |
| Riwayat order tidak dipaginasi | Halaman dan query membesar seiring transaksi | Prev/next server-rendered 10 order/page, total/range jelas, page di luar batas dinormalisasi. |
| Card/list/form lama tidak berbagi alignment dan density | Label, CTA, status, dan isi dinamis mudah bergeser | Hero, panel, form section, status chip, empty state, toolbar, dan action row memakai pola kelas bersama. |
| Layout akun desktop dipaksakan pada tablet | Sidebar dan konten form berpotensi terjepit | Desktop dua kolom; tablet memindahkan sidebar ke bar horizontal; mobile menjadi satu kolom. |
| Konten dinamis seperti nomor order/email/rekening tidak selalu punya shrink/wrap boundary | Overflow atau overlap di layar sempit | Grid memakai `minmax(0, 1fr)`, nilai dinamis wrap, status/actions turun baris pada mobile. |

## Arsitektur informasi akun saat ini

```text
Account layout
├── Identity: avatar/fallback, nama, email, link settings
├── Navigasi: Ringkasan · Pesanan · Pengaturan
├── Readiness: lengkap / bagian yang kurang
└── Content
    ├── /user          statistik + tiga order terbaru + quick actions
    ├── /user/orders   list 10/page + prev/next
    └── /user/settings progress + kontak + alamat + rekening refund
```

Route `/user/addresses` dan `/user/payment` hanya menjadi redirect kompatibilitas menuju anchor settings. Dengan demikian, hanya ada satu tempat edit utama dan tautan lama tidak langsung rusak.

## Audit per halaman akun

| Route | Struktur aktif | State kode yang ditangani | Catatan audit |
| --- | --- | --- | --- |
| `/login` | Card Google Identity, status busy/error, catatan keamanan | Google tersedia/tidak dikonfigurasi, credential gagal, mock lokal ber-flag ganda, redirect | Redirect hanya menerima path internal; user belum lengkap diarahkan ke onboarding. |
| `/user` | Hero + CTA, tiga metric card, recent order, quick actions | Order kosong/tersedia, pending payment, nilai total panjang | Hanya tiga order terbaru; empty state memiliki CTA. |
| `/user/orders` | Hero/total, range toolbar, order card, dua status pill, pagination | Kosong, satu/banyak page, seluruh enum payment/fulfillment | Status aktual tidak dipaksa menjadi “menunggu”; nomor, tanggal, total, dan aksi detail dipisah; prev/next memiliki disabled state non-interaktif. |
| `/user/settings` | Progress tiga bagian, tiga section form, security note, CTA selesai | Belum lengkap, sebagian lengkap, lengkap, save/error/success | Kontak, alamat, dan rekening dapat diselesaikan tanpa berpindah page. |
| `/user/addresses` | Redirect kompatibilitas | `action` dan redirect internal | Meneruskan ke `#addresses`; bukan UI paralel. |
| `/user/payment` | Redirect kompatibilitas | — | Meneruskan ke `#payment`; bukan UI paralel. |
| `/checkout` | Contact/address, area search, tarif, policy, summary | Session kosong, profil belum lengkap, lokasi/rate kosong/gagal, loading, price changed | Gate server dilakukan sebelum form; API tetap menjadi otoritas keamanan. |

## Audit form settings

### Kontak

- Field nama, email, dan telepon memiliki label, autocomplete/input mode, batas panjang, error dekat form, status sukses, dan button loading.
- Save meminta Turnstile action `user_profile`; client refresh membuat progress/completion dihitung ulang dari server.
- Email ditampilkan read-only dan mengikuti identitas Google terverifikasi; form hanya mengubah nama dan telepon. Ini menjaga fallback ownership order legacy tidak dapat diarahkan ke email bebas.

### Alamat

- Maksimal lima alamat ditampilkan sebagai card; add/edit menggunakan satu form.
- Pencarian area hanya berjalan setelah tombol ditekan dan minimal tiga karakter; hasil dibatasi delapan di UI.
- Alamat membutuhkan result area yang valid, detail, kode pos, serta kontak.
- Tambah/edit/hapus memakai Turnstile `user_address`, feedback error/success, confirmation delete, dan refresh server.
- Form mobile menjadi satu kolom; tombol tambah turun selebar container.

### Rekening refund

- Bank dan e-wallet dipresentasikan sebagai pilihan eksplisit, bukan dua form sekaligus.
- Rekening aktif ditampilkan dalam card ringkas; nomor dimasking kecuali empat digit terakhir.
- Nama layanan, nama pemilik, dan nomor wajib; save memakai Turnstile `user_payment`.
- Copy menjelaskan bahwa data hanya dipakai untuk refund pembatalan/retur.

## Responsivitas panel pelanggan

| Rentang | Struktur source | Proteksi overlap/overflow |
| --- | --- | --- |
| `>= 1061px` | Sidebar sticky 270 px + content `minmax(0,1fr)` | Content tidak dipaksa melebar oleh string dinamis; section memiliki max-width container. |
| `761–1060px` | Account shell satu kolom; identity/nav/logout berada pada bar atas | Status readiness disembunyikan; badge tambahan juga disembunyikan sampai 920 px agar nav tiga kolom tidak overlap. |
| `<= 760px` | Satu kolom, padding 14 px; identity dan nav ditumpuk | Field menjadi satu kolom, CTA/action full-width, order meta/status turun ke row baru. |
| Layar sangat sempit | Padding turun 10 px, label nav dapat dua baris | Target nav tidak bergantung pada satu baris; dynamic text memakai wrap/min-width 0. |

Sticky element hanya digunakan pada sidebar desktop. Form/settings dan order card tidak menjadi overlay. Anchor section memakai `scroll-margin-top`; grid/list yang memuat teks dinamis menggunakan shrink boundary. Body tidak seharusnya mendapat horizontal scroll dari panel akun.

## Panel admin

Flow transaksi admin tidak diganti. Penyempurnaan UI/query yang relevan:

| Area | Penyempurnaan |
| --- | --- |
| Shell | Canvas putih, sidebar desktop mulai 1024 px, drawer tablet/mobile dengan scrim, Escape, focus return, dan scroll lock. |
| Dashboard | Empat order terbaru dan stats query terpisah; tidak memakai list penuh untuk menghitung metrik. |
| Orders | Filter URL dipertahankan; list 20/page, relasi ringkas, pagination semantik. |
| Products/inventory/shipments/returns/users/audit | Tabel berada dalam region overflow lokal dan memakai pagination 20/page; stats terpisah dari rows. |
| Product editor | `/admin/products/[id]` dan `/admin/products/new` mengelompokkan identitas, penjualan, media, varian, dan distribusi; rail menampilkan ringkasan stok/harga langsung; payload dan route simpan tetap sama. |
| Product actions | List memakai ikon edit/duplikat/hapus dengan konfirmasi hapus. Duplikat membuka editor tambah yang telah terisi tanpa menciptakan produk sebelum disimpan; media produk dapat ditata ulang dengan tombol kiri/kanan. |
| User detail | Riwayat order 10/page, sehingga profil tidak menarik seluruh transaksi user. |
| Category detail | Tetap full-list dengan alasan data-integrity; produk yang sudah memiliki kategori lain disabled, preview gambar ditampilkan, dan API menolak assignment konflik. |
| Detail/action rail | Tablet/mobile turun satu kolom; rail tidak menjadi overlay. State machine dan endpoint transaksi tetap sama. |
| Voucher | Form CRUD/modal riwayat memiliki aksi nyata; tabel berada dalam overflow lokal, status selalu berupa teks semantik. |
| Dana omzet | Empat kartu ringkas, form penarikan dengan batas saldo/konfirmasi, dan ledger terpaginasi; rincian settlement menampilkan total QRIS, ongkir, biaya admin/layanan, fee QRIS, serta posisi bersih. |
| Dana Biteship | Ringkasan shadow balance, form biaya request, modal catatan manual, dan tabel CRUD; record otomatis ditandai sebagai otomatis dan tidak menawarkan aksi edit/hapus. |
| Kontrol semu | Search/export/notifikasi tanpa handler tidak ditampilkan sebagai aksi aktif. |

API JSON list admin yang dapat dipakai UI/consumer lain juga dipaginasi dan memiliki endpoint stats tersendiri. Pemetaan kontrak berada di `docs/system-map.md`.

## Storefront dan pusat pesanan

| Area | Pemeriksaan source | Status desain |
| --- | --- | --- |
| Canvas | Root, panel customer, dan admin memakai background dasar putih | Sesuai arahan; surface muted hanya untuk grouping. |
| Store header/footer | Breakpoint nav, menu akun/cart, focus, link bantuan | Struktur lama dipertahankan; bukan fokus rombak v1.3.0. |
| Katalog/detail | Media 1:1, varian, stock state, CTA | Data berasal dari cache katalog; checkout tetap revalidasi DB. |
| Cart | Empty/list, quantity/remove, summary | Layout client tetap; cart server sync dibatasi dan divalidasi. |
| Detail order | Ownership, payment/fulfillment status, timeline, cancel/return/refund | Tidak lagi dapat dibuka hanya dari nomor/token URL. |
| Payment | Pending/paid/failed/expired, sync manual | Sync customer memakai Turnstile dan rate limit. |
| Voucher | Marquee publik setelah katalog; input cek dan diskon pada ringkasan checkout | Marquee berhenti hover/fokus dan reduced motion; total UI hanya presentasi, checkout menghitung ulang di server. |
| Return | Step/item/evidence/review/error/success | Order ownership dan eligibility divalidasi API. |

## Aksesibilitas dan consistency contract

- Heading utama hanya satu per page; section settings memakai heading level dua.
- Status disampaikan dengan label/ikon/tone, tidak hanya warna.
- Drawer mobile menjebak fokus, menutup lewat Escape/scrim, membuat background inert, mengunci scroll, lalu mengembalikan fokus; dropdown akun menutup lewat Escape/klik luar.
- Error penting memakai `role=alert`, feedback sukses memakai live status.
- Button ikon memiliki label aksesibel atau berada bersama label teks.
- Target sentuh mobile untuk navigasi dan aksi utama minimum 44 px.
- Putaran QA source menaikkan copy utama/hero ke 12–14 px, label/helper ke minimum 11–12 px, tombol/nav ke 11–12 px, serta status/trust/tag/bukti sosial penting ke minimum 11 px; tidak ada lagi solusi 9 px untuk memaksa layout panel user muat.
- Disabled pagination memakai elemen non-link dengan `aria-disabled`.
- Nilai rekening yang ditampilkan dimasking; field edit tetap eksplisit.
- Animasi harus menghormati `prefers-reduced-motion` sesuai `DESIGN.md`.
- Body/helper copy harus mengikuti ukuran minimum `DESIGN.md`; pengecilan font bukan solusi untuk membuat card muat.

## Risiko visual yang masih perlu smoke test nyata

Audit source menurunkan risiko, tetapi tidak dapat membuktikan pixel output seluruh kombinasi data. Sebelum release, lakukan smoke test dengan data production-like pada:

- 320, 360, 390, 640, 760, 768, 1023, 1024, dan 1280 px;
- nama/email/alamat/nomor order sangat panjang;
- nol, satu, lima alamat; rekening bank dan e-wallet;
- 0, 1, 10, dan lebih dari 10 order;
- semua status payment/fulfillment/return yang aktif;
- zoom browser 200%, keyboard-only, dan reduced motion;
- error Turnstile/provider, 409 completeness/stock/price changed, dan 429 rate limit.

Khusus category assignment admin, uji katalog besar karena layar sengaja belum dipaginasi. Upload lokal juga perlu diuji pada volume deployment yang persisten.
