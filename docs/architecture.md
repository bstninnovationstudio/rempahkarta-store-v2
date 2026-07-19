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

`app/admin/layout.tsx` memanggil `requireAdmin`; semua route mutasi/read admin juga memanggil `adminFromRequest`. Fixture/bypass demo hanya aktif bila non-production **dan** `DEMO_MODE=true` **dan** `ALLOW_INSECURE_DEMO=true`; default false dan dilarang pada preview/staging publik. Payment mock juga hanya boleh hidup pada development lokal.

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

Cache tidak menyimpan cart, user, order, payment, shipment, atau data PII.

## Inventory dan concurrency

`ProductVariant` adalah unit jual. `InventoryLevel` menyimpan `onHand`, `reserved`, `safetyStock`, dan `version` per gudang.

```text
available = max(0, onHand - reserved - safetyStock)
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

## Retur, refund, dan audit

Pelanggan hanya dapat mengunggah bukti atau mengajukan retur untuk order miliknya. API menghitung nilai item dari snapshot order, membatasi masa pengajuan, dan menolak duplikasi kasus aktif.

Admin menilai retur, menjalankan resolusi operasional yang sudah ada, dan mencatat refund manual dengan bukti/referensi. Mutasi penting menulis `AuditLog`; delivery webhook ditulis ke `WebhookInbox` sebelum side effect untuk idempotency.

## Rate limiting dan Turnstile

`proxy.ts` menerapkan bucket global per IP untuk seluruh `/api/*`: 100/menit, atau 1.000/menit untuk webhook. Route mahal menambahkan bucket scope sendiri. Store in-memory dibersihkan setiap menit, membuang bucket kedaluwarsa, dan dibatasi 10.000 bucket.

Ini sengaja sederhana dan tidak terdistribusi. Pada multi-instance, limit efektif berlaku per instance; reverse proxy/CDN harus menambah batas global bila dibutuhkan.

Turnstile selalu diverifikasi lewat Siteverify server. Secret test hanya tersedia di non-production; action harus exact dan production juga mencocokkan hostname terhadap `APP_URL`. JWT secret production menolak marker placeholder dan shared secret webhook harus kuat minimal 16 karakter. Aksi yang dilindungi dan limit per route dipetakan di `docs/system-map.md`.

## Migration dan penyimpanan

Migration `0_baseline` merepresentasikan DDL schema lengkap dan `migration_lock.toml` mengunci provider MySQL. Database lama yang sudah memiliki tabel harus dibaseline satu kali dengan `npm run db:baseline:existing` **setelah** tabel/kolom/constraint/relasi diverifikasi; database kosong tidak boleh melewati baseline. Migration berikutnya menambahkan enam index query secara additive/idempoten dan tidak menjalankan seed.

`npm run setup` menjalankan generate + migrate deploy. `setup:demo`, seed, dan `db push` hanya untuk database lokal/disposable.

Data lama yang masih menunjuk bukti di public uploads dimigrasikan terpisah dengan `npm run migrate:private-media` (dry-run), lalu `npm run migrate:private-media -- --apply` setelah backup dan review. Proses ini copy-verify ke private storage, update path DB, lalu memindahkan original public ke backup recoverable. Karena filesystem dan MySQL tidak dapat berada dalam satu transaksi atomik, dry-run, backup, warning review, dan verifikasi pasca-apply wajib dilakukan.

Backup konsisten mencakup:

- dump MySQL;
- `public/uploads` dan `storage/private`;
- `storage/private-migration-backup` selama masa verifikasi migrasi legacy;
- konfigurasi/secret melalui secret manager terpisah, bukan dalam arsip aplikasi.

## Batas arsitektur saat ini

- rate limit tidak shared; konsistensi/invalidation katalog lintas instance bergantung pada adapter/platform Next Data Cache;
- media lokal bukan object storage dan membutuhkan sticky/persistent filesystem; bukti privat tidak boleh dipindah ke public web root;
- category assignment masih replacement penuh dan belum aman dipaginasi;
- tidak ada background retry provider;
- build/lint/unit test tidak menggantikan E2E dengan MySQL dan provider nyata.
