# AMK Store / REMPAHKARTA v1.3.0

Toko online D2C single-brand berbasis Next.js, Prisma, dan MySQL. Versi 1.3.0 mewajibkan pelanggan masuk dengan Google, melengkapi data akun, lalu checkout dengan identitas yang terikat ke session. Panel admin tetap mempertahankan flow transaksi yang ada, tetapi daftar besar, statistik, autentikasi, rate limit, dan akses detail pesanan telah dipisahkan dengan batas yang lebih aman untuk produksi.

Dokumentasi aktif:

- `DESIGN.md`: kontrak visual, responsivitas, dan aksesibilitas.
- `docs/system-map.md`: peta lengkap 34 page route, 50 API route, model, dan modul.
- `docs/architecture.md`: boundary aplikasi, query, cache, dan state flow.
- `docs/security-api-audit.md`: kontrol keamanan/API, batas operasional, dan risiko tersisa.
- `docs/ui-audit.md`: audit UI berbasis source; bukan hasil screenshot atau runtime database.
- `docs/test-report.md`: hasil verifikasi terakhir yang benar-benar dijalankan.

`task.md` dan `walkthrough.md` adalah catatan historis pekerjaan lama, bukan spesifikasi sistem aktif.

### Status relevansi dokumen

| Dokumen/folder | Status | Cara menggunakan |
| --- | --- | --- |
| `README.md`, `DESIGN.md`, `AGENTS.md` | Aktif | Entry point produk, kontrak UI, dan invariant implementasi. |
| `docs/system-map.md`, `docs/architecture.md`, `docs/security-api-audit.md`, `docs/ui-audit.md` | Aktif v1.3.0 | Peta source dan audit kondisi saat ini; wajib diperbarui saat route/contract berubah. |
| `docs/test-report.md` | Laporan bertanggal | Hanya hasil command yang benar-benar dijalankan; bukan janji bahwa provider/live DB selalu sehat. |
| `docs/bstn-api-docs/` | Referensi provider | Masih relevan untuk subset payment yang dipakai adapter, tetapi merupakan snapshot; verifikasi terhadap provider sebelum release. |
| `Printable-Thermal-Shipping-Label-A6/` | Referensi komponen | Contoh sumber. Implementasi aktif berada di `components/shipping-label.*` dan route resi admin. |
| `task.md`, `walkthrough.md` | Arsip historis | Konteks perubahan lama; tidak boleh menjadi acuan migration, keamanan, atau route aktif. |

## Arsitektur singkat

- Next.js 16.2.10 App Router + React 19.2.6 + TypeScript menjalankan storefront, akun pelanggan, admin, API, dan webhook dalam satu aplikasi.
- Prisma/client 6.19.3 + MySQL 8 menyimpan katalog, stok, akun, pesanan, pembayaran, pengiriman, retur, audit, dan idempotency webhook.
- Google Identity dipakai untuk login pelanggan; aplikasi menerbitkan JWT session pelanggan sendiri setelah ID token Google diverifikasi.
- Admin memakai kredensial server dan JWT admin terpisah.
- BSTN menyediakan Dynamic QRIS; Biteship menyediakan area, tarif, booking, tracking, dan pembatalan pengiriman.
- Cloudflare Turnstile divalidasi server-side pada aksi berisiko.
- Rate limiter berjalan di memori proses; katalog memakai Next.js server Data Cache. Tidak ada Redis, queue, atau worker, sehingga tidak ada shared cache/limiter eksternal yang dikonfigurasi aplikasi.
- Media produk publik disimpan di `public/uploads/products`; bukti retur/refund disimpan privat di `storage/private` dan hanya disajikan lewat API owner/admin dengan `private, no-store`. Keduanya harus persisten dan dibackup bersama MySQL.

## Persyaratan

- Node.js 20.9 atau lebih baru.
- npm.
- MySQL 8 atau MariaDB yang kompatibel dengan Prisma MySQL.
- HTTPS, volume persisten untuk `public/uploads` serta `storage/private`, dan reverse proxy yang meneruskan IP client secara tepercaya untuk production.

## Instalasi baru

```bash
npm ci
cp .env.example .env
# isi DATABASE_URL, secret auth, Google, Turnstile, BSTN, Biteship, dan gudang
# gunakan output berbeda
openssl rand -base64 48 # salin ke AUTH_SECRET
openssl rand -base64 48 # salin ke CUSTOMER_JWT_SECRET
read -s ADMIN_PASSWORD
printf '%s' "$ADMIN_PASSWORD" | npm run auth:hash-password
unset ADMIN_PASSWORD
# salin output ke ADMIN_PASSWORD_SCRYPT
npm run setup
npm run dev
```

`npm run setup` hanya menjalankan Prisma generate dan migration deploy. Perintah ini **tidak menjalankan seed** dan tidak menimpa produk yang sudah ada.

Data demo hanya untuk database lokal/disposable:

```bash
DEMO_MODE=true ALLOW_INSECURE_DEMO=true npm run setup:demo
```

Jangan menjalankan `setup:demo`, `db:seed`, atau `prisma db push` pada database berisi data nyata. Mode demo dilarang pada preview/staging yang dapat diakses publik.

### Database yang sudah berisi data sebelum migration history

1. Backup dump MySQL, `public/uploads`, dan `storage/private`.
2. Pastikan tabel, kolom, constraint, dan relasi database lama sesuai dengan schema baseline. Index query tambahan boleh belum ada karena migration berikutnya idempoten.
3. Hanya pada database lama tersebut, tandai baseline tanpa menjalankan ulang DDL:

   ```bash
   npm run db:baseline:existing
   ```

4. Terapkan migration tambahan secara berurutan:

   ```bash
   npm run db:migrate
   ```

Database baru cukup memakai `npm run setup`; Prisma akan menjalankan baseline dan migration tambahan. Jangan menjalankan `db:baseline:existing` pada database kosong. Migration query berikutnya menambahkan enam index secara additive/idempoten (`Product.status+updatedAt`, kombinasi order user/email+payment+date, serta `createdAt` untuk Order/User/AuditLog) dan tidak menyentuh row produk.

### Migrasi bukti legacy ke private storage

Jika database lama masih menyimpan path `/uploads/returns/*` atau `/uploads/refunds/*`, jalankan **setelah** migration schema dan setelah backup database/folder media:

```bash
# dry-run: hanya membaca DB/filesystem dan menampilkan rencana + warning
npm run migrate:private-media

# sesudah jumlah dan warning ditinjau
npm run migrate:private-media -- --apply
```

Mode apply menyalin dan memverifikasi file ke `storage/private`, memperbarui path DB ke API owner/admin, lalu memindahkan original public ke `storage/private-migration-backup` yang dapat dipulihkan. Script tidak menjalankan seed dan tidak menghapus permanen. Refund legacy tanpa `returnRequestId` sengaja dilewati dan diberi warning agar relasi tidak ditebak; selesaikan record tersebut secara manual sebelum menganggap seluruh bukti privat. Pertahankan backup sampai file, path DB, dan akses owner/admin selesai diverifikasi.

Build server:

```bash
npm run build
npm start
```

Panel admin tersedia di `/admin-login`.

## Environment

| Variabel | Fungsi |
| --- | --- |
| `APP_MODE` | Mode aplikasi (`development` atau `production`). Aplikasi secara otomatis memilih URL dan API key yang sesuai. |
| `APP_URL_DEV`, `APP_URL_LIVE` | Origin publik callback/provider. Mode production menggunakan `APP_URL_LIVE` (wajib HTTPS). Mode development menggunakan `APP_URL_DEV`. |
| `DATABASE_URL` | Koneksi MySQL runtime dan migration. |
| `AUTH_SECRET` | Secret JWT admin minimal 32 karakter; buat dengan `openssl rand -base64 48`. Placeholder production ditolak. |
| `CUSTOMER_JWT_SECRET` | Secret JWT pelanggan terpisah; buat output acak berbeda dengan command yang sama. Bila kosong fallback ke `AUTH_SECRET`, tetapi secret terpisah disarankan. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_SCRYPT` | Kredensial admin production. Hash scrypt bersalt dibuat melalui stdin dengan prosedur instalasi di atas; password harus 12–256 karakter. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Audience Google ID token. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Widget client dan Siteverify server. |
| `BSTN_BASE_URL`, `BSTN_PROJECT_API_KEY_DEV`, `BSTN_PROJECT_API_KEY_LIVE`, `BSTN_RETURN_SIGNATURE_SECRET` | Dynamic QRIS, verifikasi webhook, dan rekonsiliasi pembayaran (dual key untuk DEV & LIVE). |
| `BITESHIP_BASE_URL`, `BITESHIP_API_KEY_DEV`, `BITESHIP_API_KEY_LIVE`, `BITESHIP_WEBHOOK_SHARED_SECRET` | Area, tarif, shipment, tracking, pembatalan, dan autentikasi webhook (dual key untuk DEV & LIVE). |
| `ENABLED_COURIERS` | Kode kurir yang boleh ditawarkan, dipisahkan koma. |
| `WAREHOUSE_*` | Origin/pickup dan Area ID gudang. |
| `RATE_LIMIT_TRUSTED_IP_HEADER` | Header IP yang sudah dihapus/ditulis ulang oleh reverse proxy tepercaya; hanya `cf-connecting-ip`, `x-real-ip`, atau `x-forwarded-for`. |

`.env.example` sengaja memakai placeholder secret yang gagal validasi dan test key resmi Turnstile untuk localhost. Ganti seluruhnya; production (APP_MODE=production) menolak marker contoh, shared webhook secret di bawah 16 karakter, test key Turnstile, action/hostname yang tidak cocok, atau JWT secret di bawah 32 karakter. Jangan masukkan `.env`, credential, dump database, atau media pelanggan ke Git/arsip distribusi.

`ADMIN_PASSWORD_HASH` SHA-256 hanya didukung sebagai kompatibilitas development dan ditolak di production. Jangan memasukkan `ADMIN_PASSWORD` plaintext ke `.env`; variabel itu hanya input sementara saat menjalankan generator hash.

Versi Next, Prisma/client, dan eslint-config-next dikunci ke patch yang diaudit; override PostCSS dikunci ke 8.5.19. Pada snapshot 19 Juli 2026, `npm audit --omit=dev` melaporkan 0 vulnerability. Jalankan ulang audit setiap perubahan lockfile.

## Login, onboarding, dan hak akses pelanggan

1. Google ID token diverifikasi terhadap JWK Google, algoritme RS256, issuer, audience, masa berlaku, dan `email_verified`.
2. Aplikasi membuat JWT pelanggan selama 7 hari di cookie HttpOnly, Secure pada production, SameSite Lax. JWT memiliki issuer, audience, subject, `jti`, `tokenUse`, dan `sessionId`.
3. `currentSessionId` pada user menjadi device/session lock. Login baru mengganti session aktif sebelumnya.
4. Pelanggan yang belum lengkap diarahkan ke `/user/settings?onboarding=1`.
5. Akun dianggap lengkap bila memiliki nama, email, nomor telepon, minimal satu alamat, serta satu rekening refund bank atau e-wallet yang valid.
6. Halaman checkout dan `POST /api/checkout/orders` sama-sama menolak pembuatan pesanan bila profil belum lengkap.
7. Detail, pembayaran, pembatalan, media, dan retur pesanan hanya dapat diakses setelah login dan pemeriksaan ownership. Pesanan historis tanpa `userId` hanya diklaim oleh akun terverifikasi dengan email yang sama; nomor order saja tidak memberi akses.

Semua mutasi API non-webhook (`POST`/`PUT`/`PATCH`/`DELETE`) juga harus memiliki header `Origin` yang sama persis dengan origin `APP_URL`. Production fail-closed bila origin hilang/tidak cocok atau `APP_URL` tidak valid. Webhook provider dikecualikan karena memakai signature/secret sendiri.

Halaman `/user/settings` menyatukan kontak, alamat, dan rekening refund. Route lama `/user/addresses` dan `/user/payment` tetap ada sebagai redirect kompatibilitas.

## Query, pagination, statistik, dan cache

- Endpoint list menerima `page` dan `pageSize`, mengembalikan metadata `total`, `totalPages`, `hasPrevious`, dan `hasNext`.
- Produk publik: default 12, maksimum 48 per halaman.
- Pesanan pelanggan: default 10, maksimum 50 per API; UI riwayat memakai 10 per halaman.
- List admin API: default 20, maksimum 100; page admin membatasi maksimum 50.
- Detail pelanggan admin memakai 10 pesanan per halaman.
- Statistik dashboard dipisahkan dari list: `/api/user/dashboard/stats` dan `/api/admin/dashboard/stats` memakai `count`, `aggregate`, atau `groupBy`, bukan memuat seluruh transaksi.
- Dashboard hanya mengambil item terbaru yang dibutuhkan: tiga pesanan pelanggan dan empat pesanan admin.
- Katalog storefront memakai server cache 30 menit dengan tag `storefront-catalog`. Mutasi katalog, kategori, inventori, dan lifecycle stok menginvalidasi tag. Checkout tetap membaca harga dan ketersediaan langsung dari MySQL, sehingga cache tidak menjadi sumber kebenaran transaksi.

`/admin/categories/[id]` adalah pengecualian yang disengaja: editor assignment memuat daftar produk penuh karena payload saat ini mengganti seluruh `selectedProductIds`. Endpoint delta assignment diperlukan sebelum layar ini aman dipaginasi.

## Rate limit sederhana

Semua `/api/*` dibatasi 100 request/menit per identitas IP. Webhook provider memakai bucket terpisah 1.000/menit. Route mahal memiliki batas tambahan:

| Aksi | Batas |
| --- | ---: |
| Login admin | 5 / 15 menit |
| Login Google | 10 / menit |
| Buat pesanan | 10 / menit |
| Cari lokasi / cek ongkir | masing-masing 25 / menit |
| Sinkronisasi pembayaran user/admin | masing-masing 15 / menit |
| Simpan profil, alamat, rekening refund | masing-masing 20 / menit |
| Tulis cart | 30 / menit |
| Pembatalan pesanan / upload bukti | masing-masing 10 / menit |
| Pengajuan retur | 5 / menit |
| Upload media admin / keputusan retur admin | masing-masing 20 / menit |
| Booking shipment admin | 10 / menit |
| Keputusan pembatalan admin | 20 / menit |
| Penyelesaian refund admin | 10 / menit |

Limiter memakai fixed window, maksimal 10.000 bucket, dan header `X-RateLimit-*`/`Retry-After`. Forwarded IP hanya dipercaya bila `RATE_LIMIT_TRUSTED_IP_HEADER` diatur eksplisit; tanpa itu request memakai bucket aman bersama `unidentified`. Karena state limiter berada di memori proses, batas berlaku per instance dan reset saat restart. Gunakan satu instance atau tambahkan limit di reverse proxy/CDN bila deployment horizontal membutuhkan batas global.

## Turnstile

Siteverify server wajib untuk aksi berikut:

- login admin: `admin_login`;
- pencarian lokasi: `location_search`;
- cek ongkir: `shipping_quotes`;
- membuat pesanan: `checkout_order`;
- simpan kontak: `user_profile`;
- tambah/edit/hapus alamat: `user_address`;
- simpan rekening refund: `user_payment`;
- sinkronisasi pembayaran pelanggan: `payment_sync`;
- sinkronisasi pembayaran admin: `admin_payment_sync`.

Token dibatasi 2.048 karakter, diverifikasi dengan IP bila tersedia, menggunakan idempotency key, dan action wajib sama persis. Pada production, hostname hasil Siteverify juga wajib sama dengan hostname `APP_URL` dan official test key ditolak. Kegagalan Siteverify bersifat fail-closed.

## Produk, varian, dan stok

- Produk boleh tanpa kategori dan maksimal memiliki satu kategori.
- Produk tanpa varian tetap memiliki satu `ProductVariant` aktif; produk bervarian mendukung maksimal dua tingkat opsi.
- Varian lama dinonaktifkan, bukan dihapus, agar snapshot/order historis tetap aman.
- Maksimal 10 gambar JPG/PNG/WebP, masing-masing 5 MB.
- Harga, dimensi, berat, status produk, dan stok checkout selalu dibaca ulang dari database.
- Ketersediaan adalah `onHand - reserved - safetyStock`.
- Reservasi checkout memakai optimistic lock `version` dan transaksi MySQL.
- `packed` mengubah reservasi menjadi pengurangan stok fisik. Release, commit, dan restock memakai `InventoryMovement.dedupeKey` agar idempoten.

## Payment, fulfillment, retur

```text
awaiting_payment → awaiting_processing → processing → packed
→ shipment_booked → handover_pending → handed_over → completed
```

- Redirect browser tidak pernah menjadi bukti pembayaran. Status final berasal dari webhook BSTN yang valid atau GET server-to-server.
- Webhook BSTN memverifikasi HMAC raw body, delivery ID, payment ID, reference, dan amount, lalu membaca ulang detail provider.
- Webhook Biteship memproses status, perubahan harga, dan perubahan waybill secara idempoten.
- Payment terminal gagal melepas reservasi satu kali. Paid setelah order dibatalkan menjadi `refund_pending`.
- Cancel sebelum handover dapat mengembalikan stok; setelah handover pelanggan memakai alur retur.
- Refund tetap manual dan membutuhkan rekening pelanggan, bukti, serta referensi admin.
- Flow transaksi/admin yang ada tidak diganti; peningkatan difokuskan pada batas query, autentikasi, validasi, dan presentasi.

## Webhook

- BSTN: `POST /api/webhooks/bstn`, HMAC `X-BSTN-Signature`, deduplikasi `X-BSTN-Delivery-Id`.
- Biteship: `POST /api/webhooks/biteship`, secret melalui `X-Webhook-Secret` atau Bearer.
- Aktifkan event Biteship `order.status`, `order.price`, dan `order.waybill_id`.
- Gunakan HTTPS. Event disimpan di `WebhookInbox`; delivery yang sudah selesai dijawab sukses tanpa side effect ulang, sedangkan delivery pending/failed dapat diproses ulang secara aman.

## Verifikasi dan operasi

```bash
npm run lint
npm test
npx tsc --noEmit
npx prisma validate
npm run build
```

Jangan menyimpulkan flow database/provider sudah tervalidasi hanya dari build. Hasil aktual dan batas lingkungan dicatat di `docs/test-report.md`.

Checklist production:

- backup dan uji restore dump MySQL + `public/uploads` + `storage/private`;
- pakai HTTPS dan secret acak minimal 32 karakter;
- pastikan `DEMO_MODE=false`, `ALLOW_INSECURE_DEMO=false`, dan payment mock nonaktif; jangan aktifkan demo pada preview/staging publik;
- gunakan volume upload persisten dan batasi body reverse proxy sekitar 6 MB;
- teruskan hanya header IP dari proxy/CDN tepercaya;
- pantau 401/403/409/429, kegagalan webhook, dan status migration;
- lakukan smoke test dengan MySQL, Google, Turnstile, BSTN, dan Biteship pada jaringan deployment.
