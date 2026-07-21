# Implementation Plan: Fitur Kode Voucher AMK Store / REMPAHKARTA

Dokumen ini berisi pemetaan arsitektur, skema basis data, alur kalkulasi transaksi, validasi keamanan, komponen antarmuka (UI), endpoint API, serta jadwal pembaruan dokumentasi untuk fitur **Kode Voucher** pada aplikasi REMPAHKARTA.

---

## 1. Skema Prisma Database (`prisma/schema.prisma`)

### A. Enum Baru
```prisma
enum VoucherStatus {
  ACTIVE
  PAUSE
  FINISH
}

enum VoucherAvailable {
  public
  private
}

enum VoucherMode {
  NOMINAL
  PERCENTAGE
}

enum VoucherTarget {
  TOTAL
  PRODUCT_SUBTOTAL
  SHIPPING
}
```

### B. Model `Voucher` & `VoucherUsage`
```prisma
model Voucher {
  id            String           @id @default(cuid())
  name          String           @db.VarChar(160)
  description   String?          @db.Text
  code          String           @unique @db.VarChar(50)
  status        VoucherStatus    @default(ACTIVE)
  available     VoucherAvailable @default(public)
  mode          VoucherMode      @default(NOMINAL)
  discountValue BigInt
  minPurchase   BigInt?
  maxDiscount   BigInt?
  dailyLimit    Int?
  totalLimit    Int?
  userLimit     Int?
  totalUsage    Int              @default(0)
  startAt       DateTime?
  endAt         DateTime?
  target        VoucherTarget    @default(TOTAL)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  orders        Order[]
  usages        VoucherUsage[]

  @@index([status, available, code])
  @@index([endAt, status])
}

model VoucherUsage {
  id             String   @id @default(cuid())
  voucherId      String
  orderId        String   @unique
  userId         String
  discountAmount BigInt
  createdAt      DateTime @default(now())

  voucher        Voucher  @relation(fields: [voucherId], references: [id], onDelete: Cascade)
  order          Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([voucherId, userId])
  @@index([voucherId, createdAt])
}
```

### C. Penyesuaian Model `Order`
Tambahkan relasi & field snapshot voucher pada model `Order`:
```prisma
// Di dalam model Order (prisma/schema.prisma):
  voucherId      String?
  voucherCode    String?        @db.VarChar(50)
  discountAmount BigInt         @default(0)
  voucherTarget  VoucherTarget?
  voucher        Voucher?       @relation(fields: [voucherId], references: [id], onDelete: SetNull)
  voucherUsage   VoucherUsage?

  @@index([voucherId])
```

> **Prosedur Migrasi DB:**
> Jalankan `npm run db:migrate` (atau `npx prisma migrate dev --name add_vouchers`). Tanpa seeding database production/existing.

---

## 2. Logic Validasi & Kalkulasi (`lib/voucher.ts`)

Buat modul helper baru `lib/voucher.ts` untuk menangani kalkulasi dan evaluasi voucher secara terpusat:

### A. Lazy Evaluation & Expired Checking
- Saat query/check voucher:
  - Jika `status === "ACTIVE"` dan `endAt` telah lampau (`endAt <= now`) ATAU `totalLimit` tercapai (`totalLimit !== null && totalUsage >= totalLimit`):
    - Lakukan update status voucher menjadi `"FINISH"` di database.
    - Anggap voucher tidak dapat digunakan (`status === "FINISH"`).

### B. Aturan Validasi Voucher (`evaluateVoucher`)
1. **Status Saklar Utama**: Harus `ACTIVE`. Jika `PAUSE` atau `FINISH` -> Tolak.
2. **Mulai & Berakhir (WIB/UTC)**:
   - Jika `startAt` terisi & `now < startAt` -> Tolak ("Promo belum dimulai").
   - Jika `endAt` terisi & `now > endAt` -> Status ubah ke `FINISH`, Tolak ("Promo telah berakhir").
3. **Limit Keseluruhan**:
   - Jika `totalLimit` terisi & `totalUsage >= totalLimit` -> Status ubah ke `FINISH`, Tolak ("Kuota voucher sudah habis").
4. **Limit Harian Total**:
   - Hitung `VoucherUsage` untuk `voucherId` pada rentang hari WIB saat ini (`00:00:00 WIB` s.d. `23:59:59 WIB`).
   - Jika `dailyLimit` terisi & `currentDailyCount >= dailyLimit` -> Tolak ("Kuota harian voucher sudah habis").
5. **Limit Per User**:
   - Hitung `VoucherUsage` untuk `voucherId` dan `userId` terkait.
   - Jika `userLimit` terisi & `currentUserCount >= userLimit` -> Tolak ("Batas penggunaan voucher per akun telah tercapai").
6. **Minimum Nominal Dasar**:
   - Berdasarkan `target` (`TOTAL`, `PRODUCT_SUBTOTAL`, `SHIPPING`), periksa nominal pembelian dasar.
   - Jika `minPurchase` terisi & baseAmount < minPurchase -> Tolak ("Minimal pembelian belum terpenuhi").

### C. Formulas & Rules Kalkulasi Diskon
1. Nominal Acuan (`targetAmount`):
   - `TOTAL`: `subtotal + shippingFee`
   - `PRODUCT_SUBTOTAL`: `subtotal`
   - `SHIPPING`: `shippingFee`
2. Perhitungan Diskon Kotor (`rawDiscount`):
   - Mode `NOMINAL`: `rawDiscount = discountValue`
   - Mode `PERCENTAGE`: `rawDiscount = Math.floor(targetAmount * (discountValue / 100))`
3. Batasan Maksimal Diskon (`maxDiscount`):
   - Jika `maxDiscount` terisi (> 0), `calculatedDiscount = Math.min(rawDiscount, maxDiscount)`.
   - Selain itu, `calculatedDiscount = rawDiscount`.
4. Batasan Maksimal dari Acuan:
   - `finalDiscount = Math.min(calculatedDiscount, targetAmount)`.
5. Pengaruh pada Invoice & BSTN:
   - `netBaseAmount = Math.max(0, subtotal + shippingFee - finalDiscount)`.
   - `feeBreakdown = calculateServiceFee(netBaseAmount)`.
   - `grandTotal = feeBreakdown.grandTotal`.
   - Item BSTN: Tambahkan line item penyesuaian diskon `{ id: "VOUCHER_DISCOUNT", name: "Diskon Voucher (" + code + ")", price: -finalDiscount, quantity: 1 }` sehingga total harga item BSTN persis sama dengan `bstnAmount`.

---

## 3. Endpoints API Baru & Terdampak

| Method | Endpoint | Fungsi | Autentikasi / Rate Limit |
| --- | --- | --- | --- |
| `POST` | `/api/vouchers/check` | Validasi & hitung kalkulasi potongan voucher di halaman checkout | Customer session + Turnstile + Rate limit (15 req/min) |
| `GET` | `/api/vouchers/public` | Ambil daftar voucher publik (`available=public`, `status=ACTIVE`) untuk storefront | Publik + Server Cache / Tag invalidation |
| `GET` | `/api/admin/vouchers` | Mendapatkan list voucher admin (dengan search, filter status, pagination) | Admin session (`requireAdmin()`) |
| `POST` | `/api/admin/vouchers` | Membuat voucher baru | Admin session |
| `GET` | `/api/admin/vouchers/[id]` | Detail voucher & riwayat penggunaan (order & customer) | Admin session |
| `PUT` | `/api/admin/vouchers/[id]` | Memperbarui data voucher | Admin session |
| `POST` | `/api/admin/vouchers/[id]/duplicate` | Menudplikasi voucher yang ada dengan kode baru | Admin session |
| `POST` | `/api/cron/vouchers` | Cron job harian/berkala untuk memperbarui status voucher expired menjadi `FINISH` | Cron Secret / Admin auth |
| `POST` | `/api/checkout/orders` | Checkout pesanan (diperbarui untuk memproses `voucherCode`, melakukan validasi server-side authoritative dalam transaksi MySQL, simpan usage & kurangi kuota) | Customer session + Turnstile + Rate limit |

---

## 4. Pembaruan Komponen & UI

### A. Halaman Checkout (`components/checkout-form.tsx`)
- **Posisi Kode Baru**: Tepat di atas `<div className="summary-line total"><span>Total invoice</span>...</div>` (garis 428).
- **Elemen UI**:
  - Input field kode voucher dengan placeholder "Masukkan kode promo" (input uppercase).
  - Tombol **'CEK'** (`button-light`).
  - State indikator feedback (loading spinner, pesan error jika invalid, badge diskon jika valid).
  - Tombol Hapus/Batal Voucher jika voucher sudah terpasang.
- **Rincian Ringkasan**:
  - Tambahkan baris `<div className="summary-line voucher-discount"><span>Diskon Promo ({appliedVoucher.code})</span><span>- Rp X.XXX</span></div>`.
  - Update kalkulasi `Total invoice` secara dinamis sesuai hasil potongan voucher.

### B. Storefront Homepage Marquee (`components/public-voucher-marquee.tsx` & `app/page.tsx`)
- **Posisi Kode Baru**: Di `app/page.tsx` tepat setelah penutup `<section className="catalog-section">` (garis 119).
- **Elemen UI**:
  - Carousel / Marquee horizontal otomatis yang berjalan (marquee animation).
  - Berhenti saat di-hover / touch (`hover:pause`).
  - Kartu voucher bersih (light mode editorial sesuai `DESIGN.md`), menampilkan Badge Diskon (misal: "Diskon 10%" / "Potongan Rp 20rb"), Nama Promo, Kode Promo, Minimum Pembelian/Masa Berlaku, dan tombol **"Salin Kode"** dengan efek feedback visual ("Tersalin!").

### C. Panel Admin Voucher (`app/admin/vouchers/page.tsx` & `components/admin-voucher-manager.tsx`)
- **Navigasi Admin Shell (`components/admin-shell.tsx`)**:
  - Tambahkan menu `"Voucher"` dengan ikon `Ticket` dari `lucide-react` pada grup `"Operasional"` (garis 35).
- **Halaman `app/admin/vouchers/page.tsx`**:
  - Tabel daftar voucher dengan kolom: Kode, Nama, Mode & Diskon, Kuota/Penggunaan, Berlakunya, Status Pill (`ACTIVE` - hijau, `PAUSE` - kuning, `FINISH` - merah), Available (`public`/`private`), dan Aksi.
  - Form Modal Multi-Fungsi:
    - Tambah Voucher Baru.
    - Edit Voucher.
    - Duplikat Voucher.
    - Lihat Riwayat Penggunaan Voucher (Order number, Nama user, Nominal diskon, Tanggal).
    - Toggle Saklar Utama Status (`ACTIVE` / `PAUSE` / `FINISH`).

### D. Tampilan Detail Pesanan Pelanggan & Admin
- **`lib/admin-data.ts` (`getAdminOrderDetail`)**:
  - Sertakan `voucherCode`, `discountAmount`, `voucherTarget` pada payload detail order.
- **Tampilan Admin Order Detail (`app/admin/orders/[number]/page.tsx`)**:
  - Pada section Ringkasan, tambahkan baris `Diskon Voucher (CODE): - Rp X.XXX`.
- **Tampilan Pelanggan Order Detail (`app/orders/[number]/page.tsx`)**:
  - Pada tabel rincian pembayaran, tambahkan baris `Diskon Promo (CODE): - Rp X.XXX`.

---

## 5. Peta File Terdampak & Perubahan

1. `prisma/schema.prisma`: Penambahan Enum `VoucherStatus`, `VoucherAvailable`, `VoucherMode`, `VoucherTarget`, model `Voucher`, `VoucherUsage`, dan penyesuaian model `Order`.
2. `lib/voucher.ts` *(Baru)*: Logika evaluator voucher, kalkulator diskon, lazy expiration update, dan validasi transaksi DB.
3. `app/api/vouchers/check/route.ts` *(Baru)*: Endpoint pengecekan voucher checkout.
4. `app/api/vouchers/public/route.ts` *(Baru)*: Endpoint publik katalog voucher storefront.
5. `app/api/admin/vouchers/route.ts` *(Baru)*: Endpoint GET list & POST create voucher admin.
6. `app/api/admin/vouchers/[id]/route.ts` *(Baru)*: Endpoint GET detail, PUT update admin.
7. `app/api/admin/vouchers/[id]/duplicate/route.ts` *(Baru)*: Endpoint duplicate voucher admin.
8. `app/api/cron/vouchers/route.ts` *(Baru)*: Endpoint cron pembaru status expired voucher.
9. `lib/repositories/order-repository.ts`: Penyesuaian `createOrderWithReservation` untuk validasi voucher transactional & pembuatan `VoucherUsage`.
10. `app/api/checkout/orders/route.ts`: Penyesuaian skema Zod checkout & penambahan line item diskon voucher pada pembuatan payment BSTN.
11. `components/checkout-form.tsx`: Penambahan input voucher & tombol 'CEK' di atas line Total Invoice, penyesuaian ringkasan kalkulasi invoice.
12. `components/public-voucher-marquee.tsx` *(Baru)*: Komponen marquee kartu voucher publik beranda storefront.
13. `app/page.tsx`: Penambahan `<PublicVoucherMarquee />` tepat setelah `catalog-section`.
14. `components/admin-shell.tsx`: Penambahan item menu "Voucher" pada sidebar admin operasional.
15. `app/admin/vouchers/page.tsx` *(Baru)*: Halaman pengelolaan voucher admin.
16. `components/admin-voucher-manager.tsx` *(Baru)*: Komponen manajer CRUD & riwayat penggunaan voucher.
17. `lib/admin-data.ts`: Penyesuaian `getAdminOrderDetail` untuk menyertakan rincian diskon voucher.
18. `app/admin/orders/[number]/page.tsx`: Penambahan baris rincian diskon voucher pada ringkasan order admin.
19. `app/orders/[number]/page.tsx`: Penambahan baris rincian diskon voucher pada ringkasan order pelanggan.
20. `README.md` & `/docs/*` (`architecture.md`, `system-map.md`, `security-api-audit.md`, `ui-audit.md`): Pembaruan dokumentasi proyek agar selalu valid dan up-to-date.

---

## 6. Verifikasi & Pengujian (Definition of Done)

1. `npm run lint` - Lulus tanpa warning/error linting baru.
2. `npm test` - Seluruh unit/integration test lulus.
3. `npm run build` - Production build Next.js lulus.
4. Validasi Flow Manual & Transaksional:
   - Pembuatan voucher di admin (Public/Private, Mode Nominal/Persentase, Target Total/Subtotal/Ongkir, Limit harian/total/user).
   - Penampilan Marquee Voucher Publik di halaman depan storefront.
   - Pengecekan kode promo di checkout & kalkulasi Total Invoice.
   - Checkout sukses dengan diskon voucher & pembentukan pembayaran BSTN yang valid (total items == amount).
   - Pengurangan kuota voucher & pencegahan pembatalan/double use melebihi limit.
   - Penampilan detail diskon voucher pada order pelanggan dan panel admin.
   - Evaluasi otomatis (lazy evaluation) & cron job untuk voucher kedaluwarsa.
5. Pembaruan README.md & dokumentasi `/docs` selesai.
