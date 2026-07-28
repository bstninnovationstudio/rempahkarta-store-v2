import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Retur & refund",
  description: "Ajukan masalah dari halaman pesanan Anda. Pilih produk, alasan, lalu unggah bukti foto/video.",
  alternates: { canonical: "/pages/returns" },
};

export default function ReturnsPage() {
  return (
    <>
      <StoreHeader />
      <main className="simple-page policy-page">
        <div className="page-title"><p className="eyebrow">Bantuan</p><h1>Retur &amp; refund</h1></div>
        <article className="panel policy-panel">
          <h2>Retur dalam 7 hari</h2>
          <p>Ajukan masalah dari halaman pesanan Anda. Pilih produk, alasan, lalu unggah bukti foto/video. Setelah disetujui, pilih pickup atau drop-off yang tersedia dan lacak paket retur langsung di aplikasi.</p>
          <h2>Refund manual</h2>
          <p>Refund diproses manual setelah barang diterima dan lolos inspeksi. Nomor referensi dan bukti refund akan ditambahkan oleh tim finance ke kasus retur Anda.</p>
        </article>
      </main>
      <StoreFooter />
    </>
  );
}
