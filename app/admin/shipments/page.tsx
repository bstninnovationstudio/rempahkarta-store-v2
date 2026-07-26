import { AdminShippingView } from "@/components/admin-shipping-view";
import { getShippingConfig } from "@/lib/admin-shipping-config";

export const dynamic = "force-dynamic";

export default async function AdminShipmentsPage() {
  const initialConfig = await getShippingConfig();

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Operasional & Pengiriman</p>
          <h1>Pengaturan Pengiriman & Gudang</h1>
          <p>Atur ekspedisi kurir aktif dan alamat gudang penjemputan utama. Perubahan langsung tersimpan ke lingkungan sistem (ENV) tanpa menghentikan server.</p>
        </div>
      </div>

      <AdminShippingView initialConfig={initialConfig} />
    </div>
  );
}
