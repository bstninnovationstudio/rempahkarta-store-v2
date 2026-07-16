# Laporan pengujian v1.2.0

Tanggal audit terakhir: 16 Juli 2026 (Asia/Jakarta)

## Hasil otomatis

- TypeScript strict: lulus.
- ESLint: lulus.
- Unit/domain test: 13/13 lulus.
- Production build Next.js: lulus. Sebanyak 31 halaman statis dihasilkan dan seluruh halaman dinamis serta route API terkompilasi.

ESLint selesai dengan exit code 0. Warning lama yang tidak menghambat build masih tercatat pada import/parameter tidak terpakai dan penggunaan elemen `img` untuk avatar serta preview lokal. Perubahan UI tidak menurunkan aturan lint.

Cakupan test:

- normalisasi status Biteship camelCase/snake_case;
- mapping field rate resmi `type` ke `courier_type`;
- pemulihan duplicate `reference_id` Biteship;
- transisi fulfillment;
- random order token, SHA-256, dan constant-time signature compare;
- schema produk tanpa varian, varian dua tingkat, kombinasi duplikat, dan dimensi paket parsial;
- mapping status pengiriman hingga completed/cancelled;
- Turnstile Siteverify success dan action mismatch.

## HTTP smoke test

Mode development dan demo, dijalankan melalui `npm run dev -- --hostname 127.0.0.1`:

- `/`: 200.
- `/products/kayu-manis-premium`: 200.
- `/checkout?variant=...`: 200.
- `/admin/products`: 200.
- `/admin/categories`: 200.
- `GET /api/locations/search` dengan Turnstile test token: lulus dan area Sentolo 55664 ditemukan.
- `POST /api/checkout/quotes` dengan Turnstile test token: lulus dan tiga rate JNE diterima.
- `POST /api/checkout/orders` mode demo/mock: JSON valid dan URL halaman pesanan dikembalikan.

Smoke test UI putaran kedua pada 16 Juli 2026 memakai production server dengan `DEMO_MODE=true`:

- 200: `/`, `/products/kayu-manis-premium`, `/cart`, `/login`, `/pages/shipping`, `/pages/returns`.
- 200: `/orders/ORD-20260713-8F3K?token=demo`, `/orders/ORD-20260713-8F3K/return`.
- 200: `/admin`, `/admin/orders`, `/admin/products`, `/admin/categories`, `/admin/inventory`, `/admin/shipments`, `/admin/returns`, `/admin/settings`, `/admin/audit`.
- 200: `/admin-login`, `/admin/products/new`, dan `/admin/orders/ORD-20260713-8F3K`.
- 307 aman menuju login: `/checkout`, `/user`, `/user/orders`, `/user/addresses`, dan `/user/payment` tanpa session.
- 404 pada `/admin/products/prd_01` karena repository demo tidak menyediakan data edit; route dan form tetap terkompilasi serta diaudit dari source.
- 500 pada `/admin/users` dan detail retur demo tanpa `DATABASE_URL`. Halaman tersebut memanggil Prisma secara langsung. Source UI tetap diaudit. Perilaku data tidak diubah karena pekerjaan ini dibatasi pada presentasi.

Rincian audit visual dan state per halaman tersedia di `docs/ui-audit.md`.

## Verifikasi UI 16 Juli 2026

- Metadata dan branding storefront, login, footer, serta admin konsisten dengan REMPAHKARTA.
- Aset demo pakaian diganti dengan crop non-destruktif dari aset rempah yang sudah tersedia di proyek.
- Rasio seluruh media commerce, galeri, thumbnail, dan bukti distandardisasi ke 1:1.
- Enam PNG demo diperiksa hingga level decoder; seluruhnya valid dan persegi.
- Token warna, radius, shadow, tipografi, button, input, card, status pill, tabel, dan empty state dipusatkan di `app/globals.css`.
- Storefront, detail produk, checkout, tracking, akun, return form, dan admin memperoleh aturan responsive yang konsisten.
- Navigasi admin desktop dapat diciutkan dan mobile memakai drawer off-canvas dengan state terpisah; tidak ada route baru.
- Seluruh tabel admin memiliki wrapper overflow terisolasi; filter, navigation rail, dan progress yang sengaja scroll tidak menyebabkan overflow body.
- Style statis pada halaman status, action rail, cart, return, checkout, account, dan login dipusatkan sebagai class; inline style tersisa hanya nilai dinamis slider/background.
- Focus ring, reduced motion, target sentuh, label tombol ikon, dan status nonwarna dipertahankan atau diperkuat.
- `DESIGN.md` dipatenkan sebagai sumber acuan untuk token, komponen, page pattern, state matrix, aksesibilitas, dan definition of done.

Cloud browser pada lingkungan pengujian menolak URL lokal berdasarkan kebijakan akses. Karena itu, screenshot halaman aktual tidak dapat diambil secara sah dari runtime ini. Verifikasi yang dapat dilakukan mencakup source audit, render HTTP, TypeScript, lint, unit test, dan production build.

Upload lokal diuji dengan PNG 1.674.582 byte: MIME/signature valid, file tersimpan pada `/uploads/products/...`, dapat dibaca, lalu artefak uji dibersihkan.

## Cloudflare Turnstile

Siteverify resmi diuji memakai test site/secret key Cloudflare. Dummy token diterima. Implementasi API bersifat fail-closed: token kosong, provider error, hasil gagal, atau action mismatch ditolak.

## Biteship testing live

API key testing yang diberikan pemilik digunakan secara sementara dan tidak disimpan ke source/env/arsip.

- Maps origin `55664`: lulus, Area ID `IDNP5IDNC206IDND1764IDZ55664` (Sentolo, Kulon Progo).
- Maps destination `55281`: lulus, Area ID `IDNP5IDNC412IDND5043IDZ55281` (Depok, Sleman).
- Rates `jne`: lulus; JTR Rp60.000, REG Rp9.000, YES Rp13.000 pada payload uji 120 gram.
- Create order sandbox: lulus, status `confirmed`.
- Retrieve order dan tracking: lulus.
- Cancellation reasons: lulus, 9 alasan.
- Cancel order: lulus.
- Retrieve sesudah cancel: lulus, status final `cancelled`.
- Reference: `AMK-REMPAH-E2E-1784039184433`.

## BSTN

BSTN live tidak dipanggil karena pengujian transaksi diminta memakai payment mock. Kontrak create/get/cancel, item total, idempotency, webhook HMAC, GET confirmation, dan finish URL telah dipertahankan sesuai dokumen API yang diberikan.

## Database dan batasan E2E

Percobaan `prisma db push` ke host MySQL yang diberikan gagal sebelum autentikasi karena jaringan lingkungan pengembangan tidak memiliki rute ke server tersebut. Tidak ada perubahan atau data uji yang masuk ke database tersebut.

Akibatnya, flow database riil `reserve → mock paid → processing → packed → booking → delivered` dan variasi cancel tidak dapat dieksekusi terhadap MySQL live dari lingkungan ini. Logika transisi, inventory, API, build, HTTP demo, Turnstile, dan provider Biteship sudah diuji. Langkah terakhir di jaringan pemilik:

```bash
npm install
npm run setup
npm run dev
```

Lalu aktifkan `PAYMENT_MOCK=true` untuk smoke test database. Setelah lolos, kembalikan `PAYMENT_MOCK=false`.
