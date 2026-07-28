import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pengiriman",
  description: "Tarif, estimasi, kurir, dan layanan dihitung berdasarkan alamat serta dimensi paket saat checkout.",
  alternates: { canonical: "/pages/shipping" },
};

export default function ShippingPage() {
  return (
    <>
      <StoreHeader />
      <main className="simple-page policy-page">
        <div className="page-title"><p className="eyebrow">Bantuan</p><h1>Pengiriman</h1></div>
        <article className="panel policy-panel">
          <h2>Pengiriman oleh Biteship</h2>
          <p>Tarif, estimasi, kurir, dan layanan dihitung berdasarkan alamat serta dimensi paket saat checkout. Setelah paket diserahkan kepada kurir, status dan resi akan diperbarui otomatis pada halaman pesanan Anda.</p>
          <h2>Pickup &amp; drop-off</h2>
          <p>Metode penyerahan paket dipilih tim fulfillment sesuai layanan kurir. Pelanggan tidak perlu mengatur pickup untuk pesanan pembelian.</p>
        </article>
      </main>
      <StoreFooter />
    </>
  );
}
