# Printable Thermal Shipping Label A6

Komponen label pengiriman React/Next.js berukuran thermal A6 (100 mm × 150 mm), lengkap dengan barcode CODE128 dan tombol cetak/simpan PDF.

## Instalasi

```bash
npm install react-barcode
```

`react-barcode` versi modern sudah menyertakan deklarasi TypeScript sendiri.

Salin `ShippingLabel.tsx` dan `ShippingLabel.module.css` ke folder komponen proyek. Untuk mencoba cepat pada Next.js App Router, salin isi `page.example.tsx` ke halaman yang diinginkan dan sesuaikan lokasi import.

## Logo kurir

Komponen mencari logo berdasarkan nama kurir pada path berikut:

```text
/public/shipping-logos/[nama-kurir-dalam-format-slug].png
```

Contoh `courierCompany: "SAP Express"` akan mencari:

```text
/public/shipping-logos/sap-express.png
```

Jika aset tidak ditemukan, nama kurir otomatis ditampilkan sebagai fallback sehingga header tetap utuh.

## Cetak atau simpan PDF

Klik **Cetak Resi / Simpan PDF**, lalu pada dialog browser:

1. Pilih printer thermal atau **Save as PDF**.
2. Gunakan ukuran kertas **100 × 150 mm / 4 × 6 inch**.
3. Set margin ke **None/Tidak ada**.
4. Set scale ke **100%**.
5. Nonaktifkan **Headers and footers**.

CSS `@page` dan `@media print` sudah mengunci hasil menjadi satu halaman 100 × 150 mm. Dialog cetak tertentu tetap dapat memakai pengaturan bawaan driver, sehingga ukuran kertas printer perlu dipilih sekali pada driver.

## Catatan integrasi

- Komponen adalah Client Component karena menggunakan `window.print()` dan fallback logo.
- Barcode memakai SVG CODE128 agar tetap tajam pada printer thermal.
- Hanya area label yang terlihat saat print; komponen lain pada halaman disembunyikan.
- `routingCode` otomatis memakai kode pos penerima jika nilainya kosong.
- Nominal COD diformat sebagai Rupiah Indonesia.
