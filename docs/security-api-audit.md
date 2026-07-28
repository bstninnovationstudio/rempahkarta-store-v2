# Audit keamanan, API, dan database REMPAHKARTA

Tanggal audit source: 28 Juli 2026 (Asia/Jakarta)

Dokumen ini mencatat kontrol yang terlihat pada source v1.3.0 dan keterbatasannya. Ini bukan laporan penetration test dan tidak mengklaim provider atau database production telah diuji. Inventaris route lengkap berada di `docs/system-map.md`.

## Ringkasan kontrol

| Area | Implementasi aktif | Dampak |
| --- | --- | --- |
| Session pelanggan | JWT HS256 ber-issuer/audience/subject/JTI/token-use/session ID, cookie HttpOnly/SameSite/Secure production, dan device lock MySQL | Token salah konteks atau session lama ditolak. |
| Login Google | RS256 remote JWK, issuer, audience, expiry, schema claim, dan `email_verified` | Credential tidak hanya di-decode; signature dan penerbit diverifikasi. |
| Session admin | Password scrypt bersalt + JWT terpisah dengan audience/role/token-use, cookie 12 jam | Password tidak disimpan sebagai fast hash di production dan token pelanggan tidak dapat dipakai sebagai token admin. |
| Mode operasional | APP_MODE=development / APP_MODE=production dengan dual API key (_DEV / _LIVE) | Menggabungkan kontrol mode aplikasi dan memisahkan credential development & live secara aman. |
| Ownership order | Session wajib; `userId` atau email terverifikasi untuk order legacy | Nomor order saja tidak mengungkap detail. Resource asing dijawab 404 pada endpoint ownership. |
| Onboarding | Completeness dihitung dari user/address/refund setting; gate page dan API checkout | User yang belum lengkap tidak dapat membuat order. |
| Input | Zod pada payload penting, limit array/string, server re-read harga/rate/stok | Mengurangi mass assignment dan manipulasi nilai client. |
| CSRF/origin | Exact Origin check terhadap `APP_URL` untuk seluruh mutasi API non-webhook | Cross-site dan sibling-subdomain request ditolak sebelum route handler. |
| Bot/abuse | Siteverify Turnstile pada aksi berbiaya/berisiko dan rate limit per IP | Menahan spam sederhana dan request provider berulang. |
| Webhook | Signature/secret, reference/amount verification, `WebhookInbox`, delivery dedupe | Replay tidak mengulang side effect bisnis. |
| Inventory | Transaksi, optimistic version, availability condition, movement dedupe | Mengurangi oversell dan double release/restock. |
| Media | MIME/signature/size validation; produk public, bukti di private storage; GET owner/admin no-store | Bukti sensitif tidak dapat diambil sebagai static public URL. |
| HTTP | HSTS production, DENY framing, nosniff, referrer policy, permissions policy, no powered-by | Baseline hardening browser dan pengurangan fingerprint. |
| Query | Pagination, bounded relation, stats query terpisah, index tambahan | Menghindari load seluruh transaksi pada list/dashboard. |

## Dependency posture

- Aplikasi: v1.3.0.
- Next.js/`eslint-config-next`: 16.2.12.
- Prisma dan `@prisma/client`: 6.19.3.
- Sharp: 0.35.0 (override produksi).
- PostCSS override: 8.5.19.
- `npm audit --omit=dev`: 0 vulnerability pada 28 Juli 2026.

Hasil ini adalah snapshot lockfile, bukan jaminan permanen. Jalankan audit ulang setelah setiap perubahan dependency dan catat command aktual di `docs/test-report.md`.

## Autentikasi dan otorisasi

### Pelanggan

Cookie `amk_user` berisi JWT tujuh hari. `customerFromRequest()` memverifikasi:

- algoritme HS256;
- issuer `rempahkarta-store`;
- audience `rempahkarta-customer`;
- `tokenUse=customer`;
- subject sama dengan `userId`;
- keberadaan `sessionId`;
- user masih ada dan `currentSessionId` masih sama di MySQL.

Login baru merotasi `currentSessionId`; logout mengosongkannya dengan update bersyarat. Implikasinya, hanya satu session pelanggan aktif pada satu waktu.

Page `/user/*`, checkout, detail order, pembayaran, pembatalan, upload bukti, dan retur meminta session. Endpoint order membandingkan `order.userId` dengan user aktif. Untuk order historis dengan `userId=null`, fallback hanya menerima email order yang sama dengan email akun Google terverifikasi.

Endpoint profil tidak menerima perubahan email; email tampil read-only di settings dan hanya dapat diperbarui dari klaim Google pada login berikutnya. Ini mencegah user mengganti email bebas untuk mengklaim order legacy milik pihak lain.

Field `accessTokenHash` masih ada untuk kompatibilitas data/schema lama, tetapi URL token tidak lagi memberi hak akses.

### Admin

Cookie `amk_admin` berisi JWT 12 jam dengan audience `rempahkarta-admin`, `tokenUse=admin`, dan role `owner`. Layout admin dan setiap API admin melakukan pemeriksaan independen. Login memakai limiter berlapis 20/client dan 5/account per 15 menit serta memerlukan Turnstile action `admin_login`.

Password admin production diverifikasi terhadap scrypt bersalt dengan parameter `N=16384`, `r=8`, `p=1`, key 64 byte, dan salt acak 16 byte. Encoding memiliki version slot untuk upgrade parameter. Buat nilai dengan:

```bash
read -s ADMIN_PASSWORD
printf '%s' "$ADMIN_PASSWORD" | npm run auth:hash-password
unset ADMIN_PASSWORD
```

Salin output ke `ADMIN_PASSWORD_SCRYPT`; jangan simpan plaintext. Format SHA-256 legacy hanya diterima di non-production dan production fail-closed bila scrypt tidak tersedia.

## Profile completeness dan checkout

`getProfileCompleteness()` membaca field minimum langsung dari database. Tidak ada boolean `isComplete` yang dapat tertinggal setelah data berubah. Kontrol dilakukan dua lapis:

- page checkout mengarahkan user yang belum lengkap ke settings;
- API create order mengembalikan 409 `PROFILE_INCOMPLETE` beserta section yang kurang.

Create order kemudian memverifikasi Turnstile, membaca ulang varian/inventory dari MySQL, meminta ulang tarif Biteship, dan mereservasi stok dalam transaksi. Nilai harga, berat, stok, dimensi, dan ongkir client bukan sumber kebenaran.

## Origin/CSRF boundary

`proxy.ts` memeriksa `POST`, `PUT`, `PATCH`, dan `DELETE` pada seluruh `/api/*` kecuali `/api/webhooks/*`:

- expected origin diambil dari origin `APP_URL` bila valid;
- production mengharuskan header `Origin` hadir dan sama persis;
- `APP_URL` production yang tidak valid menghasilkan 503;
- origin yang berbeda—termasuk sibling subdomain—menghasilkan 403;
- development tetap memeriksa exact match bila browser mengirim header Origin;
- webhook dikecualikan karena provider tidak memakai browser cookie dan route memverifikasi HMAC/shared secret.

Cookie SameSite Lax tetap menjadi defense-in-depth, bukan satu-satunya kontrol CSRF. Client/server deployment harus memakai `APP_URL` yang sama dengan origin browser sebenarnya.

## Rate limit

`proxy.ts` menerapkan fixed-window bucket per alamat client:

| Scope | Limit | Window |
| --- | ---: | ---: |
| Semua API non-webhook | 100 | 1 menit |
| Webhook provider | 1.000 | 1 menit |
| Login admin | 20/client + 5/account | 15 menit |
| Login Google | 10 | 1 menit |
| Buat order | 10 | 1 menit |
| Cari lokasi | 25 | 1 menit |
| Cek tarif | 25 | 1 menit |
| Sinkron payment pelanggan | 15 | 1 menit |
| Sinkron payment admin | 15 | 1 menit |
| Ubah profil | 20 | 1 menit |
| Tambah/edit/hapus alamat | 20 gabungan | 1 menit |
| Simpan rekening refund | 20 | 1 menit |
| Request/resend OTP WhatsApp | 6/user dan 10/IP | 15 menit |
| Sesi OTP baru persisten | 3/user dan 3/nomor | 1 jam |
| Ubah consent WhatsApp | 20 | 1 menit |
| Buat campaign promosi | 3 | 1 jam |
| Dispatch promosi | 120 batch | 15 menit |
| Tulis cart | 30 gabungan | 1 menit |
| Pembatalan order | 10 | 1 menit |
| Upload bukti retur | 10 | 1 menit |
| Mock payment development | 10 | 1 menit |
| Ajukan retur | 5 | 1 menit |
| Upload media admin | 20 | 1 menit |
| Booking shipment admin | 10 | 1 menit |
| Keputusan pembatalan admin | 20 | 1 menit |
| Keputusan retur admin | 20 | 1 menit |
| Penyelesaian refund admin | 10 | 1 menit |
| Polling status pembayaran | 60/customer | 1 menit |
| Sinkron shipment admin | 15 | 1 menit |
| Resolve issue order | 10 | 1 menit |
| Cron internal | 10/job | 1 menit |

Respons 429 mengandung code `RATE_LIMITED`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, dan `Retry-After`. Store dibatasi 10.000 bucket dan saat penuh mengeluarkan bucket dengan `lastSeen` tertua.

Identitas memakai header yang ditetapkan `RATE_LIMIT_TRUSTED_IP_HEADER` hanya bila nilainya salah satu `cf-connecting-ip`, `x-real-ip`, atau `x-forwarded-for`; nilai IP harus maksimum 64 karakter dan hanya berisi bentuk IPv4/IPv6. Tanpa konfigurasi valid, aplikasi sengaja tidak memercayai forwarded header apa pun dan seluruh request bergabung dalam bucket aman `unidentified`. Deployment yang mengaktifkan header tepercaya harus menolak akses langsung serta menghapus/menulis ulang header tersebut agar client tidak dapat memalsukan identitas.

## Turnstile

| Route/aksi | Expected action | Transport token |
| --- | --- | --- |
| Login admin | `admin_login` | JSON body |
| Cari lokasi | `location_search` | `X-Turnstile-Token` |
| Cek ongkir | `shipping_quotes` | JSON body |
| Buat order | `checkout_order` | JSON body |
| Simpan kontak | `user_profile` | JSON body |
| Tambah/edit/hapus alamat | `user_address` | JSON body |
| Simpan rekening refund | `user_payment` | JSON body |
| Request/resend OTP | `user_otp_send` | JSON body |
| Ubah consent WhatsApp | `user_notifications` | JSON body |
| Buat campaign promosi admin | `admin_promotion_send` | multipart form |
| Sinkron payment pelanggan | `payment_sync` | JSON body |
| Sinkron payment admin | `admin_payment_sync` | JSON body |
| Pembatalan order pelanggan | `order_cancel` | JSON body |
| Upload bukti retur | `return_media` | multipart field/header |
| Pengajuan retur | `return_request` | JSON body |

Siteverify dijalankan server-side dengan timeout delapan detik, IP client bila tersedia, dan idempotency key baru. Secret/test key fallback hanya tersedia di non-production. Token kosong, terlalu panjang, gagal verifikasi, action yang tidak exact, atau—di production—hostname yang berbeda dari `APP_URL` ditolak. Official test secret/site key juga ditolak di production.

## Webhook dan rekonsiliasi

BSTN:

- shared signature secret wajib minimal 16 karakter dan placeholder production ditolak;
- signature HMAC diverifikasi atas raw body;
- delivery ID atau hash body menjadi idempotency key;
- payment ID, project reference, dan amount dicocokkan;
- server memanggil GET BSTN sebelum menetapkan status final;
- `PaymentEvent` dan `WebhookInbox` menyimpan jejak event;
- terminal failure melepas reservasi dengan dedupe key.

Biteship:

- shared secret wajib minimal 16 karakter dan placeholder production ditolak;
- event operasional memerlukan configured shared secret melalui header atau Bearer;
- event disimpan/dideduplikasi dari event, provider order ID, dan hash payload;
- status, harga aktual, resi, inventory restoration, issue flag, dan audit diproses dalam transaksi;
- probe kosong/ping/test dibalas tanpa side effect untuk registrasi endpoint.
- outbound area/rate/re-rate/booking/tracking melewati gate shadow balance lokal; debit memakai row lock dan conditional decrement dalam transaksi `Serializable`;
- kegagalan provider membuat record reversal idempoten, sedangkan keberhasilan provider tidak dibalik hanya karena finalisasi lokal berikutnya gagal;
- record pemakaian otomatis tidak dapat diedit/dihapus melalui API admin; CRUD dibatasi ke top up/pengurangan manual dan seluruh perubahan mencatat `AuditLog`;
- saldo nol menutup request walaupun configured cost nol. Ini fail-closed dan memerlukan top up operasional setelah migration.

Bucket webhook dipisahkan dari limit API pengguna agar traffic provider tidak menghabiskan kuota checkout.

## Media lokal

- Produk disimpan di `public/uploads/products` karena memang harus dapat ditampilkan publik.
- Bukti retur disimpan di `storage/private/returns/{orderId}`; bukti refund admin di `storage/private/refunds/{returnId}`.
- Nama file harus cocok pola timestamp + UUID + ekstensi JPG/PNG/WebP dan tidak menerima path segment bebas.
- Upload memverifikasi MIME, magic bytes, dan ukuran maksimum 5 MB. Bukti privat juga memverifikasi owner/eligibility dan batas jumlah; form/service produk membatasi media terpakai maksimal 10.
- Path bukti yang disubmit diverifikasi prefix route, decoded filename, keberadaan file, dan relasi order/return.
- GET bukti hanya mengizinkan admin atau owner order, menjawab 404 untuk akses asing, serta mengirim `Cache-Control: private, no-store`, `Content-Disposition: inline`, dan `nosniff`.
- Bukti legacy dipindahkan melalui script dry-run/apply; original public dipindah ke backup recoverable setelah copy dan update DB berhasil.

## Pagination dan query

List publik/user/admin membatasi `pageSize` dan memakai `skip/take`. Stats dashboard terpisah dari list. Query list hanya mengambil relasi ringkas, sedangkan detail unik memuat histori yang dibutuhkan.

Index performa meliputi status/tanggal katalog/order, user/email + payment state + tanggal, fulfillment, issue flag, shipment/update, return/create, audit/create, dan relasi utama. Migration penambahan index tidak menjalankan seed atau mengubah row produk.

Offset pagination masih memiliki biaya pada page sangat dalam; input page dibatasi 100.000. Jika volume tumbuh jauh, route dengan urutan stabil dapat dipindah ke cursor pagination tanpa mengubah state machine transaksi.

## Cache katalog dan invalidation

Cache server storefront memiliki TTL 30 menit dan tag `storefront-catalog`. Invalidation dipanggil setelah:

- create/update produk dan varian;
- create/update/delete kategori atau assignment;
- adjustment inventory admin;
- reserve, commit, release, atau restock inventory pada lifecycle order.

Cache hanya menyimpan data katalog yang sudah dipetakan untuk storefront. User, cart, order, alamat, rekening, payment, dan PII tidak di-cache. Checkout tetap membaca database dan re-rate provider, sehingga cache tidak dapat mengotorisasi pembelian dengan harga/stok lama.

## Migration aman

Migration history dipisahkan menjadi:

1. `0_baseline`: DDL schema penuh untuk database baru.
2. migration additive berikutnya: index/query support, voucher, dan ledger keuangan tanpa seed.

Untuk database existing yang struktur tabel/kolom/constraint/relasinya sudah sesuai baseline:

```bash
npm run db:baseline:existing
npm run db:migrate
```

`db:baseline:existing` tidak boleh dipakai pada database kosong dan tidak boleh dilakukan sebelum schema lama dibandingkan dengan baseline. `npm run setup` tidak menjalankan seed. Migration finance melakukan backfill ledger dari state transaksi yang sudah tersimpan dan membuat akun Biteship lokal bersaldo nol; ia tidak menambah data demo. Seed/demo hanya eksplisit untuk database disposable.

Setelah migration schema, migrasikan bukti public legacy:

```bash
npm run migrate:private-media
npm run migrate:private-media -- --apply
```

Dry-run wajib ditinjau. Apply menyalin dengan pemeriksaan hash bila destination sudah ada, memperbarui DB per batch transaksi, lalu memindahkan original ke `storage/private-migration-backup`. Operasi filesystem dan DB tidak sepenuhnya atomik; backup dan verifikasi diperlukan. Refund tanpa `returnRequestId` dilewati dengan warning dan tetap menjadi pekerjaan manual.

## Risiko dan batasan tersisa

| Risiko | Dampak | Mitigasi sekarang / tindakan berikutnya |
| --- | --- | --- |
| Rate limiter in-memory per instance | Deployment multi-instance dapat melipatgandakan limit; restart mengosongkan bucket | Gunakan satu instance atau limit tambahan di CDN/reverse proxy. Redis sengaja tidak ditambahkan. |
| Next Data Cache tanpa backend shared yang dikonfigurasi aplikasi | Konsistensi/invalidation antar-instance bergantung pada adapter platform/deployment | Pada scale-out, validasi perilaku cache platform atau gunakan shared revalidation strategy/purge deployment-level. |
| Upload lokal | File hilang pada filesystem ephemeral atau berbeda antar-instance | Mount volume persisten untuk `public/uploads` dan `storage/private`, sticky routing bila perlu, backup bersama MySQL. Pertimbangkan object storage hanya bila arsitektur berubah. |
| GOWA tidak memiliki idempotency key pengiriman | Timeout dapat berarti pesan sudah terkirim walau respons tidak diterima | Catat `AMBIGUOUS`, jangan retry otomatis, simpan provider `message_id` pada sukses, dan dedupe enqueue berdasarkan source event. |
| Broadcast promosi berhenti saat browser admin ditutup | Recipient pending belum terkirim sampai campaign dilanjutkan | Snapshot/log tetap persisten; tombol lanjutkan memproses batch tiga penerima. Tidak ada worker terpisah sesuai arsitektur. |
| Consent dicabut setelah campaign dibuat | Snapshot lama dapat memuat user yang sudah opt-out | Dispatcher memeriksa status user, verifikasi nomor, dan consent ulang tepat sebelum kirim lalu menandai `SKIPPED`. |
| Rekening refund tersimpan plaintext di MySQL | Kebocoran backup/database mengekspos nomor rekening/e-wallet | Batasi akses DB dan backup, gunakan encryption-at-rest volume/database, audit akses; pertimbangkan field-level encryption bila threat model meningkat. |
| Validasi upload tanpa malware scanner/decode penuh | Magic bytes, MIME, dan ukuran menahan spoofing dasar tetapi bukan file berbahaya yang kompleks | Batasi body sekitar 6 MB di proxy, jangan eksekusi file, sajikan private/no-store; tambahkan image re-encode atau scanner jika menerima sumber berisiko tinggi. |
| Refund legacy tanpa `returnRequestId` | Script tidak dapat menentukan owner folder secara aman; bukti lama dapat tetap public | Review warning dry-run, perbaiki relasi secara manual, jalankan ulang, lalu verifikasi tidak ada path `/uploads/refunds/*` aktif. |
| Editor category replacement penuh | Daftar tidak dipaginasi; payload besar saat katalog besar | Tambahkan endpoint assign/unassign delta sebelum pagination. |
| Header IP proxy | Header dapat dipalsukan jika server dapat diakses langsung | Batasi origin ke proxy tepercaya dan overwrite header forwarding. |
| JWT admin tanpa server-side revocation | Logout hanya menghapus cookie; token curian valid sampai 12 jam | Jaga cookie/HTTPS, rotasi `AUTH_SECRET` saat insiden; pertimbangkan session version/revocation jika threat model naik. |
| CSP masih memerlukan `unsafe-inline` untuk bootstrap Next/style saat ini | XSS inline yang lolos validasi tetap memiliki dampak | Host script/frame/connect sudah dibatasi ke self, Google, dan Turnstile; migrasikan ke nonce bila arsitektur rendering diubah. |
| Order legacy via email | Akun Google terverifikasi dengan email yang sama dapat mengklaim order lama | Ini jalur migrasi terkontrol; backfill `userId` dan hapus fallback setelah seluruh order lama diklaim. |
| Biteship ping/test tanpa secret | Endpoint dapat menerima probe non-operasional | Tidak ada side effect/database write; monitor abuse dan batasi origin/provider jika kontrak Biteship memungkinkan. |
| Offset pagination | Page sangat dalam tetap mahal walau dibatasi | Pantau slow query; gunakan keyset/cursor pada tabel terbesar bila dibutuhkan. |
| API produk memaginasi snapshot cache | Cache miss tetap membaca seluruh katalog aktif beserta relasi sebelum hasil dipotong per page | Cocok untuk katalog UMKM dan traffic tinggi berulang; jika SKU tumbuh ribuan, pindahkan cache/query ke per-page atau cached ID set. |
| Tidak ada live DB/provider E2E pada audit source | Migration dan integrasi dapat gagal karena schema/data/credential deployment | Jalankan baseline rehearsal pada clone database, smoke test Google/Turnstile/BSTN/Biteship, dan rollback drill sebelum release. |
| Scheduler cron voucher belum dijadwalkan | Lazy evaluation tetap menolak voucher expired, tetapi status list dapat tertunda | Jadwalkan `GET`/`POST /api/cron/vouchers` setiap hari dengan `Authorization: Bearer $CRON_SECRET`; endpoint fail-closed bila secret kosong/salah. |
| Shadow balance Biteship tidak terhubung saldo provider | Perbedaan akibat biaya provider aktual atau koreksi cancellation tidak tersinkron otomatis | Rekonsiliasi berkala oleh admin melalui record manual; jangan menganggap saldo lokal sebagai bukti saldo provider. |
| Saldo awal Biteship nol | Pencarian area, quote, checkout re-rate, booking, dan tracking langsung fail-closed setelah deploy | Catat top up awal di `/admin/finance/biteship` sebelum membuka traffic operasional. |
| Refund tidak menyimpan alokasi produk/ongkir/service | Seluruh refund completed mengurangi settlement omzet tanpa membedakan komponennya | Ledger membatasi posisi minimal nol; tambahkan komponen refund bila bisnis kelak membutuhkan pelaporan per komponen. |

## Checklist release keamanan

- [ ] `APP_MODE=production`, `ENABLE_DEVTOOLS=false`, dan payment mock nonaktif.
- [ ] Devtools dan fixture/bypass demo hanya diaktifkan pada lokal/disposable dengan dua flag eksplisit.
- [ ] `AUTH_SECRET`/`CUSTOMER_JWT_SECRET` acak, berbeda, minimal 32 karakter.
- [ ] `ADMIN_PASSWORD_SCRYPT` dibuat dengan generator, salt unik, dan tidak ada password plaintext/SHA-256 legacy di production.
- [ ] `APP_URL` HTTPS dan origin tidak dapat diakses melewati proxy tepercaya.
- [ ] Turnstile memakai key domain production, bukan test key.
- [ ] Shared secret webhook BSTN/Biteship acak minimal 16 karakter dan tidak mengandung marker placeholder.
- [ ] `RATE_LIMIT_TRUSTED_IP_HEADER` cocok dengan header yang benar-benar ditulis ulang proxy; origin tidak dapat diakses langsung.
- [ ] Secret webhook BSTN/Biteship sudah dirotasi dan callback HTTPS.
- [ ] Baseline direhearsal pada clone database; backup dan restore telah diuji.
- [ ] `public/uploads` dan `storage/private` berada pada volume persisten; private storage tidak berada di web root dan keduanya tidak mengeksekusi script.
- [ ] Dry-run private-media bersih atau seluruh warning ditangani; apply diverifikasi sebelum backup migrasi dihapus manual.
- [ ] Alert/monitor tersedia untuk 401, 403, 409, 429, webhook failed, dan migration failure.
- [ ] Smoke test login, onboarding, checkout, payment, shipment, cancellation, return, dan refund dilakukan dengan akun/provider sandbox yang sah.
