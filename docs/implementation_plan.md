# Rencana Implementasi GOWA dan Verifikasi WhatsApp

Status: **hasil audit — siap diterapkan**

## Tujuan

1. Nomor WhatsApp pada kontak utama wajib diverifikasi dengan OTP sebelum akun dianggap lengkap.
2. Pembuatan maupun perubahan rekening pengembalian dana wajib dikonfirmasi ulang dengan OTP ke nomor WhatsApp terverifikasi.
3. Pembayaran berhasil dan setiap row baru `ShipmentTrackingEvent` mengirim notifikasi WhatsApp dengan isi yang sama dengan timeline pelanggan.
4. Notifikasi perjalanan maupun promosi hanya dikirim setelah persetujuan terpisah dari pelanggan; consent tidak memengaruhi OTP.
5. Admin dapat mengirim pesan promosi teks atau gambar kepada seluruh pelanggan yang mengaktifkan consent promosi.
6. Integrasi tetap berada di dalam Next.js + Prisma + MySQL tanpa Redis, queue, atau worker terpisah.

## Koreksi terhadap rencana awal

- OTP tidak disimpan sebagai SHA-256 polos. Kode enam digit memiliki ruang pencarian kecil, sehingga hash memakai HMAC-SHA-256 dengan secret server, challenge ID, user, tujuan, dan nomor sebagai konteks.
- API verifikasi tidak menerbitkan bearer token yang dapat dipakai ulang. Challenge dikonsumsi secara atomik di transaksi yang juga mengubah nomor atau rekening refund.
- Challenge refund diikat ke hash payload rekening yang sudah dinormalisasi. OTP tidak dapat dipakai untuk menyimpan data rekening lain.
- Pengiriman notifikasi event tidak dilakukan di dalam transaksi provider. Transaksi membuat row outbox dengan `dedupeKey` unik, lalu `after()` mengirim setelah commit agar webhook tidak ditahan oleh timeout GOWA.
- Karena `/send/message` tidak memiliki idempotency key, timeout/network error setelah request terkirim ditandai `AMBIGUOUS` dan tidak di-retry otomatis. Respons gagal eksplisit dicatat sebagai `FAILED`; sukses menyimpan `message_id`.
- Semua pembentuk `ShipmentTrackingEvent` dicakup: webhook Biteship, sinkronisasi shipment admin, dan simulator development.

## Kontrak environment

```env
GOWA_BASE_URL_DEV=http://157.20.32.214:3000
GOWA_BASE_URL_LIVE=http://localhost:3000
GOWA_USER=replace_me
GOWA_PASS=replace_me
# Opsional untuk instalasi multi-device
GOWA_DEVICE_ID=
# Secret HMAC terpisah, minimal 32 karakter; fallback ke customer/auth secret
WHATSAPP_OTP_SECRET=replace_me_with_at_least_32_characters
```

`APP_MODE=development` memilih URL DEV dan `APP_MODE=production` memilih URL LIVE. Kredensial hanya dibaca server.

## Database dan migrasi

### `User`

- `phoneVerified Boolean @default(false)`
- `phoneVerifiedAt DateTime?`
- Boolean dan timestamp consent terpisah untuk notifikasi shipment dan promosi.

Nomor legacy tetap tersimpan tetapi dianggap belum terverifikasi sampai user menyelesaikan OTP.

### `WhatsappOtpChallenge`

- Terikat ke `userId`, `purpose`, nomor WhatsApp ternormalisasi, dan `bindingHash`.
- Menyimpan `codeHash`, `resendCount`, `attempts`, `lastSentAt`, `expiresAt`, `consumedAt`, dan `invalidatedAt`.
- OTP berlaku lima menit, maksimal lima percobaan kode, dan maksimal satu resend pada challenge yang sama.
- Challenge baru membatalkan challenge aktif lain untuk purpose yang sama.

### `WhatsappMessage`

- Transactional outbox untuk notifikasi non-OTP.
- Menyimpan penerima, isi final, jenis/source, `dedupeKey`, status, jumlah percobaan, provider `message_id`, dan error terkontrol.
- `dedupeKey` unik mencegah payment/event yang sama diantrikan dua kali.
- Body OTP tidak pernah disimpan di outbox atau audit log.

### `WhatsappPromotionCampaign`

- Menyimpan teks, referensi media privat opsional, status batch, actor admin, waktu, serta total hasil terkirim/gagal/ambigu/dilewati.
- Setiap penerima tetap memakai `WhatsappMessage` dengan `campaignId` agar log dan dedupe konsisten.

## Layanan server

### `lib/gowa.ts`

- Normalisasi `08...` / `+62...` menjadi `628...`.
- Basic Auth dan opsional `X-Device-Id`.
- Parser JSON/teks defensif; sukses hanya jika HTTP 2xx, `code=SUCCESS`, dan `results.message_id` tersedia.
- Footer wajib untuk seluruh pesan:

  `[Pesan Otomatis!] - Ini adalah pesan yang dikirimkan otomatis oleh sistem, mohon jangan membalas apapun di Chat Whatsapp ini`
- `/send/image` memakai multipart JPG/PNG dan footer yang sama pada caption.

### `lib/whatsapp-otp.ts`

- Kode enam digit memakai CSPRNG.
- Masa berlaku lima menit; resend baru tersedia setelah cooldown 60 detik dan merotasi kode.
- Maksimal satu resend, lima percobaan, tiga sesi baru per user dan per nomor dalam satu jam.
- In-memory limiter tambahan: enam request per user dan sepuluh per IP per 15 menit.
- Pesan OTP singkat, profesional, menyebut tujuan, masa berlaku, dan larangan membagikan kode.

### `lib/whatsapp-notifications.ts`

- Membuat outbox payment/event di transaksi yang sama dengan perubahan domain.
- Menggunakan formatter timeline shipment bersama agar judul/catatan UI dan WhatsApp identik.
- Format isi:

  ```text
  [24 Jul 12:05:11]
  Paket telah diterima
  Paket berhasil diserahkan kepada penerima
  ```

- Hanya nomor pemilik order yang sudah terverifikasi yang menjadi penerima.

## API

### `POST /api/user/otp`

Body:

- `purpose`: `PHONE_VERIFICATION` atau `REFUND_SETTING_VERIFICATION`
- `phone` untuk verifikasi kontak
- `refundSetting` untuk verifikasi rekening
- `challengeId` hanya untuk resend
- `turnstileToken` dengan action `user_otp_send`

Endpoint membuat atau mengirim ulang challenge dan tidak pernah mengembalikan kode.

### `PUT /api/user/profile`

- Nama dapat diubah tanpa OTP bila nomor ternormalisasi tidak berubah dan sudah terverifikasi.
- Nomor baru/belum terverifikasi mewajibkan `otpChallengeId` + `otpCode`.
- Konsumsi challenge dan update `phoneVerified` berjalan atomik.

### `POST /api/user/payment`

- API menolak bila nama/email/nomor kontak belum lengkap atau nomor belum terverifikasi.
- Setiap create/update mewajibkan challenge refund dan kode OTP.
- Hash payload harus sama dengan binding challenge; konsumsi OTP dan upsert rekening berjalan atomik.

### `PATCH /api/user/notifications`

- Menyimpan consent perjalanan dan promosi secara independen dengan Turnstile `user_notifications`.
- Setiap perubahan menghasilkan timestamp consent/revoke dan `AuditLog`.

### API promosi admin

- `POST /api/admin/promotions` membuat campaign dan snapshot penerima yang aktif, nomor terverifikasi, serta consent promosi menyala.
- `POST /api/admin/promotions/[id]/dispatch` mengirim batch kecil yang dapat dilanjutkan tanpa worker terpisah.
- Consent dan status user diperiksa ulang tepat sebelum kirim; opt-out menjadi `SKIPPED`.
- `GET /api/admin/promotions/[id]/media` menyajikan media privat hanya kepada admin.

## UI `/user/settings`

- Kontak utama menampilkan badge `Terverifikasi`/`Belum terverifikasi`.
- Nomor baru memunculkan alur kirim OTP, input enam digit, countdown lima menit, dan satu tombol resend setelah cooldown.
- Rekening refund terkunci sampai kontak utama lengkap serta nomor terverifikasi.
- Submit rekening mengirim OTP dahulu; submit berikutnya memverifikasi dan menyimpan.
- Perubahan field setelah OTP diminta membatalkan state challenge pada client dan memerlukan kode baru.
- Dua switch consent berada di bawah Kontak utama: perjalanan paket dan promosi. Keduanya tidak mengubah alur OTP.

## Notifikasi pembayaran dan shipment

- Transisi aktual pertama ke `paid` mengantrikan event `Pembayaran QRIS berhasil`.
- Setiap row baru `ShipmentTrackingEvent` mengantrikan isi dari formatter yang sama dengan timeline.
- Booking/sync/webhook berulang memakai dedupe database sehingga tidak menambah pesan yang sama.
- Dispatch memakai `after()` setelah transaksi berhasil; kegagalan notifikasi tidak menggagalkan payment, shipment, inventory, atau webhook provider.
- Payment/shipment hanya diantrikan dan dikirim bila consent perjalanan aktif.

## Halaman admin `/admin/promotions`

- Composer pesan 3–3000 karakter dan gambar JPG/PNG opsional maksimal 5 MB.
- Konfirmasi eksplisit menampilkan jumlah penerima yang memenuhi consent.
- Client menjalankan batch tiga penerima per request dan dapat melanjutkan campaign `QUEUED`/`SENDING` setelah koneksi terputus.
- Timeout ambigu tidak diulang otomatis; hasil per campaign menampilkan target, terkirim, gagal, ambigu, dan dilewati.
- Media berada di `storage/private/promotions/{campaignId}` dan ikut dalam backup private storage.

## Validasi

- Unit test normalisasi nomor, footer/format GOWA, HMAC binding, formatter timeline, batas OTP, dan canonical refund payload.
- `npx prisma validate`
- `npx prisma generate`
- `npm run lint`
- `npm test`
- `npm run build`
- Smoke test deployment tetap diperlukan dengan MySQL dan kredensial GOWA/Turnstile nyata.
