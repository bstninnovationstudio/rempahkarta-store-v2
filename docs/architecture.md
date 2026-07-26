# Arsitektur REMPAHKARTA v1.3.0

Dokumen ini menjelaskan arsitektur yang aktif. Peta route per file berada di `docs/system-map.md`; kontrol dan risiko keamanan berada di `docs/security-api-audit.md`.

## Boundary runtime

Satu aplikasi Next.js menangani page server/client, route handler, webhook, cache katalog, dan akses Prisma. MySQL adalah sumber kebenaran data. Tidak ada Redis, queue, worker, object storage, atau service session terpisah.

```text
Browser storefront / akun / admin
                │
                ▼
       Next.js pages + API
         ├── Prisma ── MySQL
         ├── Google JWK / Identity
         ├── Cloudflare Siteverify
         ├── BSTN Payment API
         ├── Biteship API
         ├── public/uploads/products
         └── storage/private/{returns,refunds}
```

Konsekuensi operasional:

- rate limiter berlaku per proses/instance; konsistensi Next Data Cache antar-instance bergantung pada platform karena aplikasi tidak mengonfigurasi shared cache eksternal;
- media produk publik dan bukti privat harus berada pada volume persisten;
- tidak ada background retry otomatis; provider direkonsiliasi lewat webhook atau aksi sync eksplisit;
- transaksi bisnis tetap bergantung pada constraint, transaksi, optimistic lock, dan idempotency di MySQL.

## Boundary autentikasi

### Pelanggan

1. Browser memperoleh Google ID credential.
2. `POST /api/auth/google` memverifikasi RS256 menggunakan remote JWK Google, issuer, audience, expiry, dan `email_verified`.
3. User di-upsert dan `currentSessionId` diganti dengan UUID baru.
4. Aplikasi menerbitkan JWT HS256 7 hari dengan issuer `rempahkarta-store`, audience `rempahkarta-customer`, subject user ID, `jti`, `tokenUse=customer`, dan `sessionId`.
5. Cookie `amk_user` adalah HttpOnly, SameSite Lax, path `/`, dan Secure pada production.
6. Setiap request terlindungi memverifikasi JWT, mengambil user dari MySQL, lalu mencocokkan `currentSessionId`.

Login baru mengakhiri validitas session pelanggan sebelumnya. Logout menghapus cookie dan, bila session masih valid, mengosongkan `currentSessionId` dengan update bersyarat.

Pesanan baru selalu menyimpan `userId`. Pesanan historis yang belum memiliki `userId` hanya dapat dibaca oleh user terautentikasi dengan email terverifikasi yang sama. Nomor order dan field token legacy tidak menjadi kredensial akses.

### Admin

Admin login memverifikasi email dan hash scrypt bersalt (`N=16384`, `r=8`, `p=1`) dengan perbandingan timing-safe, dilindungi Turnstile dan limit 5 request/15 menit. Production mewajibkan `ADMIN_PASSWORD_SCRYPT`; SHA-256 legacy hanya diterima di development. JWT HS256 admin memiliki issuer yang sama, audience `rempahkarta-admin`, subject email, `jti`, `tokenUse=admin`, role `owner`, dan masa hidup 12 jam dalam cookie `amk_admin`.

`app/admin/layout.tsx` memanggil `requireAdmin`; semua route mutasi/read admin juga memanggil `adminFromRequest`. Fixture/bypass devtools aktif secara otomatis bila `APP_MODE=development`; dilarang pada preview/staging publik. Payment mock juga hanya boleh hidup pada development lokal.

Di depan route handler, `proxy.ts` menolak mutasi API non-webhook bila `Origin` tidak sama persis dengan origin `APP_URL`. Pemeriksaan production bersifat fail-closed dan mencegah origin sibling-subdomain memanfaatkan cookie SameSite. Webhook dikecualikan dari Origin check karena memiliki autentikasi provider dan tidak berasal dari browser.

## Boundary onboarding dan checkout

Kelengkapan akun dihitung oleh `lib/user-profile.ts` dari data aktual, bukan flag yang dapat basi:

- nama minimal dua karakter;
- email terisi;
- telepon minimal delapan karakter;
- minimal satu `UserAddress`;
- satu `UserRefundSetting` bank atau e-wallet dengan nama pemilik dan nomor yang valid.

Setelah login, respons auth mengembalikan status completeness. UI mengarahkan user yang belum lengkap ke `/user/settings?onboarding=1`. `app/checkout/page.tsx` melakukan gate server-side, dan `POST /api/checkout/orders` mengulang gate yang sama sebagai kontrol otoritatif. Route akun lain memakai completion gate agar user menyelesaikan data pada satu layar terpadu.

```text
Google login
  ├── belum lengkap ──> /user/settings ──> kontak + alamat + rekening
  │                                      └── lengkap ──> tujuan awal
  └── lengkap ─────────────────────────────────────────> tujuan awal

Checkout
  └── session + profil lengkap
       └── cari area ──> cek tarif ──> validasi ulang DB/rate ──> reserve ──> payment
```

Flow checkout server:

1. Verifikasi session, profile completeness, payload Zod, Turnstile, dan rate limit.
2. Baca varian aktif, harga, berat, dimensi, dan inventory dari MySQL.
3. Minta ulang tarif Biteship. Harga berubah menghasilkan `SHIPPING_PRICE_CHANGED` dan tidak membuat order.
4. Dalam transaksi MySQL, reserve inventory dengan optimistic lock `version`, buat snapshot item/alamat/quote, order, dan audit.
5. Buat payment BSTN atau mock development. Kegagalan membuat payment membatalkan order dan melepas reservasi secara idempoten.

Data harga, stok, berat, dimensi, dan ongkir dari client tidak dipercaya.

## Boundary query

Page server tidak memanggil API aplikasi sendiri. Page membaca melalui modul server seperti `lib/catalog.ts`, `lib/admin-data.ts`, atau query Prisma terlokalisasi. Route handler menyediakan kontrak JSON untuk interaksi client dan integrasi.

Aturan query list:

- list memakai `count` + `findMany(skip/take)` dan urutan deterministik;
- relasi list hanya mengambil field/row yang diperlukan, misalnya satu item atau shipment terbaru;
- statistik memakai query `count`, `aggregate`, atau `groupBy` terpisah dari detail list;
- detail memakai lookup unik dan hanya memuat histori yang memang diperlukan;
- dashboard pelanggan mengambil tiga order terbaru, dashboard admin empat;
- produk publik dipaginasi setelah membaca snapshot katalog cache;
- input `page` dibatasi sampai 100.000 untuk menghindari offset angka tidak aman.

| Area | Default | Maksimum | Catatan |
| --- | ---: | ---: | --- |
| API produk publik | 12 | 48 | Filter kategori diterapkan pada snapshot cache. |
| API order pelanggan | 10 | 50 | Ownership user/email legacy. |
| UI order pelanggan | 10 | 10 | Prev/next server-rendered. |
| API list admin | 20 | 100 | Order, user, shipment, retur/refund. |
| UI list admin | 20 | 50 | Order, produk, inventory, shipment, retur, user, audit. |
| Order pada detail user admin | 10 | 10 | Query terpisah dari profil. |

Editor `/admin/categories/[id]` tetap memuat seluruh produk. Komponen sekarang mengirim replacement penuh `selectedProductIds`; pagination tanpa endpoint delta dapat menghapus assignment produk yang tidak sedang terlihat.

## Katalog dan cache

`lib/catalog.ts` mengubah row Prisma menjadi tipe storefront lalu membungkus loader production dengan `unstable_cache`:

- TTL: 30 menit;
- key: `storefront-catalog-v1`;
- tag: `storefront-catalog`;
- mode demo: menggunakan fixture dan tidak memakai cache/database.

Tag diinvalidasi setelah perubahan produk, kategori, penyesuaian inventory, serta lifecycle stok yang memengaruhi ketersediaan. Invalidation membuat request storefront berikutnya membaca data terbaru. Walaupun snapshot belum diperbarui, checkout selalu membaca inventory dan harga langsung dari MySQL dan dapat menolak stok/harga yang sudah berubah.

Katalog storefront mengurutkan produk aktif menurut `Product.position` lalu ID. Kategori yang memiliki produk aktif diurutkan menurut `ProductCategory.position`; pemindahan satu posisi dari panel admin disimpan dalam transaksi, menghasilkan audit log, lalu menginvalidasi tag katalog.

Cache tidak menyimpan cart, user, order, payment, shipment, atau data PII.

## Inventory dan concurrency

`ProductVariant` adalah unit jual. `InventoryLevel` menyimpan `onHand`, `reserved`, dan `version` per gudang. Kolom legacy `safetyStock` tetap ada untuk kompatibilitas database, tetapi tidak lagi dipakai kalkulasi aplikasi.

```text
available = max(0, onHand - reserved)
```

- Checkout: `reserved += quantity` dengan kondisi versi dan ketersediaan atomik.
- Payment gagal/cancel sebelum packed: `reserved -= quantity`.
- Packed: `reserved -= quantity`, `onHand -= quantity`.
- Cancel setelah packed tetapi sebelum handover: `onHand += quantity`.
- Retur layak jual: `onHand += quantity`.

Setiap commit/release/restock membuat `InventoryMovement` dengan `dedupeKey`; operasi ulang tidak menggandakan perubahan stok.

## Payment dan fulfillment

```text
awaiting_payment
  → awaiting_processing
  → processing
  → packed
  → shipment_booked
  → handover_pending
  → handed_over
  → completed
```

- Redirect browser hanya navigasi.
- Webhook BSTN yang signature-valid menjadi sinyal, lalu server membaca detail BSTN kembali sebelum status final.
- ID payment, reference, amount, dan delivery ID divalidasi/dideduplikasi.
- Status terminal gagal melepas reservasi tepat sekali.
- Pembayaran yang menjadi paid setelah order cancelled mengubah payment state menjadi `refund_pending`.
- Sync pelanggan/admin memakai kredensial masing-masing dan GET provider server-to-server; kedua aksi dilindungi rate limit dan Turnstile.

## Biteship

- Location search hanya setelah tombol user, bukan per keystroke.
- Quote hanya diminta setelah Area ID dipilih dan dibatasi `ENABLED_COURIERS`.
- Item quote dan booking berasal dari snapshot server yang sama.
- `reference_id` shipment deterministik; duplicate reference dapat mengambil order provider yang sudah ada.
- Status provider dipetakan ke fulfillment lokal melalui `lib/shipping-state.ts`.
- `order.price` memperbarui biaya aktual/selisih, tidak mengubah invoice pelanggan.
- `order.waybill_id` memperbarui resi aktif dan audit.
- Cancel/reject sebelum handover memulihkan inventory secara idempoten; kegagalan provider tidak membatalkan order lokal.
- Route resi admin membentuk label thermal melalui CSS paged media berukuran 100 × 150 mm. Konten yang melampaui satu label mengalir ke halaman berikutnya; blok label penting dijaga agar tidak terpotong di tengah halaman.

## Retur, refund, dan audit

Pelanggan hanya dapat mengunggah bukti atau mengajukan retur untuk order miliknya. API menghitung nilai item dari snapshot order, membatasi masa pengajuan, dan menolak duplikasi kasus aktif.

Admin menilai retur, menjalankan resolusi operasional yang sudah ada, dan mencatat refund manual dengan bukti/referensi. Mutasi penting menulis `AuditLog`; delivery webhook ditulis ke `WebhookInbox` sebelum side effect untuk idempotency.

## Ledger keuangan

`RevenueLedger` adalah sumber saldo omzet internal. Setiap row menyimpan delta saldo tersedia/tertahan serta snapshot subtotal produk, diskon, ongkir, kode unik BSTN, total QRIS, service fee, fee BSTN, dan posisi bersih. Rumus kanonisnya adalah `(Order.subtotal - Order.discountAmount) + Order.shippingFee + biaya admin toko + Payment.uniqueCode - refund completed` (setara `Total QRIS - fee QRIS - refund completed`). Biaya admin toko termasuk omzet toko, sedangkan fee QRIS BSTN bukan omzet.

BSTN menentukan kode unik setelah payment dibuat. Nilai itu disalin ke `Payment.uniqueCode` dari `qris.unique_code`/`qris_unique_code`; `payableAmount - grandTotal` hanya menjadi fallback deterministik untuk respons atau data lama. Karena `Payment.feeAmount` BSTN mencakup fee QRIS dan kode unik, snapshot fee QRIS ledger memakai `max(0, feeAmount - uniqueCode)`. `Order.grandTotal` tetap merupakan total sebelum kode unik, sedangkan `Payment.payableAmount` adalah total QRIS aktual yang dipakai pada payment, invoice, detail/list pesanan, serta statistik belanja.

Pada pembatalan admin, alasan AWB hanya dikirim bila `Shipment.providerOrderId` sudah ada dan pembatalan provider Biteship benar-benar diperlukan. Pembatalan sebelum booking shipment diproses lokal tanpa alasan AWB; daftar alasan provider tidak dimuat untuk kasus tersebut.

Saat pembayaran menjadi paid, `syncOrderRevenue` menempatkan settlement bersih di posisi tertahan. Posisi menjadi tersedia hanya pada fulfillment `completed`/`finished` tanpa issue, retur aktif, atau cancellation aktif. Perubahan state berikutnya dapat memindahkan dana kembali ke tertahan atau mengurangi posisi karena refund. Helper berjalan di transaksi perubahan state, mengunci order, membaca aggregate ledger sebelumnya, dan hanya menulis selisih. Dengan demikian retry webhook/sync tidak menggandakan saldo dan metric page tidak perlu query order. Perubahan formula tidak mengubah pembayaran, booking Biteship, maupun saldo bayangan Biteship.

`BiteshipFundAccount` adalah singleton saldo bayangan atomik; `BiteshipLedger` menyimpan riwayat signed amount. Area search, quote, authoritative re-rate checkout, booking shipment, dan tracking sync mereservasi dana dalam transaksi `Serializable`. Provider failure membuat reversal idempoten. Debit booking dideduplikasi berdasarkan nomor order agar pemulihan duplicate-reference tidak memotong ongkir dua kali. Catatan penggunaan otomatis immutable; CRUD hanya berlaku pada top up/pengurangan manual dan setiap perubahan merekonsiliasi saldo di bawah row lock.

Shadow balance bukan sinkronisasi saldo nyata Biteship. Saldo awal migration nol dan harus diisi admin. Cost area/rate/tracking dikonfigurasi lokal; booking shipment selalu memakai harga quote terpilih. Flow request/payload/status Biteship tidak diubah.

## Rate limiting dan Turnstile

`proxy.ts` menerapkan bucket global per IP untuk seluruh `/api/*`: 100/menit, atau 1.000/menit untuk webhook. Route mahal menambahkan bucket scope sendiri. Store in-memory dibersihkan setiap menit, membuang bucket kedaluwarsa, dan dibatasi 10.000 bucket.

Ini sengaja sederhana dan tidak terdistribusi. Pada multi-instance, limit efektif berlaku per instance; reverse proxy/CDN harus menambah batas global bila dibutuhkan.

Turnstile selalu diverifikasi lewat Siteverify server. Secret test hanya tersedia di non-production; action harus exact dan production juga mencocokkan hostname terhadap `APP_URL`. JWT secret production menolak marker placeholder dan shared secret webhook harus kuat minimal 16 karakter. Aksi yang dilindungi dan limit per route dipetakan di `docs/system-map.md`.

## Migration dan penyimpanan

Migration `0_baseline` merepresentasikan DDL schema lengkap dan `migration_lock.toml` mengunci provider MySQL. Database lama yang sudah memiliki tabel harus dibaseline satu kali dengan `npm run db:baseline:existing` **setelah** tabel/kolom/constraint/relasi diverifikasi; database kosong tidak boleh melewati baseline. Migration incremental menambahkan index query, voucher, serta ledger keuangan secara additive dan tidak menjalankan seed. Migration keuangan awal melakukan backfill posisi dana order lama dan membuat akun shadow Biteship bersaldo nol; migration `202607220002_reconcile_revenue_total_settlement` merekonsiliasi formula settlement lama, `202607220003_standardize_unique_code_revenue` menambah snapshot kode unik/subtotal dan menulis delta audit agar saldo historis mengikuti formula omzet kanonis, lalu `202607220004_correct_qris_fee_snapshot` memisahkan kode unik dari snapshot fee QRIS tanpa mengubah saldo.

`npm run setup` menjalankan generate + migrate deploy. `setup:demo`, seed, dan `db push` hanya untuk database lokal/disposable.

Data lama yang masih menunjuk bukti di public uploads dimigrasikan terpisah dengan `npm run migrate:private-media` (dry-run), lalu `npm run migrate:private-media -- --apply` setelah backup dan review. Proses ini copy-verify ke private storage, update path DB, lalu memindahkan original public ke backup recoverable. Karena filesystem dan MySQL tidak dapat berada dalam satu transaksi atomik, dry-run, backup, warning review, dan verifikasi pasca-apply wajib dilakukan.

Backup konsisten mencakup:

- dump MySQL;
- `public/uploads` dan `storage/private`;
- `storage/private-migration-backup` selama masa verifikasi migrasi legacy;
- konfigurasi/secret melalui secret manager terpisah, bukan dalam arsip aplikasi.

## Voucher dan total pembayaran

`Voucher` menyimpan aturan promo dan `VoucherUsage` menyimpan tepat satu pemakaian per order. `Order` menyimpan referensi nullable beserta snapshot kode, target, dan nominal diskon agar riwayat tidak berubah bila konfigurasi voucher diedit. Checkout menghitung ulang subtotal dari varian database dan ongkir hasil re-rate Biteship, lalu mengevaluasi voucher di transaksi MySQL `Serializable`; limit total dinaikkan secara atomik sebelum order dan usage dibuat.

Target diskon adalah total (`subtotal + ongkir`), subtotal produk, atau ongkir. Nominal/persentase dibatasi `maxDiscount` dan tidak dapat melebihi nominal target. Diskon diterapkan sebelum biaya layanan; karena BSTN menolak harga negatif, diskon dipetakan ke harga item positif (unit dapat dipecah) sehingga jumlah item tetap sama dengan `bstnAmount`. Voucher tidak mengubah request ataupun booking Biteship.

Masa berlaku disimpan UTC dan dimasukkan/dipresentasikan WIB. Evaluasi lazy pada cek/checkout serta `GET` atau `POST /api/cron/vouchers` bertoken `CRON_SECRET` menandai voucher expired atau kuota total habis sebagai `FINISH`. Limit harian dihitung 00:00–24:00 WIB dan limit per-user tidak mengakhiri voucher global.

## Batas arsitektur saat ini

- rate limit tidak shared; konsistensi/invalidation katalog lintas instance bergantung pada adapter/platform Next Data Cache;
- media lokal bukan object storage dan membutuhkan sticky/persistent filesystem; bukti privat tidak boleh dipindah ke public web root;
- category assignment masih replacement penuh dan belum aman dipaginasi;
- tidak ada background retry provider;
- build/lint/unit test tidak menggantikan E2E dengan MySQL dan provider nyata.
