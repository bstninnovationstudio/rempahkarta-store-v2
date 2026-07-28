# Laporan verifikasi REMPAHKARTA v1.3.0

Tanggal verifikasi terakhir: 28 Juli 2026 (Asia/Jakarta)

## Verifikasi tambahan integrasi WhatsApp GOWA

Audit dan implementasi WhatsApp pada 27 Juli 2026 telah diverifikasi dengan hasil:

| Pemeriksaan | Hasil |
| --- | --- |
| `npx prisma validate` | Lulus setelah penambahan challenge OTP, consent, outbox pesan, dan campaign promosi. |
| `npx prisma generate` | Lulus menggunakan Prisma 6.19.3. |
| `npx tsc --noEmit` | Lulus tanpa error TypeScript. |
| `npm run lint` | Lulus tanpa error; tersisa tiga warning lama berupa variabel tidak terpakai pada halaman invoice. |
| `npm test` | Lulus, 48/48 test; tidak ada skip/todo/failure. |
| `npm run build` | Lulus dengan Next.js 16.2.12; seluruh 59 unit page/static generation selesai. |
| `npm audit --omit=dev` | Lulus, 0 vulnerability; `sharp` 0.35.0 dipakai oleh Next. |

Test tambahan mencakup normalisasi nomor WhatsApp Indonesia/internasional, footer pesan otomatis yang tidak digandakan, multipart pengiriman gambar, parameter keamanan OTP, pemisahan konteks HMAC, binding OTP terhadap payload rekening refund, serta konsistensi copy event perjalanan paket.

Production build memuat route OTP, preferensi notifikasi, campaign promosi, media privat, metadata robots/sitemap, serta hardening cron/payment/shipment.

Migration `202607270002_add_gowa_whatsapp_verification` dan `202607270003_add_whatsapp_consents_and_promotions` telah divalidasi dari schema dan build, tetapi **belum diterapkan ke database `.env` aktif** pada sesi verifikasi ini. Penerapan harus dilakukan secara eksplisit melalui `npm run setup`/`npm run db:migrate` pada target yang sudah dipastikan dan dicadangkan; tidak ada seed atau `db push` yang dijalankan.

## Ringkasan hasil

| Pemeriksaan | Hasil |
| --- | --- |
| `npx tsc --noEmit` | Lulus. |
| `npm run lint` | Lulus tanpa error; tersisa tiga warning lama berupa variabel tidak terpakai pada halaman invoice. |
| `npm test` | Lulus, 49/49 test; tidak ada skip/todo/failure. |
| `npm run build` | Lulus dengan Next.js 16.2.12; Prisma generate, compile, TypeScript, page-data collection, dan 59/59 unit static generation selesai. |
| `npx prisma validate` | Lulus. |
| `npm audit --omit=dev` | Lulus, 0 vulnerability. |

Production source memuat **41 page route file** dan **79 API route file**, ditambah `robots.ts`, `sitemap.ts`, serta `proxy.ts`. Angka 59/59 pada output build adalah unit static-generation internal Next.js, bukan jumlah page aplikasi.

## Cakupan test otomatis

Test saat ini memeriksa:

- normalisasi status dan mapping rate Biteship;
- duplicate `reference_id` hanya direkonsiliasi untuk error resmi `40002060`, sedangkan HTTP 400 lain tetap gagal;
- allowlist transisi fulfillment;
- token acak, SHA-256, HMAC, dan constant-time comparison;
- validasi produk tanpa varian, dua tingkat varian, kombinasi duplikat, dan dimensi paket;
- pagination yang membatasi input dan metadata next/previous;
- fixed-window in-memory rate limiter, header, block, dan reset;
- hash password admin scrypt bersalt;
- safe internal redirect;
- paid provider yang datang setelah pembatalan lokal tetap authoritative;
- Turnstile Siteverify berhasil, action mismatch, dan respons tanpa action ditolak.
- Pemetaan voucher ke line item BSTN non-negatif, termasuk target ongkir dan nominal total yang tetap tepat.
- Formula omzet produk setelah diskon + ongkir + kode unik − refund, pemisahan kode unik dari `feeAmount` BSTN, posisi paid aktif sebagai held, perpindahan kembali karena issue/retur/cancellation, dan pembatasan refund agar saldo tidak negatif.

Test tidak memakai seed, tidak menulis produk, dan tidak tersambung ke database live.

## Verifikasi schema dan migration

- `prisma/schema.prisma` divalidasi; schema memuat snapshot `Payment.uniqueCode`, `RevenueLedger.productSubtotal`, dan `RevenueLedger.uniqueCode`. Prisma Client berhasil digenerate setelah dev server dihentikan sementara lalu dijalankan kembali.
- `prisma/migrations/0_baseline/migration.sql` dibandingkan dengan DDL yang digenerate ulang dari schema aktif. Isi DDL cocok; perbedaan diff hanya satu baris kosong terminal.
- `prisma/migrations/202607190001_api_query_indexes/migration.sql` hanya menambah enam index query secara idempoten melalui pemeriksaan `information_schema`.
- Migration `202607210002_add_vouchers` menambah enum/model voucher serta snapshot order secara additive; tidak menjalankan seed atau memodifikasi row order yang ada.
- Migration `202607210003_add_financial_ledgers` menambah `RevenueLedger`, `BiteshipFundAccount`, dan `BiteshipLedger`, melakukan backfill posisi order lama, serta membuat saldo shadow Biteship awal nol tanpa seed.
- Migration `202607220003_standardize_unique_code_revenue` menambah snapshot unique code/subtotal dan merekonsiliasi saldo historis secara delta; `202607220004_correct_qris_fee_snapshot` memisahkan kode unik dari snapshot fee QRIS tanpa mengubah saldo.
- `npm run setup` hanya menjalankan generate + migrate deploy. Seed tetap merupakan aksi eksplisit development melalui `db:seed`/`setup:demo`.
- `scripts/migrate-private-media.mjs` dan `scripts/hash-admin-password.mjs` lolos pemeriksaan sintaks.

`npm run db:migrate` dijalankan tanpa seed dan berhasil menerapkan migration rekonsiliasi settlement, standardisasi kode unik, dan koreksi snapshot fee QRIS pada database `.env` aktif. Verifikasi read-only atas contoh Rp117.230 + ongkir Rp14.000 − diskon Rp14.000 menemukan `payableAmount` Rp118.569, `uniqueCode` Rp9, dan omzet kanonis Rp117.239 ketika pembayaran menjadi state penerimaan dana. `npm run build` lulus setelah dev server dihentikan sementara dan diaktifkan kembali.

## Verifikasi UI berbasis source

Sesuai arahan pekerjaan, aplikasi tidak dijalankan untuk mengambil screenshot halaman login/database. Audit UI dilakukan dari page, component, state render, dan cascade CSS, lalu diverifikasi melalui lint, TypeScript, serta production build.

Pemeriksaan akhir mencakup:

- shell akun desktop, tablet, mobile dan breakpoint 1060/920/760/420 px;
- settings universal untuk kontak, alamat, dan rekening refund;
- progress/completion state serta redirect onboarding;
- statistik dashboard dan tiga order terbaru;
- riwayat order 10/page dengan status payment/fulfillment aktual;
- wrapping nilai/status panjang, target sentuh minimum 44 px, dan canvas dasar putih;
- drawer focus trap/Escape/restore/inert, dropdown akun, `aria-pressed`, focus form alamat, dan feedback login;
- storefront search, filter/empty state, serta tipografi informasi penting minimum 11 px.
- halaman finance omzet/Biteship, responsive two-column-to-single-column, konfirmasi penarikan, tabel overflow lokal, dan pembatasan aksi pada record otomatis.

Audit source menutup temuan overlap yang terlihat dari grid/cascade, tetapi tidak dapat membuktikan pixel rendering untuk seluruh kombinasi font, browser, zoom, dan data production. Matriks smoke test visual yang masih harus dijalankan terdapat di `docs/ui-audit.md`.

## Yang sengaja tidak diklaim

Verifikasi ini tidak melakukan:

- penentuan apakah database terkonfigurasi merupakan clone/staging/production; migration memang dijalankan pada target `.env` aktif;
- seed atau penulisan data produk;
- login Google sungguhan;
- Siteverify Turnstile live;
- create/get/cancel payment BSTN;
- quote/booking/tracking/cancel Biteship live;
- webhook/provider live dan concurrency test dengan request paralel;
- HTTP browser E2E atau screenshot.

Sebelum release, jalankan smoke test pada deployment sandbox yang memiliki HTTPS, MySQL clone, persistent volume, Google, Turnstile, BSTN, dan Biteship. Uji khusus race payment/cancel, retry webhook, double-click booking shipment, pagination data besar, serta restore backup database/media.
