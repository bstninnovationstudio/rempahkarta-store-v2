# Audit dan Implementasi Kelola Dana Omzet & Dana Biteship

Status: **diimplementasikan dan migration deploy berhasil pada 21 Juli 2026**.

## Koreksi atas rencana awal

Audit source menemukan beberapa bagian rencana awal yang tidak aman atau tidak sesuai data aktual:

1. Rumus `grandTotal - shippingFee - serviceFee - Payment.feeAmount` mengurangi fee QRIS dua kali. `serviceFee` checkout sudah membentuk gross-up pembayaran. Omzet bersih produk yang benar adalah `subtotal - discountAmount`; `Payment.feeAmount` tetap disimpan sebagai snapshot laporan, tetapi tidak dikurangi kembali.
2. Saldo tertahan tidak boleh dihitung dari query order bila seluruh kartu keuangan harus bersumber dari log. Ledger sekarang menyimpan dua posisi delta: `availableDelta` dan `heldDelta`.
3. Satu record income per order tidak cukup. Pesanan selesai dapat kembali tertahan karena issue, retur, atau pembatalan; refund juga dapat mengurangi saldo. Karena itu ledger mencatat perpindahan posisi secara append-only dan idempoten di bawah lock order.
4. Saldo Biteship tidak aman bila hanya dihitung dengan `SUM(ledger)` saat beberapa request berjalan bersamaan. Singleton `BiteshipFundAccount` menjadi saldo atomik, sedangkan `BiteshipLedger` menjadi riwayat audit.
5. Gate saja tidak cukup. Pencarian area, cek ongkir, validasi ulang ongkir checkout, booking shipment, dan sinkronisasi tracking sekarang membuat debit; debit dibalik bila panggilan provider gagal.
6. CRUD bebas pada record otomatis dapat merusak audit. Hanya `TOP_UP` dan `DEDUCT_MANUAL` yang dapat diedit/dihapus; record pemakaian otomatis bersifat immutable dan koreksinya memakai catatan manual.

## Model dan formula final

### Dana omzet

- `RevenueLedger.availableDelta`: perubahan saldo yang dapat ditarik.
- `RevenueLedger.heldDelta`: perubahan dana yang masih tertahan.
- `netAmount`: snapshot omzet bersih produk setelah diskon/refund.
- `grossAmount`, `shippingFee`, `serviceFee`, `adminFee`, dan `discountAmount`: snapshot audit, bukan seluruhnya komponen saldo.
- Dana dianggap sudah diterima pada payment `paid`, `refund_pending`, atau `partially_refunded`.
- Dana menjadi tersedia hanya bila fulfillment `completed`/`finished`, tidak ada issue, retur aktif, atau pembatalan aktif.
- Refund completed mengurangi posisi. Payment `refunded` melepaskan seluruh posisi yang tersisa.
- Saldo kartu hanya memakai aggregate ledger. `Total transaksi` adalah saldo tersedia + tertahan + penarikan, sehingga menunjukkan omzet bersih setelah refund dan sebelum penarikan tanpa query ke tabel order.

### Dana Biteship

- `BiteshipFundAccount` menyimpan saldo dan biaya per request untuk area, rate, dan tracking.
- Biaya booking shipment memakai harga quote terpilih.
- Saldo harus positif untuk seluruh request yang dijaga. Cost bernilai nol tidak memotong saldo, tetapi saldo nol tetap memblokir request.
- Debit menggunakan transaksi `Serializable`, row lock, dan conditional decrement.
- Debit booking memakai dedupe key nomor order; pemulihan duplicate-reference tidak menggandakan biaya, sedangkan request yang sebelumnya sudah direversal boleh didebit ulang.
- Panggilan provider gagal menghasilkan `REVERSAL`; panggilan provider yang sukses tetap dianggap terpakai walau proses lokal berikutnya gagal.
- Shadow balance tidak terhubung ke saldo riil API Biteship dan tidak mengubah kontrak pengiriman/provider.

## Integrasi lifecycle

`syncOrderRevenue` dipanggil dari:

- sinkronisasi pembayaran terverifikasi dan webhook BSTN;
- webhook dan sinkronisasi manual Biteship;
- perubahan status manual/demo;
- pengajuan, keputusan, dan penyelesaian retur/refund;
- pengajuan/keputusan pembatalan pelanggan/admin;
- resolusi issue dan fixture duplikasi order lokal.

Seluruh kalkulasi dilakukan dalam transaksi yang sama dengan perubahan state terkait dan memakai lock order. Pemanggilan ulang tanpa perubahan posisi tidak membuat record baru.

## Halaman dan API final

- `/admin/finance/omzet`: saldo tersedia, saldo tertahan, total transaksi, jumlah pesanan, ledger terpaginasi, dan pencatatan penarikan dengan konfirmasi serta validasi saldo server.
- `/admin/finance/biteship`: saldo bayangan, total top up/pemakaian, biaya per request, riwayat terpaginasi, tambah/kurang manual, edit, dan hapus record manual.
- `GET /api/admin/finance/omzet`
- `POST /api/admin/finance/omzet/withdraw`
- `GET|POST /api/admin/finance/biteship`
- `PUT|DELETE /api/admin/finance/biteship/[id]`
- `PUT /api/admin/finance/biteship/settings`

Semua mutation baru memerlukan admin session, exact Origin, validasi Zod, rate limit, transaksi database, dan `AuditLog`.

## Migration

`202607210003_add_financial_ledgers`:

- menambah `RevenueLedger`, `BiteshipFundAccount`, dan `BiteshipLedger` secara additive;
- membuat akun singleton Biteship dengan saldo awal nol;
- melakukan backfill pesanan lama yang dananya sudah diterima ke posisi tersedia/tertahan berdasarkan state aktual;
- tidak menjalankan seed dan tidak memakai `db push`.

Migration diterapkan melalui `npm run db:migrate`. Hasil verifikasi pasca-migrasi: 7 pesanan ter-backfill, saldo tersedia Rp121.000, saldo tertahan Rp398.000, dan saldo awal Biteship Rp0.

## Validasi

- `npx prisma validate`: lulus.
- `npm run db:migrate`: lulus.
- `npx tsc --noEmit`: lulus.
- `npm test`: 28/28 lulus, termasuk empat test formula/state omzet.
- `npm run lint`: lulus tanpa error.
- Build dan hasil akhir dicatat di `docs/test-report.md`.

Catatan operasional: karena saldo awal shadow Biteship adalah nol, admin harus mencatat top up di `/admin/finance/biteship` sebelum pencarian area, cek ongkir, booking shipment, atau sinkronisasi tracking dapat diproses.
