import { StoreHeader } from "@/components/store-header";

export default function ShippingPage() {
  return (
    <>
      <StoreHeader />
      <main className="simple-page policy-page">
        <div className="page-title"><p className="eyebrow">Bantuan</p><h1>Pengiriman</h1></div>
        <section className="panel policy-panel">
          <h2>Pengiriman oleh Biteship</h2>
          <p>Tarif, estimasi, kurir, dan layanan dihitung berdasarkan alamat serta dimensi paket saat checkout. Setelah paket diserahkan kepada kurir, status dan resi akan diperbarui otomatis pada halaman pesanan Anda.</p>
          <h2>Pickup &amp; drop-off</h2>
          <p>Metode penyerahan paket dipilih tim fulfillment sesuai layanan kurir. Pelanggan tidak perlu mengatur pickup untuk pesanan pembelian.</p>
        </section>
      </main>
    </>
  );
}
