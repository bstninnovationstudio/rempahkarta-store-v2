import { CheckCircle2, CircleAlert } from "lucide-react";
import { isProduction, getBstnApiKey, getBiteshipApiKey } from "@/lib/env";

function State({ ready, label }: { ready: boolean; label: string }) {
  return <div><span>{label}</span><strong className={`status-pill ${ready ? "status-paid" : "status-pending"}`}>{ready ? "Siap" : "Belum diisi"}</strong></div>;
}

export default function Settings() {
  const mode = process.env.APP_MODE || "development";
  const bstnKey = getBstnApiKey();
  const biteshipKey = getBiteshipApiKey();
  const bstnReady = Boolean(bstnKey);

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div><p className="eyebrow">Konfigurasi sistem</p><h1>Pengaturan</h1><p>Ringkasan konfigurasi operasional dari lingkungan server.</p></div>
      </div>
      <div className="admin-detail-grid">
        <div>
          <section className="admin-section">
            <h2>Operasional toko</h2>
            <div className="detail-list">
              <div><span>Mode Aplikasi</span><strong>{mode} ({isProduction() ? "Production" : "Development"})</strong></div>
              <div><span>Nama gudang</span><strong>{process.env.WAREHOUSE_NAME || "Gudang Utama REMPAHKARTA"}</strong></div>
              <div><span>Kontak penjemputan</span><strong>{process.env.WAREHOUSE_CONTACT_NAME || "Belum diisi"}</strong></div>
              <div><span>Telepon</span><strong>{process.env.WAREHOUSE_CONTACT_PHONE || "Belum diisi"}</strong></div>
              <div><span>Alamat</span><strong>{process.env.WAREHOUSE_ADDRESS || "Belum diisi"}</strong></div>
              <div><span>Kurir aktif</span><strong>{process.env.ENABLED_COURIERS || "jne,sicepat,anteraja,jnt"}</strong></div>
            </div>
          </section>
          <section className="admin-section">
            <h2>Kebijakan tetap</h2>
            <div className="detail-list">
              <div><span>Batas pengajuan retur</span><strong>7 hari setelah pesanan diterima</strong></div>
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
              <State ready={bstnReady} label={`BSTN Payment (${isProduction() ? "LIVE" : "DEV"})`} />
              <State ready={Boolean(biteshipKey)} label={`Biteship (${isProduction() ? "LIVE" : "DEV"})`} />
              <State ready={Boolean(process.env.DATABASE_URL)} label="MySQL" />
            </div>
          </section>
          <section className="admin-section">
            <h2>
              {!bstnReady
                ? <CircleAlert size={16} aria-hidden="true" />
                : <CheckCircle2 size={16} aria-hidden="true" />}
              Mode pembayaran
            </h2>
            <p className={`settings-note ${!bstnReady ? "tone-warning" : "tone-success"}`}>
              {bstnReady
                ? `BSTN (${isProduction() ? "Production Key" : "Development Key"}) siap digunakan.`
                : `BSTN Key belum diisi untuk mode ${mode}.`}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
