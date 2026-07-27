# Peta sistem REMPAHKARTA v1.3.0

Snapshot source: 21 Juli 2026 (Asia/Jakarta)

Peta ini dihasilkan dari file `app/**/page.tsx` dan `app/api/**/route.ts`. Jumlah pada snapshot ini adalah **38 page route** dan **63 API route file**. Route dinamis ditulis dengan parameter dalam kurung siku.

## Legenda

- **Publik**: tidak membutuhkan session aplikasi.
- **Customer**: JWT cookie `amk_user`, user aktif, dan `currentSessionId` cocok.
- **Owner**: customer ditambah ownership order melalui `userId`; email terverifikasi hanya menjadi fallback order legacy.
- **Admin**: JWT cookie `amk_admin` dengan audience/role/token-use admin.
- **Provider**: autentikasi webhook BSTN/Biteship.
- Semua API non-webhook menerima limit global 100 request/menit per identitas IP. Webhook memakai bucket terpisah 1.000/menit. Kolom kontrol hanya menuliskan limit tambahan dan Turnstile.

## Struktur repository

| Path | Status/peran |
| --- | --- |
| `app/` | App Router: page, layout, route handler, global CSS, dan client page khusus. |
| `components/` | Komponen storefront, account, checkout/order, admin shell/table/action, dan shipping label. |
| `lib/` | Domain/server module: auth, query, cache, inventory, provider adapter, validation, media, security. |
| `prisma/` | Schema 30 model, baseline DDL + migration index/voucher/finance additive, migration lock MySQL, dan seed demo eksplisit. |
| `tests/` | Unit/domain test untuk security, product, inventory/state, voucher/BSTN item, finance, dan adapter Biteship. |
| `public/` | Logo/aset storefront/demo, manifest/service worker, dan media produk publik saat runtime. |
| `storage/private/` | Lokasi runtime bukti retur/refund; tidak disajikan statis dan harus dipersist/backup terpisah. |
| `docs/` | Arsitektur, map, audit, test report, dan snapshot referensi BSTN. |
| `Printable-Thermal-Shipping-Label-A6/` | Referensi komponen; bukan sumber yang dirender route production. |
| `proxy.ts` | Exact Origin check mutasi non-webhook dan rate limit global `/api/*`; menggantikan konvensi middleware lama pada Next.js yang dipakai proyek. |
| `next.config.ts`, `eslint.config.mjs`, `tsconfig.json` | Header/security/image config, lint, dan type/build config. |
| `package.json`, `package-lock.json`, `.env.example` | Script/runtime dependency terkunci dan contract environment tanpa secret nyata. |
| `scripts/` | Generator scrypt admin dan migrasi dry-run/apply media private legacy. |

## Page route: storefront, akun, dan pesanan (16)

| # | Route | Akses | Data/komponen utama | Query dan perilaku |
| ---: | --- | --- | --- | --- |
| 1 | `/` | Publik | `StoreHeader`, hero, `ProductCatalog`, editorial, `StoreFooter` | Snapshot katalog server cache 30 menit; filter UI tidak memuat transaksi/user. |
| 2 | `/products/[slug]` | Publik | `ProductDetailView`, galeri, opsi varian, stok, CTA | Lookup slug pada snapshot katalog; 404 bila tidak ada. |
| 3 | `/cart` | Publik; sync bila login | `CartPageClient`, summary, kuantitas | Snapshot katalog untuk validasi presentasi; cart client/local disinkronkan ke API customer ketika session tersedia. |
| 4 | `/checkout` | Customer + profil lengkap | `CheckoutForm`, kontak/alamat tersimpan, lokasi, tarif, summary | Gate session dan completeness server-side; katalog cache hanya untuk tampilan, create order tetap DB-authoritative. |
| 5 | `/login` | Publik | Google Identity, mode mock development | Redirect lokal divalidasi; login tidak lengkap diarahkan ke onboarding settings. |
| 6 | `/pages/shipping` | Publik | Kebijakan pengiriman | Konten statis. |
| 7 | `/pages/returns` | Publik | Kebijakan retur/refund | Konten statis. |
| 8 | `/orders/[number]` | Owner | Status, timeline, item, alamat, shipment, cancel/return/refund | Lookup nomor unik lalu ownership; tidak menerima token URL sebagai kredensial. |
| 9 | `/orders/[number]/payment` | Owner | QRIS/status, `PaymentPageClient` | Payment terbaru untuk order milik customer; sync manual melalui API terlindungi. |
| 10 | `/orders/[number]/return` | Owner | Wizard `ReturnForm`, item, bukti, alasan | Memastikan order eligible dan milik user; upload/submission melalui API owner. |
| 12 | `/user` | Customer | Metrik, completeness, tiga pesanan terbaru | `count`/`aggregate` terpisah dan `take: 3`; layout account terpadu. |
| 13 | `/user/orders` | Customer | Riwayat pesanan, payment/fulfillment pill | Pagination server 10 row/page; order customer + fallback email legacy. |
| 14 | `/user/settings` | Customer | Kontak + OTP, consent WhatsApp, alamat, rekening refund, progress onboarding | Satu layar universal; nomor/rekening memakai OTP dan consent perjalanan/promosi independen. |
| 15 | `/user/addresses` | Customer | Route kompatibilitas | Redirect ke `/user/settings#addresses`, mempertahankan query aksi/redirect aman. |
| 16 | `/user/payment` | Customer | Route kompatibilitas | Redirect ke `/user/settings#payment`. |

## Page route: admin (21)

| # | Route | Akses | Data/komponen utama | Query dan perilaku |
| ---: | --- | --- | --- | --- |
| 17 | `/admin-login` | Publik | Form login admin + Turnstile | Tidak berada dalam layout admin terlindungi. |
| 18 | `/admin` | Admin | Statistik, empat order terbaru, antrean tindakan | Stats query terpisah; relasi order terbaru dibatasi satu item/shipment. |
| 19 | `/admin/orders` | Admin | Filter status/issue, tabel order | Pagination 20 default/50 maksimum pada UI; stats filter terpisah. |
| 20 | `/admin/orders/[number]` | Admin | Detail item, timeline, payment, shipment, cancellation, action rail | Lookup unik; payment/quote/shipment terbaru dibatasi; histori relevan tetap dimuat. |
| 21 | `/admin/orders/[number]/resi` | Admin | Label thermal 100 × 150 mm/barcode | Lookup order unik untuk cetak resi; CSS paged media memindahkan konten panjang ke label berikutnya. |
| 22 | `/admin/products` | Admin | Daftar produk aktif/draf dan arsip, pengurutan tersimpan | Dua tabel terpisah; tombol naik/turun langsung menyimpan posisi. |
| 23 | `/admin/products/new` | Admin | `ProductForm` create | Opsi kategori; mutation melalui API admin. |
| 24 | `/admin/products/[id]` | Admin | `ProductForm` edit | Lookup produk unik beserta varian/media/inventory. |
| 25 | `/admin/categories` | Admin | `CategoryManager`, pengurutan tersimpan | List kategori dan `_count.products`; tombol naik/turun langsung menyimpan posisi. |
| 26 | `/admin/categories/[id]` | Admin | `CategoryEditor`, assignment produk | Sengaja memuat semua produk karena submit mengganti seluruh `selectedProductIds`. |
| 27 | `/admin/inventory` | Admin | Stats stok, tabel SKU, adjustment | Pagination 20/50; ketersediaan = stok fisik dikurangi reservasi. |
| 29 | `/admin/returns` | Admin | Stats dan daftar retur/refund | Pagination 20/50; groupBy state terpisah. |
| 30 | `/admin/returns/[id]` | Admin | Detail kasus, bukti, rekening, keputusan/refund | Lookup unik dan relasi kasus/order yang diperlukan. |
| 31 | `/admin/users` | Admin | Daftar customer dan total belanja | Pagination 20/50; `_count` + `groupBy` hanya untuk user pada page aktif. |
| 32 | `/admin/users/[id]` | Admin | Profil, alamat, rekening, riwayat order | Profil unik; order dipaginasi 10/page dan total dihitung terpisah. |
| 33 | `/admin/settings` | Admin | Readiness konfigurasi server | Membaca keberadaan konfigurasi; tidak memuat credential mentah. |
| 34 | `/admin/audit` | Admin | Filter dan `AuditLog` | Pagination 20/50; select field minimum dan urutan deterministik. |
| 35 | `/admin/vouchers` | Admin | `VoucherManager`, daftar, duplikasi, riwayat pemakaian | Pagination; editor tidak lagi memakai popup. |
| 36 | `/admin/vouchers/new` | Admin | `VoucherForm` create | Form terstruktur untuk identitas, aturan, kuota, dan jadwal WIB. |
| 37 | `/admin/vouchers/[id]` | Admin | `VoucherForm` edit/kelola | Lookup voucher unik + jumlah penggunaan. |
| 38 | `/admin/finance/omzet` | Admin | Metric omzet, rincian produk/diskon/ongkir/admin toko/kode unik, penarikan, `RevenueLedger` | Saldo = produk setelah diskon + ongkir + admin toko + kode unik − refund; fee QRIS bukan omzet, seluruh metric dari aggregate ledger, transaksi 20/page. |
| 39 | `/admin/finance/biteship` | Admin | Shadow balance, biaya request, CRUD manual, `BiteshipLedger` | Akun singleton + ledger terpaginasi 20/page; record otomatis immutable. |
| 40 | `/admin/promotions` | Admin | `AdminPromotionManager`, composer teks/media, progress dan log campaign | Maksimum 20 campaign terbaru; penerima hanya user aktif dengan nomor terverifikasi dan consent promosi. |

`app/admin/layout.tsx` adalah security/layout boundary untuk route 18–38: `requireAdmin()`, shell desktop, drawer tablet/mobile, dan navigasi admin. `app/user/layout.tsx` adalah boundary session/layout route akun, menampilkan progress completeness dan navigasi account.

## API route: autentikasi, katalog, checkout, dan customer order (16)

| # | Route | Metode | Akses | Pagination/batas | Kontrol tambahan | Tujuan |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `/api/auth/google` | `POST` | Publik | — | 10/menit | Verifikasi Google ID token, upsert user, rotasi session, terbitkan JWT, kembalikan completeness. Mock hanya lokal dengan dua flag demo. |
| 2 | `/api/auth/logout` | `POST` | Publik; idempoten | — | — | Kosongkan `currentSessionId` bila cookie session valid, lalu selalu hapus cookie customer. |
| 3 | `/api/auth/me` | `GET` | Customer | — | — | Identitas session dan status profile completeness. |
| 4 | `/api/products` | `GET` | Publik | 12 default, 48 maksimum | — | List snapshot cache katalog dengan filter kategori dan metadata page. |
| 5 | `/api/products/[slug]` | `GET` | Publik | — | — | Detail satu produk dari cache katalog. |
| 6 | `/api/locations/search` | `GET` | Customer | Hasil provider dibatasi | 25/menit; Turnstile `location_search`; saldo shadow | Cari Area ID Biteship setelah aksi user dan catat biaya request. |
| 7 | `/api/checkout/quotes` | `POST` | Customer | Hasil provider dibatasi | 25/menit; Turnstile `shipping_quotes`; saldo shadow | Hitung tarif kurir aktif dari item server dan catat biaya request. |
| 8 | `/api/checkout/orders` | `POST` | Customer + profil lengkap | Maks. 20 item | 10/menit; Turnstile `checkout_order`; saldo shadow | Re-rate berbiaya, reserve stok, buat order/payment, rollback reservation bila payment gagal. |
| 9 | `/api/orders/[number]/payment/status` | `GET` | Owner | Satu payment terbaru | — | Status payment terbaru tanpa mengubah data. |
| 10 | `/api/orders/[number]/payment/sync` | `POST` | Owner | — | 15/menit; Turnstile `payment_sync` | Rekonsiliasi status BSTN server-to-server. |
| 11 | `/api/orders/[number]/cancel` | `POST` | Owner | — | 10/menit | Cancel pending payment atau buat cancellation request sesuai state. |
| 12 | `/api/orders/[number]/media` | `POST` | Owner + order eligible | 5 MB/file, 10 file tersimpan | 10/menit | Simpan bukti return di private storage dan kembalikan URL API owner/admin. |
| 13 | `/api/orders/[number]/media/[file]` | `GET` | Owner atau Admin | Satu file | `private, no-store` | Sajikan bukti return privat; akses asing mendapat 404. |
| 14 | `/api/orders/[number]/returns` | `POST` | Owner | 1–5 bukti, maks. 20 item | 5/menit | Validasi bukti privat, masa/eligibility/item, serialisasi klaim, dan hitung refund. |
| 16 | `/api/returns/[id]/media/[file]` | `GET` | Owner order atau Admin | Satu file | `private, no-store` | Sajikan bukti refund privat; akses asing mendapat 404. |

## API route: customer account (7)

| # | Route | Metode | Akses | Pagination/batas | Kontrol tambahan | Tujuan |
| ---: | --- | --- | --- | --- | --- | --- |
| 17 | `/api/user/dashboard/stats` | `GET` | Customer | Aggregate saja | — | Total order, payment pending, total belanja, dan completeness. |
| 18 | `/api/user/orders` | `GET` | Customer | 10 default, 50 maksimum | — | List order milik user/email legacy dengan satu item ringkas. |
| 19 | `/api/user/profile` | `GET`, `PUT` | Customer | — | `PUT`: 20/menit + Turnstile `user_profile` | Baca kontak atau simpan nama/telepon; email Google tetap read-only. |
| — | `/api/user/otp` | `POST` | Customer aktif | OTP 5 menit, 1 resend, 5 percobaan | 6/user + 10/IP/15 menit; 3 sesi baru/jam; Turnstile `user_otp_send` | Buat/resend challenge nomor atau refund; kode tidak pernah dikembalikan/disimpan plaintext. |
| — | `/api/user/notifications` | `PATCH` | Customer aktif | Dua consent boolean | 20/menit; Turnstile `user_notifications` | Ubah consent shipment/promosi beserta timestamp dan audit. |
| 20 | `/api/user/addresses` | `GET`, `POST` | Customer | GET maksimum 5 alamat | `POST`: 20/menit + Turnstile `user_address` | List/tambah alamat; transaksi berserial menjaga maksimal lima alamat per customer. |
| 21 | `/api/user/addresses/[id]` | `PUT`, `DELETE` | Customer pemilik alamat | — | 20/menit gabungan + Turnstile `user_address` | Ubah/hapus alamat setelah pemeriksaan ownership. |
| 22 | `/api/user/payment` | `GET`, `POST` | Customer + kontak terverifikasi | Satu setting | `POST`: 20/menit + Turnstile `user_payment` + OTP terikat payload | Baca/upsert rekening refund bank/e-wallet secara atomik dengan konsumsi challenge. |
| 23 | `/api/user/cart` | `GET`, `POST`, `PUT` | Customer | Maksimum 50 item | Write: 30/menit gabungan | Baca, tambah, atau sinkron penuh cart dengan validasi produk/varian. |

## API route: admin (32)

| # | Route | Metode | Akses | Pagination/batas | Kontrol tambahan | Tujuan |
| ---: | --- | --- | --- | --- | --- | --- |
| 24 | `/api/admin/login` | `POST` | Publik | — | 5/15 menit; Turnstile `admin_login` | Verifikasi email+scrypt dan terbitkan cookie JWT admin. |
| 25 | `/api/admin/logout` | `POST` | Publik; idempoten | — | — | Hapus cookie admin milik caller; tidak mengubah data server. |
| 26 | `/api/admin/dashboard/stats` | `GET` | Admin | Aggregate saja | — | Statistik order, payment, fulfillment, return, shipment, user, dan revenue. |
| 27 | `/api/admin/orders` | `GET` | Admin | 20 default, 100 maksimum | — | List order dengan filter/search, relasi ringkas, dan metadata page. |
| 28 | `/api/admin/products` | `GET`, `POST` | Admin | GET 20 default, 100 maksimum | — | List/filter/search produk atau create produk/varian/media/inventory. |
| 29 | `/api/admin/users` | `GET` | Admin | 20 default, 100 maksimum | — | List user dan count/order-spend yang dibatasi page. |
| 31 | `/api/admin/returns` | `GET` | Admin | 20 default, 100 maksimum | — | List return request dengan filter/search dan refund terbaru. |
| 32 | `/api/admin/refunds` | `GET` | Admin | 20 default, 100 maksimum | — | List refund dengan filter status/search dan nomor order/return ringkas. |
| 33 | `/api/admin/categories` | `POST` | Admin | — | — | Buat kategori, audit, invalidasi katalog. |
| 34 | `/api/admin/categories/[id]` | `PUT`, `DELETE` | Admin | Assignment penuh | — | Ubah/hapus kategori dan membership produk; audit + invalidasi cache. |
| 35 | `/api/admin/products/[id]` | `PUT` | Admin | — | — | Update produk dan menonaktifkan varian lama secara aman. |
| 36 | `/api/admin/inventory/[id]/adjust` | `POST` | Admin | — | — | Optimistic stock adjustment, movement/audit, invalidasi cache. |
| — | `/api/admin/products/[id]/position` | `POST` | Admin | — | exact Origin | Pindahkan satu posisi produk aktif/draf atau arsip, audit, dan invalidasi katalog. |
| — | `/api/admin/categories/[id]/position` | `POST` | Admin | — | exact Origin | Pindahkan satu posisi kategori, audit, dan invalidasi katalog. |
| 37 | `/api/admin/media/upload-url` | `POST` | Admin | 5 MB/file | 20/menit | Upload produk publik atau bukti refund privat untuk entity return yang valid. |
| 38 | `/api/admin/shipping/cancellation-reasons` | `GET` | Admin | Hasil provider dibatasi | — | Ambil alasan cancellation yang didukung Biteship. |
| 39 | `/api/admin/orders/[number]/transition` | `POST` | Admin | — | — | Jalankan transisi fulfillment yang sah melalui state machine. |
| 40 | `/api/admin/orders/[number]/manual-status` | `POST` | Admin + demo lokal | — | — | Simulasi status/issue; 404 tanpa dua flag demo non-production. |
| 41 | `/api/admin/orders/[number]/duplicate` | `POST` | Admin + demo lokal | — | — | Duplikasi order operasional; 404 tanpa dua flag demo non-production. |
| 42 | `/api/admin/orders/[number]/shipment` | `POST` | Admin | — | 10/menit; saldo shadow ≥ quote | Book shipment Biteship dan debit harga quote setelah reservasi atomik. |
| 43 | `/api/admin/orders/[number]/shipment/sync` | `POST` | Admin | — | Saldo shadow tracking | Rekonsiliasi shipment, waybill, harga, fulfillment, dan posisi omzet. |
| 44 | `/api/admin/orders/[number]/payment/sync` | `POST` | Admin | — | 15/menit; Turnstile `admin_payment_sync` | Rekonsiliasi payment BSTN dan audit actor admin. |
| 45 | `/api/admin/orders/[number]/cancellation` | `POST` | Admin | — | 20/menit | Setujui/tolak cancellation, koordinasi provider, inventory, refund state. |
| 46 | `/api/admin/orders/[number]/resolve` | `POST` | Admin | — | — | Selesaikan issue order melalui flow refund/return/finish yang ada. |
| 47 | `/api/admin/returns/[id]/decision` | `POST` | Admin | — | 20/menit | Setujui/tolak kasus secara serialized dan sinkronkan state order/return. |
| 48 | `/api/admin/returns/[id]/refund` | `POST` | Admin | Satu refund operation | 10/menit | Verifikasi bukti privat, lock order, cegah over-refund, catat referensi/audit/state. |
| — | `/api/admin/promotions` | `POST` | Admin | Semua user eligible, dedupe nomor | 3/jam; Turnstile `admin_promotion_send` | Buat campaign teks/JPG/PNG dan snapshot outbox penerima consent. |
| — | `/api/admin/promotions/[id]/dispatch` | `POST` | Admin | 3 penerima/batch | 120 batch/15 menit | Dispatch resumable, recheck consent, dan agregasi hasil campaign. |
| — | `/api/admin/promotions/[id]/media` | `GET` | Admin | Satu gambar | `private, no-store` | Sajikan lampiran promosi dari private storage. |

## API route: keuangan admin (5)

| Route | Metode | Akses | Kontrol tambahan | Tujuan |
| --- | --- | --- | --- | --- |
| `/api/admin/finance/omzet` | `GET` | Admin | Pagination 20 default/100 maksimum | Aggregate saldo ledger dan daftar transaksi omzet. |
| `/api/admin/finance/omzet/withdraw` | `POST` | Admin | 10/menit, exact Origin | Validasi saldo tersedia atomik, catat penarikan, dan audit. |
| `/api/admin/finance/biteship` | `GET`, `POST` | Admin | GET pagination; POST 20/menit + exact Origin | Baca shadow balance/ledger atau tambah catatan manual. |
| `/api/admin/finance/biteship/[id]` | `PUT`, `DELETE` | Admin | 20/menit + exact Origin | Edit/hapus hanya record manual sambil merekonsiliasi saldo. |
| `/api/admin/finance/biteship/settings` | `PUT` | Admin | 10/menit + exact Origin | Atur biaya area, rate, dan tracking. |

## API route: provider webhook (2)

| # | Route | Metode | Akses | Pagination | Kontrol | Tujuan |
| ---: | --- | --- | --- | --- | --- | --- |
| 49 | `/api/webhooks/biteship` | `POST` | Shared secret kuat; probe kosong/test tanpa side effect | — | Bucket webhook 1.000/menit | Deduplikasi/retry inbox, tolak stale/regressive state, proses status/price/waybill/inventory/issue. |
| 50 | `/api/webhooks/bstn` | `POST` | HMAC + shared secret kuat | — | Bucket webhook 1.000/menit | Deduplikasi/retry inbox, verifikasi reference/amount, GET provider, update payment/order/inventory. |

## API route: voucher dan cron (6)

| Route | Metode | Akses | Kontrol tambahan | Tujuan |
| --- | --- | --- | --- | --- |
| `/api/vouchers/check` | `POST` | Customer | 15/menit, exact Origin, Turnstile `voucher_check` | Evaluasi UI kode berdasarkan subtotal/ongkir saat ini; checkout tetap authoritative. |
| `/api/vouchers/public` | `GET` | Publik | Cache response singkat | Daftar voucher public yang active dan berada dalam masa berlaku. |
| `/api/cron/vouchers` | `GET`, `POST` | Scheduler | Bearer atau `X-Cron-Secret` | Menandai promo expired/limit total habis sebagai `FINISH`. |
| `/api/admin/vouchers` | `GET`, `POST` | Admin | GET pagination; POST exact Origin | List dan create voucher + audit. |
| `/api/admin/vouchers/[id]` | `GET`, `PUT` | Admin | PUT exact Origin | Detail voucher, 100 penggunaan terbaru, dan update + audit. |
| `/api/admin/vouchers/[id]/duplicate` | `POST` | Admin | exact Origin | Duplikasi konfigurasi dengan kode baru dan status awal `PAUSE`. |

## Model Prisma (30)

| Domain | Model | Peran |
| --- | --- | --- |
| Katalog | `Product`, `ProductCategory`, `ProductVariant`, `ProductImage` | Master produk/kategori dengan posisi tersimpan, satu kategori opsional, unit jual, media. |
| Inventory | `Warehouse`, `InventoryLevel`, `InventoryMovement` | Gudang, saldo/version per varian, ledger side effect idempoten. |
| Customer | `User`, `UserAddress`, `UserRefundSetting`, `CartItem`, `WhatsappOtpChallenge` | Identitas/session, nomor terverifikasi, consent, challenge OTP, alamat, rekening refund, cart. |
| Order/voucher | `Order`, `OrderItem`, `OrderAddress`, `Voucher`, `VoucherUsage` | Header state/total/owner, snapshot item/alamat/voucher, aturan dan pemakaian promo. |
| Payment | `Payment`, `PaymentEvent` | Payment lokal/provider dan histori delivery/status. |
| Shipping | `ShippingQuote`, `Shipment`, `ShipmentTrackingEvent` | Snapshot tarif terpilih, booking, status/waybill/harga/tracking. |
| Purnajual | `CancellationRequest`, `ReturnRequest`, `ReturnItem`, `Refund` | Permintaan batal, kasus retur/issue, item, refund manual. |
| Operasional | `WebhookInbox`, `AuditLog` | Idempotency inbox provider dan jejak perubahan aktor/entity. |
| WhatsApp | `WhatsappMessage`, `WhatsappPromotionCampaign` | Transactional outbox notifikasi dan log campaign promosi teks/media. |
| Keuangan | `RevenueLedger`, `BiteshipFundAccount`, `BiteshipLedger` | Posisi omzet available/held, shadow balance atomik, dan histori dana Biteship. |

Enum state kanonis mencakup state order/retur, voucher, `RevenueLedgerType`, dan `BiteshipLedgerType` pada `prisma/schema.prisma`.

## Peta modul server

| Modul | Tanggung jawab | Konsumen utama |
| --- | --- | --- |
| `lib/db.ts` | Singleton Prisma client | Seluruh page/API server. |
| `lib/demo-data.ts` | Fixture storefront/order untuk mode demo non-production | Catalog dan admin mapper development. |
| `lib/auth.ts` | Password/JWT/cookie/guard admin | Admin layout dan API admin. |
| `lib/password.ts`, `scripts/hash-admin-password.mjs` | Hash/verify scrypt bersalt dan generator credential admin | Setup serta login admin. |
| `scripts/migrate-private-media.mjs` | Rencana/copy-verify/update/move-backup bukti legacy | Operasi migration pasca-schema; bukan runtime request. |
| `lib/customer-auth.ts` | JWT/cookie/session lock/guard customer | User, checkout, order API. |
| `lib/user-profile.ts` | Hitung completeness dari relational data | Login, auth/me, dashboard, checkout. |
| `lib/catalog.ts` | Query + map katalog, cache 30 menit, tag invalidation | Homepage, product, cart, checkout, product API. |
| `lib/product-admin.ts` | Schema input/slug produk | Form dan product service. |
| `lib/product-data.ts` | Data editor kategori/produk | Page create/edit admin. |
| `lib/product-service.ts` | Transaksi create/update product/variant/media/inventory | API product admin. |
| `lib/admin-data.ts` | Query page/stats/detail admin dan map presentasi | Seluruh page admin utama. |
| `lib/pagination.ts` | Normalisasi page/pageSize dan metadata | API list publik/user/admin. |
| `lib/safe-redirect.ts` | Allowlist path internal dan penolakan protocol-relative/control character | Login, onboarding, redirect settings. |
| `lib/rate-limit.ts`, `proxy.ts` | Bucket global/scope dan header 429 | Seluruh API. |
| `lib/turnstile.ts` | Siteverify fail-closed dan site key dev | Login, checkout, profile/address/payment sync. |
| `lib/gowa.ts`, `lib/whatsapp-otp.ts` | Kontrak GOWA teks/gambar, normalisasi, HMAC challenge dan konsumsi OTP | Onboarding, perubahan nomor, dan rekening refund. |
| `lib/whatsapp-notifications.ts`, `lib/shipment-event.ts` | Outbox/dedupe/dispatch consent-aware dan copy timeline bersama | Payment, Biteship, sync, simulator, promosi. |
| `lib/refund-setting.ts` | Schema, canonical payload, dan binding hash rekening | Request OTP refund dan save rekening. |
| `lib/inventory.ts` | Commit/release/restock + movement dedupe | Checkout, payment, shipment, cancellation, webhook. |
| `lib/repositories/order-repository.ts`, `lib/voucher.ts` | Reserve, evaluasi voucher, dan create snapshot order atomik | Checkout order, voucher check/public, cron. |
| `lib/payment-sync.ts` | Rekonsiliasi payment provider, state order, inventory, dan audit secara konsisten | Sync customer/admin, webhook BSTN, dan test domain. |
| `lib/finance.ts` | Posisi omzet, penarikan, shadow balance, reservasi/reversal biaya, dan CRUD manual atomik | Lifecycle payment/order/return/shipment serta page/API keuangan. |
| `lib/adapters/bstn.ts` | Create/cancel/get payment dan verify webhook | Checkout, sync, cancel, webhook. |
| `lib/adapters/biteship.ts` | Area/rate/order/tracking/cancel provider | Checkout, shipment, sync. |
| `lib/shipping-state.ts` | Normalisasi dan mapping status provider | Webhook, admin shipment, timeline. |
| `lib/state-machine.ts` | Allowlist transisi fulfillment | Aksi admin. |
| `lib/local-media.ts` | Validasi dan penyimpanan file lokal | Upload admin dan bukti customer. |
| `lib/security.ts` | SHA-256, HMAC, random token, constant-time compare | Auth, webhook, compatibility order. |
| `lib/env.ts` | Validasi env, hard gate demo/payment mock | Runtime dan provider. |
| `lib/prisma-errors.ts`, `lib/error-message.ts` | Normalisasi error constraint/server dan pesan client | Mutasi user/admin dan form client. |
| `lib/serialize.ts`, `lib/format.ts`, `lib/types.ts` | Serialisasi BigInt, format UI, tipe domain presentasi | Page/API/component. |

## Peta komponen UI

| Area | Komponen utama | Peran |
| --- | --- | --- |
| Store shell | `store-header`, `store-footer` | Navigasi storefront, akun, cart, footer. |
| Katalog | `product-catalog`, `product-card`, `product-detail-view`, `product-purchase` | Filter/grid, visual produk, pilihan varian, add-to-cart. |
| Checkout/cart | `cart-sync`, `checkout-form`, `public-voucher-marquee`, cart/payment page clients | Sinkron cart, lokasi/tarif/promo/Turnstile/order, status payment. |
| Akun | `user-account-navigation`, `user-completion-gate`, `user-contact-settings-client`, `user-addresses-client`, `user-payment-client` | Navigasi responsif, onboarding, kontak, alamat, rekening. |
| Order customer | `order-cancel-button`, payment page client, `return-form`, `mock-payment-actions` | Aksi yang dibatasi ownership/state. |
| Admin shell/list | `admin-shell`, `admin-pagination`, `status-pill` | Sidebar/drawer, paging, status semantik. |
| Admin mutation | `product-form`, category editors, inventory/order/return action components | Mutasi katalog, stok, transaksi, shipment, return/refund tanpa mengganti state flow. |
| Admin finance | `revenue-finance-manager`, `biteship-finance-manager` | Penarikan omzet, biaya request, CRUD dana manual, dan feedback mutasi. |
| Shipping label | `shipping-label` | Label thermal 100 × 150 mm, barcode, dan aturan paginasi cetak untuk route resi. |

## Boundary data penting

- Client tidak boleh mengirim harga/stok/ongkir sebagai nilai final; server membaca ulang database/provider.
- List tidak boleh memakai `findMany` tanpa batas kecuali master data yang sengaja kecil atau editor kategori replacement penuh.
- Stats tidak diturunkan dengan mengunduh seluruh row transaksi.
- Cookie JWT berbeda untuk customer dan admin; token satu audience tidak berlaku pada audience lain.
- Nomor order, token URL lama, dan email request bebas tidak menjadi bukti ownership.
- Webhook tidak memakai session user/admin; ia memiliki signature/secret dan idempotency sendiri.
- Katalog boleh stale secara presentasi sampai invalidation/TTL, tetapi create order selalu authoritative ke MySQL.
