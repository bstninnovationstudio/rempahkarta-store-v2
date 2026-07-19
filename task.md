> **ARSIP HISTORIS — BUKAN SPESIFIKASI AKTIF.** Dokumen ini merekam satu rangkaian pekerjaan lama dan dapat menyebut route, query, atau langkah database yang sudah berubah. Untuk kondisi sistem saat ini gunakan `README.md`, `docs/system-map.md`, `docs/architecture.md`, dan `docs/security-api-audit.md`. Jangan menjalankan perintah database dari arsip ini tanpa verifikasi migration aktif dan backup.

# Daftar Tugas: Kustomisasi Halaman Detail Pesanan Pelanggan & Aksi Admin

- [x] Integrasi Pengecekan Batas Waktu Klaim 7 Hari (`app/orders/[number]/page.tsx`)
- [x] Penyesuaian Progress Bar 4-Bar untuk Kasus Bermasalah (`app/orders/[number]/page.tsx`)
- [x] Restrukturisasi Panel "Ada Masalah?" Berdasarkan Kasus & WhatsApp CS (`app/orders/[number]/page.tsx`)
- [x] Memperbaiki Kondisi Rendering Tombol Batal agar Muncul Tanpa Query Token (`app/orders/[number]/page.tsx`)
- [x] Implemetasi Case detail: Pembatalan Diajukan, Ditolak, Disetujui, Dibatalkan Penjual (`app/orders/[number]/page.tsx`)
- [x] Deteksi Rekening Pengembalian Dana & Warning Banner (`app/orders/[number]/page.tsx`)
- [x] Integrasi return/refund events ke timeline pesanan (`app/orders/[number]/page.tsx` & `lib/admin-data.ts`)
- [x] Filter tombol "Retur" di Panel Admin hanya untuk pesanan completed (`components/admin-order-actions.tsx`)
- [x] Hapus query token dari alur pengajuan retur pelanggan (`app/orders/[number]/page.tsx`, `app/orders/[number]/return/page.tsx`)
- [x] Implementasi 4-Step Wizard Return Flow (Pilih Masalah, Produk & Bukti, Resolusi, Konfirmasi) (`components/return-form.tsx`)
- [x] Modifikasi API post return untuk kalkulasi otomatis refundAmount (`app/api/orders/[number]/returns/route.ts`)
- [x] Modifikasi list admin returns untuk merender tipe yang tepat berdasarkan reason (`lib/admin-data.ts`)
- [x] Modifikasi tampilan detail return admin untuk menampilkan multi-item secara detail (`app/admin/returns/[id]/page.tsx`)
- [x] Eliminasi total opsi resolusi Return (Pengembalian Barang & Dana) di seluruh codebase (`components/return-form.tsx`, `components/admin-order-actions.tsx`, `app/api/admin/orders/[number]/resolve/route.ts`)
- [x] Pembersihan menyeluruh data legacy: Hapus tabel database `ReturnShipment` dan `ReturnShipmentTrackingEvent` (`prisma/schema.prisma`)
- [x] Jalankan push schema database MySQL (`npx prisma db push --accept-data-loss`)
- [x] Hapus seluruh endpoint/routing dead code terkait return shipping (`app/api/orders/[number]/returns/quote`, `app/api/admin/returns/[id]/quotes`, `app/api/admin/returns/[id]/shipment`, `app/api/admin/returns/[id]/waybill`, `app/api/admin/returns/[id]/inspection`)
- [x] Pembersihan total logika Biteship Webhook dari referensi return shipping (`app/api/webhooks/biteship/route.ts`)
- [x] Pembersihan cache tipe generator Next.js (`.next`)
- [x] Perbaikan verifikasi isDemo di client-side component dengan meneruskan prop isDemo dari server component (`app/orders/[number]/return/page.tsx`, `components/return-form.tsx`)
- [x] Penambahan penanganan kasus penolakan refund (rejected):
  - [x] Input alasan penolakan refund di panel admin (`components/admin-return-actions.tsx`)
  - [x] Tampilan alasan penolakan di panel Pusat Resolusi pelanggan (`app/orders/[number]/page.tsx`)
  - [x] Tombol ajukan masalah lagi jika pengajuan sebelumnya ditolak (`app/orders/[number]/page.tsx`)
  - [x] Penyesuaian 4-Bar Progress Bar: Refund Diajukan -> Investigasi -> Refund Dana -> Ditolak (`app/orders/[number]/page.tsx`)
  - [x] Menambahkan timeline peristiwa penolakan refund dan pengajuan refund ke riwayat perjalanan paket pembeli dan admin (`app/orders/[number]/page.tsx`, `lib/admin-data.ts`)
  - [x] Restore/pemulihan status order `fulfillmentState` dari `return_requested` kembali ke `completed` saat admin melakukan penolakan refund (`app/api/admin/returns/[id]/decision/route.ts`)
- [x] Perbaikan Timeline Inkonsistensi & Riwayat Multi-Pengajuan:
  - [x] Menghilangkan batasan `take: 1` pada kueri `returns` dan `cancellations` (`app/orders/[number]/page.tsx`, `lib/admin-data.ts`)
  - [x] Mengubah kompilasi timeline menjadi loop perulangan (`forEach`) untuk memproses seluruh data riwayat keluhan (`app/orders/[number]/page.tsx`, `lib/admin-data.ts`)
  - [x] Stabilisasi timestamp peristiwa: mengganti penggunaan `new Date()` dan `order.updatedAt` yang volatil menjadi fallback stabil `requestedAt` (`app/orders/[number]/page.tsx`, `lib/admin-data.ts`)
- [x] Penarikan Riil Timestamp Perubahan Status via AuditLog:
  - [x] Mengambil data audit log dari tabel `AuditLog` saat memuat detail pesanan pembeli (`app/orders/[number]/page.tsx`) dan admin (`lib/admin-data.ts`)
  - [x] Menyesuaikan log peristiwa "Pesanan sedang diproses" dan "Pesanan sudah dikemas" agar menggunakan waktu riil dari `AuditLog` (saat admin menekan tombol transisi atau mengubah status manual)
  - [x] Menghilangkan seluruh kalkulasi selisih/offset manipulatif pada timeline
- [x] Verifikasi dan Pengujian Kompilasi (`npx tsc --noEmit`)
