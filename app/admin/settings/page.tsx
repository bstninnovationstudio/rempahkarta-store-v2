import { CheckCircle2, CircleAlert } from "lucide-react";

function State({ ready, label }: { ready: boolean; label: string }) {
  return <div><span>{label}</span><strong className={ready ? "tone-success" : "tone-warning"}>{ready ? "Siap" : "Belum diisi"}</strong></div>;
}

export default function Settings() {
  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div><p className="eyebrow">System configuration</p><h1>Pengaturan</h1><p>Ringkasan konfigurasi ringan dari environment server.</p></div>
      </div>
      <div className="admin-detail-grid">
        <div>
          <section className="admin-section">
            <h2>Operasional toko</h2>
            <div className="detail-list">
              <div><span>Nama gudang</span><strong>{process.env.WAREHOUSE_NAME || "Gudang Utama AMK"}</strong></div>
              <div><span>Kontak pickup</span><strong>{process.env.WAREHOUSE_CONTACT_NAME || "Belum diisi"}</strong></div>
              <div><span>Telepon</span><strong>{process.env.WAREHOUSE_CONTACT_PHONE || "Belum diisi"}</strong></div>
              <div><span>Alamat</span><strong>{process.env.WAREHOUSE_ADDRESS || "Belum diisi"}</strong></div>
              <div><span>Kurir aktif</span><strong>{process.env.ENABLED_COURIERS || "jne,sicepat,anteraja,jnt"}</strong></div>
            </div>
          </section>
          <section className="admin-section">
            <h2>Kebijakan tetap</h2>
            <div className="detail-list">
              <div><span>Batas pengajuan retur</span><strong>7 hari setelah delivered</strong></div>
              <div><span>Selisih ongkir aktual</span><strong>Ditanggung toko</strong></div>
              <div><span>Refund</span><strong>Dicatat manual oleh admin</strong></div>
              <div><span>Media</span><strong>public/uploads (lokal)</strong></div>
            </div>
          </section>
        </div>
        <aside>
          <section className="admin-section">
            <h2>Status integrasi</h2>
            <div className="detail-list">
              <State ready={process.env.PAYMENT_MOCK === "true" || Boolean(process.env.BSTN_PROJECT_API_KEY)} label={process.env.PAYMENT_MOCK === "true" ? "Payment mock" : "BSTN Payment"} />
              <State ready={Boolean(process.env.BITESHIP_API_KEY)} label="Biteship" />
              <State ready={Boolean(process.env.DATABASE_URL)} label="MySQL" />
            </div>
          </section>
          <section className="admin-section">
            <h2>{process.env.PAYMENT_MOCK === "true" ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />} Mode pembayaran</h2>
            <p className="settings-note">{process.env.PAYMENT_MOCK === "true" ? "Mode mock aktif. Ubah PAYMENT_MOCK=false sebelum memakai BSTN." : "BSTN aktif; status paid hanya diterima setelah verifikasi webhook atau sinkronisasi server."}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
