# Arsitektur dan state flow AMK Store / REMPAHKARTA

**CATATAN TEKNIS:** *SELALU CATAT PERUBAHAN / LAKUKAN PENYESUAIAN BAGIAN TERKAIT DALAM README INI BERKAITAN YANG TERJADI PADA SISTEM SEHINGGA README SELALU VALID DAN UPDATED!!! (tidak harus selalu, jika dibutukan saja!)*

## Komponen

Satu proses Next.js menangani storefront, admin, API, dan webhook. Prisma berbicara langsung ke MySQL. Tidak ada Redis, queue, atau worker. Provider dipanggil dari aksi eksplisit dan webhook; operasi kritis dapat direkonsiliasi melalui tombol sync admin.

```text
Browser storefront/admin
        │
        ▼
Next.js pages + route handlers
   ├── Prisma ── MySQL
   ├── BSTN Dynamic QRIS
   ├── Biteship Maps/Rates/Orders/Tracking
   ├── Turnstile Siteverify
   └── public/uploads (filesystem lokal)
```

## Model katalog

`Product` memiliki `categoryId?`, `hasVariants`, `option1Name?`, dan `option2Name?`. `ProductCategory` adalah master kategori; foreign key tunggal menjamin satu produk maksimal satu kategori.

`ProductVariant` tetap menjadi unit penjualan untuk kedua mode:

- tanpa varian: satu row aktif, nilai opsi null;
- satu tingkat: `(option1Value, null)`;
- dua tingkat: `(option1Value, option2Value)`.

Setiap row menyimpan SKU, harga, berat, dimensi opsional, ambang stok menipis, posisi, dan status. Inventory berada di `InventoryLevel` per varian/gudang. Varian lama dinonaktifkan agar relasi order historis tidak rusak.

## Checkout publik

```text
Ketik lokasi → Turnstile → klik Cari → Biteship Maps
Pilih Area ID → Turnstile → klik Cek ongkir → Biteship Rates
Pilih rate + setujui kebijakan → Turnstile → POST order
Server baca varian MySQL → re-rate Biteship → reserve stok → payment
```

Tidak ada request Maps per keystroke dan tidak ada rate contoh. Ketiga API publik memvalidasi token Turnstile melalui Siteverify. Server tidak mempercayai harga, berat, dimensi, stok, atau ongkir dari browser.

## Inventory

- Checkout: `reserved += quantity` dengan optimistic lock.
- Payment gagal/cancel sebelum packed: `reserved -= quantity`.
- Packed: `reserved -= quantity`, `onHand -= quantity`.
- Cancel setelah packed sebelum handover: `onHand += quantity`.
- Retur sellable: `onHand += quantity`.

Semua side effect memakai transaction dan `dedupeKey`. Jika dua checkout membaca stok yang sama, hanya update dengan `version` terkini yang berhasil; request lain mendapat konflik dan harus mengulang.

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

BSTN paid hanya dari webhook valid atau GET provider. Tanpa worker, expiry diselesaikan oleh webhook atau sync guest/admin. Payment gagal tidak meninggalkan reservasi.

## Biteship

- Rate memakai snapshot item yang sama dengan booking.
- Dimensi opsional; berat wajib.
- `confirmed/scheduled/allocated` → booked.
- `picking_up` → handover pending.
- `picked/in_transit/dropping_off` → handed over.
- `delivered` → completed.
- Perubahan price dan waybill dicatat tanpa mengubah invoice.
- Webhook dan manual sync menggunakan mapping fulfillment yang sama.
- Cancel provider sebelum handover merestore inventory. Kegagalan request cancel dicatat sebagai `provider_failed` dan dapat dicoba lagi.

## Retur/refund

```text
requested → approved|rejected
approved → awaiting_handover → in_transit → received
received → inspection_passed|inspection_failed
inspection_passed → refund_pending → refunded → closed
```

Pengiriman retur berarah pelanggan ke gudang. Refund tetap manual dan membutuhkan bukti serta referensi.

## Operasional

Schema awal/perubahan diterapkan dengan `npm run setup`. Backup terdiri dari dump MySQL dan folder `public/uploads`. `.env`, cache, build output, dan credential tidak boleh masuk arsip distribusi.
