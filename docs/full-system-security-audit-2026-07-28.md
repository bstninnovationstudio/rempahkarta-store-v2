# Audit Penuh Sistem, Keamanan, Autentikasi, API, dan SEO

**Proyek:** REMPAHKARTA Store v2  
**Tanggal audit:** 28 Juli 2026  
**Versi sumber saat audit:** 1.3.0  
**Cakupan:** 309 file arsip, 79 route API, skema Prisma, migrasi, autentikasi, transaksi pembayaran/pengiriman, webhook, media privat, rate limiting, Cloudflare Turnstile, konfigurasi produksi, dan metadata SEO.

## 1. Batasan dan prinsip audit

Audit dilakukan berbasis kode tanpa menjalankan UI atau bergantung pada koneksi database/provider produksi. Seluruh README dan dokumentasi proyek dibaca penuh sebelum penelusuran implementasi. Perbaikan mempertahankan:

- route, bentuk alur bisnis, dan state machine yang sudah ada;
- susunan halaman dan tampilan;
- MySQL/Prisma sebagai satu-satunya layanan stateful;
- adapter BSTN, Biteship, GOWA, dan Cloudflare Turnstile yang sudah dipakai;
- operasi personal web store tanpa Redis, message broker, atau platform tambahan.

Verifikasi yang digunakan:

- ESLint;
- TypeScript `--noEmit`;
- seluruh test Node;
- Prisma schema validation;
- Next.js production build;
- `npm audit --omit=dev`.

## 2. Ringkasan eksekutif

Baseline sudah memiliki fondasi yang baik: JWT memakai issuer/audience/token-use, cookie `HttpOnly`, customer session lock tersimpan di database, scrypt untuk password admin produksi, pemeriksaan Origin untuk mutasi browser, verifikasi signature webhook, inbox idempotensi, Turnstile pada jalur berbiaya tinggi, transaksi Prisma, row lock pada sebagian state transition, validasi Zod, dan media retur/refund di storage privat.

Namun, sebelum remediasi terdapat beberapa risiko yang dapat berdampak langsung pada integritas pesanan dan operasional:

| Severity | Jumlah awal | Tema utama |
|---|---:|---|
| Kritis | 1 | Cron mutasi fail-open |
| Tinggi | 8 | Payment split-brain, webhook/shipment race, media path, env injection, dependency advisory |
| Sedang | 12 | Rate-limit khusus, sesi blokir, OAuth linking, cart race, cache PII, upload size, devtools |
| Rendah | 5 | SEO, dokumentasi drift, hardening header, observability |

Status setelah implementasi dicatat pada setiap temuan. Risiko yang tidak dapat dihapus tanpa state bersama atau perubahan provider dicatat sebagai risiko residual.

Implementasi final mengubah 65 file proyek dan menambah lima file teknis (`robots.ts`, `sitemap.ts`, helper media/body, dan laporan ini). Jumlah page UI tetap 41 dan jumlah API route tetap 79; tidak ada page UI, susunan navigasi, state machine, atau tujuan flow transaksi yang ditambah/dihapus.

## 3. Temuan dan remediasi

### SEC-01 — Cron kedaluwarsa fail-open

- **Severity:** Kritis
- **Lokasi awal:** `app/api/cron/expire-orders/route.ts`, fungsi `GET`
- **Masalah:** autentikasi hanya dijalankan jika `CRON_SECRET` terisi. Saat kosong, endpoint publik tetap memindahkan order kedaluwarsa ke status terminal dan melepas reservasi stok.
- **Dampak:** penyerang dapat memicu mutasi massal, menambah beban database, dan mengubah status order tanpa kredensial.
- **Remediasi:** autentikasi cron dipusatkan pada helper fail-closed, secret minimum 32 karakter, perbandingan constant-time, dan limiter khusus cron. GET/POST tetap dipertahankan.
- **Status:** Diperbaiki.

### SEC-02 — Split-brain pada pembuatan pembayaran

- **Severity:** Tinggi
- **Lokasi awal:** `app/api/checkout/orders/route.ts`, blok `bstn.createPayment()` lalu `prisma.payment.create()`
- **Masalah:** provider dipanggil sebelum record `Payment` lokal dibuat. Jika provider sukses tetapi respons timeout atau insert lokal gagal, pembayaran nyata dapat ada di provider sementara order lokal dibatalkan dan stok dilepas.
- **Dampak:** pembayaran pelanggan tidak tertaut, potensi paid-after-cancel, refund manual, dan inkonsistensi inventori.
- **Remediasi:** record payment intent lokal dibuat sebelum side effect provider menggunakan `projectPaymentRef` idempoten. Respons provider memperbarui intent yang sama. Kegagalan 4xx yang definitif membatalkan order; timeout/5xx diperlakukan ambigu dan order tetap dapat direkonsiliasi oleh webhook atau kedaluwarsa terjadwal.
- **Status:** Diperbaiki.

### SEC-03 — Webhook BSTN tidak dapat menautkan callback awal secara aman

- **Severity:** Tinggi
- **Lokasi awal:** `app/api/webhooks/bstn/route.ts`, lookup `providerPaymentId`
- **Masalah:** callback hanya mencari `providerPaymentId`. Callback yang tiba sebelum ID provider tersimpan selalu menjadi `pending_unmatched`.
- **Dampak:** delivery bergantung penuh pada retry provider dan dapat tertinggal.
- **Remediasi:** fallback lookup memakai `projectPaymentRef`, ID provider ditautkan secara atomik setelah reference/amount diverifikasi, payload divalidasi ketat, delivery ID dinormalisasi sesuai ukuran kolom, dan event insert dibuat idempoten.
- **Status:** Diperbaiki.

### SEC-04 — Race dan lost update pada webhook Biteship

- **Severity:** Tinggi
- **Lokasi awal:** `app/api/webhooks/biteship/route.ts`, lookup shipment sebelum `$transaction`
- **Masalah:** status shipment/order, pengecekan stale event, dan keputusan state transition memakai snapshot di luar transaksi. Dua event sah yang paralel dapat menimpa status yang lebih baru.
- **Dampak:** regresi fulfillment, restock/release yang salah, issue flag tertinggal, atau timeline tidak konsisten.
- **Remediasi:** transaksi mengunci `Shipment` lalu `Order`, membaca ulang state terkini, menghitung stale/monotonic transition dari data terkunci, dan menyelesaikan inbox pada transaksi yang sama.
- **Status:** Diperbaiki.

### SEC-05 — Race pada booking dan sinkronisasi shipment

- **Severity:** Tinggi
- **Lokasi awal:**  
  - `app/api/admin/orders/[number]/shipment/route.ts`  
  - `app/api/admin/orders/[number]/shipment/sync/route.ts`
- **Masalah:** finalisasi booking tidak mengunci order; pembatalan provider dilakukan di dalam transaksi database; manual sync dapat mengubah shipment/order dari snapshot lama dan dapat meregresikan state.
- **Dampak:** shipment tercipta setelah order dibatalkan, transaksi database tertahan oleh network call, atau status terminal tertimpa.
- **Remediasi:** finalisasi mengunci shipment/order, provider compensation dijalankan setelah transaksi gagal, sync memakai lock dan guard monotonic yang sama dengan webhook, serta memperoleh limiter khusus.
- **Status:** Diperbaiki.

### SEC-06 — Path containment media dapat tertipu prefix

- **Severity:** Tinggi
- **Lokasi awal:**  
  - `lib/admin-media.ts`, `resolveSafeAbsolutePath()`  
  - `app/api/admin/media/preview/route.ts`
- **Masalah:** `fullPath.startsWith(UPLOADS_DIR)` menerima sibling dengan nama berprefix sama, misalnya `public/uploads-evil`.
- **Dampak:** admin yang dibajak atau payload internal dapat membaca/menghapus file di luar root media yang dimaksud.
- **Remediasi:** containment menggunakan `path.relative()` dengan pengecekan segmen, preview dibatasi ke file reguler berformat gambar dan maksimum 5 MB, serta respons memakai `nosniff`.
- **Status:** Diperbaiki.

### SEC-07 — Injeksi dan korupsi `.env` melalui konfigurasi gudang

- **Severity:** Tinggi
- **Lokasi awal:** `lib/admin-shipping-config.ts`, `warehouseSchema()` dan `writeEnvUpdates()`
- **Masalah:** nilai admin ditulis mentah sebagai `KEY=value`, tanpa batas panjang atau larangan newline/control character. Tulis file juga tidak atomik dan dua request dapat saling menimpa.
- **Dampak:** penyisipan key environment baru, korupsi konfigurasi, atau konfigurasi parsial antara DB dan file.
- **Remediasi:** validasi panjang/format ketat, penolakan control character, encoding nilai dotenv ber-quote, mutex proses, temp-file + rename atomik, mode file terbatas, dan audit log perubahan tanpa menyimpan PII lengkap.
- **Status:** Diperbaiki.

### SEC-08 — Dependency produksi memiliki advisory kategori tinggi

- **Severity:** Tinggi
- **Lokasi awal:** `package.json`, `package-lock.json`
- **Masalah:** Next.js 16.2.10 menarik versi `sharp` dan Next yang tercakup advisory high.
- **Dampak:** bergantung pada advisory yang aktif pada framework/image pipeline.
- **Remediasi:** patch ke Next.js dan `eslint-config-next` 16.2.12 lalu verifikasi `npm audit --omit=dev`.
- **Status:** Diperbaiki.

### SEC-09 — Resolve API dapat menutup order yang bukan issue

- **Severity:** Tinggi
- **Lokasi awal:** `app/api/admin/orders/[number]/resolve/route.ts`
- **Masalah:** UI hanya menampilkan aksi pada order bermasalah, tetapi API tidak memvalidasi `issueOrder` atau state yang sesuai dan tidak memakai row lock.
- **Dampak:** request langsung dapat menandai order biasa sebagai `finished` atau membuat return/refund case yang tidak sah.
- **Remediasi:** row lock, server-side eligibility guard, idempotensi active return, public number collision-safe, audit before/after, dan limiter khusus.
- **Status:** Diperbaiki.

### SEC-10 — Mutasi order milik pengguna lain melalui status lookup

- **Severity:** Sedang–Tinggi
- **Lokasi awal:**  
  - `app/api/orders/[number]/payment/status/route.ts`  
  - `app/orders/[number]/page.tsx`
- **Masalah:** `checkAndExpireOrder(number)` dipanggil sebelum ownership diverifikasi. Pengguna login yang menebak nomor order lain dapat memicu expiry/release reservation.
- **Dampak:** object-level authorization bypass untuk efek samping walaupun data order tetap disembunyikan.
- **Remediasi:** lookup kepemilikan dilakukan lebih dahulu; expiry baru dijalankan untuk order milik sesi dan data kemudian dibaca ulang.
- **Status:** Diperbaiki.

### AUTH-01 — Linking akun Google legacy/race tidak aman

- **Severity:** Sedang
- **Lokasi awal:** `app/api/auth/google/route.ts`
- **Masalah:** user dicari berdasarkan Google ID atau email, tetapi `upsert` selalu memakai Google ID. Akun email yang sudah ada dengan Google ID berbeda dapat memicu unique constraint/500.
- **Dampak:** login gagal, race create, atau akun legacy tidak tertaut.
- **Remediasi:** transaksi serializable, per-user row lock, akun hanya diperbarui bila Google `sub` stabil dan token memiliki `email_verified=true`, konflik email/subject ditolak tanpa menautkan identitas secara implisit, session ID dirotasi atomik, dan limiter tambahan per Google subject.
- **Status:** Diperbaiki.

### AUTH-02 — Memblokir user tidak segera mencabut sesi

- **Severity:** Sedang
- **Lokasi awal:** `app/api/admin/users/[id]/status/route.ts`
- **Masalah:** status berubah ke `BLOCK`, tetapi `currentSessionId` tetap tersimpan.
- **Dampak:** request berikut memang ditolak oleh status check, tetapi sesi tidak secara eksplisit direvoke dan dapat aktif kembali jika status dipulihkan.
- **Remediasi:** update status memakai row lock dan mengosongkan `currentSessionId` saat `BLOCK`.
- **Status:** Diperbaiki.

### AUTH-03 — Hardening cookie admin/customer belum maksimum

- **Severity:** Rendah–Sedang
- **Lokasi:** `lib/auth.ts`, `lib/customer-auth.ts`
- **Masalah:** admin cookie menggunakan `SameSite=Lax`; kedua cookie belum memiliki priority.
- **Remediasi:** admin menjadi `SameSite=Strict`, kedua cookie `Priority=high`, tetap `HttpOnly`, `Secure` pada produksi, scope `/`, dan expiry semula.
- **Status:** Diperbaiki.

### AUTH-04 — Devtools cukup diaktifkan satu flag

- **Severity:** Sedang
- **Lokasi awal:** `lib/env.ts`, `isDevToolsEnabled()`
- **Masalah:** dokumentasi mengklaim dua flag, tetapi implementasi hanya memerlukan `APP_MODE=development`.
- **Dampak:** preview/staging yang salah mode dapat mengekspos duplicate/delete/manual-status order.
- **Remediasi:** wajib `APP_MODE=development` dan `ENABLE_DEVTOOLS=true`; production selalu false.
- **Status:** Diperbaiki.

### API-01 — Cart merge/replace race

- **Severity:** Sedang
- **Lokasi awal:** `app/api/user/cart/route.ts`, `POST` dan `PUT`
- **Masalah:** transaksi tidak mengunci invariant per user. Request paralel dapat melewati batas 50 item atau saling menimpa.
- **Remediasi:** row lock `User` pada awal transaksi cart dan validasi dilakukan ulang pada unit atomik.
- **Status:** Diperbaiki.

### API-02 — Batch expiry tidak dibatasi

- **Severity:** Sedang
- **Lokasi awal:** `lib/payment-sync.ts`, `checkAndExpireAllStaleOrders()`
- **Masalah:** cron memuat semua order stale ke memory dan memproses serial.
- **Dampak:** latency/memory spike dan timeout saat backlog.
- **Remediasi:** batch deterministik maksimum 100 order per eksekusi; cron dapat dipanggil ulang idempoten.
- **Status:** Diperbaiki.

### API-03 — Body multipart dapat dibuffer sebelum batas file diperiksa

- **Severity:** Sedang
- **Lokasi:** upload media admin, retur, refund, dan promosi.
- **Masalah:** `request.formData()` dapat mengalokasikan body besar sebelum `File.size` divalidasi.
- **Remediasi:** preflight `Content-Length` dengan batas konservatif sebelum parsing, tetap mempertahankan validasi ukuran, MIME, magic bytes, nama file acak, dan jumlah file.
- **Status:** Diperbaiki pada route upload; reverse proxy tetap harus memiliki body-size limit sebagai defense-in-depth.

### API-04 — Scope upload admin fallback ke publik

- **Severity:** Sedang
- **Lokasi awal:** `app/api/admin/media/upload-url/route.ts`
- **Masalah:** nilai scope tidak dikenal otomatis dianggap `products`, sehingga typo dapat membuat file sensitif masuk area publik.
- **Remediasi:** scope divalidasi sebagai enum dan nilai tidak dikenal ditolak.
- **Status:** Diperbaiki.

### API-05 — Invariant inventory dapat gagal tanpa menghentikan transaksi

- **Severity:** Sedang–Tinggi
- **Lokasi awal:** `lib/inventory.ts`, fungsi release/commit/restock.
- **Masalah:** inventory level yang hilang atau conditional decrement yang gagal dapat dilewati tanpa error; restock tidak membuktikan bahwa penjualan sebelumnya pernah dikomit.
- **Dampak:** status order dapat maju walau ledger movement dan saldo stok tidak konsisten.
- **Remediasi:** seluruh invariant menjadi fail-fast; release wajib menurunkan satu row, commit wajib memiliki stok/reservasi, dan restock wajib menemukan movement `sale_committed` yang sesuai.
- **Status:** Diperbaiki.

### API-06 — Overlap jadwal dan biaya pencarian area admin belum atomik

- **Severity:** Sedang
- **Lokasi awal:** `app/api/admin/settings/schedules/route.ts`, `app/api/admin/shipping/locations/route.ts`.
- **Masalah:** dua request jadwal paralel dapat sama-sama melewati overlap check; pencarian area admin memanggil provider tanpa gate/debit shadow balance yang sudah dipakai flow lain.
- **Dampak:** jadwal operasional bertumpuk atau biaya provider tidak tercatat konsisten.
- **Remediasi:** create jadwal memakai transaksi `Serializable`; pencarian area admin memakai limiter, reservasi shadow balance, dan reversal jika provider gagal.
- **Status:** Diperbaiki.

### API-07 — Input rekening refund terlalu permisif

- **Severity:** Rendah–Sedang
- **Lokasi awal:** `lib/refund-setting.ts`.
- **Masalah:** panjang dan karakter identifier rekening/e-wallet belum dibatasi cukup ketat untuk data yang masuk audit, notifikasi, dan operasi refund.
- **Remediasi:** trim, batas panjang, larangan control character, dan allowlist digit/spasi/tanda hubung tanpa mengubah jenis rekening atau alur OTP.
- **Status:** Diperbaiki.

### RATE-01 — Mutasi penting hanya memiliki limiter universal

- **Severity:** Sedang
- **Lokasi:** proxy dan route admin.
- **Cakupan awal yang terlewat:** CRUD/reorder kategori dan produk, inventory adjustment, order transition/resolve, shipment sync, shipping config/courier/warehouse, media delete/preview, voucher CRUD/duplicate, dev order tools, cron expiry, serta payment-status polling.
- **Dampak:** satu fitur mahal dapat menghabiskan database/provider quota walaupun belum mencapai limiter universal 100/menit.
- **Remediasi:** policy khusus path+method pada proxy dan policy route-level untuk operasi provider/transaction yang paling sensitif. Limit dipilih moderat untuk personal store, bukan standar korporasi yang terlalu ketat.
- **Status:** Diperbaiki.

### RATE-02 — Rate limiter hanya in-memory per instance

- **Severity:** Risiko residual
- **Lokasi:** `lib/rate-limit.ts`
- **Masalah:** bucket tidak dibagi antar instance dan hilang saat restart.
- **Keputusan:** dipertahankan sesuai larangan penambahan Redis/platform. Cleanup diperbaiki menjadi oldest-last-seen, validasi policy ditambahkan, dan konfigurasi trusted IP tetap fail-closed.
- **Kontrol kompensasi:** Turnstile, limiter provider/database, MySQL invariants, Origin check, dan pembatasan deployment satu instance atau sticky routing.
- **Status:** Diterima dengan kontrol kompensasi.

### TURN-01 — Pembatalan, upload bukti, dan pengajuan retur belum memakai Turnstile

- **Severity:** Sedang
- **Lokasi awal:**  
  - `components/order-cancel-button.tsx` / `app/api/orders/[number]/cancel/route.ts`  
  - `components/return-form.tsx` / `app/api/orders/[number]/returns/route.ts`
- **Masalah:** kedua jalur mengubah state transaksi dan dapat memicu provider/refund workflow, tetapi hanya dilindungi sesi dan limiter.
- **Remediasi:** Turnstile invisible ditambahkan ke komponen yang sama tanpa mengubah susunan/visual UI; action server diverifikasi pada pembatalan (`order_cancel`), setiap upload bukti (`return_media`), dan pengajuan akhir (`return_request`). Upload tetap dilindungi auth, ownership, state, MIME/magic-byte, count, Content-Length, dan limiter.
- **Status:** Diperbaiki.

### SEO-01 — Metadata berisi catatan sistem dan coverage indexing minim

- **Severity:** Rendah
- **Lokasi awal:** `app/layout.tsx`
- **Masalah:** metadata `other.codex-preview=development` adalah catatan sistem yang tidak relevan untuk indeks. Open Graph, Twitter, canonical, robots, dan metadata produk belum lengkap.
- **Remediasi:** catatan sistem dihapus. Metadata memakai copy yang sudah ada di website saja; ditambahkan `metadataBase`, canonical, Open Graph/Twitter, robots, serta dynamic metadata produk dari nama/deskripsi/gambar yang sudah tersimpan. Route teknis robots/sitemap tidak membuat halaman UI baru dan mengecualikan admin, API, login, user, checkout, cart, serta order privat.
- **Status:** Diperbaiki.

### HDR-01 — Security header belum mencakup CSP dan cache PII

- **Severity:** Sedang
- **Lokasi awal:** `next.config.ts`
- **Masalah:** sudah ada HSTS/nosniff/frame/referrer/permissions, tetapi belum ada CSP dan no-store menyeluruh untuk API user/admin/order/auth.
- **Remediasi:** CSP kompatibel dengan Next, Google Identity, dan Turnstile; COOP dan DNS prefetch control; serta `Cache-Control: private, no-store` pada API privat.
- **Status:** Diperbaiki.

### DOC-01 — Dokumentasi drift dari implementasi

- **Severity:** Rendah
- **Lokasi:** `README.md`, `docs/system-map.md`, `docs/security-api-audit.md`, `.env.example`
- **Masalah:** jumlah route tertulis 63 sedangkan aktual 79; guard devtools dan cron tidak sesuai dokumentasi; environment baru belum terdokumentasi.
- **Remediasi:** dokumen dan `.env.example` diselaraskan dengan implementasi final.
- **Status:** Diperbaiki.

## 4. Referensi file dan baris implementasi final

Nomor baris berikut merujuk pada source setelah remediasi di arsip hasil audit. Rentang menunjukkan pusat kontrol; import atau helper pendukung dapat berada tepat di luar rentang.

| Temuan/kontrol | File dan baris final | Implementasi yang dapat diperiksa |
|---|---|---|
| SEC-01 cron fail-closed | `lib/security.ts:20–32`; `app/api/cron/expire-orders/route.ts:7–26`; `lib/payment-sync.ts:193–232` | Secret kuat, perbandingan constant-time, limiter job, dan batch 100. |
| SEC-02 payment intent | `app/api/checkout/orders/route.ts:112–225` | Intent lokal mendahului call BSTN; hasil definitif dan ambigu dipisahkan. |
| SEC-03 callback BSTN awal | `app/api/webhooks/bstn/route.ts:88–190` | Lookup provider/reference, collision guard, lock Payment→Order, linking ID atomik. |
| SEC-04 webhook shipment | `app/api/webhooks/biteship/route.ts:130–245` | Delivery key bounded, retry inbox, lock Shipment→Order, stale/monotonic guard. |
| SEC-05 booking/sync shipment | `app/api/admin/orders/[number]/shipment/route.ts:26–230`; `app/api/admin/orders/[number]/shipment/sync/route.ts:49–105` | Eligibility, claim, final lock, compensation luar transaksi, sync monotonic. |
| SEC-06 media path | `lib/media-path.ts:3–44`; `app/api/admin/media/preview/route.ts:9–45`; `lib/admin-media.ts:224–329` | Root-segment containment, ekstensi allowlist, regular-file/size check, safe deletion. |
| SEC-07 shipping config | `lib/admin-shipping-config.ts:20–197` | Schema bounded, dotenv quote, write queue, temp+rename, rollback DB/file. |
| SEC-08 dependency | `package.json:25–49`; `package-lock.json` | Next/eslint 16.2.12 dan Sharp 0.35.0 terkunci. |
| SEC-09 resolve issue | `app/api/admin/orders/[number]/resolve/route.ts:18–148` | Limiter, row lock, `issueOrder` guard, idempotensi, audit. |
| SEC-10 ownership sebelum expiry | `app/api/orders/[number]/payment/status/route.ts:13–64`; `app/orders/[number]/page.tsx:416–460` | Owner diverifikasi sebelum side effect expiry. |
| AUTH-01 Google identity | `app/api/auth/google/route.ts:38–126` | Verifikasi JWT/claim, subject limiter, stable-sub binding, serializable lock/session rotation. |
| AUTH-02 block/revoke | `app/api/admin/users/[id]/status/route.ts:12–62` | User lock dan `currentSessionId=null` pada BLOCK. |
| AUTH-03 cookie | `lib/auth.ts:64`; `lib/customer-auth.ts:113–122` | HttpOnly/Secure, admin Strict, priority high. |
| AUTH-04 devtools | `lib/env.ts:3–6`; `lib/env.ts:113–117` | Dua flag eksplisit dan production hard stop. |
| API-01 cart race | `app/api/user/cart/route.ts:97–164` | User row lock pada add dan full replace. |
| API-02 expiry batch | `lib/payment-sync.ts:193–232` | Query stale bounded dan pemrosesan idempoten. |
| API-03 body size | `lib/request-body.ts:1–10`; `proxy.ts:36–57` | Preflight JSON/multipart/webhook dan validasi Content-Length. |
| API-04 scope media | `app/api/admin/media/upload-url/route.ts:9–27` | Enum `products/refunds`, entity privat wajib valid. |
| API-05 inventory | `lib/inventory.ts:3–40`; `lib/inventory.ts:42–83`; `lib/inventory.ts:85–122` | Release/commit/restock fail-fast dan movement dedupe. |
| API-06 schedule/provider cost | `app/api/admin/settings/schedules/route.ts:43–103`; `app/api/admin/shipping/locations/route.ts:8–47` | Serializable overlap dan shadow-balance reservation/reversal. |
| API-07 rekening refund | `lib/refund-setting.ts:3–29`; `app/api/user/payment/route.ts:17–105` | Format bounded dan OTP binding tetap dipertahankan. |
| RATE-01 policy | `proxy.ts:6–33`; `proxy.ts:74–86`; `lib/rate-limit.ts:37–117` | Policy path+method, universal+sensitive bucket, trusted IP, LRU bounded. |
| TURN-01 cancel/return | `components/order-cancel-button.tsx:16–42`; `components/return-form.tsx:20–38`; `components/return-form.tsx:96–154`; `app/api/orders/[number]/cancel/route.ts:14–39`; `app/api/orders/[number]/media/route.ts:9–48`; `app/api/orders/[number]/returns/route.ts:11–51` | Invisible widget dan action server yang exact untuk tiga tahap. |
| SEO-01 metadata | `app/layout.tsx:8–43`; `app/products/[slug]/page.tsx:15–39`; `app/robots.ts:4–23`; `app/sitemap.ts:5–26` | Canonical/OG/Twitter/robots/sitemap memakai copy/data produk yang ada. |
| HDR-01 HTTP hardening | `next.config.ts:3–29`; `next.config.ts:42–54` | CSP/headers global dan no-store API privat. |

## 5. Matriks kontrol API

| Kelompok | Autentikasi | Otorisasi objek | Rate limit | Turnstile/signature | Atomisitas utama |
|---|---|---|---|---|---|
| Admin CRUD | JWT admin | role owner | universal + mutation-specific | Origin | transaksi + audit untuk mutasi |
| Customer profile/address/refund | JWT customer + DB session lock | user ID | universal + route-specific | Turnstile + OTP untuk data sensitif | user row lock |
| Cart | JWT customer | user ID | cart-write | Origin | user row lock + transaksi |
| Checkout | JWT customer aktif + profil lengkap | user ID | checkout-specific | Turnstile | serializable reservation + payment intent |
| Payment status/sync | JWT customer/admin | ownership/admin | polling/sync-specific | Turnstile untuk manual sync | Payment lalu Order row lock |
| Cancellation/return | JWT customer/admin | ownership/admin | action-specific | Turnstile customer | Order row lock + idempotent movement |
| Shipment | JWT admin | admin | booking/sync-specific | Origin | Shipment lalu Order row lock |
| BSTN webhook | Tidak memakai browser session | reference + amount | webhook-specific | HMAC signature | inbox + Payment/Order locks |
| Biteship webhook | Tidak memakai browser session | provider order/tracking ID | webhook-specific | strong shared secret | inbox + Shipment/Order locks |
| Cron | Secret internal | n/a | cron-specific | constant-time shared secret | batch idempoten |
| Media privat | JWT owner/admin | order/return ownership | upload/read/delete-specific | Turnstile pada final workflow | path containment + file validation |

## 6. Risiko residual dan persyaratan produksi

1. **Rate limiter multi-instance.** Tanpa Redis/state bersama, limiter bersifat per proses. Jalankan satu instance atau gunakan sticky routing dan rate limiting tambahan pada reverse proxy/Cloudflare.
2. **Filesystem media lokal.** Storage lokal harus dipasang pada volume persisten dan tidak cocok untuk scale-out tanpa shared filesystem. Backup `storage/private` wajib terpisah dari public uploads.
3. **Atomicitas lintas provider.** Database dan provider eksternal tidak dapat menjadi satu transaksi ACID. Implementasi memakai idempotency key, local intent, inbox, retryable ambiguous state, dan compensation.
4. **CSP tanpa nonce.** Karena Next.js menghasilkan bootstrap inline dan arsitektur sekarang tidak memakai nonce middleware, `unsafe-inline` masih diperlukan untuk script/style. Host eksternal dibatasi ke Google dan Cloudflare.
5. **Secret rotation admin.** JWT admin stateless tidak memiliki server-side revocation per token. Rotasi `AUTH_SECRET` mencabut semua sesi admin; logout menghapus cookie lokal. Untuk personal store satu owner, ini diterima.
6. **Body limit edge.** Pemeriksaan `Content-Length` tidak menggantikan pembatasan body pada reverse proxy karena transfer chunked dapat tidak menyertakan header.
7. **Database production.** Build dan static analysis tidak menggantikan integration test terhadap salinan MySQL staging serta sandbox provider.
8. **Rekening refund di database.** Nomor rekening/e-wallet masih tersimpan plaintext sesuai schema lama; wajib lindungi akses database/backup dan gunakan encryption-at-rest. Field-level encryption dapat dipertimbangkan bila threat model meningkat.

## 7. Checklist deployment

- Set `APP_MODE=production` dan `ENABLE_DEVTOOLS=false`.
- Gunakan HTTPS dan isi `APP_URL_LIVE` dengan origin persis.
- Isi secret acak kuat: `AUTH_SECRET`, opsional `CUSTOMER_JWT_SECRET`, `WHATSAPP_OTP_SECRET`, `CRON_SECRET`, `BSTN_RETURN_SIGNATURE_SECRET`, dan `BITESHIP_WEBHOOK_SHARED_SECRET`.
- Gunakan `ADMIN_PASSWORD_SCRYPT`; jangan aktifkan hash SHA-256 legacy.
- Isi Turnstile production site/secret key dan hostname yang sama dengan `APP_URL_LIVE`.
- Set `RATE_LIMIT_TRUSTED_IP_HEADER` hanya jika reverse proxy benar-benar menghapus lalu menulis ulang header tersebut.
- Jalankan `prisma migrate deploy`, bukan `db push`, pada produksi.
- Konfigurasi cron dengan Bearer atau `x-cron-secret`; jangan menaruh secret pada query string.
- Pasang batas body request sekitar 6 MB pada reverse proxy.
- Persist dan backup `.env`, database MySQL, `storage/private`, dan `public/uploads/products`.
- Uji callback BSTN/Biteship, payment timeout, payment paid-after-cancel, shipment cancel race, dan restore backup sebelum go-live.

## 8. Hasil verifikasi final

Bagian ini diperbarui setelah implementasi:

| Pemeriksaan | Hasil |
|---|---|
| ESLint | Lulus, 0 error; 3 warning lama pada halaman invoice |
| TypeScript | Lulus tanpa error |
| Test | Lulus 48/48; 0 skip/todo/failure |
| Prisma validate | Lulus |
| npm audit production | Lulus, 0 vulnerability |
| Next production build | Lulus dengan Next.js 16.2.12; 59/59 unit static generation |
