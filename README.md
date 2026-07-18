# AMK Store / REMPAHKARTA v1.2.0

**CATATAN TEKNIS:** *SELALU CATAT PERUBAHAN / LAKUKAN PENYESUAIAN BAGIAN TERKAIT DALAM README INI BERKAITAN YANG TERJADI PADA SISTEM SEHINGGA README SELALU VALID DAN UPDATED!!! (tidak harus selalu, jika dibutukan saja!)*

Toko online D2C ringan untuk satu usaha/brand. Pelanggan memilih variasi, checkout tanpa akun, membayar melalui BSTN Dynamic QRIS, lalu memantau pesanan dan tracking Biteship dari tautan bertoken. Admin mengelola produk, kategori, stok, pesanan, pengiriman, pembatalan, retur, inspeksi, dan refund manual.

Antarmuka memakai design system REMPAHKARTA yang terdokumentasi di `DESIGN.md`. Sistem visual mencakup token warna, tipografi, spacing, rasio media 1:1, status semantik, pola storefront dan admin, responsivitas, aksesibilitas, serta matriks state yang wajib diaudit. Aset demo menggunakan media rempah yang tersedia di proyek dan tidak memengaruhi data produk production.

Panel admin memakai canvas putih dengan shell desktop mulai 1024 px dan drawer pada tablet/mobile. Detail page serta form editor turun ke satu kolom sampai 1023 px; tabel memiliki region scroll terlokalisasi, caption semantik, dan target sentuh minimum 44 px pada perangkat sentuh. Form produk mempertahankan endpoint dan payload lama, tetapi ditata menjadi informasi dasar/media, konfigurasi penjualan, matriks varian, tautan marketplace, dan action bar bawah. Pemetaan 17 route UI admin serta hasil audit rinci tersedia di `docs/ui-audit.md`.

## Arsitektur

- Next.js App Router + React + TypeScript.
- Prisma + MySQL 8 sebagai satu-satunya database dan service stateful.
- BSTN Payment API untuk Dynamic QRIS; tersedia payment mock untuk pengujian.
- Biteship untuk area, ongkir, booking, tracking, perubahan harga/resi, dan pembatalan.
- Cloudflare Turnstile hanya sebagai proteksi API publik; tidak memakai Cloudflare Worker.
- Gambar produk serta bukti retur/refund disimpan lokal di `public/uploads`.
- Tidak memakai Redis, BullMQ, worker terpisah, D1/Drizzle, S3/R2, Resend, atau email otomatis.

## Persyaratan dan instalasi

- Node.js 20.9 atau lebih baru.
- npm.
- MySQL 8 atau MariaDB yang kompatibel dengan Prisma MySQL.

```bash
npm install
cp .env.example .env
# isi database, admin, gudang, Turnstile, BSTN, dan Biteship
npm run setup
npm run dev
```

`npm run setup` menjalankan `prisma db push` lalu seed. Untuk database yang pernah dipakai versi 1.1.0, perintah yang sama menambah tabel/kolom baru dan memindahkan kategori teks lama ke tabel kategori. Backup database sebelum menjalankannya.

Build server:

```bash
npm run build
npm start
```

Panel admin: `/admin-login`.

## Environment penting

- `DATABASE_URL`: koneksi MySQL.
- `APP_URL`: URL publik aplikasi dan callback provider.
- `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`: akses admin. Buat hash dengan `printf 'password-ku' | sha256sum`.
- `PAYMENT_MOCK=true`: pembayaran lokal; `PAYMENT_MOCK_AUTO_PAID=true` langsung menandai paid.
- `BSTN_*`: base URL, project API key, dan signature secret.
- `BITESHIP_*`: base URL, API key, serta secret autentikasi webhook.
- `ENABLED_COURIERS`: kode kurir yang boleh ditampilkan, dipisahkan koma.
- `WAREHOUSE_*`: alamat origin/pickup. Area ID hasil pengujian untuk Sentolo 55664 adalah `IDNP5IDNC206IDND1764IDZ55664`.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY`: widget client dan validasi Siteverify server.

Untuk localhost, `.env.example` memakai test key resmi Turnstile. Di production, ganti keduanya dengan key widget milik domain Anda. API checkout, pencarian area, dan ongkir menolak request tanpa token yang lolos verifikasi server.

Tidak ada `REDIS_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, atau konfigurasi object storage.

## Produk, variasi, dan kategori

- Produk dapat disetel tanpa varian: satu harga, SKU, stok, berat, batas stok menipis, dan dimensi paket opsional.
- Produk dengan varian mendukung Tingkat I dan Tingkat II maksimal. Kombinasi dibuat otomatis dan setiap kombinasi memiliki SKU, harga, stok, berat, dimensi, batas stok menipis, serta status aktif.
- Panjang × lebar × tinggi bersifat opsional. Jika digunakan, ketiganya harus diisi dalam sentimeter. Berat dalam gram selalu wajib.
- Maksimal 10 gambar JPG/PNG/WebP, masing-masing 5 MB. Gambar pertama menjadi gambar utama.
- Produk boleh tanpa kategori dan hanya dapat berada dalam satu kategori. Kategori dikelola di `/admin/categories`.
- Varian yang dihapus dari konfigurasi dinonaktifkan, bukan dihapus secara fisik, sehingga snapshot/order lama tetap aman.

## Checkout dan stok

1. Pelanggan mengetik kecamatan/kode pos lalu menekan **Cari**. Biteship hanya dipanggil setelah aksi tersebut.
2. Setelah memilih hasil area, pelanggan menekan **Cek ongkir**. Hanya kurir pada `ENABLED_COURIERS` yang diminta.
3. Checkout server membaca harga, berat, dimensi, dan status varian langsung dari MySQL; data harga client tidak dipercaya.
4. Server mengambil ulang tarif Biteship. Bila ongkir berubah, checkout berhenti dengan `SHIPPING_PRICE_CHANGED` dan total baru harus ditinjau pelanggan.
5. Persetujuan kebijakan wajib di client dan kembali divalidasi sebagai literal `true` di API.
6. Transaksi MySQL mereservasi stok menggunakan optimistic lock `version`. Checkout bersamaan hanya dapat mengambil unit yang masih tersedia setelah reservasi dan safety stock.
7. Stok tersedia adalah `onHand - reserved - safetyStock`. UI membedakan aman, menipis, dan habis.

## Payment dan fulfillment

```text
awaiting_payment → awaiting_processing → processing → packed
→ shipment_booked → handover_pending → handed_over → completed
```

- `packed` mengubah reservasi menjadi pengurangan stok fisik.
- Pembuatan resi belum berarti handover.
- Biteship `picking_up` → `handover_pending`; `picked/in_transit/dropping_off` → `handed_over`; `delivered` → `completed`.
- Status pembayaran final hanya dari webhook BSTN yang valid atau GET server-to-server, bukan redirect browser.
- Payment terminal gagal melepas reservasi tepat sekali. Paid setelah order terlanjur cancelled menjadi `refund_pending`.

## Perubahan ongkir, resi, dan pembatalan Biteship

- Event `order.price` menyimpan `actualPrice` dan `priceAdjustment`; invoice pelanggan tidak berubah.
- Event `order.waybill_id` mengganti resi aktif serta menyimpan waktu, histori, dan audit.
- Webhook dan tombol sinkronisasi admin sama-sama memperbarui status fulfillment.
- Status `cancelled`, `rejected`, `courier_not_found`, atau `disposed` sebelum handover memulihkan stok satu kali dan membuat refund pending bila sudah paid.
- Kegagalan cancel ke provider disimpan sebagai `provider_failed`; order belum dibatalkan dan admin dapat mencoba kembali.
- Setelah handover, pembatalan ditutup dan pelanggan menggunakan retur.

## Retur dan refund manual & Resolusi Pesanan Bermasalah

- **Retur Pelanggan:** Pelanggan mengajukan retur dari halaman pesanan dengan bukti foto. Admin menilai kasus, memesan kurir retur Biteship, melakukan inspeksi, dan mengembalikan stok jika layak jual. Refund dicatat secara manual.
- **Pesanan Bermasalah (Issue Order):** Sistem otomatis menandai pesanan lunas yang mengalami kendala sistem/kurir dari Biteship (`cancelled`, `courier_not_found`, `rejected`, `disposed`, `return_in_transit`, `returned`) dengan flag `issueOrder = true`. Admin dapat memproses resolusi berupa:
  - **Refund:** Membuat tiket resolusi refund langsung yang memindahkan status retur/refund ke `processing_refund` dan mengarah ke penyelesaian `finished`.
  - **Retur:** Membuat tiket resolusi retur manual (`awaiting_approval` -> `waiting_waybill` -> `processing_return` -> `processing_refund` -> `finished`) di mana admin meregistrasikan kurir & resi retur secara manual.
  - **Tandai Selesai:** Mengabaikan isu dan mengubah status pesanan langsung menjadi `finished` (Selesai).

## Webhook

- BSTN: `POST /api/webhooks/bstn`, HMAC `X-BSTN-Signature`, deduplikasi `X-BSTN-Delivery-Id`.
- Biteship: `POST /api/webhooks/biteship` dengan header `X-Webhook-Secret` yang nilainya sama dengan `BITESHIP_WEBHOOK_SHARED_SECRET`.
- Aktifkan event Biteship `order.status`, `order.price`, dan `order.waybill_id`.
- Gunakan HTTPS. Semua event masuk ke `WebhookInbox` idempoten dan audit MySQL.

## Pengujian

```bash
npm run lint
npm test
npm run build
```

Laporan rinci ada di `docs/test-report.md`. Pengujian provider memakai Biteship testing dan tidak menyimpan credential. Karena host MySQL yang diberikan tidak dapat dijangkau dari lingkungan pengembangan ini, `npm run setup` dan flow database end-to-end harus dijalankan sekali dari jaringan VS Code/server Anda.

## Backup

- Backup dump MySQL dan `public/uploads` secara bersamaan.
- Folder upload harus writable oleh proses Node.js dan persisten antar-deploy.
- Gunakan HTTPS dan batasi request body reverse proxy sekitar 6 MB.
- Jangan masukkan `.env` ke Git/arsip. Rotasi credential yang pernah dibagikan setelah pengujian.

Acuan implementasi: `AGENTS.md`, `DESIGN.md`, dan `docs/architecture.md`.
