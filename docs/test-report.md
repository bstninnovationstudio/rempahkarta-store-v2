# Laporan verifikasi REMPAHKARTA v1.3.0

Tanggal verifikasi: 21 Juli 2026 (Asia/Jakarta)

## Ringkasan hasil

| Pemeriksaan | Hasil |
| --- | --- |
| `npx tsc --noEmit` | Lulus. |
| `npm run lint` | Lulus tanpa error; warning lama tersisa pada invoice dan payment client. |
| `npm test` | Lulus, 28/28 test; tidak ada skip/todo/failure. |
| `npm run build` | Tahap `prisma generate` tertahan `EPERM` karena DLL Prisma sedang dipakai dev server aktif. |
| `npx next build` | Lulus; compile, TypeScript, page-data collection, dan 48/48 unit static generation selesai. |
| `npx prisma validate` | Lulus. |
| `npm run db:migrate` | Lulus tanpa seed; migration finance diterapkan. |

Production build menghasilkan manifest lengkap untuk **37 page route** dan **62 API route file**, termasuk finance, voucher/cron, serta `proxy.ts`. Angka 48/48 pada output build adalah unit static-generation internal Next.js, bukan jumlah page aplikasi.

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
- Formula omzet bersih setelah diskon, posisi paid aktif sebagai held, perpindahan kembali karena issue/retur/cancellation, dan pembatasan refund agar saldo tidak negatif.

Test tidak memakai seed, tidak menulis produk, dan tidak tersambung ke database live.

## Verifikasi schema dan migration

- `prisma/schema.prisma` di-format dan divalidasi; schema kini memuat 30 model termasuk voucher dan tiga model ledger finance. Generate memperbarui type client tetapi penggantian DLL engine tidak dapat diselesaikan saat dev server Windows masih aktif.
- `prisma/migrations/0_baseline/migration.sql` dibandingkan dengan DDL yang digenerate ulang dari schema aktif. Isi DDL cocok; perbedaan diff hanya satu baris kosong terminal.
- `prisma/migrations/202607190001_api_query_indexes/migration.sql` hanya menambah enam index query secara idempoten melalui pemeriksaan `information_schema`.
- Migration `202607210002_add_vouchers` menambah enum/model voucher serta snapshot order secara additive; tidak menjalankan seed atau memodifikasi row order yang ada.
- Migration `202607210003_add_financial_ledgers` menambah `RevenueLedger`, `BiteshipFundAccount`, dan `BiteshipLedger`, melakukan backfill posisi order lama, serta membuat saldo shadow Biteship awal nol tanpa seed.
- `npm run setup` hanya menjalankan generate + migrate deploy. Seed tetap merupakan aksi eksplisit development melalui `db:seed`/`setup:demo`.
- `scripts/migrate-private-media.mjs` dan `scripts/hash-admin-password.mjs` lolos pemeriksaan sintaks.

`npm run db:migrate` dijalankan tanpa seed dan berhasil menerapkan `202607210003_add_financial_ledgers` pada database yang dikonfigurasi. Verifikasi read-only setelah migration menemukan 7 order ter-backfill: saldo available Rp121.000, held Rp398.000, dan saldo Biteship Rp0. `npx next build` lulus. Wrapper `npm run build` berhenti sebelum Next build pada `prisma generate` dengan `EPERM` karena tiga proses dev server aktif mengunci query engine; proses tersebut sengaja tidak dihentikan.

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
