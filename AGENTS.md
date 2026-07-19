# AGENTS.md — Aturan Implementasi AMK Store / REMPAHKARTA

**CATATAN TEKNIS:** *SELALU CATAT PERUBAHAN / LAKUKAN PENYESUAIAN BAGIAN TERKAIT DALAM README INI BERKAITAN YANG TERJADI PADA SISTEM SEHINGGA README SELALU VALID DAN UPDATED!!! (tidak harus selalu, jika dibutukan saja!)*

## Ruang lingkup

Aplikasi UMKM single-brand dan single-tenant. Checkout wajib memakai customer session; detail pesanan juga wajib login dan lolos ownership check. Pertahankan arsitektur ringan: Next.js full-stack, Prisma, dan MySQL. Jangan menambahkan Redis, queue/worker terpisah, S3/R2, layanan email, D1/Drizzle, atau runtime Cloudflare tanpa permintaan eksplisit pemilik. Turnstile adalah verifikasi keamanan HTTP, bukan runtime aplikasi.

## Perintah standar

- Instalasi: `npm install`.
- Development: `npm run dev`.
- Database baru/perubahan schema: `npm run setup` (generate + migrate deploy, tanpa seed).
- Database lama: verifikasi kesesuaian struktur schema, jalankan `npm run db:baseline:existing` tepat satu kali, lalu `npm run db:migrate`; jangan baseline database kosong.
- Seed/demo hanya untuk database disposable melalui perintah demo eksplisit; jangan seed atau `db push` database production.
- Fixture/bypass demo membutuhkan `DEMO_MODE=true` dan `ALLOW_INSECURE_DEMO=true` sekaligus di non-production. Jangan aktifkan pada preview/staging publik atau database nyata.
- Validasi: `npm run lint`, `npm test`, `npm run build`.

## Invariant katalog

- Produk hanya memiliki nol atau satu `categoryId`; kategori boleh null.
- Produk tanpa varian memiliki tepat satu `ProductVariant` aktif dengan opsi kosong.
- Produk dengan varian memiliki Tingkat I wajib dan Tingkat II opsional; tidak boleh lebih dari dua tingkat.
- Kombinasi `(option1Value, option2Value)` dan SKU tidak boleh duplikat.
- Varian yang pernah direferensikan order dinonaktifkan, bukan dihapus.
- Harga, SKU, opsi, berat, dimensi, alamat, dan layanan pengiriman disalin sebagai snapshot order.
- Maksimal 10 gambar produk. Hanya path `/uploads/products/...` yang diterima.

## Inventory dan race condition

- Semua mutasi stok terjadi dalam transaksi MySQL.
- Checkout memakai pembanding `version` dan kondisi `onHand >= reserved + safetyStock + quantity` pada update atomik.
- `available = max(0, onHand - reserved - safetyStock)`.
- Penyesuaian admin tidak boleh membuat `onHand < reserved` dan juga memakai optimistic lock.
- Reservasi, commit, release, restock pembatalan, dan restock retur memakai `InventoryMovement.dedupeKey`.
- Packing melakukan commit; booking shipment tidak mengurangi stok lagi.

## Checkout dan keamanan

- Login pelanggan memakai Google ID token yang signature, issuer, audience, expiry, dan email verified-nya divalidasi server-side sebelum aplikasi menerbitkan JWT sendiri.
- JWT customer/admin wajib berbeda audience dan token-use; cookie HttpOnly, SameSite, dan Secure pada production.
- JWT secret production minimal 32 karakter dan tidak boleh berupa placeholder; hasil `openssl rand -base64 48` yang berbeda dianjurkan untuk admin/customer.
- Password admin production wajib memakai `ADMIN_PASSWORD_SCRYPT` yang dibuat lewat `npm run auth:hash-password`; SHA-256 legacy hanya untuk kompatibilitas development.
- Customer yang belum memiliki nama, email, telepon, minimal satu alamat, dan rekening refund tidak boleh membuat order. Gate UI tidak menggantikan gate API.
- Detail, payment, cancellation, media, dan return order wajib memeriksa session dan ownership. Nomor order atau query token bukan kredensial.
- Mutasi API browser wajib lolos exact Origin check terhadap `APP_URL`; webhook dikecualikan dan memakai autentikasi provider sendiri.
- Location search hanya setelah tombol user, bukan per-keystroke.
- Rate baru diminta setelah area Biteship dipilih; tidak ada ongkir fallback produksi.
- Checkout, location search, quote, login admin, perubahan profil/alamat/rekening, dan sync payment wajib lolos Siteverify Turnstile di server. Widget client saja tidak cukup.
- Token Turnstile maksimum 2048 karakter, single-use, action wajib exact, dan hostname production wajib sama dengan `APP_URL`; test key production ditolak.
- Semua body divalidasi Zod; provider/API failure harus tetap menghasilkan JSON yang dapat dibaca client.
- Persetujuan kebijakan wajib literal `true` di API.
- Seluruh API memakai limit global sederhana; route mahal memiliki limit scope tambahan. Jangan menganggap limiter in-memory sebagai limit global multi-instance.

## Query, pagination, dan cache

- List transaksi/user/shipment/return/refund/audit wajib memakai page/pageSize dengan batas server dan urutan deterministik.
- Statistik memakai endpoint/query agregat terpisah; jangan memuat seluruh list untuk menghitung card dashboard.
- Relasi pada list dibatasi dengan `select`/`take`; detail unik boleh memuat histori yang relevan.
- Katalog storefront boleh di-cache server 30 menit, tetapi checkout selalu membaca harga, stok, dan ongkir authoritative.
- Perubahan produk, kategori, inventory, reserve, commit, release, dan restock harus menginvalidasi tag katalog.
- Editor category saat ini replacement penuh; jangan paginasi sebelum tersedia endpoint assign/unassign delta.

## BSTN

- `project_payment_ref` unik dan dipakai sebagai idempotency key.
- Total item termasuk ongkir harus sama dengan amount.
- Redirect hanya navigasi. Paid hanya dari webhook valid atau GET BSTN.
- Webhook: verifikasi HMAC raw body, delivery ID, payment ID, reference, dan amount; lalu GET detail.
- Terminal gagal melepas reservasi sekali. `PAYMENT_MOCK` tidak boleh aktif di production.

## Biteship

- Gunakan Area ID bila valid; string placeholder `replace_*` dianggap kosong dan postal code menjadi fallback.
- Berat wajib; dimensi opsional tetapi bila dipakai harus lengkap.
- Untuk rempah gunakan kategori shipment `food_and_drink`.
- Rate client selalu diperiksa ulang. Perubahan harga membutuhkan persetujuan ulang.
- `reference_id` shipment deterministik; duplicate reference mengambil order lama.
- Hanya izinkan collection method dari quote.
- Tangani `order.status`, `order.price`, `order.waybill_id`, perubahan tracking ID, serta cancel/reject/courier_not_found/disposed.
- Manual sync harus memperbarui shipment dan fulfillment, bukan shipment saja.
- Kegagalan pembatalan provider tidak boleh membatalkan order lokal.

## Media dan data sensitif

- Validasi MIME dan signature bytes JPG/PNG/WebP, maksimal 5 MB, nama acak, mode file terbatas.
- Media produk publik berada di `public/uploads/products`; bukti retur/refund privat berada di `storage/private/{returns,refunds}/{ownerId}` dan hanya disajikan lewat route owner/admin dengan `Cache-Control: private, no-store`.
- Backup `public/uploads` dan `storage/private` bersama MySQL.
- Migrasi media legacy harus dry-run dahulu; mode apply mempertahankan original di `storage/private-migration-backup`. Jangan menebak relasi refund tanpa `returnRequestId` atau menghapus backup sebelum verifikasi.
- API key hanya di environment server; tidak boleh ada di source, fixture, screenshot, log, atau arsip.
- Field hash token order lama dipertahankan untuk kompatibilitas data, tetapi tidak boleh dipakai sebagai kredensial akses baru. List admin meminimalkan PII.

## Definition of done

- TypeScript, lint, test, dan production build lulus.
- Create/edit produk, kombinasi varian, kategori, multi-image, stok, checkout, payment, shipment, cancellation, return, dan refund memiliki jalur validasi/error yang jelas.
- State penting menghasilkan audit dan operasi berulang tidak menggandakan stok.
- README, system map, security audit, schema, migration, env example, seed, arsitektur, dan UI konsisten.
