# Laporan verifikasi REMPAHKARTA v1.3.0

Tanggal verifikasi: 19 Juli 2026 (Asia/Jakarta)

## Ringkasan hasil

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run lint` | Lulus, 0 error dan 0 warning. |
| `npm test` | Lulus, 21/21 test; tidak ada skip/todo/failure. |
| `npx tsc --noEmit --incremental false` | Lulus. |
| `DATABASE_URL='mysql://…' npx prisma validate` | Lulus terhadap schema MySQL; URL dummy hanya memenuhi parser dan tidak membuka koneksi. |
| `npm run build` | Lulus pada Next.js 16.2.10/Prisma 6.19.3; compile, TypeScript, page-data collection, dan 39/39 unit static generation selesai. |
| `npm audit --omit=dev` | Lulus, 0 vulnerability. |
| `node --check` untuk dua script operasional | Lulus untuk generator hash admin dan migrasi private media. |

Production build menghasilkan manifest lengkap untuk **34 page route** dan **50 API route**, termasuk dynamic route serta `proxy.ts`. Angka 39/39 pada output build adalah unit static-generation internal Next.js, bukan jumlah page aplikasi.

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

Test tidak memakai seed, tidak menulis produk, dan tidak tersambung ke database live.

## Verifikasi schema dan migration

- `prisma/schema.prisma` valid untuk provider MySQL dan memuat 25 model.
- `prisma/migrations/0_baseline/migration.sql` dibandingkan dengan DDL yang digenerate ulang dari schema aktif. Isi DDL cocok; perbedaan diff hanya satu baris kosong terminal.
- `prisma/migrations/202607190001_api_query_indexes/migration.sql` hanya menambah enam index query secara idempoten melalui pemeriksaan `information_schema`.
- Pencarian statement destructive/DML pada migration tidak menemukan `DROP`, `DELETE FROM`, `TRUNCATE`, `UPDATE`, `INSERT INTO`, atau `REPLACE INTO`.
- `npm run setup` hanya menjalankan generate + migrate deploy. Seed tetap merupakan aksi eksplisit development melalui `db:seed`/`setup:demo`.
- `scripts/migrate-private-media.mjs` dan `scripts/hash-admin-password.mjs` lolos pemeriksaan sintaks.

Migration **tidak dijalankan** karena lingkungan audit tidak memiliki clone MySQL/data production. Karena itu, keberhasilan DDL terhadap data existing, durasi pembuatan index, dan rollback operasional belum dibuktikan. Ikuti prosedur baseline, backup, rehearsal clone, dan dry-run media pada README sebelum production.

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

Audit source menutup temuan overlap yang terlihat dari grid/cascade, tetapi tidak dapat membuktikan pixel rendering untuk seluruh kombinasi font, browser, zoom, dan data production. Matriks smoke test visual yang masih harus dijalankan terdapat di `docs/ui-audit.md`.

## Yang sengaja tidak diklaim

Verifikasi ini tidak melakukan:

- koneksi atau migration pada MySQL production/clone;
- seed atau penulisan data produk;
- login Google sungguhan;
- Siteverify Turnstile live;
- create/get/cancel payment BSTN;
- quote/booking/tracking/cancel Biteship live;
- webhook/concurrency test dengan request paralel dan database nyata;
- HTTP browser E2E atau screenshot.

Sebelum release, jalankan smoke test pada deployment sandbox yang memiliki HTTPS, MySQL clone, persistent volume, Google, Turnstile, BSTN, dan Biteship. Uji khusus race payment/cancel, retry webhook, double-click booking shipment, pagination data besar, serta restore backup database/media.
