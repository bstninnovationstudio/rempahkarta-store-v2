# AGENTS.md — Aturan Implementasi AMK Store / REMPAHKARTA

**CATATAN TEKNIS:** *SELALU CATAT PERUBAHAN / LAKUKAN PENYESUAIAN BAGIAN TERKAIT DALAM README INI BERKAITAN YANG TERJADI PADA SISTEM SEHINGGA README SELALU VALID DAN UPDATED!!! (tidak harus selalu, jika dibutukan saja!)*

## Ruang lingkup

Aplikasi UMKM single-brand, single-tenant, dan guest checkout. Pertahankan arsitektur ringan: Next.js full-stack, Prisma, dan MySQL. Jangan menambahkan Redis, queue/worker terpisah, S3/R2, layanan email, D1/Drizzle, atau runtime Cloudflare tanpa permintaan eksplisit pemilik. Turnstile adalah verifikasi keamanan HTTP, bukan runtime aplikasi.

## Perintah standar

- Instalasi: `npm install`.
- Development: `npm run dev`.
- Database awal/perubahan schema: `npm run setup`.
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

- Location search hanya setelah tombol user, bukan per-keystroke.
- Rate baru diminta setelah area Biteship dipilih; tidak ada ongkir fallback produksi.
- Checkout, location search, dan quote wajib lolos Siteverify Turnstile di server. Widget client saja tidak cukup.
- Token Turnstile maksimum 2048 karakter, single-use, dan action harus cocok bila provider mengembalikannya.
- Semua body divalidasi Zod; provider/API failure harus tetap menghasilkan JSON yang dapat dibaca client.
- Persetujuan kebijakan wajib literal `true` di API.

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
- Backup `public/uploads` bersama MySQL.
- API key hanya di environment server; tidak boleh ada di source, fixture, screenshot, log, atau arsip.
- Token order disimpan sebagai SHA-256 hash. List admin meminimalkan PII.

## Definition of done

- TypeScript, lint, test, dan production build lulus.
- Create/edit produk, kombinasi varian, kategori, multi-image, stok, checkout, payment, shipment, cancellation, return, dan refund memiliki jalur validasi/error yang jelas.
- State penting menghasilkan audit dan operasi berulang tidak menggandakan stok.
- README, schema, env example, seed, arsitektur, dan UI konsisten.
